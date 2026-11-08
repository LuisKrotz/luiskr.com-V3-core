/**
 * @file tokens/classes/project.js
 * @description Project/internal page class tokens (`internal-*` block) —
 * token group.
 */

import {
  _B_INTERNAL,
  _B_INTERNAL_DESCRIPTION,
  _B_INTERNAL_EXTRA,
  _B_INTERNAL_FOOTER,
  _B_INTERNAL_FOOTER_ITEMS,
  _B_INTERNAL_MAIN,
} from '../base.js'

/**
 * Internals (project-detail) page classes on the `internal-*` block family:
 * `internal` root, `internal-main` item grid, `internal-description` prose
 * block, `internal-extra` scroll strip, `internal-footer` related/notes
 * area, `internal-expand` trigger. `ZTF_VIDEO` is a standalone modifier
 * (zoom-to-fill) applied alongside items, not an internal-* descendant.
 */
export const INTERNAL_CLASSES = Object.freeze({
  INTERNAL: _B_INTERNAL,
  INTERNAL_TITLE: `${_B_INTERNAL}-title`,
  /** Modifier on the project title <h1> — switches the heading to the
   *  uppercase marquee strip (project view only; legal/animations keep
   *  the plain title). */
  INTERNAL_TITLE_MARQUEE_MOD: `${_B_INTERNAL}-title--marquee`,
  /** The endlessly translating marquee strip inside the marquee title. */
  INTERNAL_TITLE_STRIP: `${_B_INTERNAL}-title-marquee`,
  /** One half of the strip — N title units wide (N sized to the viewport)
   *  so the -50% translateX loop always lands on an identical seam. */
  INTERNAL_TITLE_COPY: `${_B_INTERNAL}-title-copy`,
  /** One "TITLE |" repetition inside a half — the measured unit that
   *  sizes how many repetitions fill the viewport. */
  INTERNAL_TITLE_UNIT: `${_B_INTERNAL}-title-unit`,
  /** The pipe separator trailing each title unit. */
  INTERNAL_TITLE_SEP: `${_B_INTERNAL}-title-sep`,
  INTERNAL_MAIN: _B_INTERNAL_MAIN,
  INTERNAL_MAIN_ITEM: `${_B_INTERNAL_MAIN}-item`,
  // Zoom-to-fill modifier: cover video that intentionally fills and crops the frame.
  // Apply alongside INTERNAL_MAIN_ITEM when the video should use object-fit:cover.
  ZTF_VIDEO: 'ztf-video',
  INTERNAL_DESCRIPTION: _B_INTERNAL_DESCRIPTION,
  INTERNAL_DESCRIPTION_TEXT: `${_B_INTERNAL_DESCRIPTION}-text`,
  /** Modifier on .internal-description — set by fitDescriptionSizes when the
   *  block holds a single paragraph that renders on one line at the base
   *  body size: the sentence is promoted to the TTL_XL display ramp. */
  INTERNAL_DESCRIPTION_XL: `${_B_INTERNAL_DESCRIPTION}--xl`,
  /** Modifier on .internal-description — single paragraph that wraps past
   *  one line at the base body size: promoted to the TXT_LG ramp. */
  INTERNAL_DESCRIPTION_MD: `${_B_INTERNAL_DESCRIPTION}--md`,
  INTERNAL_EXTRA: _B_INTERNAL_EXTRA,
  INTERNAL_EXTRA_SCROLL: `${_B_INTERNAL_EXTRA}-scroll`,
  INTERNAL_EXTRA_ITEM: `${_B_INTERNAL_EXTRA}-item`,
  INTERNAL_FOOTER: _B_INTERNAL_FOOTER,
  INTERNAL_FOOTER_TITLE: `${_B_INTERNAL_FOOTER}-title`,
  INTERNAL_FOOTER_RELATED: `${_B_INTERNAL_FOOTER}-related`,
  INTERNAL_FOOTER_ITEMS: _B_INTERNAL_FOOTER_ITEMS,
  INTERNAL_FOOTER_ITEMS_DIVIDER: `${_B_INTERNAL_FOOTER_ITEMS}-divider`,
  /** WebGPU overlay canvas for the divider sheen (`divider-sheen` widget). */
  INTERNAL_FOOTER_ITEMS_DIVIDER_CANVAS: `${_B_INTERNAL_FOOTER_ITEMS}-divider-canvas`,
  INTERNAL_FOOTER_ITEMS_LINK: `${_B_INTERNAL_FOOTER_ITEMS}-link`,
  INTERNAL_FOOTER_ITEMS_SEP: `${_B_INTERNAL_FOOTER_ITEMS}-separator`,
  /** Atomic separator+link unit — nowrap so a line break can only land
   *  BEFORE the pair: the dot always opens the wrapped line instead of
   *  dangling at the previous line's end. */
  INTERNAL_FOOTER_ITEMS_PAIR: `${_B_INTERNAL_FOOTER_ITEMS}-pair`,
  /** Modifier toggled on a pair that leads a wrapped line — its
   *  separator hides so the line opens on the label, not a dot. */
  INTERNAL_FOOTER_ITEMS_PAIR_LEAD: `${_B_INTERNAL_FOOTER_ITEMS}-pair--lead`,
  INTERNAL_FOOTER_ITEMS_NOTE: `${_B_INTERNAL_FOOTER_ITEMS}-note`,
  INTERNAL_FOOTER_ITEMS_NOTE_TEXT: `${_B_INTERNAL_FOOTER_ITEMS}-note-text`,
  INTERNAL_FOOTER_ITEMS_CREDIT: `${_B_INTERNAL_FOOTER_ITEMS}-credit`,
  INTERNAL_FOOTER_ITEMS_RIGHTS: `${_B_INTERNAL_FOOTER_ITEMS}-rights`,
  INTERNAL_FOOTER_ITEMS_HOME: `${_B_INTERNAL_FOOTER_ITEMS}-home`,
  /** RSS row under the legal links — wraps the locale feed anchor. */
  INTERNAL_FOOTER_ITEMS_FEED: `${_B_INTERNAL_FOOTER_ITEMS}-feed`,
  /** The feed anchor itself — the delegated SPA click handler skips it so
   *  the browser fetches the XML file instead of routing. */
  INTERNAL_FOOTER_ITEMS_FEED_LINK: `${_B_INTERNAL_FOOTER_ITEMS}-feed-link`,
  /** Inline RSS glyph (dot + two broadcast arcs) inside the feed anchor. */
  INTERNAL_FOOTER_ITEMS_FEED_ICON: `${_B_INTERNAL_FOOTER_ITEMS}-feed-icon`,
  /** One broadcast arc of the RSS glyph — staggered pulse on hover/focus. */
  INTERNAL_FOOTER_ITEMS_FEED_WAVE: `${_B_INTERNAL_FOOTER_ITEMS}-feed-wave`,
  INTERNAL_FOOTER_DOCS: `${_B_INTERNAL_FOOTER}-docs`,
  INTERNAL_FOOTER_DOCS_LINK: `${_B_INTERNAL_FOOTER}-docs-link`,
  INTERNAL_FOOTER_DOCS_DESC: `${_B_INTERNAL_FOOTER}-docs-desc`,
  /** The '→' glyph span inside the docs link. */
  INTERNAL_FOOTER_DOCS_ARROW: `${_B_INTERNAL_FOOTER}-docs-arrow`,
  /** Unified-footer top row — legal nav left, source pill + socials right. */
  INTERNAL_FOOTER_TOP: `${_B_INTERNAL_FOOTER}-top`,
  /** Left nav wrapping the legal links + the locale RSS feed item. */
  INTERNAL_FOOTER_LEGAL: `${_B_INTERNAL_FOOTER}-legal`,
  /** Right column of the top row — source-code pill above the socials row. */
  INTERNAL_FOOTER_SIDE: `${_B_INTERNAL_FOOTER}-side`,
  /** The 'PROJECT SOURCE CODE: GIT' capsule in the right column. */
  INTERNAL_FOOTER_SOURCE: `${_B_INTERNAL_FOOTER}-source`,
  INTERNAL_FOOTER_SOURCE_LINK: `${_B_INTERNAL_FOOTER}-source-link`,
  /** The home + social-channels row under the source pill. */
  INTERNAL_FOOTER_SOCIALS: `${_B_INTERNAL_FOOTER}-socials`,
  INTERNAL_EXPAND: `${_B_INTERNAL}-expand`,
})

/**
 * Frozen project class-name map — sole declaration site for these tokens; consumers read
 * members and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes
 * the token contract immutable at runtime.
 */
export const PROJECT_CLASSES = Object.freeze({
  PROJECT: 'project',
})
