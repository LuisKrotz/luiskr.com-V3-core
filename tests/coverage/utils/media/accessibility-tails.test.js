/**
 * @file accessibility-tails.test.js
 * @description Coverage for core/utils/media/accessibility.ts — the naming
 * authority for co-located .vtt description tracks and _longdesc files.
 * Covers both key builders' English/localized branches, the manifest
 * offer gate (not-ready optimistic, ready-present, ready-absent), the
 * 16-track emission with UI-locale and English default selection, the
 * unknown-tag srclang fallback, and every longdescUrl resolution path.
 */
import { describe, test, expect, jest } from '@jest/globals'
import { LOCALES } from '@core/tokens/locales.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { encodeMediaUrl } from '@core/utils/media.js'

/** Mutable manifest-mock state — the mock below reads these per call, so
 *  tests steer "manifest still in flight" vs "proven key set" branches. */
let mockReady = false
let mockKeys = new Set()

jest.unstable_mockModule('@core/utils/media/manifest.js', () => ({
  mediaManifestReady: () => mockReady,
  mediaKeyExists: (url) => mockKeys.has(url),
}))

/* LANG_OPTIONS is mocked with an extra 'xx' row that has no LOCALE_TAGS
 * entry — the only way to reach the `?.bcp || code` srclang fallback,
 * since every real locale carries a bcp tag. */
jest.unstable_mockModule('@core/i18n.js', () => ({
  LANG_OPTIONS: Object.freeze([
    { code: LOCALES.EN, label: 'English' },
    { code: LOCALES.BR, label: 'Português' },
    { code: LOCALES.ES, label: 'Español' },
    { code: LOCALES.DE, label: 'Deutsch' },
    { code: LOCALES.HRK, label: 'Hunsrik' },
    { code: LOCALES.CAS, label: 'Castellano' },
    { code: LOCALES.RIV, label: 'Portuñol' },
    { code: LOCALES.GN, label: 'Guaraní' },
    { code: LOCALES.IT, label: 'Italiano' },
    { code: LOCALES.RU, label: 'Русский' },
    { code: LOCALES.FR, label: 'Français' },
    { code: LOCALES.TLN, label: 'Talian' },
    { code: LOCALES.GL, label: 'Galego' },
    { code: LOCALES.CA, label: 'Català' },
    { code: LOCALES.NL, label: 'Nederlands' },
    { code: LOCALES.GA, label: 'Gaeilge' },
    { code: 'xx', label: 'Test' },
  ]),
}))

const { vttKey, longdescKey, descriptionTracks, longdescUrl } =
  await import('@core/utils/media/accessibility.js')

const STEM = 'https://cdn.example/media/tour'

describe('media accessibility tails', () => {
  test('vttKey: English canonical stem.vtt, localized stem.<locale>.vtt', () => {
    expect(vttKey(STEM, LOCALES.EN)).toBe(`${STEM}${MEDIA.VTT_EXT}`)

    expect(vttKey(STEM, LOCALES.DE)).toBe(`${STEM}.${LOCALES.DE}${MEDIA.VTT_EXT}`)
  })

  test('longdescKey: English canonical + dotted localized', () => {
    expect(longdescKey(STEM, LOCALES.EN)).toBe(
      `${STEM}${MEDIA.LONGDESC_SUFFIX}${MEDIA.LONGDESC_EXT}`
    )

    expect(longdescKey(STEM, LOCALES.FR)).toBe(
      `${STEM}${MEDIA.LONGDESC_SUFFIX}.${LOCALES.FR}${MEDIA.LONGDESC_EXT}`
    )
  })

  test('descriptionTracks: empty stem emits nothing', () => {
    mockReady = true

    expect(descriptionTracks('', LOCALES.EN)).toEqual([])
  })

  test('manifest in flight is optimistic — all 17 tracks, UI locale default', () => {
    mockReady = false

    const tracks = descriptionTracks(STEM, LOCALES.DE)

    expect(tracks).toHaveLength(17)
    expect(tracks.find((t) => t.locale === LOCALES.DE).isDefault).toBe(true)
    expect(tracks.filter((t) => t.isDefault)).toHaveLength(1)
    expect(tracks[0].src).toBe(encodeMediaUrl(vttKey(STEM, LOCALES.EN)))
    expect(tracks[0].srclang).toBe('en')
    expect(tracks[0].label).toBe('English')
  })

  test('unknown-tag locale falls back to its code as srclang', () => {
    mockReady = false

    const tracks = descriptionTracks(STEM, 'xx')

    expect(tracks.find((t) => t.locale === 'xx').srclang).toBe('xx')
    expect(tracks.find((t) => t.locale === 'xx').isDefault).toBe(true)
  })

  test('manifest-proven-absent stems emit no tracks at all', () => {
    mockReady = true
    mockKeys = new Set()

    expect(descriptionTracks(STEM, LOCALES.EN)).toEqual([])
  })

  test('partial manifest: only offered siblings emit, default → first offered', () => {
    mockReady = true

    const en = encodeMediaUrl(vttKey(STEM, LOCALES.EN))
    const fr = encodeMediaUrl(vttKey(STEM, LOCALES.FR))

    mockKeys = new Set([en, fr])

    const tracks = descriptionTracks(STEM, LOCALES.DE)

    expect(tracks.map((t) => t.locale)).toEqual([LOCALES.EN, LOCALES.FR])
    expect(tracks[0].isDefault).toBe(true)
    expect(tracks[1].isDefault).toBe(false)
  })

  test('longdescUrl: empty stem and fully-absent manifest both yield empty', () => {
    mockReady = true
    mockKeys = new Set()

    expect(longdescUrl('', LOCALES.DE)).toBe(ATTR_VALUES.EMPTY)
    expect(longdescUrl(STEM, LOCALES.DE)).toBe(ATTR_VALUES.EMPTY)
  })

  test('longdescUrl: in-flight manifest offers the localized file', () => {
    mockReady = false

    expect(longdescUrl(STEM, LOCALES.DE)).toBe(encodeMediaUrl(longdescKey(STEM, LOCALES.DE)))
  })

  test('longdescUrl: absent localized file falls back to English canonical', () => {
    mockReady = true
    mockKeys = new Set([encodeMediaUrl(longdescKey(STEM, LOCALES.EN))])

    expect(longdescUrl(STEM, LOCALES.DE)).toBe(encodeMediaUrl(longdescKey(STEM, LOCALES.EN)))
  })

  test('longdescUrl: empty locale resolves the English path', () => {
    mockReady = false

    expect(longdescUrl(STEM, '')).toBe(encodeMediaUrl(longdescKey(STEM, LOCALES.EN)))
  })
})
