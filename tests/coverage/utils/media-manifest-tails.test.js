/**
 * @file media-manifest-tails.test.js
 * @description Coverage tail for utils/media/manifest.ts — the runtime gate
 * that keeps 404-prone webp/webm <source>s out of the DOM. Covers the
 * pre-fetch unknown state, a successful fetch, fetch-dedupe, a rejected
 * fetch, and the CDN_BASE key normalization.
 */
import { jest } from '@jest/globals'
import { CDN_URLS } from '@core/tokens/media/urls.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { TEST_URLS } from '@tests/fixtures/test-constants.js'

describe('media manifest tails', () => {
  const KEY = 'covers/unit-cover'
  const CDN_IMG = `${CDN_URLS.CDN_BASE}${KEY}${MEDIA.EXT}`
  const CDN_WEBP = `${CDN_URLS.CDN_BASE}${KEY}${MEDIA.WEBP_EXT}`

  test('manifest absent → variants report unknown/empty', async () => {
    const m = await import('@core/utils/media/manifest.js')

    expect(m.mediaManifestReady()).toBe(false)
    expect(m.mediaKeyExists(CDN_IMG)).toBe(false)
    expect(m.webpIfExists(CDN_IMG)).toBe(ATTR_VALUES.EMPTY)
    expect(m.webmIfExists(`${CDN_URLS.CDN_BASE}${KEY}${MEDIA.VIDEO_EXT}`)).toBe(ATTR_VALUES.EMPTY)
    expect(m.webpIfExists(ATTR_VALUES.EMPTY)).toBe(ATTR_VALUES.EMPTY)
    expect(m.webpIfExists(TEST_URLS.IMG)).toBe(ATTR_VALUES.EMPTY)

    // Non-jpg input has no webp grammar — empty regardless of manifest.
    expect(m.webpIfExists(`${CDN_URLS.CDN_BASE}${KEY}.png`)).toBe(ATTR_VALUES.EMPTY)
  })

  test('fetch rejection clears pending → a later call can retry', async () => {
    const realFetch = globalThis.fetch

    globalThis.fetch = jest.fn(async () => {
      throw new Error('offline')
    })

    const m = await import('@core/utils/media/manifest.js')

    await m.initMediaManifest()

    expect(m.mediaManifestReady()).toBe(false)
    expect(m.webpIfExists(CDN_IMG)).toBe(ATTR_VALUES.EMPTY)

    globalThis.fetch = realFetch
  })

  test('fetch success → set populated, CDN_BASE stripped for lookups', async () => {
    const realFetch = globalThis.fetch

    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => [
        `${KEY}${MEDIA.EXT}`,
        `${KEY}${MEDIA.WEBP_EXT}`,
        `${KEY}${MEDIA.WEBM_EXT}`,
      ],
    }))

    const m = await import('@core/utils/media/manifest.js')

    await m.initMediaManifest()

    // Repeat call resolves immediately — keys already present.
    await m.initMediaManifest()

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(m.mediaManifestReady()).toBe(true)
    expect(m.mediaKeyExists(CDN_IMG)).toBe(true)
    expect(m.webpIfExists(CDN_IMG)).toBe(CDN_WEBP)
    expect(m.webmIfExists(`${CDN_URLS.CDN_BASE}${KEY}${MEDIA.VIDEO_EXT}`)).toBe(
      `${CDN_URLS.CDN_BASE}${KEY}${MEDIA.WEBM_EXT}`
    )

    // Non-CDN URL can't be in the bucket set; non-list json also safe.
    expect(m.mediaKeyExists(TEST_URLS.IMG)).toBe(false)
    expect(m.webpIfExists(`${CDN_URLS.CDN_BASE}${KEY}${MEDIA.EXT}x`)).toBe(ATTR_VALUES.EMPTY)

    // jpg exists but its webp was never generated → no <source>.
    expect(m.webpIfExists(`${CDN_URLS.CDN_BASE}unconverted/pic${MEDIA.EXT}`)).toBe(
      ATTR_VALUES.EMPTY
    )
    expect(m.webmIfExists(`${CDN_URLS.CDN_BASE}unconverted/clip${MEDIA.VIDEO_EXT}`)).toBe(
      ATTR_VALUES.EMPTY
    )

    globalThis.fetch = realFetch
  })
})
