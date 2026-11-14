/**
 * @file tokens/css/field.js
 * @description Backdrop-field palette CSS custom-property names — the
 * seven material poles the page-field lobes and the menu wash are mixed
 * from. Light theme pins paper/newsprint tints; dark mode re-pins the
 * same slots to dim metal tones. Grouped subset of CSS_PROPS.
 */

/**
 * Field palette CSS custom-property names. Sole declaration site —
 * consumers (the WebGL page backdrop's theme sampler) import members
 * from this frozen map rather than re-declaring the literals
 * (zero-hardcoding rule). Order matters: `FIELD_CSS_PROP_LIST` is the
 * shader's `u_col[i]` index order.
 */
export const FIELD_CSS_PROPS = Object.freeze({
  CREAM: '--field-cream',
  SAND: '--field-sand',
  BONE: '--field-bone',
  PARCHMENT: '--field-parchment',
  OCHRE: '--field-ochre',
  CANVAS: '--field-canvas',
  UMBER: '--field-umber',
  /**
   * Newsprint ink pole — sampled by the shader's counter-shade lobe
   * (NOT a u_col slot: it mixes the field darker, not into a hue lobe).
   */
  INK: '--field-ink',
  /**
   * Specular white — the key light's tint; pure white in both themes
   * (studio specular reads neutral over paper and metal alike).
   */
  SPECULAR: '--color-white-raw',
})

/**
 * Shader colour-slot order — index `i` of this list is `u_col[i]` in the
 * page-backdrop fragment shader, so the GLSL lobe table and the JS
 * sampler can never disagree on which material a slot holds.
 */
export const FIELD_CSS_PROP_LIST = Object.freeze([
  FIELD_CSS_PROPS.CREAM,
  FIELD_CSS_PROPS.SAND,
  FIELD_CSS_PROPS.BONE,
  FIELD_CSS_PROPS.PARCHMENT,
  FIELD_CSS_PROPS.OCHRE,
  FIELD_CSS_PROPS.CANVAS,
  FIELD_CSS_PROPS.UMBER,
])
