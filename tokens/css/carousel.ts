/**
 * @file tokens/css/carousel.js
 * @description Carousel-related CSS custom-property names — grouped subset
 * of CSS_PROPS.
 */

/**
 * Carousel-related CSS custom-property names. Sole declaration site — consumers import members
 * from this frozen map rather than re-declaring the literals
 * (zero-hardcoding rule).
 */
export const CAROUSEL_CSS_PROPS = Object.freeze({
  CAROUSEL_ITEM_HEIGHT: '--carousel-item-height',
  CAROUSEL_MEDIA_HEIGHT: '--carousel-media-height',
  CAROUSEL_LANDSCAPE_MEDIA_HEIGHT: '--carousel-landscape-media-height',
  CAROUSEL_LANDSCAPE_MEDIA_WIDTH: '--carousel-landscape-media-width',
  RANGE_PCT: '--range-pct',
})
