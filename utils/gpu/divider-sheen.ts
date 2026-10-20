/**
 * @file utils/gpu/divider-sheen.ts — the WebGPU mount for the footer
 * divider sheen. The `.footer-source-divider` /
 * `.internal-footer-items-divider` `<hr>` elements carry a static
 * hairline + a traveling accent band (`::after` swept with
 * translateX). This module swaps the whole visual for the
 * `rust/divider-sheen` widget on an overlay canvas — the hairline and
 * the band render in one shader, one draw call per frame.
 *
 * Mount contract (same shape as the other widget integrations):
 *
 *   - Capability gate: no `navigator.gpu`, a failed artifact, or
 *     `prefers-reduced-motion` all leave the `<hr>`'s CSS visual as
 *     the render path — mounting can never regress the divider.
 *   - Deferred mount: an IntersectionObserver on the `<hr>` defers the
 *     artifact fetch until the divider first enters the viewport —
 *     footers sit below the fold, so the ~43KB module never travels
 *     the critical path.
 *   - Zero-shift overlay: the canvas is an absolutely-positioned
 *     sibling at the `<hr>`'s offset box (same parent → same
 *     offsetParent → identical resolution space); the `<hr>` flips to
 *     `visibility: hidden` via the `:has()` gate — its box stays, so
 *     metrics stay readable and nothing reflows.
 *   - IO-gated loop: MANUAL drive — this module owns one rAF that only
 *     ticks while the divider is on screen and the tab is visible, so
 *     the sweep costs nothing once scrolled past (frame-budget rule).
 */

import { THEME_CSS_PROPS } from '@core/tokens/css/theme.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { MEDIA_QUERIES } from '@core/tokens/primitives.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { WINDOW_EVENTS, CLIPBOARD_EVENTS } from '@core/tokens/events/dom.js'
import { STATE_STRINGS } from '@core/tokens/strings/state.js'
import { parseCssColor } from '@core/utils/canvas/css-color.js'
import { GPU_WIDGET_DRIVE, GPU_WIDGET_KINDS } from '@core/tokens/motion/gpu-widgets.js'
import { hasWebGpu, mountWebGpuWidget } from '@core/utils/gpu/webgpu-widget.js'
import { applyAnimationDesc } from '@core/utils/a11y/animation-desc.js'
import { ANIMATION_IDS } from '@core/tokens/data/animation-ids.js'
import type { WidgetHandle } from '@core/utils/gpu/webgpu-widget.js'

/**
 * Kind-specific wasm surface for the divider-sheen crate — typed on
 * top of the generic WasmWidget so calls stay checked.
 */
interface DividerSheenWasm {
  /** Push the hairline + band colors (rgba 0-1, computed style). */
  set_colors: (
    br: number,
    bg: number,
    bb: number,
    ba: number,
    ar: number,
    ag: number,
    ab: number,
    aa: number
  ) => void
}

/**
 * Live mount state — the rAF loop + IO gate + the pending-mount flag
 * so a disconnect during the artifact fetch still tears down cleanly.
 */
interface DividerMount {
  /** The widget handle once init resolves (null while pending/failed). */
  handle: WidgetHandle | null
  /** True between `mountWebGpuWidget` call and its resolution. */
  pending: boolean
  /** True once the mount attempt finished without a widget. */
  failed: boolean
  /** The overlay canvas (removed on destroy). */
  canvas: HTMLCanvasElement
  /** The IntersectionObserver gating mount + the loop. */
  io: IntersectionObserver
  /** Live rAF id, 0 when the loop is idle. */
  raf: number
  /** Last frame timestamp for dt. */
  last: number
  /** True while the hr is on screen (drives the loop). */
  visible: boolean
  /** True after destroy — every async path short-circuits on it. */
  dead: boolean
}

/**
 * Resolves the divider's two colors from live CSS vars — the crate
 * never sees `var()`: `--border-color` feeds the hairline,
 * `--color-accent` the traveling band. Alpha is 1 for both (the CSS
 * gradient carries no alpha — the opacity is baked into the stops).
 * @param hr The divider element (vars resolve in its shadow scope).
 */
function pushDividerColors(hr: HTMLElement, handle: WidgetHandle): void {
  const style = getComputedStyle(hr)
  const border = parseCssColor(style.getPropertyValue(THEME_CSS_PROPS.BORDER_COLOR))
  const accent = parseCssColor(style.getPropertyValue(THEME_CSS_PROPS.COLOR_ACCENT))
  const w = handle.widget as unknown as DividerSheenWasm

  if (border && accent) {
    w.set_colors(border[0], border[1], border[2], 1, accent[0], accent[1], accent[2], 1)
  }
}

/**
 * Mirrors the `<hr>`'s box onto the overlay canvas — the canvas is an
 * absolutely-positioned sibling, so it resolves its offsets against
 * the same offsetParent the `<hr>`'s `offset*` properties report:
 * copying left/top/width/height lands the overlay pixel-identically.
 * The `<hr>` stays `visibility: hidden` (never `display: none`), so
 * this stays measurable on every resize. Backing size is device px.
 * @param hr The divider element.
 * @param m The live mount state.
 */
function mirrorDividerBox(hr: HTMLElement, m: DividerMount): void {
  m.canvas.style.left = `${hr.offsetLeft}px`
  m.canvas.style.top = `${hr.offsetTop}px`
  m.canvas.style.width = `${hr.offsetWidth}px`
  m.canvas.style.height = `${hr.offsetHeight}px`
  m.canvas.style.borderRadius = getComputedStyle(hr).borderRadius

  const w = Math.max(1, Math.round(hr.offsetWidth * window.devicePixelRatio))
  const h = Math.max(1, Math.round(hr.offsetHeight * window.devicePixelRatio))

  m.canvas.width = w
  m.canvas.height = h

  m.handle?.widget.resize(w, h)
}

/**
 * The loop tick — dt in seconds; self-schedules while the divider is
 * visible. A widget returning false (stale surface) disarms the loop
 * permanently; the canvas keeps its last frame painted until destroy.
 * @param m The live mount state.
 */
function tickDivider(m: DividerMount): void {
  const now = performance.now()
  const dt = (now - m.last) / 1000

  m.last = now
  m.raf = 0

  if (m.handle?.widget.frame(dt) !== false && m.visible && !document.hidden && !m.dead) {
    m.raf = requestAnimationFrame(() => tickDivider(m))
  }
}

/**
 * Starts the loop if it is idle — the IO + visibilitychange paths
 * funnel here so there is exactly one clock at all times.
 * @param m The live mount state.
 */
function pumpDivider(m: DividerMount): void {
  if (m.raf || m.dead || !m.visible || document.hidden || !m.handle) return

  m.last = performance.now()
  m.raf = requestAnimationFrame(() => tickDivider(m))
}

/**
 * Stops the loop — IO exit / tab-hidden / destroy paths.
 * @param m The live mount state.
 */
function stopDivider(m: DividerMount): void {
  if (m.raf) cancelAnimationFrame(m.raf)

  m.raf = 0
}

/**
 * Mounts the divider-sheen widget over an `<hr>` divider. Returns a
 * disposer that releases the widget, the overlay canvas, the IO, and
 * the rAF — call it from the host component's `onDestroy` (and call
 * again on re-render: `_updateDom` swaps the `<hr>` node, so the old
 * mount's canvas + observer must go with it).
 *
 * @param hr The divider element (`aria-hidden` already — the canvas
 *   is decorative paint on top of it).
 * @param canvasClass The overlay canvas's class token — the
 *   stylesheet's `:has()` gate keys on it to hide the `<hr>` paint.
 * @returns Teardown function; safe to call more than once.
 */
export function mountDividerSheen(hr: HTMLElement, canvasClass: string): () => void {
  const noop = () => undefined

  if (!hr) return noop

  // The hairline's traveling light band runs as a CSS fallback even
  // without WebGPU — the description applies before the capability
  // guard; the injected desc node is what AI/SEO agents read.
  applyAnimationDesc(hr, ANIMATION_IDS.DIVIDER_SHEEN)

  if (
    !hasWebGpu() ||
    typeof document === TYPE_STRINGS.UNDEFINED ||
    typeof window === TYPE_STRINGS.UNDEFINED ||
    typeof IntersectionObserver === TYPE_STRINGS.UNDEFINED ||
    (window.matchMedia && window.matchMedia(MEDIA_QUERIES.PREFERS_REDUCED_MOTION).matches)
  ) {
    return noop
  }

  const canvas = document.createElement(HTML_TAGS.CANVAS) as HTMLCanvasElement

  canvas.setAttribute(ARIA_ATTRS.ARIA_HIDDEN, ATTR_VALUES.TRUE)
  canvas.className = `${canvasClass} ${STATE_CLASSES.IS_FALLBACK}`
  canvas.style.position = STATE_STRINGS.ABSOLUTE

  const m: DividerMount = {
    handle: null,
    pending: false,
    failed: false,
    canvas,
    io: new IntersectionObserver((entries) => {
      for (const entry of entries) {
        m.visible = entry.isIntersecting
      }

      if (m.visible && !m.handle && !m.pending && !m.failed) {
        // First intersection — fetch + init the artifact now.
        m.pending = true

        void mountWebGpuWidget(GPU_WIDGET_KINDS.DIVIDER_SHEEN, canvas, undefined, {
          drive: GPU_WIDGET_DRIVE.MANUAL,
        }).then((handle) => {
          m.pending = false

          if (!handle) {
            m.failed = true

            canvas.remove()

            return
          }

          if (m.dead) {
            handle.destroy()

            canvas.remove()

            return
          }

          m.handle = handle

          pushDividerColors(hr, handle)

          mirrorDividerBox(hr, m)

          // Live — drop the fallback marker so the `:has()` gate hides
          // the `<hr>`'s own paint (visibility keeps its box).
          canvas.classList.remove(STATE_CLASSES.IS_FALLBACK)

          pumpDivider(m)
        })
      } else if (m.visible) {
        pumpDivider(m)
      } else {
        stopDivider(m)
      }
    }),
    raf: 0,
    last: 0,
    visible: false,
    dead: false,
  }

  const onVisible = () => {
    if (document.hidden) {
      stopDivider(m)
    } else {
      pumpDivider(m)
    }
  }

  const onResize = () => {
    if (m.handle && !m.dead) mirrorDividerBox(hr, m)
  }

  document.addEventListener(CLIPBOARD_EVENTS.VISIBILITY_CHANGE, onVisible)
  window.addEventListener(WINDOW_EVENTS.RESIZE, onResize, { passive: true })

  // The canvas lands right after the hr — while it carries
  // `is-fallback` the `:has()` gate keeps the hr painted; the mount
  // resolution drops the class and the visibility swap does the rest.
  hr.after(canvas)

  m.io.observe(hr)

  return () => {
    if (m.dead) return

    m.dead = true
    m.visible = false

    stopDivider(m)

    m.io.disconnect()

    document.removeEventListener(CLIPBOARD_EVENTS.VISIBILITY_CHANGE, onVisible)
    window.removeEventListener(WINDOW_EVENTS.RESIZE, onResize)

    m.handle?.destroy()

    m.handle = null

    canvas.remove()
  }
}
