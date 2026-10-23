/**
 * @file utils/motion/scroll-spring.ts
 * @description Scroll-position chase spring — the shared driver both
 * carousels use for programmatic slide travel. The browser's
 * `scrollTo({behavior:'smooth'})` runs a fixed, velocity-less ease that
 * can't overshoot or retarget mid-flight; this integrates a damped
 * spring on `scrollLeft` (same `springStep` the slider knobs run) so
 * nav arrives with a small elastic settle and keeps its momentum when
 * the target moves mid-flight.
 *
 * Mechanics: while a spring is live the track carries the caller's
 * "animating" class — the SCSS disables `scroll-snap-type` +
 * `scroll-behavior` under it, because a per-frame `scrollLeft` write
 * would otherwise fight mandatory snap and get re-eased by the CSS
 * smooth behavior. The class lifts on settle/cancel at a snap-aligned
 * rest position, so snap re-engages invisibly.
 *
 * Frame budget: one `scrollLeft` write per rAF, monomorphic state
 * (fixed fields, WeakMap-keyed per track, no per-frame allocation),
 * dt clamped, watchdog-capped, and the loop cancels on user input so a
 * gesture always wins over the animation.
 */
import { CAROUSEL_SPRING } from '@core/tokens/motion/carousel.js'
import { framePool } from './frame.js'
import { springStep, type SpringChase } from './spring.js'

/**
 * Live spring state for one track — extends the shared chase triple
 * (currentP/velP/targetP in px) with loop bookkeeping. `raf` doubles
 * as the running flag (0 = idle).
 */
interface ScrollSpring extends SpringChase {
  /** Pending frame-pool id — 0 while the loop is stopped. */
  raf: number
  /** Bound tick — allocated once per spring so re-arms never alloc. */
  tick: ((ts: number) => void) | null
  /** Timestamp (ms) of the previous tick — 0 marks the first frame. */
  last: number
  /** Wall-clock runtime (ms) for the MAX_MS watchdog. */
  elapsed: number
  /** Fired once when the spring settles or is force-settled. */
  onSettle: (() => void) | null
}

/** Per-track spring states — WeakMap so detached tracks never leak. */
const states = new WeakMap<Element, ScrollSpring>()

/**
 * Runs one spring tick: integrates the px chase, writes the track's
 * scrollLeft, and either re-arms or settles (snap to target + class
 * lift + onSettle). Kept as a closure over (track, state) so the rAF
 * body itself allocates nothing per frame.
 * @param track The scrolling element.
 * @param s The track's spring state.
 * @param animClass Class lifted on settle.
 * @param ts rAF timestamp (ms).
 */
const tickSpring = (track: Element, s: ScrollSpring, animClass: string, ts: number): void => {
  // The queued id is consumed — clearing it first keeps `springScrollTo`
  // honest: a mid-tick throw leaves `s.raf` at 0 so the next call falls
  // through the live-guard and re-arms instead of returning early on a
  // dead handle (the frozen-spring wedge).
  s.raf = 0

  const dt = s.last
    ? Math.min((ts - s.last) / 1000, CAROUSEL_SPRING.DT_MAX_S)
    : CAROUSEL_SPRING.DT_INIT_S

  s.last = ts
  s.elapsed += dt * 1000

  springStep(
    s,
    CAROUSEL_SPRING.K,
    CAROUSEL_SPRING.C,
    dt,
    CAROUSEL_SPRING.SETTLE_PX,
    CAROUSEL_SPRING.VEL_EPS
  )

  ;(track as Element & { scrollLeft: number }).scrollLeft = s.currentP

  const settled = s.velP === 0 && s.currentP === s.targetP

  if (settled || s.elapsed >= CAROUSEL_SPRING.MAX_MS) {
    s.raf = 0

    ;(track as Element & { scrollLeft: number }).scrollLeft = s.targetP

    track.classList.remove(animClass)

    states.delete(track)

    s.onSettle?.()

    return
  }

  s.raf = framePool.request(s.tick as (ts: number) => void)
}

/**
 * Spring-scrolls `track` to `target` scrollLeft. Mid-flight retargets
 * preserve velocity (the organic part — a rapid double-tap nav curves
 * onto the new course instead of restarting). When a spring is already
 * live only the target/onSettle update — the loop keeps its frame cadence.
 * @param track The scrolling element (the carousel track).
 * @param target Target scrollLeft (px).
 * @param animClass Track modifier class that disables CSS snap+smooth
 *   while the spring drives.
 * @param onSettle Called once on settle — normal completion path for
 *   clone teleports and the isNavigating release.
 * @param instant Reduced-motion / no-animation escape: writes the
 *   target directly, kills any live spring, fires onSettle now.
 */
export const springScrollTo = (
  track: Element,
  target: number,
  animClass: string,
  onSettle: (() => void) | null = null,
  instant = false
): void => {
  const t = track as Element & { scrollLeft: number }

  let s = states.get(track)

  if (instant || Math.abs(target - t.scrollLeft) < CAROUSEL_SPRING.MIN_TRAVEL_PX) {
    if (s && s.raf) framePool.cancel(s.raf)

    t.classList.remove(animClass)

    states.delete(track)

    t.scrollLeft = target

    onSettle?.()

    return
  }

  if (!s) {
    s = {
      currentP: t.scrollLeft,
      velP: 0,
      targetP: t.scrollLeft,
      raf: 0,
      tick: null,
      last: 0,
      elapsed: 0,
      onSettle: null,
    }
  }

  s.tick = (ts) => tickSpring(track, s as ScrollSpring, animClass, ts)

  s.targetP = target
  s.onSettle = onSettle
  s.elapsed = 0

  if (s.raf) return

  s.currentP = t.scrollLeft
  s.velP = 0
  s.last = 0

  states.set(track, s)

  t.classList.add(animClass)

  s.raf = framePool.request(s.tick as (ts: number) => void)
}

/**
 * Cancels a live spring — user-input takeover (wheel/touch): the track
 * stays wherever the spring left it and mandatory snap re-engages from
 * the lifted class. The caller's onSettle is dropped — a cancelled nav
 * must not fire its teleport.
 * @param track The scrolling element.
 * @param animClass The modifier class to lift.
 */
export const cancelSpringScroll = (track: Element, animClass: string): void => {
  const s = states.get(track)

  if (!s) return

  if (s.raf) framePool.cancel(s.raf)

  track.classList.remove(animClass)

  states.delete(track)
}
