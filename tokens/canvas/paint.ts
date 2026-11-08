/**
 * @file tokens/canvas/paint.ts
 * @description Canvas/GLSL paint-color tokens — sole declaration site
 * for every color painted by the widget shaders and 2D context
 * fallbacks. GLSL entries are pre-formatted `vec3(...)` source strings
 * interpolated straight into shader templates (the token-injection
 * pattern SKELETON_GLYPH already uses); CSS entries are hex strings for
 * ctx.strokeStyle/fillStyle sites. Where a value matches a SCSS token
 * the doc names it — TURQUOISE_TOP is `$neon-teal`/`$cms-accent`
 * (#66fcf1).
 */

/** GLSL `vec3(...)` source strings — interpolate into shader templates. */
export const CANVAS_PAINT_GLSL = Object.freeze({
  // ── Close/burger liquid disc ─────────────────────────────────────
  /** Neutral disc background (non-HC). */
  DISC_BG: 'vec3(0.22, 0.23, 0.27)',
  /** Liquid body — the deep end of the turquoise pour ramp. */
  TURQUOISE_DEEP: 'vec3(0.18, 0.65, 0.62)',
  /** Liquid surface — `$neon-teal` #66fcf1, the awards-bar accent. */
  TURQUOISE_TOP: 'vec3(0.40, 0.988, 0.945)',
  /** Foam-crest glow riding the liquid surface. */
  FOAM_CREST: 'vec3(0.75, 1.0, 0.98)',
  /** Rising-bubble highlight inside the liquid. */
  BUBBLE_HI: 'vec3(0.85, 1.0, 0.98)',
  /** Pure-white ink/stroke pole. */
  INK_WHITE: 'vec3(1.0, 1.0, 1.0)',

  // ── Burger glyph ─────────────────────────────────────────────────
  /** Glyph pulse peak on the dark surface. */
  GLYPH_DARK: 'vec3(0.95, 0.97, 1.0)',
  /** Glyph pulse trough on the light surface. */
  GLYPH_LIGHT: 'vec3(0.10, 0.10, 0.14)',
  /** Ambient glyph glow on the dark surface. */
  GLOW_DARK: 'vec3(0.55, 0.58, 0.65)',
  /** Ambient glyph glow on the light surface. */
  GLOW_LIGHT: 'vec3(0.15, 0.15, 0.22)',

  // ── Switch-slider track & contexts ──────────────────────────────
  /** Off-state track fill. */
  TRACK_OFF: 'vec3(0.18, 0.19, 0.22)',
  /** Stats context — emerald-green on state. */
  TRACK_STATS: 'vec3(0.08, 0.58, 0.36)',
  /** Grid context — cyan-blueprint on state. */
  TRACK_GRID: 'vec3(0.06, 0.48, 0.72)',
  /** Motion context — violet/magenta on state. */
  TRACK_MOTION: 'vec3(0.48, 0.24, 0.68)',
  /** Contrast context — warm-amber on state. */
  TRACK_CONTRAST: 'vec3(0.78, 0.50, 0.08)',
  /** ECG wave — off-state grey. */
  WAVE_OFF: 'vec3(0.35, 0.40, 0.45)',
  /** ECG wave — on-state green. */
  WAVE_ON: 'vec3(0.45, 1.0, 0.65)',
  /** Blueprint grid lines — off-state slate. */
  GRID_OFF: 'vec3(0.30, 0.35, 0.42)',
  /** Blueprint grid lines — on-state cyan. */
  GRID_ON: 'vec3(0.50, 0.85, 1.0)',
  /** Wind-drift streak (motion-off). */
  STREAK: 'vec3(0.85, 0.70, 1.0)',
  /** Calm centerline datum (motion-on). */
  DATUM: 'vec3(0.95, 0.85, 1.0)',
  /** Contrast wipe — dark side. */
  WIPE_DARK: 'vec3(0.05, 0.05, 0.08)',
  /** Near-white surface (wipe light side, knob base). */
  SURFACE_NEAR_WHITE: 'vec3(0.98, 0.98, 1.0)',
  /** Amber seam riding the contrast boundary. */
  SEAM: 'vec3(1.0, 0.78, 0.30)',
  /** Knob dot — off-state grey. */
  DOT_OFF: 'vec3(0.6, 0.65, 0.7)',
  /** Knob dot — stats on-state. */
  DOT_STATS: 'vec3(0.1, 0.85, 0.45)',
  /** Knob dot — grid on-state. */
  DOT_GRID: 'vec3(0.1, 0.65, 0.95)',
  /** Knob dot — motion on-state. */
  DOT_MOTION: 'vec3(0.65, 0.4, 0.95)',
  /** Knob dot — contrast on-state. */
  DOT_CONTRAST: 'vec3(1.0, 0.75, 0.25)',
  /** Solid black (bezel/shadow mixes). */
  BLACK: 'vec3(0.0, 0.0, 0.0)',

  // ── Theme-slider day/night scene ────────────────────────────────
  /** Night sky — zenith end. */
  SKY_NIGHT_A: 'vec3(0.38, 0.28, 0.60)',
  /** Night sky — horizon end. */
  SKY_NIGHT_B: 'vec3(0.46, 0.35, 0.70)',
  /** System-twilight sky — zenith end. */
  SKY_SYS_A: 'vec3(0.60, 0.38, 0.52)',
  /** System-twilight sky — horizon end. */
  SKY_SYS_B: 'vec3(0.72, 0.48, 0.62)',
  /** Day sky — zenith end. */
  SKY_DAY_A: 'vec3(0.92, 0.48, 0.40)',
  /** Day sky — horizon end. */
  SKY_DAY_B: 'vec3(0.98, 0.64, 0.50)',
  /** Sun core cream. */
  SUN_CREAM: 'vec3(0.99, 0.90, 0.75)',
  /** Corona ring — inner. */
  RING_INNER: 'vec3(0.98, 0.76, 0.60)',
  /** Corona ring — outer. */
  RING_OUTER: 'vec3(0.96, 0.64, 0.52)',
  /** Aurora wave — cool end. */
  AURORA_COOL: 'vec3(0.38, 0.78, 0.92)',
  /** Aurora wave — warm end. */
  AURORA_WARM: 'vec3(0.85, 0.45, 0.80)',
  /** Back mesa — night. */
  MESA_BACK_NIGHT: 'vec3(0.34, 0.16, 0.49)',
  /** Back mesa — system twilight. */
  MESA_BACK_SYS: 'vec3(0.52, 0.24, 0.45)',
  /** Back mesa — day. */
  MESA_BACK_DAY: 'vec3(0.76, 0.30, 0.40)',
  /** Front dune — night. */
  MESA_FRONT_NIGHT: 'vec3(0.42, 0.22, 0.58)',
  /** Front dune — system twilight. */
  MESA_FRONT_SYS: 'vec3(0.62, 0.30, 0.50)',
  /** Front dune — day. */
  MESA_FRONT_DAY: 'vec3(0.85, 0.40, 0.48)',
  /** Interactive ripple tint. */
  RIPPLE: 'vec3(0.35, 0.25, 0.45)',
  /** Knob drop-shadow tint. */
  KNOB_SHADOW: 'vec3(0.12, 0.08, 0.20)',
  /** Knob base — system position. */
  KNOB_SYS: 'vec3(0.98, 0.94, 0.90)',
  /** Knob base — day position. */
  KNOB_SUN: 'vec3(0.99, 0.89, 0.73)',
  /** Lunar crater fill. */
  CRATER: 'vec3(0.88, 0.89, 0.92)',
  /** Knob corona — day position. */
  HALO_SUN: 'vec3(1.0, 0.82, 0.50)',
  /** Knob corona — system position. */
  HALO_SYS: 'vec3(0.85, 0.72, 0.98)',

  /** Split-flag dividing line — near-black hairline (`vec4` w/ alpha). */
  FLAG_DIVIDER: 'vec4(0.1, 0.1, 0.1, 1.0)',
})

/** CSS hex strings — 2D-context fallbacks (ctx.strokeStyle/fillStyle). */
export const CANVAS_PAINT_CSS = Object.freeze({
  /** `$neon-teal`/`$cms-accent` — the site accent (TURQUOISE_TOP's hex). */
  NEON_TEAL: '#66fcf1',
})
