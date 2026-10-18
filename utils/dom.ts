/**
 * @file utils/dom.ts
 * @description Shadow-piercing DOM queries + the SVG placeholder helper.
 * Every component renders inside a closed-ish shadow tree, so a plain
 * `document.querySelector` can never reach e.g. a `<video>` inside
 * `<media-figure>` — the deep* walkers recurse through `.shadowRoot` so
 * app-level code (autoplay sweep, measurements) can still find them.
 */
import { SVG_STRINGS } from '@core/tokens/strings/svg.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { COVER_DIMENSIONS } from '@core/tokens/media/dimensions.js'
import { MOUSE_EVENTS, POINTER_EVENTS } from '@core/tokens/events/dom.js'
import { ANIMATION_DURATIONS } from '@core/tokens/motion/animation.js'

/** Any node that can host a subtree worth scanning. */
type DeepRoot = Document | Element | ShadowRoot

/** document when it exists, null in non-DOM contexts (SSR/test shims). */
const _root = (): Document | null => (typeof document !== TYPE_STRINGS.UNDEFINED ? document : null)

/**
 * Depth-first search for the FIRST element matching `selector`, descending
 * through every nested shadow root it passes. Order matches the visual
 * document order (parents before their shadow children). Recursion — not a
 * hand-rolled stack — matches the self-similar tree shape per repo rule 20.
 * @param selector CSS selector.
 * @param root Subtree root; defaults to document when present.
 * @returns First match or null.
 */
export const deepQuerySelector = (
  selector: string,
  root: DeepRoot | null = _root()
): Element | null => {
  if (!root) return null

  const el = root.querySelector?.(selector)

  if (el) return el

  const elements = root.querySelectorAll ? root.querySelectorAll('*') : []

  for (const child of elements) {
    if (child.shadowRoot) {
      const found = deepQuerySelector(selector, child.shadowRoot)

      if (found) return found
    }
  }

  return null
}

/**
 * Same traversal as deepQuerySelector but collects EVERY match across all
 * shadow trees — used for sweeps like "pause every video on the page".
 * The results array is threaded through recursion (accumulator style) so
 * no intermediate arrays get concatenated per level.
 * @param selector CSS selector.
 * @param root Subtree root; defaults to document.
 * @param results Accumulator — internal recursion state, omit externally.
 * @returns All matching elements in visual document order.
 */
export const deepQuerySelectorAll = (
  selector: string,
  root: DeepRoot | null = _root(),
  results: Element[] = []
): Element[] => {
  if (!root) return results

  const els = root.querySelectorAll ? root.querySelectorAll(selector) : []

  results.push(...Array.from(els))

  const elements = root.querySelectorAll ? root.querySelectorAll('*') : []

  for (const child of elements) {
    if (child.shadowRoot) {
      deepQuerySelectorAll(selector, child.shadowRoot, results)
    }
  }

  return results
}

/**
 * Whether `now` still falls inside a just-mounted overlay's input-arm
 * window. Dialogs and the menu mount synchronously during the opening
 * gesture's dispatch, so a residual press from that same gesture — the
 * second click of an in-place double-click, or a mouseup retargeted onto
 * freshly mounted controls — lands inside the overlay and fires whatever
 * happens to sit under the cursor (a language option, the dismiss
 * backdrop). Capture-phase guards consult this before letting pointer
 * input through; a non-positive `openedAt` disarms the window entirely.
 * @param openedAt `performance.now()` sampled on the open transition.
 * @param now Sample time — defaults to the shared time-origin clock.
 * @returns True while pointer input inside the overlay should be swallowed.
 */
export const withinModalArmWindow = (openedAt: number, now: number = performance.now()): boolean =>
  openedAt > 0 && now - openedAt < ANIMATION_DURATIONS.MODAL_ARM_MS

/** Minimal host surface the residual-input guard needs. */
interface ArmGuardHost extends EventTarget {
  /** Scoped listener registration (BaseComponent.addScopedListener). */
  addScopedListener(
    target: EventTarget | null,
    event: string,
    handler: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean
  ): void
}

/**
 * Attaches the residual-input guard to an overlay host — a capture-phase
 * click/pointerdown pair on the host element itself, so a swallowed event
 * never descends into the shadow tree toward option, backdrop, or widget
 * handlers. The guard is inert while the overlay reports closed.
 *
 * Event discrimination:
 *   - Only `MouseEvent`-typed input can be gesture residue — plain
 *     `Event('click')` dispatches are scripted/deliberate and always pass.
 *   - `click` carries a meaningful `detail`: 0 marks keyboard/programmatic
 *     activation (deliberate — always passes, keeping tests' `.click()`
 *     working); ≥2 marks a multi-click residual — stale by definition.
 *   - pointer presses carry no click count and are armed by the time
 *     window alone; this also covers drags started by a stale pointerdown
 *     (e.g. the theme slider's window-tracked drag).
 * @param host Overlay host element (also the listener owner).
 * @param isOpen Predicate — the guard is inert while the overlay is closed.
 * @param openedAt Clock accessor — `performance.now()` sampled at open.
 */
export const armResidualInputGuard = (
  host: ArmGuardHost,
  isOpen: () => boolean,
  openedAt: () => number
): void => {
  const guard: EventListener = (e) => {
    if (!isOpen() || !(e instanceof MouseEvent)) return

    if (e.type === MOUSE_EVENTS.CLICK) {
      if (e.detail === 0) return

      if (e.detail > 1) {
        e.stopPropagation()

        return
      }
    }

    if (withinModalArmWindow(openedAt())) e.stopPropagation()
  }

  host.addScopedListener(host, MOUSE_EVENTS.CLICK, guard, { capture: true })

  host.addScopedListener(host, POINTER_EVENTS.POINTERDOWN, guard, { capture: true })
}

/**
 * Generates an ultra-lightweight inline SVG placeholder data URI with exact
 * dimensions. An empty `<svg width height viewBox>` weighs ~110 bytes,
 * decodes instantly, and — crucially — gives the `<img>` a definite intrinsic
 * size AND aspect ratio, so `width:auto` layouts reserve the real natural box
 * while the actual image streams in (zero CLS, no uniform-width stretching).
 * Without the width/height attrs the SVG is intrinsic-ratio-only and the img
 * collapses to the ~300×150 default replaced size. Default is FHD
 * 1920×1080 (16:9), the common media shape. `encodeURIComponent` (not
 * base64) keeps the URI readable and is the spec-supported form for
 * `data:image/svg+xml` per RFC 2397 — b64 would inflate size ~33%.
 * @param w Intrinsic width to declare (px).
 * @param h Intrinsic height to declare (px).
 * @returns `data:image/svg+xml;charset=utf-8,…` URI for img.src.
 */
export const svgPlaceholder = (
  w: number = COVER_DIMENSIONS.FHD_WIDTH,
  h: number = COVER_DIMENSIONS.FHD_HEIGHT
): string => {
  const svg = `<svg xmlns="${SVG_STRINGS.SVG_XMLNS}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"></svg>`

  return `${SVG_STRINGS.SVG_DATA_URI_PREFIX}${encodeURIComponent(svg)}`
}

/**
 * Cached `window.innerWidth` — Blink marks innerWidth as layout-forcing
 * when it follows style writes, so batch passes (mosaic layout, fit
 * flushes) read it once per event-loop task instead of once per call.
 * The cache lives for a single microtask turn: innerWidth can only change
 * on resize, which never lands mid-task, and the first read of the next
 * task re-queries.
 */
let cachedVW = -1

/**
 * Returns `window.innerWidth`, memoized within the current task. The
 * first call takes the (layout-forcing) hit; every subsequent caller in
 * the same task reuses the number — after DOM writes this keeps a burst
 * of N reads down to a single possible reflow at the batch head.
 * @returns viewport width in px, or 0 without a window (SSR/tests).
 */
export const viewportWidth = (): number => {
  if (cachedVW >= 0) return cachedVW

  if (typeof window === TYPE_STRINGS.UNDEFINED) return 0

  cachedVW = window.innerWidth

  queueMicrotask(() => {
    cachedVW = -1
  })

  return cachedVW
}

/**
 * Test/invalidate hook — clears the memoized width. Test suites call it
 * between cases since jsdom/happy-dom innerWidth is mutable mid-test.
 */
export const resetViewportCache = (): void => {
  cachedVW = -1
}

/** Set while flushLayout runs — the reflow test allowlists this window. */
let inIntentionalFlush = false

/** True only inside flushLayout() — used by the forced-reflow governance test. */
export const isIntentionalFlush = (): boolean => inIntentionalFlush

/**
 * Deliberate synchronous layout flush — the ONE sanctioned forced reflow.
 * Used by the transition-restart pattern: write classes/styles, force
 * layout so the browser commits them, then apply the animating class in
 * the same frame. Callers get the element's offsetHeight as a side effect
 * of the flush; the return value is meant to be ignored (`void`).
 * @param el Element whose layout is flushed.
 * @returns the element's offsetHeight (the flushing read).
 */
export const flushLayout = (el: HTMLElement): number => {
  inIntentionalFlush = true

  try {
    return el.offsetHeight
  } finally {
    inIntentionalFlush = false
  }
}
