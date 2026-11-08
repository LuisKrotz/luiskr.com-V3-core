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
  /** Edge-dissolve lane width on the <mentions-deck> strip — cardW ×
   *  FADE_FRAC, published per measure so the mask matches the fade curve. */
  MENTIONS_DECK_FADE: '--mentions-deck-fade',
  RANGE_PCT: '--range-pct',
})
