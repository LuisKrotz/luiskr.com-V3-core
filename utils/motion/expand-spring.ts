/**
 * @file utils/motion/expand-spring.ts
 * @description Height chase spring — drives an element's inline
 * `style.height` toward a measured px target with the same `springStep`
 * integrator and `framePool` pump the scroll-spring and slider widgets
 * run on. Expanding/collapsing panels (route-search's listbox) retarget
 * mid-flight so a growing result set inherits velocity instead of
 * restarting — that inherited velocity is the organic part.
 *
 * Compute placement: the integrator is two multiplies per frame — far
 * under the wasm-pool dispatch floor — so it stays on the main thread
 * with zero per-frame object allocation (the bound tick closure is
 * created once per spring, and a single template-string `px` write per
 * frame is the DOM StyleOM cost — there is no numeric API for height).
 */
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { EXPAND_SPRING } from '@core/tokens/motion/expand.js'
import { framePool } from './frame.js'
import { springStep, type SpringChase } from './spring.js'

/** Live spring state for one element — the chase triple plus loop bookkeeping. */
interface ExpandSpring extends SpringChase {
  /** Live frame id — 0 when idle. */
  raf: number
  /** Bound tick — allocated once per spring so re-arms never alloc. */
  tick: ((ts: number) => void) | null
  /** Timestamp of the last integrated frame (ms). */
  last: number
  /** Watchdog clock (ms) — force-settles if rAF starves. */
  elapsed: number
  /** Fired once when the spring settles or is force-settled. */
  onSettle: (() => void) | null
}

/** Per-element spring states — WeakMap so detached elements never leak. */
const states = new WeakMap<HTMLElement, ExpandSpring>()

/**
 * Runs one spring tick: integrates the px chase, writes the element's
 * inline height, and either re-arms or settles (snap to target +
 * onSettle). Kept as a closure over (el, state) so the rAF body itself
 * allocates nothing per frame.
 * @param el The element being expanded.
 * @param s The element's spring state.
 * @param ts rAF timestamp (ms).
 */
/**
 * Default render hook — writes the chase position as an inline px
 * height. Callers that need a composited (non-layout) property pass
 * their own — e.g. the listbox clips with `clip-path` so the reveal
 * costs zero reflow.
 * @param el The element being written.
 * @param v The chase position in px.
 */
const writeHeight = (el: HTMLElement, v: number): void => {
  el.style.height = `${v}${CHAR_STRINGS.PX}`
}

const tickSpring = (
  el: HTMLElement,
  s: ExpandSpring,
  ts: number,
  write: (el: HTMLElement, v: number) => void
): void => {
  // The queued id is consumed — clearing it first keeps `springExpandTo`
  // honest: a mid-tick throw leaves `s.raf` at 0 so the next call falls
  // through the live-guard and re-arms instead of returning early on a
  // dead handle.
  s.raf = 0

  const dt = s.last
    ? Math.min((ts - s.last) / 1000, EXPAND_SPRING.DT_MAX_S)
    : EXPAND_SPRING.DT_INIT_S

  s.last = ts
  s.elapsed += dt * 1000

  springStep(
    s,
    EXPAND_SPRING.K,
    EXPAND_SPRING.C,
    dt,
    EXPAND_SPRING.SETTLE_PX,
    EXPAND_SPRING.VEL_EPS
  )

  write(el, s.currentP)

  const settled = s.velP === 0 && s.currentP === s.targetP

  if (settled || s.elapsed >= EXPAND_SPRING.MAX_MS) {
    write(el, s.targetP)

    states.delete(el)

    s.onSettle?.()

    return
  }

  s.raf = framePool.request(s.tick as (ts: number) => void)
}

/**
 * Spring-drives `el`'s height toward `target` px. Mid-flight retargets
 * preserve velocity — a result list that grows again before settling
 * curves onto the new course instead of restarting. When a spring is
 * already live only the target/onSettle update — the loop keeps its
 * frame cadence.
 * @param el The element whose height chases the target.
 * @param target Target height in px (`scrollHeight` for natural growth).
 * @param onSettle Called once on settle — the caller's completion path
 *   (release the inline height, commit `hidden`, …).
 * @param instant Reduced-motion escape: writes the target directly,
 *   kills any live spring, fires onSettle now.
 * @param write Optional per-frame render hook receiving the px chase
 *   position — defaults to writing `style.height`. Composited reveals
 *   (clip-path, transform) supply their own to stay off the layout path.
 * @param from Optional explicit start position — composited reveals
 *   don't shrink the box, so callers supply the chase origin (e.g. 0)
 *   instead of letting the rect report the natural height.
 */
export const springExpandTo = (
  el: HTMLElement,
  target: number,
  onSettle: (() => void) | null = null,
  instant = false,
  write: (el: HTMLElement, v: number) => void = writeHeight,
  from?: number
): void => {
  let s = states.get(el)

  // A live spring's own position is the truth — measuring the element
  // mid-flight would read the laid-out box, not the chase.
  const measured = s ? s.currentP : (from ?? el.getBoundingClientRect().height)

  if (instant || Math.abs(target - measured) < EXPAND_SPRING.MIN_TRAVEL_PX) {
    if (s && s.raf) framePool.cancel(s.raf)

    states.delete(el)

    write(el, target)

    onSettle?.()

    return
  }

  if (!s) {
    s = {
      currentP: measured,
      velP: 0,
      targetP: 0,
      raf: 0,
      tick: null,
      last: 0,
      elapsed: 0,
      onSettle: null,
    }
  }

  s.tick = (ts) => tickSpring(el, s as ExpandSpring, ts, write)

  s.targetP = target
  s.onSettle = onSettle
  s.elapsed = 0

  if (s.raf) return

  s.currentP = measured
  s.velP = 0
  s.last = 0

  states.set(el, s)

  s.raf = framePool.request(s.tick as (ts: number) => void)
}

/**
 * Cancels a live expansion — the element stays wherever the spring left
 * it and the caller's onSettle is dropped (a cancelled open must not
 * commit `hidden`). Used on disconnect so no frames outlive the node.
 * @param el The element whose spring should die.
 */
export const cancelExpandSpring = (el: HTMLElement): void => {
  const s = states.get(el)

  if (!s) return

  if (s.raf) framePool.cancel(s.raf)

  states.delete(el)
}
