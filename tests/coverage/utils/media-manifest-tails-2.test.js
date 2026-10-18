/**
 * @file media-manifest-tails-2.test.js
 * @description Second coverage tail for utils/media/manifest.ts — the
 * fetch-absent and response-not-ok arms. Module state is per test file;
 * the absent-fetch test runs first so `keys` stays null when the guard
 * re-checks `typeof fetch` — the non-ok test then latches an empty set.
 */
import { jest } from '@jest/globals'
import { CDN_URLS } from '@core/tokens/media/urls.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { TEST_URLS } from '@tests/fixtures/test-constants.js'

describe('media manifest tails 2', () => {
  const KEY = 'covers/unit-cover'
  const CDN_IMG = `${CDN_URLS.CDN_BASE}${KEY}${MEDIA.EXT}`

  test('fetch undefined → resolves unmanifested (non-fetch envs)', async () => {
    const realFetch = globalThis.fetch

    // globalThis.fetch is a non-configurable getter in Node — defineProperty
    // is the only reliable way to shadow it for the typeof check.
    Object.defineProperty(globalThis, 'fetch', { value: undefined, configurable: true })

    const m = await import('@core/utils/media/manifest.js')

    await m.initMediaManifest()

    expect(m.mediaManifestReady()).toBe(false)
    expect(m.webpIfExists(CDN_IMG)).toBe(ATTR_VALUES.EMPTY)

    Object.defineProperty(globalThis, 'fetch', { value: realFetch, configurable: true })
  })

  test('non-ok response → empty set (manifested but nothing known)', async () => {
    const realFetch = globalThis.fetch

    globalThis.fetch = jest.fn(async () => ({ ok: false }))

    const m = await import('@core/utils/media/manifest.js')

    await m.initMediaManifest()

    // Manifested (ready) but empty — every variant reads absent.
    expect(m.mediaManifestReady()).toBe(true)
    expect(m.webpIfExists(CDN_IMG)).toBe(ATTR_VALUES.EMPTY)
    expect(m.mediaKeyExists(CDN_IMG)).toBe(false)
    expect(m.webpIfExists(TEST_URLS.IMG)).toBe(ATTR_VALUES.EMPTY)
    expect(m.webmIfExists(TEST_URLS.IMG)).toBe(ATTR_VALUES.EMPTY)

    globalThis.fetch = realFetch
  })
})
