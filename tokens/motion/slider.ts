/**
 * Slider spring tokens.
 *
 * Knob-spring tunables for the slider widgets (theme
 * slider, switch slider). Sole declaration site (zero-hardcoding
 * rule): the WebGL render loops, the 2D fallbacks, and the wasm
 * state pushes all chase `targetP` through the same damped spring —
 * `v += (−(p−target)·K − v·C)·dt; p += v·dt` — replacing the old
 * frame-rate-coupled geometric lerp.
 *
 * Two regimes share the integrator:
 *   SNAP — release/tap/programmatic moves: ωn=√170≈13.0 rad/s,
 *     ζ≈0.72 → ~4% overshoot, settle ≈0.4s — the little elastic
 *     arrival that reads organic instead of dead.
 *   DRAG — finger-follow: ζ=1.0 (critically damped, ωn≈20.5) — the
 *     knob tracks the pointer with a ~50ms fluid lag, never
 *     oscillates, and inherits velocity into the release snap so a
 *     flick whips into the stop.
 */
export const SLIDER_SPRING = Object.freeze({
  /** Snap-regime stiffness — ωn² of the chase spring. */
  SNAP_K: 170,
  /** Snap-regime damping — 2ζωn with ζ≈0.72 (the elastic overshoot). */
  SNAP_C: 18.8,
  /** Drag-regime stiffness — critically damped follow (ζ=1.0 ⇒ C=2√K). */
  DRAG_K: 420,
  /** Drag-regime damping — 2·√420 ≈ 41.0. */
  DRAG_C: 41,
  /**
   * Settle epsilon — |target−p| and |v| both under these values snap
   * to the stop so the knob never micro-oscillates a sub-pixel ring.
   * Sized under half a track unit of visible travel.
   */
  SETTLE_EPS: 0.0005,
  /** Velocity settle epsilon (track units per second) — see SETTLE_EPS. */
  VEL_EPS: 0.02,
  /**
   * Per-frame integration step cap (seconds) — a suspended tab resumes
   * with a finite dt instead of a spring explosion.
   */
  DT_MAX_S: 0.05,
  /** First-frame step (seconds) — the loop's initial tick assumes 60Hz. */
  DT_INIT_S: 1 / 60,
})
