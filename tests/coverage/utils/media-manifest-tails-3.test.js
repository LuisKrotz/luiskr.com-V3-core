/**
 * @file media-manifest-tails-3.test.js
 * @description Third coverage tail for utils/media/manifest.ts — the
 * in-flight dedupe arm (`pending` already set on a concurrent init) and
 * the non-array payload arm (`Array.isArray(list)` false → empty set).
 * Fresh module state per file: this file's first init must reach the
 * fetch body, so no other scenario may latch `keys` ahead of it.
 */
import { jest } from '@jest/globals'
import { CDN_URLS } from '@core/tokens/media/urls.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'

describe('media manifest tails 3', () => {
  const KEY = 'covers/unit-cover'
  const CDN_IMG = `${CDN_URLS.CDN_BASE}${KEY}${MEDIA.EXT}`

  test('concurrent init dedupes the fetch; non-array json → empty set', async () => {
    const realFetch = globalThis.fetch
    let resolveFetch

    globalThis.fetch = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        })
    )

    const m = await import('@core/utils/media/manifest.js')

    // First call creates `pending`; the second hits the `!pending` false
    // arm and returns the same promise instead of refetching.
    const first = m.initMediaManifest()
    const second = m.initMediaManifest()

    resolveFetch({ ok: true, json: async () => 'not-an-array' })

    await Promise.all([first, second])

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(m.mediaManifestReady()).toBe(true)
    expect(m.webpIfExists(CDN_IMG)).toBe(ATTR_VALUES.EMPTY)

    globalThis.fetch = realFetch
  })
})
