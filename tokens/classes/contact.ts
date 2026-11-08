/**
 * @file tokens/classes/contact.js
 * @description Contact section class tokens — token group.
 */

import {
  _B_CONTACT,
  _B_CONTACT_LINKS,
  _B_CONTACT_MAIL,
  _B_CONTACT_OTHER,
  _B_CONTACT_SOCIAL,
} from '../base.js'

/**
 * Contact-section classes: `contact` block (title + subtitle + channel row +
 * mentions deck mount), `contact-social` block (profile links + separator),
 * `contact-other` block (secondary links), `contact-mail` block (primary
 * e-mail channel), `contact-links` block (secondary channel list). All
 * compose `_B_*` fragments from base.ts — never re-declared.
 */
export const CONTACT_CLASSES = Object.freeze({
  CONTACT: _B_CONTACT,
  CONTACT_TITLE: `${_B_CONTACT}-title`,
  /** Subtitle line under the title ('Let's create something extraordinary'). */
  CONTACT_SUBTITLE: `${_B_CONTACT}-subtitle`,
  /** The mail + secondary-links row under the heading block. */
  CONTACT_ROW: `${_B_CONTACT}-row`,
  CONTACT_SOCIAL: _B_CONTACT_SOCIAL,
  CONTACT_SOCIAL_LINK: `${_B_CONTACT_SOCIAL}-link`,
  CONTACT_OTHER: _B_CONTACT_OTHER,
  CONTACT_OTHER_LINK: `${_B_CONTACT_OTHER}-link`,
  CONTACT_SEPARATOR: `${_B_CONTACT_SOCIAL}-separator`,
  /** Primary mailto channel — desktop: label over large address; mobile: filled pill. */
  CONTACT_MAIL: _B_CONTACT_MAIL,
  CONTACT_MAIL_LABEL: `${_B_CONTACT_MAIL}-label`,
  CONTACT_MAIL_ADDR: `${_B_CONTACT_MAIL}-addr`,
  /** Secondary channel list — desktop: arrow links + captions; mobile: outline pills. */
  CONTACT_LINKS: _B_CONTACT_LINKS,
  CONTACT_LINKS_ITEM: `${_B_CONTACT_LINKS}-item`,
  CONTACT_LINKS_LINK: `${_B_CONTACT_LINKS}-link`,
  CONTACT_LINKS_CAPTION: `${_B_CONTACT_LINKS}-caption`,
  /** The '→' glyph span inside each secondary channel link (desktop only). */
  CONTACT_LINKS_ARROW: `${_B_CONTACT_LINKS}-arrow`,
  /** Wrapper region the <mentions-deck> mounts into. */
  CONTACT_MENTIONS: `${_B_CONTACT}-mentions`,
})
