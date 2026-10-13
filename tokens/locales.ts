/**
 * @file @core/tokens/locales.js
 * @description Supported language locales for i18n routing and CMS data
 * fetching. The codes are the keys of `translations/<locale>` in Firebase
 * and the URL prefixes on the site (`/de/…`, `/br/…`).
 */

/**
 * Locale codes. Most are ISO-639 codes; the site also serves dialects and
 * contact languages with custom codes:
 *   hrk = Hunsrik (German-Brazilian dialect), cas = Rioplatense Spanish,
 *   riv = Portuñol (Uruguay/Brazil border), gn = Guaraní, tln = Talian
 *   (Italian-Brazilian dialect), gl = Galego, ca = Català, ga = Gaeilge.
 * PT/HRX/TLI are legacy aliases kept so old URLs still resolve to a locale.
 * @type {Readonly<Record<string, string>>}
 */
export const LOCALES = Object.freeze({
  EN: 'en',
  BR: 'br',
  PT: 'pt',
  ES: 'es',
  DE: 'de',
  FR: 'fr',
  IT: 'it',
  RU: 'ru',
  HRX: 'hrx',
  HRK: 'hrk',
  CAS: 'cas',
  RIV: 'riv',
  GN: 'gn',
  TLI: 'tli',
  TLN: 'tln',
  GL: 'gl',
  CA: 'ca',
  NL: 'nl',
  GA: 'ga',
})

/**
 * Locale code → metadata tags. `bcp` is the BCP-47 tag used in `hreflang`,
 * `<html lang>` and JSON-LD `inLanguage`; `og` is the xx_YY form
 * `og:locale` requires. Dialects without a standardized region keep their
 * ISO-639-3 tag and map og:locale to the closest standardized culture.
 * Sole declaration site — the static-page generator imports this file so
 * runtime head sync and emitted HTML can never diverge.
 */
export const LOCALE_TAGS: Readonly<Record<string, Readonly<{ bcp: string; og: string }>>> =
  Object.freeze({
    en: { bcp: 'en', og: 'en_US' },
    br: { bcp: 'pt-BR', og: 'pt_BR' },
    es: { bcp: 'es', og: 'es_ES' },
    de: { bcp: 'de', og: 'de_DE' },
    hrk: { bcp: 'hrk', og: 'de_DE' },
    cas: { bcp: 'es-AR', og: 'es_AR' },
    riv: { bcp: 'es-UY', og: 'es_UY' },
    gn: { bcp: 'gn', og: 'es_PY' },
    it: { bcp: 'it', og: 'it_IT' },
    ru: { bcp: 'ru', og: 'ru_RU' },
    fr: { bcp: 'fr', og: 'fr_FR' },
    tln: { bcp: 'tln', og: 'it_IT' },
    gl: { bcp: 'gl', og: 'gl_ES' },
    ca: { bcp: 'ca', og: 'ca_ES' },
    nl: { bcp: 'nl', og: 'nl_NL' },
    ga: { bcp: 'ga', og: 'ga_IE' },
  })
