/**
 * @file media-manifest-onmanifest-tails.test.js
 * @description Coverage tail for onMediaManifest — the arrival-subscription
 * surface mosaics/related cards use to re-render manifest-gated pictures.
 * Covers subscribe-then-fire on fetch landing, unsubscribe-before-land,
 * and the synchronous-fire arm once the key set is populated.
 */
import { jest } from '@jest/globals'
import { CDN_URLS } from '@core/tokens/media/urls.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'

describe('onMediaManifest tails', () => {
  const KEY = 'covers/onmanifest-cover'
  const CDN_IMG = `${CDN_URLS.CDN_BASE}${KEY}${MEDIA.EXT}`

  test('subscribers fire when the fetch lands; disposer detaches', async () => {
    const realFetch = globalThis.fetch

    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => [`${KEY}${MEDIA.EXT}`, `${KEY}${MEDIA.WEBP_EXT}`],
    }))

    const m = await import('@core/utils/media/manifest.js')

    const fired = jest.fn()
    const dropped = jest.fn()

    const unsub = m.onMediaManifest(fired)
    const unsubDrop = m.onMediaManifest(dropped)

    unsubDrop()

    expect(fired).not.toHaveBeenCalled()
    expect(dropped).not.toHaveBeenCalled()

    await m.initMediaManifest()

    expect(fired).toHaveBeenCalledTimes(1)
    expect(dropped).not.toHaveBeenCalled()

    // Listener set drained — a second landing can never re-fire.
    unsub()

    globalThis.fetch = realFetch
  })

  test('manifest already loaded → cb fires synchronously, disposer is a noop', async () => {
    const m = await import('@core/utils/media/manifest.js')

    const fired = jest.fn()
    const unsub = m.onMediaManifest(fired)

    expect(fired).toHaveBeenCalledTimes(1)
    expect(m.mediaKeyExists(CDN_IMG)).toBe(true)

    unsub()
  })
})
