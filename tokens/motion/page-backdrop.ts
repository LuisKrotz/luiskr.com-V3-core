/**
 * @file tokens/motion/page-backdrop.js
 * @description Tuning tokens for the WebGL page backdrop — the grained
 * lobe field rendered behind every route. Buffer caps, drift periods,
 * the key/shade lobe gains and the dark-theme gain live here so the
 * shader template and the loop read one declaration (zero-hardcoding
 * rule).
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
   * Key-light drift period (seconds) — coprime with the three field
   * periods so the right-side specular pool never phase-locks into a
   * repeating pose.
   */
  PERIOD_KEY: 23,
  /**
   * Key-light peak gains — the right-side specular lobe. Dark is dimmer
   * (a soft studio pool on the near-black field); light is a stronger
   * window-light sheen over the paper.
   */
  KEY_GAIN_DARK: 0.18,
  KEY_GAIN_LIGHT: 0.4,
  /**
   * Counter-shade peak gains — the lower-left pool the key light throws.
   * Dark deepens the field corner; light is a faint sepia paper shadow.
   */
  SHADE_GAIN_DARK: 0.34,
  SHADE_GAIN_LIGHT: 0.07,
  /**
   * Film-grain base amplitude in 8-bit least-significant bits, applied
   * to a triangular (two-tap) white-noise distribution whose peak is
   * ±half the token. 2.4 LSB puts the triangular tail at ±1.2 LSB —
   * past the ±1 LSB TPDF floor that guarantees every 8-bit
   * quantization boundary gets dithered, so no contour line can
   * survive — and just far enough past it to read as very fine film
   * grain on the dark field (the eye integrates the per-frame
   * decorrelation into a stationary speckle).
   */
  GRAIN_LSB: 3.0,
  /**
   * Luminance-adaptive grain lift in LSB — multiplied by the pixel's
   * composite luminance before adding to GRAIN_LSB. An absolute LSB
   * step carries far less visible contrast on the bright paper field
   * than on near-black (Weber's law), so the grain scales with
   * luminance to read the same very-fine speckle in both themes.
   */
  GRAIN_LUM_LSB: 2.4,
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
