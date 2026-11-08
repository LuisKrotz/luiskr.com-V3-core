/**
 * @file core/locale/lang-slugs.ts
 * @description Canonical localized route-slug table — the per-locale path
 * segments after the locale prefix. English is canonical/un-prefixed; every
 * other locale maps its routes through this table. CMS may override these
 * at runtime via `translations/<loc>/slugs`.
 *
 * This file is a ZERO-IMPORT leaf by design: node build scripts
 * (scripts/build/build-locale-pages.mjs, scripts/build/generate-sitemap.js) import it
 * directly with native type stripping — any import here would break plain-
 * node resolution (`.js` specifiers only resolve under bundler/jest).
 */

/** One locale's localized route segments (keys match the router's route ids). */
export interface LangSlugMap {
  about: string
  contact: string
  privacy: string
  gdpr: string
  terms: string
  license: string
  earthPlayground: string
  starField: string
  animations: string
  search: string
  sitemap: string
}

/**
 * Localized route slugs per locale — the path segments after the locale
 * prefix. English is canonical/un-prefixed; every other locale maps its
 * routes through this table (`/br/sobre`, `/de/nutzungsbedingungen`, …).
 * CMS may override these at runtime via `translations/<loc>/slugs`.
 *
 * Slugs are ASCII-folded (no diacritics — `ueber` not `über`,
 * `termes-d-us` not `termes-d'ús`) so URLs survive servers and clients
 * that mishandle percent-encoded UTF-8, and stay readable when pasted
 * into plain-text contexts.
 */
export const LANG_SLUGS: Record<string, LangSlugMap> = {
  en: {
    about: 'about',
    contact: 'contact',
    privacy: 'privacy-policy',
    gdpr: 'gdpr',
    terms: 'terms-of-use',
    license: 'license',
    earthPlayground: 'earth-playground',
    starField: 'star-field-experiment',
    animations: 'animations',
    search: 'search',
    sitemap: 'sitemap',
  },
  br: {
    about: 'sobre',
    contact: 'contato',
    privacy: 'politica-de-privacidade',
    gdpr: 'lgpd',
    terms: 'termos-de-uso',
    license: 'licenca',
    earthPlayground: 'playground-da-terra',
    starField: 'experimento-campo-estelar',
    animations: 'animacoes',
    search: 'pesquisar',
    sitemap: 'mapa-do-site',
  },
  es: {
    about: 'acerca',
    contact: 'contacto',
    privacy: 'politica-de-privacidad',
    gdpr: 'rgpd',
    terms: 'terminos-de-uso',
    license: 'licencia',
    earthPlayground: 'playground-de-la-tierra',
    starField: 'experimento-campo-estelar',
    animations: 'animaciones',
    search: 'busqueda',
    sitemap: 'mapa-del-sitio',
  },
  de: {
    about: 'ueber',
    contact: 'kontakt',
    privacy: 'datenschutzrichtlinie',
    gdpr: 'dsgvo',
    terms: 'nutzungsbedingungen',
    license: 'lizenz',
    earthPlayground: 'erde-playground',
    starField: 'sternenfeld-experiment',
    animations: 'animationen',
    search: 'suche',
    sitemap: 'sitemap',
  },
  hrk: {
    about: 'iwwer-mich',
    contact: 'kontakt',
    privacy: 'dateschutz-erklerung',
    gdpr: 'datenschutz',
    terms: 'nutzungsbedingunge',
    license: 'lizenz',
    earthPlayground: 'erd-playground',
    starField: 'sternfeld-experiment',
    animations: 'animatsione',
    search: 'suach',
    sitemap: 'sitemap',
  },
  cas: {
    about: 'sobre-mi',
    contact: 'contacto',
    privacy: 'politica-de-privacidad',
    gdpr: 'rgpd',
    terms: 'terminos-de-uso',
    license: 'licencia',
    earthPlayground: 'playground-de-la-tierra',
    starField: 'experimento-campo-estelar',
    animations: 'animaciones',
    search: 'busca',
    sitemap: 'mapa-del-sitio',
  },
  riv: {
    about: 'sobre-yo',
    contact: 'contato',
    privacy: 'politica-de-privacidade',
    gdpr: 'lgpd-gdpr',
    terms: 'termos-de-uso',
    license: 'licenca',
    earthPlayground: 'playground-da-terra',
    starField: 'experimento-campo-estelar',
    animations: 'animacoes',
    search: 'busca',
    sitemap: 'mapa-do-site',
  },
  gn: {
    about: 'che-rehegua',
    contact: 'kontakt',
    privacy: 'marandu-nangarekoha',
    gdpr: 'lgpd-gdpr',
    terms: 'oipuruva-nemoarandu',
    license: 'licencia',
    earthPlayground: 'yvy-nembosarai',
    starField: 'mbyja-nembosarai',
    animations: 'jeguama',
    search: 'jeheka',
    sitemap: 'pe-saito-mapa',
  },
  it: {
    about: 'chi-sono',
    contact: 'contatti',
    privacy: 'informativa-sulla-privacy',
    gdpr: 'gdpr',
    terms: 'termini-di-utilizzo',
    license: 'licenza',
    earthPlayground: 'playground-della-terra',
    starField: 'esperimento-campo-stellare',
    animations: 'animazioni',
    search: 'ricerca',
    sitemap: 'mappa-del-sito',
  },
  ru: {
    about: 'obo-mne',
    contact: 'kontakty',
    privacy: 'politika-konfidentsialnosti',
    gdpr: 'gdpr',
    terms: 'usloviya-ispolzovaniya',
    license: 'litsenziya',
    earthPlayground: 'zemnaya-pesochnitsa',
    starField: 'zvezdnoe-pole',
    animations: 'animatsii',
    search: 'poisk',
    sitemap: 'karta-sajta',
  },
  fr: {
    about: 'a-propos',
    contact: 'contact',
    privacy: 'politique-de-confidentialite',
    gdpr: 'rgpd',
    terms: 'conditions-utilisation',
    license: 'licence',
    earthPlayground: 'playground-de-la-terre',
    starField: 'experience-champ-etoile',
    animations: 'animations',
    search: 'recherche',
    sitemap: 'plan-du-site',
  },
  tln: {
    about: 'de-mi',
    contact: 'contato',
    privacy: 'informativa-su-la-privacy',
    gdpr: 'gdpr',
    terms: 'condission-de-uso',
    license: 'lisensa',
    earthPlayground: 'playground-della-terra',
    starField: 'esperimento-canpo-stelare',
    animations: 'animassion',
    search: 'cir',
    sitemap: 'mapa-del-sito',
  },
  gl: {
    about: 'sobre-min',
    contact: 'contacto',
    privacy: 'politica-de-privacidade',
    gdpr: 'rgpd',
    terms: 'termos-de-uso',
    license: 'licenza',
    earthPlayground: 'playground-da-terra',
    starField: 'experimento-campo-estelar',
    animations: 'animacions',
    search: 'busca',
    sitemap: 'mapa-do-sitio',
  },
  ca: {
    about: 'quant-a-mi',
    contact: 'contacte',
    privacy: 'politica-de-privacitat',
    gdpr: 'rgpd',
    terms: 'termes-d-us',
    license: 'llicencia',
    earthPlayground: 'playground-de-la-terra',
    starField: 'experiment-camp-estelar',
    animations: 'animacions',
    search: 'cerca',
    sitemap: 'mapa-del-lloc',
  },
  nl: {
    about: 'over-mij',
    contact: 'contact',
    privacy: 'privacybeleid',
    gdpr: 'avg',
    terms: 'gebruiksvoorwaarden',
    license: 'licentie',
    earthPlayground: 'aarde-playground',
    starField: 'sterrenveld-experiment',
    animations: 'animaties',
    search: 'zoeken',
    sitemap: 'sitemap',
  },
  ga: {
    about: 'faoi-mhe',
    contact: 'teagmhail',
    privacy: 'beartas-probhaideachta',
    gdpr: 'gdpr',
    terms: 'tearmai-usaide',
    license: 'ceadunas',
    earthPlayground: 'playground-an-domhain',
    starField: 'turgnamh-reimse-realta',
    animations: 'beochan',
    search: 'cuardach',
    sitemap: 'mapa-an-tsuimh',
  },
}
