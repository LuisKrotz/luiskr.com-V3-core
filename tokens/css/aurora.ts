/**
 * @file tokens/css/aurora.js
 * @description Aurora palette CSS custom-property names — the seven hue
 * poles the light-theme backdrop lobes and the menu wash are mixed from.
 * Grouped subset of CSS_PROPS.
 */

/**
 * Aurora palette CSS custom-property names. Sole declaration site —
 * consumers (the WebGL page backdrop's theme sampler) import members
 * from this frozen map rather than re-declaring the literals
 * (zero-hardcoding rule). Order matters: `AURORA_CSS_PROP_LIST` is the
 * shader's `u_col[i]` index order.
 */
export const AURORA_CSS_PROPS = Object.freeze({
  GREEN: '--aurora-green',
  TEAL: '--aurora-teal',
  CYAN: '--aurora-cyan',
  VIOLET: '--aurora-violet',
  VIOLET_DEEP: '--aurora-violet-deep',
  MAGENTA: '--aurora-magenta',
  INDIGO: '--aurora-indigo',
})

/**
 * Shader colour-slot order — index `i` of this list is `u_col[i]` in the
 * page-backdrop fragment shader, so the GLSL lobe table and the JS
 * sampler can never disagree on which hue a slot holds.
 */
export const AURORA_CSS_PROP_LIST = Object.freeze([
  AURORA_CSS_PROPS.GREEN,
  AURORA_CSS_PROPS.TEAL,
  AURORA_CSS_PROPS.CYAN,
  AURORA_CSS_PROPS.VIOLET,
  AURORA_CSS_PROPS.VIOLET_DEEP,
  AURORA_CSS_PROPS.MAGENTA,
  AURORA_CSS_PROPS.INDIGO,
])
