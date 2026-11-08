/**
 * @file tokens/classes/awards.js
 * @description Awards footer class tokens — token group.
 */

import {
  _B_AWARDS_FOOTER,
  _B_AWARDS_FOOTER_LINKS,
  _B_AWARDS_FOOTER_PROGRESS,
  _B_AWARDS_FOOTER_PROGRESS_FILL,
} from '../base.js'

/**
 * Frozen awards class-name map — sole declaration site for these tokens; consumers read
 * members and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes
 * the token contract immutable at runtime.
 */
export const AWARDS_CLASSES = Object.freeze({
  AWARDS_FOOTER: _B_AWARDS_FOOTER,
  /** Top row of the legal band — legal nav left, source-code pill right. */
  AWARDS_FOOTER_TOP: `${_B_AWARDS_FOOTER}-top`,
  AWARDS_FOOTER_TITLE: `${_B_AWARDS_FOOTER}-title`,
  AWARDS_FOOTER_HEADER: `${_B_AWARDS_FOOTER}-header`,
  AWARDS_FOOTER_PROGRESS: _B_AWARDS_FOOTER_PROGRESS,
  AWARDS_FOOTER_PROGRESS_FILL: _B_AWARDS_FOOTER_PROGRESS_FILL,
  AWARDS_FOOTER_PROGRESS_FILL_RUNNING: `${_B_AWARDS_FOOTER_PROGRESS_FILL}--running`,
  AWARDS_FOOTER_PROGRESS_HIDDEN: `${_B_AWARDS_FOOTER_PROGRESS}--hidden`,
  AWARDS_FOOTER_LINKS: _B_AWARDS_FOOTER_LINKS,
  AWARDS_FOOTER_ITEM: `${_B_AWARDS_FOOTER_LINKS}-item`,
  AWARDS_FOOTER_SEP: `${_B_AWARDS_FOOTER_LINKS}-sep`,
  /** RSS feed anchor — last legal-nav entry; the delegated SPA click
   *  handler skips it so the browser fetches the XML file natively. */
  AWARDS_FOOTER_FEED: `${_B_AWARDS_FOOTER_LINKS}-feed`,
  /** Inline RSS glyph (dot + two broadcast arcs) inside the feed anchor. */
  AWARDS_FOOTER_FEED_ICON: `${_B_AWARDS_FOOTER_LINKS}-feed-icon`,
  /** One broadcast arc of the RSS glyph — staggered pulse on hover/focus. */
  AWARDS_FOOTER_FEED_WAVE: `${_B_AWARDS_FOOTER_LINKS}-feed-wave`,
  AWARDS_FOOTER_SKEL: `${_B_AWARDS_FOOTER}-skel`,
})
