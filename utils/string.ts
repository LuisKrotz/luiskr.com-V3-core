/**
 * @file utils/string.ts
 * @description Small pure string transforms — HTML stripping for
 * plain-text contexts (schema.org, meta descriptions, aria labels) and
 * slug/case helpers for id generation.
 */
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'

/**
 * Strips HTML tags iteratively to prevent malformed or nested tags from leaking.
 * A single `replace(/<[^>]*>/)` pass can leave a reconstructed tag behind
 * (input like `<scr<script>ipt>` collapses into `<script>`), so the loop
 * re-runs until the string is stable — this is the classic "iterated
 * sanitization" defense: each pass may expose a tag assembled from
 * fragments of the previous pass.
 * Pure ESM utility function, tree-shakeable.
 * @param str Raw markup-bearing text.
 * @returns Text with every `<…>` span removed.
 */
export const stripHtml = (str: string): string => {
  if (!str || typeof str !== TYPE_STRINGS.STRING) return ATTR_VALUES.EMPTY

  let prev: string

  let curr = str

  do {
    prev = curr

    curr = curr.replace(/<[^>]*>/g, ATTR_VALUES.EMPTY)
  } while (curr !== prev)

  return curr
}

/** Meta descriptions cap at ~160 chars — Google's SERP snippet budget. */
const META_DESCRIPTION_MAX = 160

/**
 * Compacts markup-bearing CMS text into a meta-description string:
 * `<br>` collapses to a space (it is a line break, not a word boundary),
 * remaining tags strip via the iterated sanitizer, named/numeric entities
 * decode so `&nbsp;` doesn't survive into the content attribute, runs of
 * whitespace collapse to one space, and overlong text cuts at the last
 * word boundary inside `max` — never mid-word.
 * Pure ESM utility function, tree-shakeable.
 * @param str Raw CMS text (may contain tags/entities).
 * @param max Character budget — defaults to the SERP limit.
 * @returns Plain-text description ≤ max chars.
 */
export const toMetaDescription = (str: string, max: number = META_DESCRIPTION_MAX): string => {
  const text = stripHtml(
    String(str || ATTR_VALUES.EMPTY).replace(/<br\s*\/?>/gi, CHAR_STRINGS.SPACE_CHAR)
  )
    .replace(/&nbsp;/gi, CHAR_STRINGS.SPACE_CHAR)
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, CHAR_STRINGS.SPACE_CHAR)
    .trim()

  if (text.length <= max) return text

  const cut = text.slice(0, max)

  return cut.slice(0, Math.max(cut.lastIndexOf(CHAR_STRINGS.SPACE_CHAR), 0)).trim()
}

/**
 * Escapes HTML-significant characters for safe insertion into innerHTML or
 * double-quoted attributes. `&` must be replaced first so the entities
 * emitted by the later replacements are not double-escaped.
 * Pure ESM utility function, tree-shakeable.
 * @param {string} str — raw text that may contain &, <, >, ", '
 * @returns {string} entity-escaped text safe for markup contexts
 */
export const escapeHtml = (str: string): string => {
  if (!str || typeof str !== TYPE_STRINGS.STRING) return ATTR_VALUES.EMPTY

  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Converts a string into a clean, URL-safe and DOM-id-safe slug.
 * Pipeline: NFD-fold diacritics to ASCII → lowercase → trim → collapse
 * every non-alphanumeric run to a single `-` → strip edge dashes. e.g.
 * "METCHA — Leather!" → "metcha-leather", "Cecerelê: tour" →
 * "cecerele-tour", "aboutmarco.com" → "aboutmarco-com".
 * MUST stay byte-identical to the slugify in shared/scripts/build
 * (generate-sitemap.js + build-locale-pages.mjs): it computes the media
 * deep-link segment both at runtime (modal write/read) and at build
 * (emitted pages + sitemap URLs), so the two transforms have to agree
 * or indexed /portfolio/<p>/<media> links stop auto-opening.
 * @param text Display text to slug.
 * @returns URL/id-safe slug, or '' for non-string input.
 */
export const slugify = (text: string): string => {
  if (!text || typeof text !== TYPE_STRINGS.STRING) return ATTR_VALUES.EMPTY

  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ATTR_VALUES.EMPTY)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, ATTR_VALUES.EMPTY)
}
