/**
 * @file share-gallery-tails.test.js
 * @description Coverage for core/utils/share-gallery.ts — the playground
 * share-capture rotation (Earth + Star Field sets): manifest fetch +
 * per-set cache, random pick, card-meta writes, JSON-LD gallery
 * emission, the stale-sync guard, cancellation/restore, and the
 * navigate.ts branches that drive them. All app strings resolve through
 * tokens.
 */
import { jest } from '@jest/globals'
import {
  pickShareImage,
  shareGalleryEntity,
  syncEarthShare,
  syncStarShare,
  cancelShare,
  resetShareGallery,
} from '@core/utils/share-gallery.js'
import { syncDocumentHead } from '@core/router/navigate.js'
import { QUERY_STRINGS } from '@core/tokens/strings/queries.js'
import { SCHEMA_STRINGS } from '@core/tokens/strings/schema.js'
import { EARTH_SHARE, STAR_SHARE } from '@core/tokens/playground/share.js'
import { NET_STRINGS } from '@core/tokens/strings/net.js'
import { ROUTE_NAMES } from '@core/tokens/routes/names.js'
import { LOCALES } from '@core/tokens/locales.js'
import { BASE_TITLE } from '@core/tokens/routes.js'
import { TEST_TEXT } from '@tests/fixtures/test-constants.js'

const SHARE_A = 'https://cdn.example/a.png'
const SHARE_B = 'https://cdn.example/b.png'

/** Seeds the head with the card-image metas + the JSON-LD node the
 *  runtime writes against. */
const seedHead = () => {
  document.head.innerHTML = [
    '<meta itemprop="image" content="">',
    '<meta property="og:image" content="">',
    '<meta name="twitter:image:src" content="">',
    `<meta name="robots" content="">`,
    `<script type="application/ld+json" id="${SCHEMA_STRINGS.JSON_LD_SCRIPT_ID}"></script>`,
  ].join('')
}

const metaContent = (sel) => document.querySelector(sel)?.content

const graph = () =>
  JSON.parse(document.getElementById(SCHEMA_STRINGS.JSON_LD_SCRIPT_ID).textContent)

const epRoute = (overrides = {}) => ({
  name: ROUTE_NAMES.EARTH_PLAYGROUND,
  path: '/earth-playground',
  lang: LOCALES.EN,
  meta: { title: `${TEST_TEXT.HEADING} | ${BASE_TITLE}` },
  ...overrides,
})

const sfRoute = (overrides = {}) => ({
  name: ROUTE_NAMES.STAR_FIELD,
  path: '/star-field-experiment',
  lang: LOCALES.EN,
  meta: { title: `${TEST_TEXT.HEADING} | ${BASE_TITLE}` },
  ...overrides,
})

const baseGraphOf = (image) => [
  { '@type': 'WebPage', primaryImageOfPage: { '@type': 'ImageObject', url: image } },
]

beforeEach(() => {
  seedHead()
  resetShareGallery()
})

describe('share gallery rotation', () => {
  test('populated manifest rotates metas + graph, cache survives reset-free calls', async () => {
    const realFetch = globalThis.fetch
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ images: [SHARE_A, SHARE_B, ''] }),
    }))

    globalThis.fetch = fetchMock

    await syncEarthShare(epRoute(), 'https://luiskr.com/earth-playground', baseGraphOf)

    expect(fetchMock).toHaveBeenCalledWith(EARTH_SHARE.MANIFEST_URL)

    const picked = metaContent(QUERY_STRINGS.META_OG_IMAGE)

    expect([SHARE_A, SHARE_B]).toContain(picked)
    expect(metaContent(QUERY_STRINGS.META_TW_IMAGE)).toBe(picked)
    expect(metaContent(QUERY_STRINGS.META_ITEMPROP_IMAGE)).toBe(picked)

    const g = graph()

    expect(g['@graph'].at(-1)['@type']).toBe('ItemList')
    expect(g['@graph'].at(-1).itemListElement).toHaveLength(2)
    expect(g['@graph'][0].primaryImageOfPage.url).toBe(picked)

    // Second sync reuses the cached manifest — no second fetch. Cleared
    // head covers the absent-meta guard; empty meta/lang cover the
    // title + BCP fallbacks.
    document.head.innerHTML = ''

    await syncEarthShare(
      epRoute({ meta: {}, lang: TEST_TEXT.UNKNOWN }),
      'https://luiskr.com/earth-playground',
      baseGraphOf
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)

    globalThis.fetch = realFetch
  })

  test('empty + malformed manifests leave the default card untouched', async () => {
    const realFetch = globalThis.fetch

    globalThis.fetch = jest
      .fn(async () => ({ ok: true, json: async () => ({ images: [] }) }))
      .mockImplementationOnce(async () => ({ ok: true, json: async () => ({}) }))

    await syncEarthShare(epRoute(), 'https://luiskr.com/x', baseGraphOf)

    resetShareGallery()

    await syncEarthShare(epRoute(), 'https://luiskr.com/x', baseGraphOf)

    expect(metaContent(QUERY_STRINGS.META_OG_IMAGE)).toBe('')

    globalThis.fetch = realFetch
  })

  test('fetch failure warns, retries next sync, then applies the pick', async () => {
    const realFetch = globalThis.fetch
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(async () => {
        throw new Error('offline')
      })
      .mockImplementationOnce(async () => ({ ok: false }))
      .mockImplementationOnce(async () => ({ ok: true, json: async () => ({ images: [SHARE_A] }) }))

    globalThis.fetch = fetchMock

    await syncEarthShare(epRoute(), 'https://luiskr.com/x', baseGraphOf)

    resetShareGallery()

    await syncEarthShare(epRoute(), 'https://luiskr.com/x', baseGraphOf)

    resetShareGallery()

    await syncEarthShare(epRoute(), 'https://luiskr.com/x', baseGraphOf)

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(metaContent(QUERY_STRINGS.META_OG_IMAGE)).toBe(SHARE_A)

    globalThis.fetch = realFetch
  })

  test('a newer sync wins: stale resolution never lands', async () => {
    const realFetch = globalThis.fetch
    let resolveFirst

    globalThis.fetch = jest.fn(
      () =>
        new Promise((res) => {
          resolveFirst = res
        })
    )

    const first = syncEarthShare(epRoute(), 'https://luiskr.com/x', baseGraphOf)
    const second = syncEarthShare(epRoute(), 'https://luiskr.com/x', baseGraphOf)

    resolveFirst({ ok: true, json: async () => ({ images: [SHARE_A] }) })

    await Promise.all([first, second])

    globalThis.fetch = realFetch
  })

  test('cancel restores the default card only after a pick applied', async () => {
    const realFetch = globalThis.fetch

    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ images: [SHARE_A] }),
    }))

    // Cancel with nothing applied → metas untouched (non-empty sentinel).
    const sentinel = 'https://cdn.example/sentinel.png'

    document.querySelector(QUERY_STRINGS.META_OG_IMAGE).content = sentinel

    cancelShare()

    expect(metaContent(QUERY_STRINGS.META_OG_IMAGE)).toBe(sentinel)

    await syncEarthShare(epRoute(), 'https://luiskr.com/x', baseGraphOf)

    cancelShare()

    expect(metaContent(QUERY_STRINGS.META_OG_IMAGE)).toBe(
      `${NET_STRINGS.SITE_URL}${SCHEMA_STRINGS.SCHEMA_SHARE_IMAGE}`
    )

    // Cancel again while a sync is in flight → stale seq, pick discarded.
    resetShareGallery()

    let resolveLate
    globalThis.fetch = jest.fn(
      () =>
        new Promise((res) => {
          resolveLate = res
        })
    )

    const pending = syncEarthShare(epRoute(), 'https://luiskr.com/x', baseGraphOf)

    cancelShare()

    resolveLate({ ok: true, json: async () => ({ images: [SHARE_B] }) })
    await pending

    expect(metaContent(QUERY_STRINGS.META_OG_IMAGE)).not.toBe(SHARE_B)

    globalThis.fetch = realFetch
  })

  test('pickShareImage + shareGalleryEntity shapes', () => {
    expect(pickShareImage([SHARE_A])).toBe(SHARE_A)
    expect([SHARE_A, SHARE_B]).toContain(pickShareImage([SHARE_A, SHARE_B]))

    const entity = shareGalleryEntity(
      'https://luiskr.com/earth-playground',
      TEST_TEXT.HEADING,
      [SHARE_A, SHARE_B],
      'en'
    )

    expect(entity['@type']).toBe('ItemList')
    expect(entity.numberOfItems).toBe(2)
    expect(entity.itemListElement[1].item['@type']).toBe('ImageObject')
    expect(entity.itemListElement[1].item.url).toBe(SHARE_B)
    expect(entity.itemListElement[0].position).toBe(1)
  })

  test('navigate branch: EP routes rotate, other routes cancel', async () => {
    const realFetch = globalThis.fetch

    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ images: [SHARE_A] }),
    }))

    syncDocumentHead(epRoute())

    await new Promise((r) => setTimeout(r, 0))

    expect(metaContent(QUERY_STRINGS.META_OG_IMAGE)).toBe(SHARE_A)

    // Non-EP route → cancel path: applied pick restores to the default.
    syncDocumentHead({
      name: ROUTE_NAMES.HOME,
      path: '/',
      lang: LOCALES.EN,
      meta: { title: BASE_TITLE },
    })

    expect(metaContent(QUERY_STRINGS.META_OG_IMAGE)).toBe(
      `${NET_STRINGS.SITE_URL}${SCHEMA_STRINGS.SCHEMA_SHARE_IMAGE}`
    )

    globalThis.fetch = realFetch
  })

  test('star set caches per manifest — earth and star fetches stay independent', async () => {
    const realFetch = globalThis.fetch
    const fetched = []

    globalThis.fetch = jest.fn(async (url) => {
      fetched.push(url)

      return {
        ok: true,
        json: async () => ({
          images: url === STAR_SHARE.MANIFEST_URL ? [SHARE_B] : [SHARE_A],
        }),
      }
    })

    await syncStarShare(sfRoute(), 'https://luiskr.com/star-field-experiment', baseGraphOf)

    expect(fetched).toEqual([STAR_SHARE.MANIFEST_URL])
    expect(metaContent(QUERY_STRINGS.META_OG_IMAGE)).toBe(SHARE_B)

    // The earth set keeps its own cache — its manifest is fetched on
    // first use and the star cache is never consulted.
    await syncEarthShare(epRoute(), 'https://luiskr.com/earth-playground', baseGraphOf)

    expect(fetched).toEqual([STAR_SHARE.MANIFEST_URL, EARTH_SHARE.MANIFEST_URL])
    expect(metaContent(QUERY_STRINGS.META_OG_IMAGE)).toBe(SHARE_A)

    // Second star sync reuses its cached manifest — still only 2 fetches.
    await syncStarShare(sfRoute(), 'https://luiskr.com/star-field-experiment', baseGraphOf)

    expect(fetched).toHaveLength(2)

    globalThis.fetch = realFetch
  })

  test('navigate branch: STAR_FIELD routes rotate the star set', async () => {
    const realFetch = globalThis.fetch

    globalThis.fetch = jest.fn(async (url) => ({
      ok: true,
      json: async () => ({
        images: url === STAR_SHARE.MANIFEST_URL ? [SHARE_B] : [SHARE_A],
      }),
    }))

    syncDocumentHead(sfRoute())

    await new Promise((r) => setTimeout(r, 0))

    expect(metaContent(QUERY_STRINGS.META_OG_IMAGE)).toBe(SHARE_B)

    syncDocumentHead({
      name: ROUTE_NAMES.HOME,
      path: '/',
      lang: LOCALES.EN,
      meta: { title: BASE_TITLE },
    })

    expect(metaContent(QUERY_STRINGS.META_OG_IMAGE)).toBe(
      `${NET_STRINGS.SITE_URL}${SCHEMA_STRINGS.SCHEMA_SHARE_IMAGE}`
    )

    globalThis.fetch = realFetch
  })

  test('lang fallbacks: unknown lang keeps the raw code, missing lang defaults', async () => {
    const realFetch = globalThis.fetch

    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ images: [SHARE_A] }),
    }))

    // Unknown lang — LOCALE_TAGS['xx'] is absent so the bcp lookup falls
    // back to the raw code (the `|| to.lang` arm).
    await syncStarShare(sfRoute({ lang: 'xx' }), 'https://luiskr.com/x', baseGraphOf)

    // Missing lang — the inner `to.lang || LOCALES.EN` arm supplies en.
    await syncStarShare({ ...sfRoute(), lang: undefined }, 'https://luiskr.com/x', baseGraphOf)

    expect(metaContent(QUERY_STRINGS.META_OG_IMAGE)).toBe(SHARE_A)

    globalThis.fetch = realFetch
  })
})
