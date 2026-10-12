/**
 * @file tokens/starfield/params/post.ts
 * @description Post-processing chain tuning for the star-field engine —
 * the RenderPipeline stack (bloom → vignette → film grain) that lifts
 * the chart from a flat render to an HDR-composited frame. Values mirror
 * the earth engine's conservative defaults; bloom stays threshold-gated
 * so only genuinely bright sources (suns, coronae, nebula cores, the
 * accretion ring) bleed light instead of the whole frame fogging.
 */

/** RenderPipeline post-chain parameters. */
export const SF_POST = Object.freeze({
  /**
   * Bloom luminance gate — only texels above this threshold bleed into
   * the bloom pyramid. 0.55 keeps nebula glows and star cores blooming
   * while the mid-tone planet textures and the skybox stay sharp.
   */
  BLOOM_THRESHOLD: 0.55,
  /** Bloom contribution added on top of the scene color. */
  BLOOM_STRENGTH: 0.85,
  /** Bloom blur radius — wider reads dreamier, tighter reads optical. */
  BLOOM_RADIUS: 0.6,
  /**
   * Vignette edge darkness + reach — a whisper of lens falloff so the
   * frame edges recede like a real eyepiece/sensor, never a black oval.
   */
  VIGNETTE_DARKNESS: 0.5,
  VIGNETTE_OFFSET: 0.55,
  /**
   * Film-grain intensity — just enough noise to kill the banding that
   * additive glow gradients leave on dark space backgrounds.
   */
  GRAIN_INTENSITY: 0.035,
})
