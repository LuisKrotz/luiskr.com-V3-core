/**
 * @file utils/gpu/ring-fill.ts — the WebGPU mount for the route-search
 * go-button conic ring fill. Each `.route-search-go` button carries an
 * SVG ring whose `stroke-dashoffset` sweeps on hover/focus (the CSS
 * fallback). This module replaces all of them with ONE overlay canvas:
 * per-button centers + live progress go down a storage sheet and
 * `rust/ring-fill` draws every ring as an instanced SDF arc — one draw
 * call for the whole list.
 *
 * Mount contract:
 *
 *   - Capability gate: no `navigator.gpu`, a failed artifact, or
 *     `prefers-reduced-motion` leave the SVG rings untouched.
 *   - Deferred mount: an IntersectionObserver defers the artifact
 *     fetch until the list first enters the viewport.
 *   - Progress easing: `setProgress(i, 0|1)` sets a per-button target;
 *     the session eases each tile toward its target over ~350 ms while
 *     the rAF clock runs — idle frames cost zero draw submissions.
 *   - The `:has(> canvas:not(.is-fallback))` stylesheet gate hides the
 *     SVG fills once live; a mount that never resolves keeps
 *     `is-fallback` and the CSS rings stay authoritative.
 */

import { THEME_CSS_PROPS } from '@core/tokens/css/theme.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { MEDIA_QUERIES } from '@core/tokens/primitives.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { CLIPBOARD_EVENTS } from '@core/tokens/events/dom.js'
import { parseCssColor } from '@core/utils/canvas/css-color.js'
import { GPU_WIDGET_DRIVE, GPU_WIDGET_KINDS } from '@core/tokens/motion/gpu-widgets.js'
import { hasWebGpu, mountWebGpuWidget } from '@core/utils/gpu/webgpu-widget.js'
import { framePool } from '../motion/frame.js'
import type { WidgetHandle } from '@core/utils/gpu/webgpu-widget.js'

/** Tile-sheet stride — mirrors rust/ring-fill's `TILE_F32S`. */
const TILE_F32S = 8

/** Perimeter draw duration — the light tip travels the whole border. */
const FILL_SECONDS = 0.8

/**
 * Kind-specific wasm surface for the ring-fill crate — typed on top of
 * the generic WasmWidget so calls stay checked.
 */
interface RingFillWasm {
  /** Per-button sheet — 8 f32s: center x,y · radius · progress · phase · pad×3 (device px). */
  set_tiles: (values: Float32Array) => number
  /** Track + fill + head rgba 0-1 + hairline half-width (device px). */
  set_colors: (
    tr: number,
    tg: number,
    tb: number,
    ta: number,
    fr: number,
    fg: number,
    fb: number,
    fa: number,
    hr: number,
    hg: number,
    hb: number,
    ha: number,
    hair: number
  ) => void
}

/** Live ring-fill overlay — the return surface callers hold. */
export interface RingFillSession {
  /** Set one button's fill target (0 collapsed, 1 filled); eases over FILL_SECONDS. */
  setProgress: (_index: number, _target: number) => void
  /** Re-measure buttons + repush the sheet NOW (list re-renders). */
  refresh: () => void
  /** Tear down canvas/widget/observers/listeners. */
  destroy: () => void
}

/**
 * `mountRingFill` — overlays one instanced ring canvas on the results
 * list. Returns null when the surface can't mount (no GPU, no
 * IntersectionObserver, reduced motion) — the SVG rings stay.
 * @param container The positioned ancestor the canvas fills
 *   (`.route-search` results wrapper).
 * @param tilesSelector Class selector for the ringed go buttons.
 * @param canvasClass Overlay canvas class (the `:has()` gate keys on it).
 * @returns A session handle, or null when nothing was mounted.
 */
export function mountRingFill(
  container: HTMLElement,
  tilesSelector: string,
  canvasClass: string
): RingFillSession | null {
  if (!container) return null

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
  /** True while geometry may be stale (resize/re-render). */
  let dirty = true
  /** Per-tile eased progress — Float32Arrays keep the hot loop allocation-free. */
  let progress = new Float32Array(0)
  let targets = new Float32Array(0)

  const tiles = (): HTMLElement[] =>
    Array.from(container.querySelectorAll<HTMLElement>(tilesSelector))

  /**
   * Re-measures every button against the container box and repushes the
   * sheet + backing size. Progress values are preserved across
   * re-measures (the sheet is rebuilt, not the animation state).
   * @param surface The live widget handle.
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

    if (progress.length !== list.length) {
      const next = new Float32Array(list.length)
      const nextTargets = new Float32Array(list.length)

      next.set(progress.subarray(0, list.length))
      nextTargets.set(targets.subarray(0, list.length))

      progress = next
      targets = nextTargets
    }

    const sheet = new Float32Array(list.length * TILE_F32S)

    list.forEach((tile, i) => {
      const r = tile.getBoundingClientRect()
      const rec = i * TILE_F32S
      const cs = getComputedStyle(tile)
      const cornerR = parseFloat(cs.borderTopLeftRadius) || 0

      // Tile record — [0,1] center · [2] halfW · [3] halfH · [4] corner
      // radius · [5] progress · [6] shape (0=circle,1=rrect) · [7] pad.
      const halfW = r.width * 0.5
      const halfH = r.height * 0.5
      const isCircle = Math.abs(halfW - halfH) < 1 && cornerR >= halfW - 1

      sheet[rec] = (r.left - box.left + r.width * 0.5) * dpr
      sheet[rec + 1] = (r.top - box.top + r.height * 0.5) * dpr
      sheet[rec + 2] = halfW * dpr
      sheet[rec + 3] = halfH * dpr
      sheet[rec + 4] = cornerR * dpr
      sheet[rec + 5] = progress[i] || 0
      sheet[rec + 6] = isCircle ? 0 : 1
      sheet[rec + 7] = 0
    })

    const wasm = surface.widget as unknown as RingFillWasm
    const cs = getComputedStyle(container)
    const track = parseCssColor(cs.getPropertyValue(THEME_CSS_PROPS.BORDER_ITEM_HOVER)) || [1, 1, 1]
    const fill = parseCssColor(cs.getPropertyValue(THEME_CSS_PROPS.COLOR_ACCENT)) || [1, 1, 1]
    const head = parseCssColor(cs.getPropertyValue(THEME_CSS_PROPS.COLOR_ACCENT_CONTRAST)) || [
      1, 1, 1,
    ]
    const hair = (parseFloat(cs.getPropertyValue(THEME_CSS_PROPS.SPACE_HAIRLINE)) || 1) * 0.5

    wasm.set_colors(
      track[0],
      track[1],
      track[2],
      track[3] ?? 1,
      fill[0],
      fill[1],
      fill[2],
      1,
      head[0],
      head[1],
      head[2],
      1,
      hair * dpr
    )
    wasm.set_tiles(sheet)
  }

  /**
   * Advances every tile's progress toward its target by `dt` seconds
   * (linear ease — matches the CSS transition timing). Returns true
   * while any tile is still animating so the caller keeps the clock
   * running; the sheet is repushed each animating frame.
   * @param dt Frame delta in seconds.
   * @param surface The live widget handle (resheet source).
   * @returns True while animation is in flight.
   */
  const step = (dt: number, surface: WidgetHandle): boolean => {
    let moving = false
    const n = tiles().length

    for (let i = 0; i < n; i++) {
      const t = targets[i] || 0
      const p = progress[i] || 0

      if (p === t) continue

      const dir = t > p ? 1 : -1
      const next = p + dir * (dt / FILL_SECONDS)

      progress[i] = dir > 0 ? Math.min(next, t) : Math.max(next, t)
      moving = true
    }

    if (moving) resheet(surface)

    return moving
  }

  /** The MANUAL rAF clock — resheets while dirty, eases, then draws. */
  const tick = (now: number) => {
    raf = 0

    if (!handle || dead) return

    const dt = last ? (now - last) / 1000 : 0

    last = now

    if (dirty) {
      dirty = false

      resheet(handle)
    }

    const moving = step(dt, handle)

    const alive = handle.widget.frame(dt) !== false

    if (alive && !dead && !document.hidden && moving) {
      raf = framePool.request(tick)
    }
  }

  /** Schedules the next frame when idle (dirty flips, progress changes). */
  const poke = () => {
    if (!raf && !dead && handle && !document.hidden) {
      last = performance.now()
      raf = framePool.request(tick)
    }
  }

  const mount = () => {
    if (pending || handle || failed || dead) return

    pending = true

    void mountWebGpuWidget(GPU_WIDGET_KINDS.RING_FILL, canvas, undefined, {
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

      // One initial frame paints the track rings; later frames only run
      // while a progress animation or resheet is pending.
      handle.widget.frame(0)
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

  /** Marks geometry stale — list re-renders and resizes funnel here. */
  const markDirty = () => {
    dirty = true

    poke()
  }

  const ro = typeof ResizeObserver !== TYPE_STRINGS.UNDEFINED ? new ResizeObserver(markDirty) : null

  const onVisible = () => {
    if (!document.hidden) poke()
  }

  ro?.observe(container)

  document.addEventListener(CLIPBOARD_EVENTS.VISIBILITY_CHANGE, onVisible)

  container.appendChild(canvas)

  if (io) {
    io.observe(container)
  } else {
    mount()
  }

  return {
    setProgress: (index: number, target: number) => {
      if (index < 0 || index >= targets.length) return

      targets[index] = target

      poke()
    },
    refresh: markDirty,
    destroy: () => {
      if (dead) return

      dead = true

      if (raf) framePool.cancel(raf)
      raf = 0

      io?.disconnect()
      ro?.disconnect()

      document.removeEventListener(CLIPBOARD_EVENTS.VISIBILITY_CHANGE, onVisible)

      handle?.destroy()

      handle = null

      canvas.remove()
    },
  }
}
