/**
 * @file tokens/classes/reader.js
 * @description Reader-mode content class tokens — the prerendered article
 * Readability extracts (Firefox/Safari reader views can't pierce shadow
 * DOM, so the light-DOM article is the only surface they can read).
 */

/**
 * Frozen reader-content class-name map — sole declaration site for these
 * tokens; consumers import members rather than re-declaring the literals
 * (zero-hardcoding rules 4–5). The build-time page generator emits
 * `reader-content` on the same <article> the runtime hoists offscreen.
 */
export const READER_CLASSES = Object.freeze({
  /** Marks the prerendered <article> carrying the page's readable copy. */
  CONTENT: 'reader-content',
  /** Post-mount modifier — the app shell replaces the article visually,
   * so it parks offscreen (still DOM-present for reader mode + AI agents). */
  OFFSCREEN: 'reader-content--offscreen',
  /** Build-time modifier for media-less routes — with no LQIP to paint,
   * the article's own text is the only early-LCP candidate, so it stays
   * painted under the intro veil instead of parking offscreen at once. */
  PAINTED: 'reader-content--painted',
})
