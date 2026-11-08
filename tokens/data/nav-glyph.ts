/**
 * @file tokens/data/nav-glyph.ts
 * @description Nav glyph motion tokens — the wasm artifact URL, the emitter
 * kinds, the particle record layout and the canvas frame shared by the
 * nav-glyph bridge and the search/brush icons. Values mirror the constants in
 * rust/nav-glyph/src/lib.rs; change both together.
 */

/**
 * Frozen nav-glyph token map — sole declaration site for the particle
 * engine's artifact URL, emitter kinds, record layout and frame geometry;
 * the TS bridge and both nav icons read members instead of re-declaring
 * the numbers, so the JS side stays in lockstep with the rust constants.
 */
export const NAV_GLYPH = Object.freeze({
  /** wasm-pack glue module URL (served from website/public). */
  GLUE_URL: '/wasm/nav-glyph/luiskr_nav_glyph.js',
  /** Emitter kind — speed streaks across the search prompt. */
  KIND_STREAK: 0,
  /** Emitter kind — sparks riding the preferences brush swoosh. */
  KIND_SWOOSH: 1,
  /** Particle pool capacity (rust POOL). */
  POOL: 96,
  /** Floats per particle record: x, y, alpha, size, hue (rust STRIDE). */
  STRIDE: 5,
  /** Canvas frame origin in viewBox units — the glyph's center sits here. */
  FRAME_ORIGIN: 48,
  /** Canvas frame span in viewBox units — three glyph widths. */
  FRAME_SPAN: 144,
  /** Streak stroke width in viewBox units. */
  STREAK_WIDTH: 1.6,
  /** Hue below this picks the first palette color, otherwise the second. */
  HUE_SPLIT: 0.5,
  /** Energy floor below which the frame loop goes back to sleep. */
  SLEEP_EPS: 0.002,
  /** Deterministic jitter seed for the particle pool. */
  SEED: 2654435769,
})
