/**
 * @file tokens/motion/frame-budget.ts
 * @description Animation frame-budget constants — the per-frame work
 * ceiling every render-loop path must stay under. Sole declaration
 * site (zero-hardcoding rule): consumers import these instead of
 * re-declaring millisecond literals.
 */

/**
 * Animation frame budgets in milliseconds. The site targets high-rate
 * displays: mobile renders at ≥120Hz (8.33ms/frame) and desktop at
 * ≥240Hz (4.16ms/frame). Per-frame JS work (rAF callbacks, pointermove
 * handlers that touch visual state, tick math) must complete inside
 * these ceilings — anything heavier routes through worker/WASM/GPU
 * paths per the perf-compute-offload conventions.
 */
export const FRAME_BUDGET = Object.freeze({
  /** Mobile floor — 120Hz ⇒ ~8.33ms per frame. */
  MOBILE_MS: 1000 / 120,
  /** Desktop floor — 240Hz ⇒ ~4.17ms per frame. */
  DESKTOP_MS: 1000 / 240,
  /** Mobile refresh floor the animation gate enforces, in Hz. */
  MOBILE_HZ: 120,
  /** Desktop refresh floor the animation gate enforces, in Hz. */
  DESKTOP_HZ: 240,
  /** Media-heavy route floor — project pages dense with carousels and
   *  media figures cannot sustain the native-refresh bound under
   *  full-viewport raster pressure; the fluid-display minimum (60Hz) is
   *  the honest gate there — anything below it is a real regression. */
  HEAVY_ROUTE_HZ: 60,
})
