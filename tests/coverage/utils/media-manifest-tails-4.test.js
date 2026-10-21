/**
 * @file media-manifest-tails-4.test.js
 * @description Fourth coverage tail for utils/media/manifest.ts —
 * coverVariants(): the LQIP matrix (thumb + mobile + webp arms), the
 * jpg-only arm (webp falls back to the original's probe), the
 * mobile-without-thumb arm, the non-.jpg stem-strip false arm, and
 * coverRungs(): the ascending quality ladder (q50 → q75 → original →
 * uncompressed) — each derivative gated on the manifest, the original
 * always trusted. One manifest fetch populates `keys` for every probe —
 * the module latches the first payload, so each stem exercises a
 * different combo.
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
  const Q50 = `${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`
  const Q50_WEBP = `${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.WEBP_EXT}`
  const Q75 = `${MEDIA.MOZ}${MEDIA.Q75}${MEDIA.EXT}`
  const Q100 = `${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`
  const Q100_WEBP = `${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.WEBP_EXT}`

  const url = (key) => `${CDN_URLS.CDN_BASE}${key}`

  test('coverVariants resolves every manifest-gated arm', async () => {
    const realFetch = globalThis.fetch

    const keys = [
      // 'a' — full LQIP matrix: thumb jpg+webp, mobile jpg+webp
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
      // 'f' — thumb + q50 jpg+webp: the ladder opens on q50
      `covers/f${THUMB}`,
      `covers/f${Q50}`,
      `covers/f${Q50_WEBP}`,
      // 'g' — thumb + original webp: the ladder is the original rung
      `covers/g${THUMB}`,
      `covers/g${MEDIA.WEBP_EXT}`,
      // 'h' — thumb + every tier: the full q50 → q75 → orig → q100 climb
      `covers/h${THUMB}`,
      `covers/h${Q50}`,
      `covers/h${Q75}`,
      `covers/h${Q100}`,
      `covers/h${Q100_WEBP}`,
    ]

    globalThis.fetch = jest.fn(async () => ({ ok: true, json: async () => keys }))

    const m = await import('@core/utils/media/manifest.js')

    await m.initMediaManifest()

    // Full LQIP matrix — ladder is the single always-trusted original rung.
    const a = m.coverVariants(url(`covers/a${MEDIA.EXT}`))

    expect(a).toEqual({
      src: url(`covers/a${THUMB}`),
      webp: url(`covers/a${THUMB_WEBP}`),
      mobileJpg: url(`covers/a${MOBILE}`),
      mobileWebp: url(`covers/a${MOBILE_WEBP}`),
      rungs: [{ jpg: url(`covers/a${MEDIA.EXT}`), webp: ATTR_VALUES.EMPTY }],
    })

    // Thumb jpg without webp/mobile — src swaps, webp/mobile stay empty.
    const b = m.coverVariants(url(`covers/b${MEDIA.EXT}`))

    expect(b).toEqual({
      src: url(`covers/b${THUMB}`),
      webp: ATTR_VALUES.EMPTY,
      mobileJpg: ATTR_VALUES.EMPTY,
      mobileWebp: ATTR_VALUES.EMPTY,
      rungs: [{ jpg: url(`covers/b${MEDIA.EXT}`), webp: ATTR_VALUES.EMPTY }],
    })

    // Mobile without thumb — original src, mobile source still offered;
    // no LQIP means there is nothing to climb (rungs stays empty).
    const c = m.coverVariants(url(`covers/c${MEDIA.EXT}`))

    expect(c).toEqual({
      src: url(`covers/c${MEDIA.EXT}`),
      webp: ATTR_VALUES.EMPTY,
      mobileJpg: url(`covers/c${MOBILE}`),
      mobileWebp: ATTR_VALUES.EMPTY,
      rungs: [],
    })

    // Original webp only — webp probes the original when no thumb lands.
    const d = m.coverVariants(url(`covers/d${MEDIA.EXT}`))

    expect(d).toEqual({
      src: url(`covers/d${MEDIA.EXT}`),
      webp: url(`covers/d${MEDIA.WEBP_EXT}`),
      mobileJpg: ATTR_VALUES.EMPTY,
      mobileWebp: ATTR_VALUES.EMPTY,
      rungs: [],
    })

    // Non-.jpg input — the endsWith false arm keeps the stem whole and
    // every variant probe misses, so the input passes through unchanged.
    const e = m.coverVariants(url('covers/e.png'))

    expect(e).toEqual({
      src: url('covers/e.png'),
      webp: ATTR_VALUES.EMPTY,
      mobileJpg: ATTR_VALUES.EMPTY,
      mobileWebp: ATTR_VALUES.EMPTY,
      rungs: [],
    })

    // Thumb + q50 pair — the ladder opens on the proven q50 (with its
    // webp sibling) then lands on the always-trusted original.
    const f = m.coverVariants(url(`covers/f${MEDIA.EXT}`))

    expect(f).toEqual({
      src: url(`covers/f${THUMB}`),
      webp: ATTR_VALUES.EMPTY,
      mobileJpg: ATTR_VALUES.EMPTY,
      mobileWebp: ATTR_VALUES.EMPTY,
      rungs: [
        { jpg: url(`covers/f${Q50}`), webp: url(`covers/f${Q50_WEBP}`) },
        { jpg: url(`covers/f${MEDIA.EXT}`), webp: ATTR_VALUES.EMPTY },
      ],
    })

    // Thumb + original webp — the single rung carries the proven webp.
    const g = m.coverVariants(url(`covers/g${MEDIA.EXT}`))

    expect(g).toEqual({
      src: url(`covers/g${THUMB}`),
      webp: ATTR_VALUES.EMPTY,
      mobileJpg: ATTR_VALUES.EMPTY,
      mobileWebp: ATTR_VALUES.EMPTY,
      rungs: [{ jpg: url(`covers/g${MEDIA.EXT}`), webp: url(`covers/g${MEDIA.WEBP_EXT}`) }],
    })

    // Every tier proven — the ladder climbs q50 → q75 → original →
    // uncompressed, the q100 webp sibling riding its own rung.
    const h = m.coverVariants(url(`covers/h${MEDIA.EXT}`))

    expect(h).toEqual({
      src: url(`covers/h${THUMB}`),
      webp: ATTR_VALUES.EMPTY,
      mobileJpg: ATTR_VALUES.EMPTY,
      mobileWebp: ATTR_VALUES.EMPTY,
      rungs: [
        { jpg: url(`covers/h${Q50}`), webp: ATTR_VALUES.EMPTY },
        { jpg: url(`covers/h${Q75}`), webp: ATTR_VALUES.EMPTY },
        { jpg: url(`covers/h${MEDIA.EXT}`), webp: ATTR_VALUES.EMPTY },
        { jpg: url(`covers/h${Q100}`), webp: url(`covers/h${Q100_WEBP}`) },
      ],
    })

    // coverRungs direct — the non-.jpg arm keeps the stem whole and only
    // the passthrough original rung survives.
    expect(m.coverRungs(url('covers/e.png'))).toEqual([
      { jpg: url('covers/e.png'), webp: ATTR_VALUES.EMPTY },
    ])

    globalThis.fetch = realFetch
  })
})
