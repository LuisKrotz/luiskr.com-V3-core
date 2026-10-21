/**
 * @file media-manifest-tails-4.test.js
 * @description Fourth coverage tail for utils/media/manifest.ts —
 * coverVariants(): the full matrix (thumb + mobile + webp arms), the
 * jpg-only arm (webp falls back to the original's probe), the
 * mobile-without-thumb arm, and the non-.jpg stem-strip false arm.
 * One manifest fetch populates `keys` for every probe — the module
 * latches the first payload, so each stem exercises a different combo.
 */
import { jest } from '@jest/globals'
import { CDN_URLS } from '@core/tokens/media/urls.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'

describe('media manifest tails 4', () => {
  const THUMB = `${MEDIA.MOZ}${MEDIA.THUMB_SUFFIX}${MEDIA.EXT}`
  const THUMB_WEBP = `${MEDIA.MOZ}${MEDIA.THUMB_SUFFIX}${MEDIA.WEBP_EXT}`
  const MOBILE = `${MEDIA.MOZ}${MEDIA.THUMB_SUFFIX}${MEDIA.MOBILE_SUFFIX}${MEDIA.EXT}`
  const MOBILE_WEBP = `${MEDIA.MOZ}${MEDIA.THUMB_SUFFIX}${MEDIA.MOBILE_SUFFIX}${MEDIA.WEBP_EXT}`

  const url = (key) => `${CDN_URLS.CDN_BASE}${key}`

  test('coverVariants resolves every manifest-gated arm', async () => {
    const realFetch = globalThis.fetch

    const keys = [
      // 'a' — full matrix: thumb jpg+webp, mobile jpg+webp
      `covers/a${THUMB}`,
      `covers/a${THUMB_WEBP}`,
      `covers/a${MOBILE}`,
      `covers/a${MOBILE_WEBP}`,
      // 'b' — thumb jpg only (no webp, no mobile)
      `covers/b${THUMB}`,
      // 'c' — mobile jpg without a thumb (fallback src + mobile source)
      `covers/c${MOBILE}`,
      // 'd' — only the ORIGINAL webp sibling
      `covers/d${MEDIA.WEBP_EXT}`,
    ]

    globalThis.fetch = jest.fn(async () => ({ ok: true, json: async () => keys }))

    const m = await import('@core/utils/media/manifest.js')

    await m.initMediaManifest()

    // Full matrix — every slot filled.
    const a = m.coverVariants(url(`covers/a${MEDIA.EXT}`))

    expect(a).toEqual({
      src: url(`covers/a${THUMB}`),
      webp: url(`covers/a${THUMB_WEBP}`),
      mobileJpg: url(`covers/a${MOBILE}`),
      mobileWebp: url(`covers/a${MOBILE_WEBP}`),
    })

    // Thumb jpg without webp/mobile — src swaps, webp/mobile stay empty.
    const b = m.coverVariants(url(`covers/b${MEDIA.EXT}`))

    expect(b).toEqual({
      src: url(`covers/b${THUMB}`),
      webp: ATTR_VALUES.EMPTY,
      mobileJpg: ATTR_VALUES.EMPTY,
      mobileWebp: ATTR_VALUES.EMPTY,
    })

    // Mobile without thumb — original src, mobile source still offered.
    const c = m.coverVariants(url(`covers/c${MEDIA.EXT}`))

    expect(c).toEqual({
      src: url(`covers/c${MEDIA.EXT}`),
      webp: ATTR_VALUES.EMPTY,
      mobileJpg: url(`covers/c${MOBILE}`),
      mobileWebp: ATTR_VALUES.EMPTY,
    })

    // Original webp only — webp probes the original when no thumb lands.
    const d = m.coverVariants(url(`covers/d${MEDIA.EXT}`))

    expect(d).toEqual({
      src: url(`covers/d${MEDIA.EXT}`),
      webp: url(`covers/d${MEDIA.WEBP_EXT}`),
      mobileJpg: ATTR_VALUES.EMPTY,
      mobileWebp: ATTR_VALUES.EMPTY,
    })

    // Non-.jpg input — the endsWith false arm keeps the stem whole and
    // every variant probe misses, so the input passes through unchanged.
    const e = m.coverVariants(url('covers/e.png'))

    expect(e).toEqual({
      src: url('covers/e.png'),
      webp: ATTR_VALUES.EMPTY,
      mobileJpg: ATTR_VALUES.EMPTY,
      mobileWebp: ATTR_VALUES.EMPTY,
    })

    globalThis.fetch = realFetch
  })
})
