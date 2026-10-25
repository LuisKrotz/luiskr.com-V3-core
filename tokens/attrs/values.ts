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
})
