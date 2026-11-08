/**
 * @file tokens/motion/marquee.js
 * @description Marquee motion tokens — the internals project-title ticker:
 * copy count, drift speed and the pre-measure fallback duration.
 */

/**
 * Frozen title-marquee map — sole declaration site for these tokens; consumers read members and
 * never re-declare the literals (zero-hardcoding rules 4–5). Object.freeze makes the token
 * contract immutable at runtime.
 */
export const TITLE_MARQUEE = Object.freeze({
  /** Identical halves inside the strip — two is the minimum for a
   *  seamless translateX(-50%) loop; each half repeats the title enough
   *  times to span the viewport so the seam never shows. */
  COPIES: 2,
  /** Pre-measure title repetitions per half — the render default before
   *  the JS pass derives ceil(viewportW ÷ unitW) + SAFETY_REPEAT. */
  MIN_REPEAT: 4,
  /** Extra repetitions past the exact viewport fill — absorbs font-swap
   *  width drift and sub-pixel rounding so a gap never opens at the edge. */
  SAFETY_REPEAT: 1,
  /** Drift speed in px/s — slow enough to read as a living title, fast
   *  enough to notice the motion (≈ one viewport every ~16s at 1440px). */
  SPEED_PX_S: 90,
  /** Pre-measure animation duration (s) — the CSS fallback while the
   *  JS pass that derives duration = copyW ÷ SPEED_PX_S is pending. */
  FALLBACK_S: 60,
})
