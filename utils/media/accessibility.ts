/**
 * @file utils/media/accessibility.ts
 * @description Accessibility metadata URL builders — the single naming
 * authority for co-located WebVTT description tracks and `longdesc`
 * files. The generation pipeline (shared/scripts/media/a11y) writes
 * bucket objects under exactly these key names; the runtime (media-figure,
 * media-expanded) links exactly these URLs, so generated files and their
 * consumers can never drift.
 *
 * Naming contract (all siblings of the source media object):
 *   video  <stem>.mp4            → <stem>.vtt              (English, canonical)
 *                                → <stem>.<locale>.vtt     (15 localized tracks)
 *   image  <stem>[.variants].jpg → <stem>_longdesc.txt     (English, canonical)
 *                                → <stem>_longdesc.<locale>.txt
 */

import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { LOCALES, LOCALE_TAGS } from '@core/tokens/locales.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { LANG_OPTIONS } from '@core/i18n.js'
import { encodeMediaUrl } from '../media.js'
import { mediaKeyExists, mediaManifestReady } from './manifest.js'

/**
 * One `<track kind="descriptions">` source descriptor — everything the JSX
 * layer needs to emit the element: fetch URL, BCP-47 `srclang`, the
 * human-readable `label`, and whether this track is the `default` one the
 * browser activates when the user enables text descriptions.
 */
export interface DescriptionTrack {
  /** Fetch URL of the localized .vtt sibling. */
  src: string
  /** BCP-47 language tag stamped on `srclang` (hrk→hrx, tln→vec…). */
  srclang: string
  /** Human language name shown in caption pickers ('Português', 'Deutsch'). */
  label: string
  /** Site locale code this track serves — key for the file naming. */
  locale: string
  /** Whether the browser selects this track without user choice. */
  isDefault: boolean
}

/**
 * Bucket key (or URL) of a locale's descriptions track for a media stem —
 * `<stem>.vtt` for English (the spec's identical-name contract), dotted
 * `<stem>.<locale>.vtt` for every other language.
 * @param stem Extensionless media stem — `<storage><folder><src>` form at
 * runtime, `<folder><src>` form in the pipeline.
 * @param locale Site locale code.
 * @returns The sibling key/URL — same shape the caller handed in.
 */
export const vttKey = (stem: string, locale: string): string =>
  locale === LOCALES.EN
    ? `${stem}${MEDIA.VTT_EXT}`
    : `${stem}${CHAR_STRINGS.DOT}${locale}${MEDIA.VTT_EXT}`

/**
 * Bucket key (or URL) of a locale's longdesc file — `<stem>_longdesc.txt`
 * English canonical, `<stem>_longdesc.<locale>.txt` localized.
 * @param stem Extensionless media stem.
 * @param locale Site locale code.
 * @returns The sibling key/URL.
 */
export const longdescKey = (stem: string, locale: string): string =>
  `${stem}${MEDIA.LONGDESC_SUFFIX}${locale === LOCALES.EN ? ATTR_VALUES.EMPTY : `${CHAR_STRINGS.DOT}${locale}`}${MEDIA.LONGDESC_EXT}`

/**
 * Manifest gate mirroring the runtime convention — a derived sibling is
 * offered optimistically while the manifest is still in flight (the
 * generated a11y pipeline writes the siblings for every video, so a
 * pending proof must not strip tracks the file most likely has); once
 * landed, only manifest-PROVEN siblings emit (doomed 404s land in the
 * console audit).
 * @param url Candidate sibling URL.
 * @returns `url` when proven or still unproven, `''` when disproven.
 */
const offerUrl = (url: string): string =>
  !mediaManifestReady() || mediaKeyExists(url) ? url : ATTR_VALUES.EMPTY

/**
 * All sixteen description-track descriptors for a media stem — one per
 * supported locale, each manifest-gated. `default` lands on the visitor's
 * current UI locale when that track is offered, else on English (the
 * canonical file the spec's naming contract guarantees).
 * @param stem Extensionless media stem — `storage + mediaSrc`.
 * @param currentLocale Active UI locale ('' ⇒ English default).
 * @returns Emittable tracks — possibly empty when the manifest proves
 * no description files exist for the media.
 */
export function descriptionTracks(stem: string, currentLocale: string): DescriptionTrack[] {
  if (!stem) return []

  const tracks: DescriptionTrack[] = []

  for (const { code, label } of LANG_OPTIONS) {
    const src = offerUrl(encodeMediaUrl(vttKey(stem, code)))

    if (!src) continue

    tracks.push({
      src,
      srclang: LOCALE_TAGS[code]?.bcp || code,
      label,
      locale: code,
      isDefault: false,
    })
  }

  // Default selection: the UI locale's own descriptions first (the reader
  // hears context in the language they browse in); English is the
  // guaranteed fallback every generated media carries.
  const preferred = tracks.find((t) => t.locale === currentLocale) || tracks[0]

  if (preferred) preferred.isDefault = true

  return tracks
}

/**
 * Localized longdesc URL for an image stem — the current locale's file
 * when offered, English canonical otherwise, `''` when the manifest
 * proves neither exists.
 * @param stem Extensionless media stem — `storage + mediaSrc`.
 * @param currentLocale Active UI locale.
 * @returns Emittable `longdesc`/`aria-details` URL or ''.
 */
export function longdescUrl(stem: string, currentLocale: string): string {
  if (!stem) return ATTR_VALUES.EMPTY

  const localized = offerUrl(encodeMediaUrl(longdescKey(stem, currentLocale || LOCALES.EN)))

  if (localized) return localized

  return offerUrl(encodeMediaUrl(longdescKey(stem, LOCALES.EN)))
}
