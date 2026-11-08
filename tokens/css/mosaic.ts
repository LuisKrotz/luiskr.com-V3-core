/**
 * @file tokens/css/mosaic.js
 * @description Mosaic-related CSS custom-property names — grouped subset
 * of CSS_PROPS.
 */

/**
 * Mosaic-related CSS custom-property names. Sole declaration site — consumers import members
 * from this frozen map rather than re-declaring the literals (zero-hardcoding rule).
 */
export const MOSAIC_CSS_PROPS = Object.freeze({
  /** Pre-pack wall-height estimate published on the project section wrapper — the
   *  media-mosaic wall reads it as min-height so deferred mosaics reserve their
   *  final box instead of shifting siblings when the real pack lands. */
  MEDIA_MOSAIC_HEIGHT: '--media-mosaic-height',
})
