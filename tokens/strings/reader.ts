/**
 * @file tokens/strings/reader.js
 * @description Reader-mode content string tokens — the accessible label
 * carried by the parked reader-content <article> (see classes/reader.js
 * for the element contract).
 */

/**
 * Frozen reader-content string map — sole declaration site for these
 * tokens; consumers import members rather than re-declaring the literals
 * (zero-hardcoding rules 4–5).
 */
export const READER_STRINGS = Object.freeze({
  /**
   * `aria-label` on the parked <article> — names the region landmark so
   * accessibility checkers accept it as self-contained (the label is
   * never announced: aria-hidden removes the subtree from the AT tree;
   * it exists only to satisfy landmark-labelling rules).
   */
  STATIC_COPY_LABEL: 'Static page copy',
})
