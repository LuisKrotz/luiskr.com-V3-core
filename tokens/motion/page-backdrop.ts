/**
 * @file tokens/motion/page-backdrop.js
 * @description Tuning tokens for the WebGL page backdrop — the dithered
 * aurora lobe field rendered behind every route. Buffer caps, drift
 * periods and the dark-theme gain live here so the shader template and
 * the loop read one declaration (zero-hardcoding rule).
 */

/**
 * Frozen page-backdrop tuning map — sole declaration site for these
 * tokens; consumers read members and never re-declare the numbers.
 */
export const PAGE_BACKDROP = Object.freeze({
  /**
   * Backing-store devicePixelRatio cap. The field is smooth colour with
   * an in-shader dither, so rendering past 2× adds GPU fill for no
   * visible gain; 2× keeps retina output at native pixels so the dither
   * lands per device pixel instead of being upsampled into blur.
   */
  DPR_MAX: 2,
  /**
   * Per-axis backing-store cap in device pixels — 4K-wide at 1× or a
   * 2× laptop panel both fit; beyond this the browser's bilinear
   * downsample of a 32-bit-dithered field is still band-free.
   */
  MAX_DIM: 4096,
  /**
   * Drift periods (seconds) for the three lobe layers — pairwise
   * coprime so the layers never phase-lock into a repeating pose; these
   * mirror the former CSS keyframe durations (16/21/27s).
   */
  PERIOD_1: 16,
  PERIOD_2: 21,
  PERIOD_3: 27,
  /**
   * Dark-theme alpha gain applied to every lobe peak — the dark field
   * keeps the same parallax structure at ember strength (≈0.04 peak)
   * so the near-black canvas never lights up.
   */
  DARK_GAIN: 0.14,
  /**
   * Light-theme gain — lobe peaks render as authored.
   */
  LIGHT_GAIN: 1,
})
