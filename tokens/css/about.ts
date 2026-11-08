/**
 * @file tokens/css/about.js
 * @description About-section CSS custom-property names — grouped subset
 * of CSS_PROPS.
 */

/**
 * About-section-related CSS custom-property names. Sole declaration site —
 * consumers import members from this frozen map rather than re-declaring
 * the literals (zero-hardcoding rule).
 */
export const ABOUT_CSS_PROPS = Object.freeze({
  /** The rendered width of the section title's text line — about/
   *  titlefit.ts measures the h2's draw-text box and publishes it here
   *  so the portrait square grows to match the "ABOUT ME" line (the
   *  stylesheet's space tokens remain the floor). */
  ABOUT_PICTURE_W: '--about-picture-w',
})
