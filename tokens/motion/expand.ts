/**
 * @file tokens/motion/expand.ts
 * @description Constants for the px-space expansion spring —
 * panel/list heights that grow and collapse to their measured content
 * size. Same integrator contract as CAROUSEL_SPRING (springStep k/c +
 * settle epsilons + dt clamps + a starved-rAF watchdog) — kept as its
 * own token so retuning one surface never drags the other.
 */

/**
 * Frozen expand-spring map — sole declaration site for these constants.
 * Damping ζ≈1.0 (critically damped): the expansion settles onto the
 * target without overshoot — an expanding box that dips below its
 * content would clip rows mid-flight; organic comes from the velocity
 * the chase inherits on mid-flight retargets, not from bounce.
 */
export const EXPAND_SPRING = Object.freeze({
  /** Spring stiffness — ωn² in px-space. */
  K: 140,
  /** Spring damping — 2ζωn with ζ≈1.0 (critically damped, no bounce). */
  C: 24,
  /**
   * Settle epsilon (px) — gap under this with velocity under VEL_EPS
   * snaps to the target so the spring never micro-rings sub-pixel.
   */
  SETTLE_PX: 0.5,
  /** Velocity settle epsilon (px/s) — see SETTLE_PX. */
  VEL_EPS: 30,
  /** Per-frame integration step cap (s) — suspended-tab resume safety. */
  DT_MAX_S: 0.05,
  /** First-frame step (s) — the loop's initial tick assumes 60Hz. */
  DT_INIT_S: 1 / 60,
  /**
   * Watchdog (ms) — force-settles the expansion when rAF starves
   * (hidden tab) so the caller's settle callback can never latch.
   */
  MAX_MS: 900,
  /** Travel floor (px) — sub-2px changes write instantly, no frames burnt. */
  MIN_TRAVEL_PX: 2,
})
