/**
 * @file media-manifest-encode-tails.test.js
 * @description Coverage tail for the percent-decoded lookup arm of
 * utils/media/manifest.ts — bucket keys carry literal spaces ('brazilian
 * leather/…') but emitted URLs arrive %20-encoded; mediaKeyExists must
 * decode before comparing, and malformed escapes must fall back raw.
 * Own file because the manifest module caches its key set per module
 * instance — the spaced fixture set needs a fresh registry.
 */
import { jest } from '@jest/globals'
import { CDN_URLS } from '@core/tokens/media/urls.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'

const SPACED_KEY = 'brazilian leather/portal/shot'
const SPACED_URL = `${CDN_URLS.CDN_BASE}${SPACED_KEY}`
const ENCODED_URL = `${CDN_URLS.CDN_BASE}brazilian%20leather/portal/shot`

describe('media manifest encoded-key tails', () => {
  test('encoded input decodes to the raw bucket key; emission stays encoded', async () => {
    const realFetch = globalThis.fetch

    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => [
        `${SPACED_KEY}${MEDIA.EXT}`,
        `${SPACED_KEY}${MEDIA.WEBP_EXT}`,
        `${SPACED_KEY}${MEDIA.VIDEO_EXT}`,
        `${SPACED_KEY}${MEDIA.WEBM_EXT}`,
      ],
    }))

    const m = await import('@core/utils/media/manifest.js')

    await m.initMediaManifest()

    // Encoded input decodes for the manifest check…
    expect(m.mediaKeyExists(`${ENCODED_URL}${MEDIA.EXT}`)).toBe(true)
    expect(m.mediaKeyExists(`${SPACED_URL}${MEDIA.WEBP_EXT}`)).toBe(true)

    // …and the returned srcset candidate stays emission-encoded.
    expect(m.webpIfExists(`${SPACED_URL}${MEDIA.EXT}`)).toBe(`${ENCODED_URL}${MEDIA.WEBP_EXT}`)
    expect(m.webpIfExists(`${ENCODED_URL}${MEDIA.EXT}`)).toBe(`${ENCODED_URL}${MEDIA.WEBP_EXT}`)
    expect(m.webmIfExists(`${SPACED_URL}${MEDIA.VIDEO_EXT}`)).toBe(
      `${ENCODED_URL}${MEDIA.WEBM_EXT}`
    )

    // A malformed escape can't decodeURI — raw comparison, no throw.
    expect(m.mediaKeyExists(`${CDN_URLS.CDN_BASE}bad%zz${MEDIA.EXT}`)).toBe(false)

    // Encoded-but-absent key still reports false.
    expect(m.mediaKeyExists(`${CDN_URLS.CDN_BASE}missing%20key${MEDIA.EXT}`)).toBe(false)

    globalThis.fetch = realFetch
  })
})
