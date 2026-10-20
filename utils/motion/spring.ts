/**
 * @file utils/motion/spring.ts
 * @description Shared chase-spring integrator — a damped spring
 * (`v += (−(p−target)·K − v·C)·dt; p += v·dt`) integrated with
 * semi-implicit Euler. Semi-implicit Euler is unconditionally stable
 * for the K/C ranges the widgets use and costs two multiplies — the
 * monomorphic, zero-allocation shape the frame budget requires. Both
 * slider widgets keep `currentP`/`velP`/`targetP` as plain fields, so
 * the state argument is the host itself: TurboFan sees identical
 * shapes on every call.
 */
import { SLIDER_SPRING } from '@core/tokens/motion/slider.js'

/**
 * Minimal chase-spring state — the field names are the contract the
 * widget classes already carry (`currentP`/`targetP` + `velP`).
 */
export interface SpringChase {
  /** Current position (track units). */
  currentP: number
  /** Spring velocity (track units per second). */
  velP: number
  /** Chase target (track units). */
  targetP: number
}

/**
 * Advances one integration step: accelerates toward `targetP` under
 * stiffness `k` and damping `c`, then snaps to the stop once both the
 * gap and the velocity fall under the settle epsilons — without the
 * snap an underdamped spring rings sub-pixel forever.
 * @param s The chase state — mutated in place (zero allocation).
 * @param k Spring stiffness (ωn²).
 * @param c Spring damping (2ζωn).
 * @param dt Integration step in seconds (clamped upstream).
 * @param epsSettle Settle epsilon in the state's units — the slider
 *   widgets' normalized default; px-space callers (scroll spring) pass
 *   their own.
 * @param epsVel Velocity settle epsilon (state units/s) — see epsSettle.
 */
export const springStep = (
  s: SpringChase,
  k: number,
  c: number,
  dt: number,
  epsSettle: number = SLIDER_SPRING.SETTLE_EPS,
  epsVel: number = SLIDER_SPRING.VEL_EPS
): void => {
  s.velP += (-(s.currentP - s.targetP) * k - s.velP * c) * dt

  s.currentP += s.velP * dt

  if (Math.abs(s.targetP - s.currentP) < epsSettle && Math.abs(s.velP) < epsVel) {
    s.currentP = s.targetP

    s.velP = 0
  }
}
