/**
 * @file utils/gpu/corner-brackets.ts — the WebGPU mount for the button
 * corner-bracket animation. `.pref-done-btn`, `.aw-c-card-action` and
 * `.aw-c-label-action` carry `::before`/`::after` L-brackets at the
 * top-left and bottom-right corners whose box grows from a stub
 * ($space-md) to `calc(100% − inset)` on hover/focus over 0.25s. This
 * module draws the same brackets with the `rust/corner-brackets`
 * widget on a child canvas of the button.
 *
 * Mount contract:
 *
 *   - Capability gate: no `navigator.gpu`, a failed artifact, or
 *     `prefers-reduced-motion` all leave the CSS pseudo-elements as
 *     the render path — mounting can never regress the button.
 *   - Deferred mount: an IntersectionObserver defers the artifact
 *     fetch until the button first enters the viewport.
 *   - Stateless shader: the widget holds no clock — JS drives one
 *     eased `hover` scalar through a 250ms ramp on hover/focus change
 *     (the CSS transition's timing function, evaluated with the same
 *     Newton-solved cubic-bezier the WGSL uses) and only paints while
 *     the ramp moves; a settled button costs nothing.
 *   - The `<hr>`-style suppression: while the canvas carries
 *     `is-fallback` the pseudo-elements paint; the stylesheet's
 *     `:has(> canvas:not(.is-fallback))` gate hides them once live.
 */

import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { MEDIA_QUERIES } from '@core/tokens/primitives.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { FOCUS_EVENTS, POINTER_EVENTS } from '@core/tokens/events/dom.js'
import { parseCssColor } from '@core/utils/canvas/css-color.js'
import { GPU_WIDGET_DRIVE, GPU_WIDGET_KINDS } from '@core/tokens/motion/gpu-widgets.js'
import { hasWebGpu, mountWebGpuWidget } from '@core/utils/gpu/webgpu-widget.js'
import { applyAnimationDesc } from '@core/utils/a11y/animation-desc.js'
import { ANIMATION_IDS } from '@core/tokens/data/animation-ids.js'
import type { WidgetHandle } from '@core/utils/gpu/webgpu-widget.js'

/**
 * Per-surface parameters for `mountCornerBrackets` — the pieces the
 * button styles differ in.
 */
export interface CornerBracketSpec {
  /** Overlay canvas class (the `:has()` gate keys on it). */
  canvasClass: string
  /** CSS var the hover inset resolves from — `calc(100% − var)`. */
  insetVar: string
  /** Cubic-bezier control points of the surface's CSS transition. */
  ease: readonly [number, number, number, number]
  /** Expansion ramp duration (ms) — ANIMATION_DURATIONS.BRACKET* tokens. */
  ms: number
  /**
   * Element whose hover/focus drives the ramp — defaults to `button`.
   * `.expand-modal-open-1` animates on `.internal-expand:hover &`
   * (the parent), so callers pass that ancestor here.
   */
  hoverOn?: HTMLElement
  /**
   * Ancestor selector alternative to `hoverOn` — resolved per button
   * (`button.closest(...)`) so batch mounts each watch their own parent.
   */
  hoverParentSelector?: string
}

/**
 * Kind-specific wasm surface for the corner-brackets crate — typed on
 * top of the generic WasmWidget so calls stay checked.
 */
interface CornerBracketsWasm {
  /** Eased hover progress 0..1 — arm length + tint lerp. */
  set_hover: (v: number) => void
  /** Stub/full arm lengths + hairline half-width (device px). */
  set_arms: (a0w: number, a0h: number, a1w: number, a1h: number, hair: number) => void
  /** Resting + hover bracket colors (rgba 0-1). */
  set_colors: (
    er: number,
    eg: number,
    eb: number,
    ea: number,
    ar: number,
    ag: number,
    ab: number,
    aa: number
  ) => void
}

/**
 * `bezierEase` — evaluate cubic-bezier(x1,y1,x2,y2) at progress `p`.
 * CSS resolves y at the parameter t where x(t)=p — Newton's method on
 * the x polynomial, four iterations like the WGSL `bez` (the two must
 * agree pixel-for-pixel or the GPU arm grows on a different clock than
 * the CSS one it replaces).
 * @param p Linear progress 0..1.
 * @param x1 @param y1 @param x2 @param y2 Control-point coordinates.
 * @returns Eased progress 0..1.
 */
export function bezierEase(p: number, x1: number, y1: number, x2: number, y2: number): number {
  let t = Math.min(1, Math.max(0, p))

  for (let i = 0; i < 4; i++) {
    const o = 1 - t
    const x = 3 * o * o * t * x1 + 3 * o * t * t * x2 + t * t * t
    const dx = 3 * o * o * x1 + 6 * o * t * (x2 - x1) + 3 * t * t * (1 - x2)

    if (Math.abs(dx) < 1e-6) break

    t = Math.min(1, Math.max(0, t - (x - p) / dx))
  }

  const o = 1 - t

  return 3 * o * o * t * y1 + 3 * o * t * t * y2 + t * t * t
}

/**
 * `cssLength` — resolve a CSS length (e.g. `var(--space-xs)`) to px in
 * the element's style scope: a probe span inherits the same custom
 * properties, so shadow-DOM-scoped values resolve correctly. Returns 0
 * when probing is impossible.
 * @param el Element whose scope the length resolves in.
 * @param value Any CSS width value.
 */
function cssLength(el: HTMLElement, value: string): number {
  const probe = document.createElement(HTML_TAGS.SPAN)

  probe.style.width = value
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'

  const parent = el.parentElement || el

  parent.appendChild(probe)

  const px = probe.offsetWidth

  probe.remove()

  return px
}

/**
 * Mounts the corner-brackets widget inside `button`. The canvas is a
 * `position:absolute; inset:0` child — it follows the button's box for
 * free, so only the backing size + arm lengths need mirroring.
 * @param button The bracketed button/link element.
 * @param spec Per-surface parameters (canvas class, hover inset, ease).
 * @returns Teardown function; safe to call more than once.
 */
export function mountCornerBrackets(button: HTMLElement, spec: CornerBracketSpec): () => void {
  const noop = () => undefined

  if (!button) return noop

  // The button animates its corner brackets on hover even without
  // WebGPU (the CSS ::before fallback), so the description applies
  // before the capability guard — idempotent across re-mounts.
  applyAnimationDesc(button, ANIMATION_IDS.CORNER_BRACKETS)

  if (
    !hasWebGpu() ||
    typeof document === TYPE_STRINGS.UNDEFINED ||
    typeof window === TYPE_STRINGS.UNDEFINED ||
    (window.matchMedia && window.matchMedia(MEDIA_QUERIES.PREFERS_REDUCED_MOTION).matches)
  ) {
    return noop
  }

  const canvas = document.createElement(HTML_TAGS.CANVAS) as HTMLCanvasElement

  canvas.setAttribute(ARIA_ATTRS.ARIA_HIDDEN, ATTR_VALUES.TRUE)
  canvas.className = `${spec.canvasClass} ${STATE_CLASSES.IS_FALLBACK}`

  let handle: WidgetHandle | null = null
  let pending = false
  let failed = false
  let dead = false
  let hover = 0
  let target = 0
  let rampFrom = 0
  let rampAt = 0
  let raf = 0
  let ro: ResizeObserver | null = null

  /**
   * Pushes the box-dependent parameters: stub arm = the pseudo-box's
   * resting size (read off `::before`'s computed style), full arm =
   * the button's own span minus the surface's inset, hairline = the
   * pseudo-border's width — all converted to the canvas's device px.
   */
  const layout = () => {
    if (!handle) return

    const dpr = window.devicePixelRatio || 1
    const w = Math.max(1, Math.round(button.clientWidth * dpr))
    const h = Math.max(1, Math.round(button.clientHeight * dpr))

    canvas.width = w
    canvas.height = h

    handle.widget.resize(w, h)

    const before = getComputedStyle(button, '::before')
    const insetPx = cssLength(button, `var(${spec.insetVar})`)
    const stubW = parseFloat(before.width) || 0
    const stubH = parseFloat(before.height) || 0
    const hair = (parseFloat(before.borderTopWidth) || 1) * 0.5
    const wasm = handle.widget as unknown as CornerBracketsWasm

    wasm.set_arms(
      stubW * dpr,
      stubH * dpr,
      (button.clientWidth - insetPx) * dpr,
      (button.clientHeight - insetPx) * dpr,
      hair * dpr
    )
  }

  /**
   * Pushes the resting + hover bracket colors — re-run on every ramp
   * retarget so `currentColor` borders (which resolve against the
   * button's transitioning text color) paint the correct hover tint
   * while `:hover` applies.
   */
  const colors = () => {
    if (!handle) return

    const border = parseCssColor(getComputedStyle(button, '::before').borderTopColor) || [1, 1, 1]
    const w = handle.widget as unknown as CornerBracketsWasm

    w.set_colors(border[0], border[1], border[2], 1, border[0], border[1], border[2], 1)
  }

  /** One ramp tick — ease the hover scalar toward its target and paint. */
  const tick = () => {
    raf = 0

    if (!handle || dead) return

    const p = Math.min(1, (performance.now() - rampAt) / spec.ms)
    const eased = bezierEase(p, spec.ease[0], spec.ease[1], spec.ease[2], spec.ease[3])

    hover = rampFrom + (target - rampFrom) * eased

    const w = handle.widget as unknown as CornerBracketsWasm

    w.set_hover(hover)

    handle.widget.frame(0)

    if (p < 1) {
      raf = requestAnimationFrame(tick)
    }
  }

  /** Element whose hover/focus state the CSS brackets key on. */
  const watched =
    spec.hoverOn ||
    (spec.hoverParentSelector
      ? (button.closest(spec.hoverParentSelector) as HTMLElement | null)
      : null) ||
    button

  /** Retargets the ramp — hover/focus state changed on the watched element. */
  const retarget = () => {
    const on =
      watched.matches(':hover') || watched.matches(':focus') || watched.matches(':focus-within')
        ? 1
        : 0

    if (on === target) return

    colors()

    target = on
    rampFrom = hover
    rampAt = performance.now()

    if (handle && !raf && !dead) {
      raf = requestAnimationFrame(tick)
    }
  }

  const mount = () => {
    if (pending || handle || failed || dead) return

    pending = true

    void mountWebGpuWidget(GPU_WIDGET_KINDS.CORNER_BRACKETS, canvas, undefined, {
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

      layout()
      colors()

      canvas.classList.remove(STATE_CLASSES.IS_FALLBACK)

      // Paint the resting state once — the ramp only ticks on changes.
      handle.widget.frame(0)

      if (typeof ResizeObserver !== TYPE_STRINGS.UNDEFINED) {
        ro = new ResizeObserver(() => layout())

        ro.observe(button)
      }
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

  const events: [string, EventListener][] = [
    [POINTER_EVENTS.POINTERENTER, retarget],
    [POINTER_EVENTS.POINTERLEAVE, retarget],
    [FOCUS_EVENTS.FOCUSIN, retarget],
    [FOCUS_EVENTS.FOCUSOUT, retarget],
  ]

  for (const [name, listener] of events) {
    watched.addEventListener(name, listener, { passive: true })
  }

  button.appendChild(canvas)

  if (io) {
    io.observe(button)
  } else {
    mount()
  }

  return () => {
    if (dead) return

    dead = true

    if (raf) cancelAnimationFrame(raf)
    raf = 0

    io?.disconnect()
    ro?.disconnect()

    for (const [name, listener] of events) {
      watched.removeEventListener(name, listener)
    }

    handle?.destroy()

    handle = null

    canvas.remove()
  }
}

/**
 * Batch mount — one `mountCornerBrackets` per matching element under
 * `root` (a component shadow root or any parent). Returns a single
 * teardown that destroys them all; surfaces that re-render call it
 * then re-query (the helper tolerates re-mounting on new nodes).
 * @param root The subtree to query.
 * @param selector Class selector for the bracketed elements.
 * @param spec Shared surface parameters.
 * @returns Teardown for every mounted bracket.
 */
export function mountCornerBracketsAll(
  root: ParentNode,
  selector: string,
  spec: CornerBracketSpec
): () => void {
  const teardowns: (() => void)[] = []

  root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    teardowns.push(mountCornerBrackets(el, spec))
  })

  return () => {
    for (const teardown of teardowns) {
      teardown()
    }

    teardowns.length = 0
  }
}
