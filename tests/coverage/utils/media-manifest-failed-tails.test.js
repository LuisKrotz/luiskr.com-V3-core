/**
 * @file media-manifest-failed-tails.test.js
 * @description Coverage tail for the manifest fetch-failure arm — the
 * `failed` latch, `mediaManifestFailed()`, and the subscriber fire that
 * settles originals-only renders. Runs on a fresh module registry so the
 * catch path executes before any success populates `keys`.
 */
import { jest } from '@jest/globals'
import { CDN_URLS } from '@core/tokens/media/urls.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'

describe('media manifest failure tails', () => {
  test('fetch rejection latches failed + fires subscribers into originals', async () => {
    const realFetch = globalThis.fetch

    globalThis.fetch = jest.fn(async () => {
      throw new Error('offline')
    })

    const m = await import('@core/utils/media/manifest.js')

    const fired = jest.fn()

    m.onMediaManifest(fired)

    expect(m.mediaManifestReady()).toBe(false)
    expect(m.mediaManifestFailed()).toBe(false)

    await m.initMediaManifest()

    expect(m.mediaManifestFailed()).toBe(true)
    expect(m.mediaManifestReady()).toBe(false)
    expect(fired).toHaveBeenCalledTimes(1)

    // Originals fallback — no variants resolve while unmanifested.
    expect(m.webpIfExists(`${CDN_URLS.CDN_BASE}covers/x${MEDIA.EXT}`)).toBe(ATTR_VALUES.EMPTY)

    globalThis.fetch = realFetch
  })
})
