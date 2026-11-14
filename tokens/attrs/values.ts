/**
 * @file tokens/attrs/values.js
 * @description Generic attribute-value tokens — token group.
 */

/**
 * Generic attribute-value tokens. Sole declaration site — consumers import members
 * from this frozen map rather than re-declaring the literals
 * (zero-hardcoding rule).
 */
export const ATTR_VALUES = Object.freeze({
  EMPTY: '',
  TRUE: 'true',
  FALSE: 'false',
  NONE: 'none',
  BLOCK: 'block',
  FLEX: 'flex',
  AUTO: 'auto',
  HIDDEN: 'hidden',
  VISIBLE: 'visible',
  SMOOTH: 'smooth',
  INSTANT: 'instant',
  DELAY_25: '25',
  NEGATIVE_TABINDEX: '-1',
  /** tabindex="0" — the single tab stop inside roving-tabindex widgets. */
  TABINDEX_ZERO: '0',
  /** URL scheme prefix check + img loading/audio-video preload values. */
  HTTP: 'http',
  LAZY: 'lazy',
  /** `off` — autocomplete/spellcheck disable value. */
  OFF: 'off',
  /** `horizontal` — aria-orientation value for left/right sliders. */
  HORIZONTAL: 'horizontal',
  /** `currentColor` — SVG fill/stroke keyword inheriting the document ink. */
  CURRENT_COLOR: 'currentColor',
  /** `cover` — object-fit keyword: the layer fills its box, cropping overflow. */
  COVER: 'cover',
  /** `scale-down` — object-fit keyword: letterboxes the layer (contain, never
   * upscale) so its box can keep transparent bands. */
  SCALE_DOWN: 'scale-down',
})
