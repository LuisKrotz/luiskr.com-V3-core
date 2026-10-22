/**
 * @file tokens/data/component-keys.js
 * @description Dotted paths into translations/<locale>/components — grouped
 * subsets by component.
 */

import {
  _B_CONTACT,
  _B_LANG_DIALOG,
  _K_CLOSE,
  _K_CREDIT,
  _K_LEGAL_FOOTER,
  _K_MEDIA,
  _K_RELATED,
  _K_RIGHTS,
  _K_SOURCE_CODE,
} from '../base.js'

/**
 * Frozen lang component key map — sole declaration site for these tokens; consumers read
 * members and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes
 * the token contract immutable at runtime.
 */
export const LANG_COMPONENT_KEYS = Object.freeze({
  LANG_TITLE: `${_B_LANG_DIALOG}.title`,
  LANG_CLOSE: `${_B_LANG_DIALOG}.${_K_CLOSE}`,
})

/**
 * Frozen media component key map — sole declaration site for these tokens; consumers read
 * members and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes
 * the token contract immutable at runtime.
 */
export const MEDIA_COMPONENT_KEYS = Object.freeze({
  MEDIA_CLOSE: `${_K_MEDIA}.${_K_CLOSE}`,
  MEDIA_TO_OPEN: `${_K_MEDIA}.toOpen`,
  MEDIA_AUDIO_NOTE: `${_K_MEDIA}.audioNote`,
})

/**
 * Frozen legal component key map — sole declaration site for these tokens; consumers read
 * members and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes
 * the token contract immutable at runtime.
 */
export const LEGAL_COMPONENT_KEYS = Object.freeze({
  LEGAL_LINKS: `${_K_LEGAL_FOOTER}.links`,
})

/**
 * Frozen source component key map — sole declaration site for these tokens; consumers read
 * members and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes
 * the token contract immutable at runtime.
 */
export const SOURCE_COMPONENT_KEYS = Object.freeze({
  SOURCE_LABEL: `${_K_SOURCE_CODE}.label`,
  SOURCE_LINK: `${_K_SOURCE_CODE}.link`,
  SOURCE_CREDIT: `${_K_SOURCE_CODE}.${_K_CREDIT}`,
  SOURCE_RIGHTS: `${_K_SOURCE_CODE}.${_K_RIGHTS}`,
})

/**
 * Placeholder inside `source-code.rights` translations — the renderers swap
 * it for the live `new Date().getFullYear()` so the copyright line never
 * goes stale.
 */
export const SOURCE_YEAR_TOKEN = '{year}'

/**
 * Placeholder inside the `a11y.*` heading templates — renderers swap it for
 * the 1-based ordinal so translators may position the number freely
 * ('Section {index}' vs '{index}. Bölüm').
 */
export const A11Y_INDEX_TOKEN = '{index}'

/**
 * Frozen section component key map — sole declaration site for these tokens; consumers read
 * members and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes
 * the token contract immutable at runtime.
 */
export const SECTION_COMPONENT_KEYS = Object.freeze({
  RELATED_TITLE: `${_K_RELATED}.title`,
  CONTACT_TITLE: `${_B_CONTACT}.title`,
})
