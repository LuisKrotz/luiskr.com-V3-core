/**
 * @file core/locale/portfolio-word.ts
 * @description The print title-cover's second line — the single display
 * word "Portfolio" resolved per locale. This is a display word, not a
 * route slug (localized path segments live in lang-slugs.ts) and not a
 * fetched dictionary key (the Firebase dictionaries carry sentences, not
 * this standalone mark) — a static per-locale table like LOCALE_TAGS.
 *
 * Dialects borrow their parent language's word: Hunsrik/Talian print the
 * German/Italian form, Rioplatense/Galego/Guaraní the Spanish loan, and
 * Portuñol the Portuguese form — matching the dialectOf routing in
 * LOCALE_TRANSLATE.
 */

import { LOCALES } from '@core/tokens/locales.js'

/**
 * Locale code → the localized "Portfolio" word as printed on the title
 * cover — the routable codes plus the legacy aliases (pt/hrx/tli)
 * pinned to their sibling language's word.
 * @type {Readonly<Record<string, string>>}
 */
export const PORTFOLIO_WORD: Readonly<Record<string, string>> = Object.freeze({
  [LOCALES.EN]: 'Portfolio',
  [LOCALES.BR]: 'Portfólio',
  [LOCALES.PT]: 'Portfólio',
  [LOCALES.ES]: 'Portafolio',
  [LOCALES.DE]: 'Portfolio',
  [LOCALES.HRK]: 'Portfolio',
  [LOCALES.HRX]: 'Portfolio',
  [LOCALES.CAS]: 'Portafolio',
  [LOCALES.RIV]: 'Portfólio',
  [LOCALES.GN]: 'Portafolio',
  [LOCALES.IT]: 'Portfolio',
  [LOCALES.TLI]: 'Portfolio',
  [LOCALES.TLN]: 'Portfolio',
  [LOCALES.RU]: 'Портфолио',
  [LOCALES.FR]: 'Portfolio',
  [LOCALES.GL]: 'Portafolio',
  [LOCALES.CA]: 'Portafoli',
  [LOCALES.NL]: 'Portfolio',
  [LOCALES.GA]: 'Punann',
})

/**
 * Resolves the cover's "Portfolio" word for a locale code — unknown codes
 * and the legacy aliases fall back to English (the canonical form).
 * @param lang Route locale code, e.g. 'br'.
 * @returns The localized word.
 */
export const portfolioWord = (lang: string): string =>
  PORTFOLIO_WORD[lang] ?? PORTFOLIO_WORD[LOCALES.EN]
