/**
 * @file tokens/css/starfield.js
 * @description Star-field CSS custom-property names set from JS — grouped
 * token group.
 */

/**
 * Star-field CSS custom-property names. Sole declaration site — consumers
 * import members from this frozen map rather than re-declaring the
 * literals (zero-hardcoding rule).
 */
export const SF_CSS_PROPS = Object.freeze({
  /**
   * Leader-line rotation for the hover/hint tooltip — JS writes the
   * edge-indicator angle (deg) while the marker is clamped to the canvas
   * edge so the hairline points toward the off-screen body.
   */
  TIP_ANGLE: '--sf-tip-angle',
})
