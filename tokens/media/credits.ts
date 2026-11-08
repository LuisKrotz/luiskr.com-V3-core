/**
 * @file tokens/media/credits.ts
 * @description Explicit credit vocabulary for third-party dossier media
 * (star-field body images and videos). Each raw credit string the
 * registry data carries maps to its source, original host and licence
 * posture; `creditTextFor` expands the pair into the structured
 * `creditText` the JSON-LD emitters publish, so image search can read
 * where an asset came from, where it is hosted, under what terms it
 * is used here, and which page displays it. Shared by the runtime
 * schema builder (core/utils/schema.ts) and the build-time generator
 * (shared/scripts/build/build-locale-pages.mjs) so both emit identical
 * credit text. Only the site owner's own captures carry the owner's
 * name; third-party assets never do.
 */

/** Source record for one third-party credit string. */
export interface MediaCreditSource {
  /** Human-readable originating agency or collection. */
  source: string
  /** Original host the asset is published on. */
  host: string
  /** Licence posture as published by the source. */
  license: string
  /**
   * Canonical page stating the source's licence terms — emitted as
   * ImageObject/VideoObject `license` + `acquireLicensePage` for credited
   * assets so the licensable badge lands on the real terms page, never
   * the site's own legal page (the site's MPL grant does not cover
   * third-party imagery).
   */
  licenseUrl: string
}

/** Labels for each credit field, kept as tokens so the expansion stays literal-free. */
export const MEDIA_CREDIT_LABELS = {
  SOURCE: 'Source',
  HOST: 'Original host',
  LICENSE: 'License',
  USAGE: 'Current usage',
} as const

/** Separator between credit fields inside one creditText string. */
export const MEDIA_CREDIT_SEPARATOR = ' · '

/**
 * Registry credit string → source record. Keys match the `credit`
 * values in experiments/star-field/public/data/<locale>/<body>.json
 * exactly. NASA imagery is a US government work (public domain under
 * NASA's media usage guidelines); the Wikimedia-routed entry defers to
 * the licence on its Commons file page because individual files differ.
 */
export const MEDIA_CREDIT_SOURCES: Record<string, MediaCreditSource> = {
  NASA: {
    source: 'NASA',
    host: 'nasa.gov',
    license: 'US government work, public domain under NASA media usage guidelines',
    licenseUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
  },
  'NASA Goddard': {
    source: 'NASA Goddard Space Flight Center',
    host: 'nasa.gov',
    license: 'US government work, public domain under NASA media usage guidelines',
    licenseUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
  },
  'NASA/JPL — via Wikimedia Commons': {
    source: 'NASA/JPL',
    host: 'commons.wikimedia.org',
    license: 'NASA/JPL image; the licence stated on the Wikimedia Commons file page applies',
    licenseUrl: 'https://commons.wikimedia.org/wiki/Commons:Licensing',
  },
}

/**
 * Expands a registry credit into structured creditText — source, original
 * host, licence and current usage (the dossier page it appears on). Credits
 * without a source record pass through verbatim so new data never loses its
 * credit while the map is being extended.
 * @param credit  Raw registry credit string (e.g. 'NASA').
 * @param subject Display name of the body the asset illustrates.
 * @returns Structured creditText, or the raw credit when no source record exists.
 */
export const creditTextFor = (credit: string, subject: string): string => {
  const entry = MEDIA_CREDIT_SOURCES[credit]

  if (!entry) return credit

  return [
    `${MEDIA_CREDIT_LABELS.SOURCE}: ${entry.source}`,
    `${MEDIA_CREDIT_LABELS.HOST}: ${entry.host}`,
    `${MEDIA_CREDIT_LABELS.LICENSE}: ${entry.license}`,
    `${MEDIA_CREDIT_LABELS.USAGE}: ${subject} dossier, luiskr.com Star Field`,
  ].join(MEDIA_CREDIT_SEPARATOR)
}

/**
 * Resolves the canonical licence-terms URL for a registry credit — the
 * SOURCE's page (NASA media guidelines, Commons licensing), never the
 * site's. Returns undefined for credits without a source record so
 * emitters omit the licence pair rather than misattribute the asset.
 * @param credit Raw registry credit string (e.g. 'NASA').
 * @returns Absolute licence URL, or undefined when the credit is unmapped.
 */
export const creditLicenseUrlFor = (credit: string): string | undefined =>
  MEDIA_CREDIT_SOURCES[credit]?.licenseUrl

/** Inputs for the shared media-provenance field bag. */
export interface MediaProvenanceFields {
  /**
   * Absolute licence URL — the locale's legal page for site-owned
   * assets, the source's terms page for credited third-party assets.
   * Undefined omits both licence properties.
   */
  licenseUrl?: string
  /** Copyright/attribution notice — '© owner' for owned assets, the raw
   *  credit for third-party ones. */
  copyrightNotice?: string
  /** Structured credit line — owner name or `creditTextFor` output. */
  creditText?: string
}

/**
 * Assembles the Schema.org provenance properties every media entity
 * (ImageObject/VideoObject) carries — `license` + `acquireLicensePage`
 * always resolve to the same target so Google Images can flag the asset
 * as licensable and land the click on the terms page. The property
 * names are declared once here for every emitter (runtime schema.ts,
 * share-gallery.ts, build-locale-pages.mjs) so the JSON-LD vocabulary
 * cannot drift between surfaces.
 * @param fields Resolved licence URL, notice and credit line.
 * @returns Field bag to spread into the entity literal.
 */
export const mediaProvenanceFields = (fields: MediaProvenanceFields): Record<string, unknown> => ({
  ...(fields.licenseUrl
    ? { license: fields.licenseUrl, acquireLicensePage: fields.licenseUrl }
    : {}),
  ...(fields.copyrightNotice ? { copyrightNotice: fields.copyrightNotice } : {}),
  ...(fields.creditText ? { creditText: fields.creditText } : {}),
})
