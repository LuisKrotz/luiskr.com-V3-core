/**
 * @file utils/gpu/ring-sheen.ts — the WebGPU mount for the tile
 * border-sheen ring. `.home-mosaic-item` and `.related-mosaic-item`
 * each carry two masked pseudo-element layers (`::after` static ring,
 * `::before` opacity-pulsed sheen on a 9s alternate loop). This module
 * replaces both layers grid-wide with ONE overlay canvas: per-tile
 * rects stream down a storage sheet and `rust/ring-sheen` draws every
 * ring as an instanced SDF quad — one draw call instead of 2·N
 * compositor layers.
 *
 * Mount contract:
 *
 *   - Capability gate: no `navigator.gpu`, a failed artifact, or
 *     `prefers-reduced-motion` leave the CSS rings untouched.
 *   - Deferred mount: an IntersectionObserver defers the artifact
 *     fetch until the container first enters the viewport.
 *   - Dirty-tracked resheets: tile rects live on transitioning cards
 *     (hover expand, masonry repacks), so the sheet re-measures only
 *     while a transition or ResizeObserver marks the wall dirty —
 *     idle frames cost one flag check + one frame call.
 *   - The `:has(> canvas:not(.is-fallback))` stylesheet gate hides
 *     the pseudo rings once live; a mount that never resolves keeps
 *     `is-fallback` and the CSS rings stay.
 */

import { THEME_CSS_PROPS } from '@core/tokens/css/theme.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { MEDIA_QUERIES } from '@core/tokens/primitives.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { ANIMATION_EVENTS, CLIPBOARD_EVENTS } from '@core/tokens/events/dom.js'
import { parseCssColor } from '@core/utils/canvas/css-color.js'
import { GPU_WIDGET_DRIVE, GPU_WIDGET_KINDS } from '@core/tokens/motion/gpu-widgets.js'
import { hasWebGpu, mountWebGpuWidget } from '@core/utils/gpu/webgpu-widget.js'
import { applyAnimationDesc } from '@core/utils/a11y/animation-desc.js'
import { ANIMATION_IDS } from '@core/tokens/data/animation-ids.js'
import type { WidgetHandle } from '@core/utils/gpu/webgpu-widget.js'

/** Tile-sheet stride — mirrors rust/ring-sheen's `TILE_F32S`. */
const TILE_F32S = 8

/**
 * Kind-specific wasm surface for the ring-sheen crate — typed on top
 * of the generic WasmWidget so calls stay checked.
 */
interface RingSheenWasm {
  /** Per-tile sheet — 8 f32s: rect x,y,w,h · radius · phase · pad×2 (device px). */
  set_tiles: (values: Float32Array) => number
  /** Ring edge + sheen core rgba 0-1 + hairline half-width (device px). */
  set_colors: (
    er: number,
    eg: number,
    eb: number,
    ea: number,
    ar: number,
    ag: number,
    ab: number,
    aa: number,
    hair: number
  ) => void
}

/** Live ring-sheen overlay — the return surface callers hold. */
export interface RingSheenSession {
  /** Re-measure tiles + repush the sheet NOW (host-driven repacks). */
  refresh: () => void
  /** Tear down canvas/widget/observers/listeners. */
  destroy: () => void
}

/**
 * `mountRingSheen` — overlays one instanced ring canvas on a tile
 * container. Returns null when the surface can't mount (no GPU, no
 * IntersectionObserver, reduced motion) — the CSS rings stay.
 * @param container The positioned ancestor the canvas fills
 *   (`.home-mosaic` / `.related-mosaic`).
 * @param tilesSelector Class selector for the ringed tiles.
 * @param canvasClass Overlay canvas class (the `:has()` gate keys on it).
 * @returns A session handle, or null when nothing was mounted.
 */
export function mountRingSheen(
  container: HTMLElement,
  tilesSelector: string,
  canvasClass: string
): RingSheenSession | null {
  if (!container) return null

  // The tile ring sheen runs as CSS rings even without WebGPU — the
  // description binds to the container before the capability guard.
  applyAnimationDesc(container, ANIMATION_IDS.RING_SHEEN)

  if (
    !hasWebGpu() ||
    typeof document === TYPE_STRINGS.UNDEFINED ||
    typeof window === TYPE_STRINGS.UNDEFINED ||
    (window.matchMedia && window.matchMedia(MEDIA_QUERIES.PREFERS_REDUCED_MOTION).matches)
  ) {
    return null
  }

  const canvas = document.createElement(HTML_TAGS.CANVAS) as HTMLCanvasElement

  canvas.setAttribute(ARIA_ATTRS.ARIA_HIDDEN, ATTR_VALUES.TRUE)
  canvas.className = `${canvasClass} ${STATE_CLASSES.IS_FALLBACK}`

  let handle: WidgetHandle | null = null
  let pending = false
  let failed = false
  let dead = false
  let raf = 0
  let last = 0
  /** True while tile geometry may be stale (transition/resize/repack). */
  let dirty = true

  const tiles = (): HTMLElement[] =>
    Array.from(container.querySelectorAll<HTMLElement>(tilesSelector))

  /**
   * Re-measures every tile against the container box and repushes the
   * sheet + backing size. Colors refresh too — theme flips restyle the
   * ring vars without a remount.
   * @param surface The live widget handle (callers run post-mount or post-guard).
   */
  const resheet = (surface: WidgetHandle) => {
    const dpr = window.devicePixelRatio || 1
    const box = container.getBoundingClientRect()
    const w = Math.max(1, Math.round(box.width * dpr))
    const h = Math.max(1, Math.round(box.height * dpr))

    canvas.width = w
    canvas.height = h

    surface.widget.resize(w, h)

    const list = tiles()
    const sheet = new Float32Array(list.length * TILE_F32S)

    list.forEach((tile, i) => {
      const r = tile.getBoundingClientRect()
      const rec = i * TILE_F32S
      const radius = parseFloat(getComputedStyle(tile).borderTopLeftRadius) || 0

      sheet[rec] = (r.left - box.left) * dpr
      sheet[rec + 1] = (r.top - box.top) * dpr
      sheet[rec + 2] = r.width * dpr
      sheet[rec + 3] = r.height * dpr
      sheet[rec + 4] = radius * dpr
      sheet[rec + 5] = 0
      sheet[rec + 6] = 0
      sheet[rec + 7] = 0
    })

    const wasm = surface.widget as unknown as RingSheenWasm
    const cs = getComputedStyle(container)
    const edge = parseCssColor(cs.getPropertyValue(THEME_CSS_PROPS.BORDER_ITEM_HOVER)) || [1, 1, 1]
    const accent = parseCssColor(cs.getPropertyValue(THEME_CSS_PROPS.COLOR_ACCENT_CONTRAST)) || [
      1, 1, 1,
    ]
    const hair = (parseFloat(cs.getPropertyValue(THEME_CSS_PROPS.SPACE_HAIRLINE)) || 1) * 0.5

    wasm.set_colors(edge[0], edge[1], edge[2], 1, accent[0], accent[1], accent[2], 1, hair * dpr)
    wasm.set_tiles(sheet)
  }

  /** The MANUAL rAF clock — resheets while dirty, then draws. */
  const tick = (now: number) => {
    raf = 0

    if (!handle || dead) return

    const dt = last ? (now - last) / 1000 : 0

    last = now

    // transitionLive keeps the sheet tracking mid-slide tiles that
    // never trip ResizeObserver (top/left-only moves).
    if (dirty || transitionLive) {
      dirty = transitionLive

      resheet(handle)
    }

    const alive = handle.widget.frame(dt) !== false

    if (alive && !dead && !document.hidden) {
      raf = requestAnimationFrame(tick)
    }
  }

  /** Schedules the next frame when idle (dirty flips, visibility return). */
  const poke = () => {
    if (!raf && !dead && handle && !document.hidden) {
      raf = requestAnimationFrame(tick)
    }
  }

  const mount = () => {
    if (pending || handle || failed || dead) return

    pending = true

    void mountWebGpuWidget(GPU_WIDGET_KINDS.RING_SHEEN, canvas, undefined, {
      drive: GPU_WIDGET_DRIVE.MANUAL,
    }).then((mounted) => {
      pending = false

      if (!mounted) {
        failed = true

        canvas.remove()

        return
      }

      if (dead) {
        mounted.destroy()

        canvas.remove()

        return
      }

      handle = mounted

      resheet(handle)

      canvas.classList.remove(STATE_CLASSES.IS_FALLBACK)

      // Continuous sheen — the clock runs while the surface lives
      // (paused via tick's document.hidden early-out).
      poke()
    })
  }

  const io =
    typeof IntersectionObserver !== TYPE_STRINGS.UNDEFINED
      ? new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) mount()
          }
        })
      : null

  /** Whether a tile transition is currently animating (keeps resheets flowing — top/left moves never fire ResizeObserver). */
  let transitionLive = false

  /** Marks the sheet stale — tile transitions + resizes both funnel here. */
  const markDirty = () => {
    dirty = true

    poke()
  }

  const onTransitionStart = () => {
    dirty = true

    transitionLive = true

    poke()
  }

  const onTransitionEnd = () => {
    transitionLive = false
  }

  const ro = typeof ResizeObserver !== TYPE_STRINGS.UNDEFINED ? new ResizeObserver(markDirty) : null

  const onVisible = () => {
    if (!document.hidden) poke()
  }

  // Tile set changes across renders — observe the container only; the
  // host calls refresh() after its own repack/re-render passes.
  ro?.observe(container)

  container.addEventListener(ANIMATION_EVENTS.TRANSITIONSTART, onTransitionStart, {
    passive: true,
  })
  container.addEventListener(ANIMATION_EVENTS.TRANSITIONEND, onTransitionEnd, {
    passive: true,
  })
  document.addEventListener(CLIPBOARD_EVENTS.VISIBILITY_CHANGE, onVisible)

  container.appendChild(canvas)

  if (io) {
    io.observe(container)
  } else {
    mount()
  }

  return {
    refresh: markDirty,
    destroy: () => {
      if (dead) return

      dead = true

      if (raf) cancelAnimationFrame(raf)
      raf = 0

      io?.disconnect()
      ro?.disconnect()

      container.removeEventListener(ANIMATION_EVENTS.TRANSITIONSTART, onTransitionStart)
      container.removeEventListener(ANIMATION_EVENTS.TRANSITIONEND, onTransitionEnd)
      document.removeEventListener(CLIPBOARD_EVENTS.VISIBILITY_CHANGE, onVisible)

      handle?.destroy()

      handle = null

      canvas.remove()
    },
  }
}
