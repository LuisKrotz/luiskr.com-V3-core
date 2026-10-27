/**
 * @file utils/share-gallery.ts
 * @description Runtime playground share-capture rotation. The build
 * emits one manifest per share set (`/meta/earth-playground-share.json`,
 * `/meta/star-field-share.json` — one CDN URL per screenshot under the
 * bucket's share/ prefix — see shared/scripts/build/
 * playground-share.mjs); the SPA fetches the matching manifest lazily on
 * the first playground/star-field navigation and every subsequent sync
 * picks a random capture for the og/twitter/itemprop image metas and
 * re-emits the route's JSON-LD with an ImageObject ItemList covering the
 * whole set. Static pages draw their per-build pick inside
 * build-locale-pages — this module is the per-navigation equivalent for
 * the live DOM, so each JS-aware fetch of a playground sees a different
 * share image.
 */

import { QUERY_STRINGS } from '@core/tokens/strings/queries.js'
import { NET_STRINGS } from '@core/tokens/strings/net.js'
import { SCHEMA_STRINGS } from '@core/tokens/strings/schema.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { EARTH_SHARE, STAR_SHARE } from '@core/tokens/playground/share.js'
import { LOCALE_TAGS, LOCALES } from '@core/tokens/locales.js'
import { BASE_TITLE } from '@core/tokens/routes.js'
import { updateJsonLd } from '@core/utils/schema.js'
import { devWarn } from '@core/devlog.js'
import type { RouteDescriptor } from '@core/router/types.js'

/** The shell's card image — restored when a rotation is cancelled. */
const DEFAULT_IMAGE = `${NET_STRINGS.SITE_URL}${SCHEMA_STRINGS.SCHEMA_SHARE_IMAGE}`

/** Monotonic guard — a newer nav (or cancel) invalidates in-flight syncs. */
let syncSeq = 0

/** The capture currently bound into the image metas, if any. */
let appliedImage: string | null = null

/** Per-set manifest fetch state — each share manifest caches its URL list and in-flight promise independently. */
interface ShareSetState {
  /** Manifest payload cache — null until the first fetch resolves. */
  urls: string[] | null
  /** In-flight manifest fetch — coalesced so concurrent syncs share one request. */
  promise: Promise<string[]> | null
}

/** Manifest states keyed by manifest URL — one cache per share set. */
const setStates = new Map<string, ShareSetState>()

/**
 * The fetch state for one manifest URL — created lazily so a set's cache
 * only exists once one of its routes has been visited.
 * @param manifestUrl site-served share manifest URL
 * @returns that set's mutable state cell
 */
const stateOf = (manifestUrl: string): ShareSetState => {
  let state = setStates.get(manifestUrl)

  if (!state) {
    state = { urls: null, promise: null }

    setStates.set(manifestUrl, state)
  }

  return state
}

/** Writes `url` into the three card-image metas (itemprop, og, twitter). */
const setShareImageMetas = (url: string): void => {
  for (const selector of [
    QUERY_STRINGS.META_ITEMPROP_IMAGE,
    QUERY_STRINGS.META_OG_IMAGE,
    QUERY_STRINGS.META_TW_IMAGE,
  ]) {
    const el = document.querySelector<HTMLMetaElement>(selector)

    if (el) el.content = url
  }
}

/**
 * Loads one share manifest once — resolves its URL list, caches it for
 * the session, and resets the in-flight promise so a failure retries on
 * the next playground navigation instead of poisoning the cache.
 * @param manifestUrl site-served share manifest URL
 * @returns resolved share-image URLs (empty when unavailable)
 */
const loadShareImages = (manifestUrl: string): Promise<string[]> => {
  const state = stateOf(manifestUrl)

  if (state.urls) return Promise.resolve(state.urls)

  state.promise ??= fetch(manifestUrl)
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then((data: { images?: unknown }) => {
      const images = Array.isArray(data?.images) ? data.images : []

      state.urls = images.filter(
        (u): u is string => typeof u === TYPE_STRINGS.STRING && u.length > 0
      )

      return state.urls
    })
    .catch((err) => {
      devWarn('[share-gallery] manifest fetch failed:', err)

      state.promise = null

      return []
    })

  return state.promise
}

/**
 * Uniformly random pick from the share set — every sync draws fresh so
 * repeated fetches/navigations surface different card captures.
 * @param urls candidate URLs
 * @returns one random URL
 */
export const pickShareImage = (urls: string[]): string =>
  urls[Math.floor(Math.random() * urls.length)]

/**
 * ImageObject ItemList covering the whole share set — mirrors the
 * build-time share entities emitted into the static playground
 * pages so the runtime graph carries the same crawlable gallery.
 * @param pageUrl canonical page URL the entities belong to
 * @param name    localized gallery label
 * @param urls    the full share set
 * @param bcp     BCP-47 tag for inLanguage
 * @returns ItemList JSON-LD entity
 */
export const shareGalleryEntity = (
  pageUrl: string,
  name: string,
  urls: string[],
  bcp: string
): Record<string, unknown> => ({
  '@context': SCHEMA_STRINGS.SCHEMA_CONTEXT,
  '@type': 'ItemList',
  '@id': `${pageUrl}#share-gallery`,
  name,
  inLanguage: bcp,
  numberOfItems: urls.length,
  itemListElement: urls.map((u, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: {
      '@type': 'ImageObject',
      '@id': `${pageUrl}#share-${i + 1}`,
      url: u,
      contentUrl: u,
      name: `${name} ${i + 1}`,
      inLanguage: bcp,
      author: { '@type': 'Person', name: BASE_TITLE, url: NET_STRINGS.SITE_URL },
      creator: { '@type': 'Person', name: BASE_TITLE, url: NET_STRINGS.SITE_URL },
      isPartOf: { '@id': `${pageUrl}#webpage` },
    },
  })),
})

/**
 * Rotates one playground's share surface: draws a random capture from
 * `manifestUrl`'s set into the image metas, then re-emits the route's
 * JSON-LD as baseGraph(image) + the gallery ItemList. Abandoned silently
 * when a newer navigation (or a cancel) landed while the manifest fetch
 * was in flight, and when the manifest lists no captures.
 * @param to          resolved route descriptor (title/lang feed the graph)
 * @param canonicalUrl canonical URL for the page + entity @ids
 * @param baseGraphOf route-graph builder — receives the picked image so
 *                    primaryImageOfPage matches the card metas
 * @param manifestUrl site-served share manifest URL for this route's set
 */
const syncShare = async (
  to: RouteDescriptor,
  canonicalUrl: string,
  baseGraphOf: (image: string) => Record<string, unknown>[],
  manifestUrl: string
): Promise<void> => {
  const seq = ++syncSeq

  const urls = await loadShareImages(manifestUrl)

  if (seq !== syncSeq || urls.length === 0) return

  const image = pickShareImage(urls)

  appliedImage = image

  setShareImageMetas(image)

  const bcp = (to.lang && LOCALE_TAGS[to.lang]?.bcp) || to.lang || LOCALES.EN
  const name = String(to.meta.title || BASE_TITLE)

  updateJsonLd([...baseGraphOf(image), shareGalleryEntity(canonicalUrl, name, urls, bcp)])
}

/**
 * Earth Playground share sync — binds the generic rotation to the earth
 * set's manifest.
 * @param to          resolved route descriptor
 * @param canonicalUrl canonical page URL
 * @param baseGraphOf route-graph builder
 */
export const syncEarthShare = (
  to: RouteDescriptor,
  canonicalUrl: string,
  baseGraphOf: (image: string) => Record<string, unknown>[]
): Promise<void> => syncShare(to, canonicalUrl, baseGraphOf, EARTH_SHARE.MANIFEST_URL)

/**
 * Star Field share sync — binds the generic rotation to the star set's
 * manifest.
 * @param to          resolved route descriptor
 * @param canonicalUrl canonical page URL
 * @param baseGraphOf route-graph builder
 */
export const syncStarShare = (
  to: RouteDescriptor,
  canonicalUrl: string,
  baseGraphOf: (image: string) => Record<string, unknown>[]
): Promise<void> => syncShare(to, canonicalUrl, baseGraphOf, STAR_SHARE.MANIFEST_URL)

/**
 * Cancels the share surface — bumps the sync sequence so an in-flight
 * manifest fetch can never land on a newer route, and restores the
 * default card image only when a rotation actually applied one (a direct
 * landing on a media page keeps its emitted og:image).
 */
export const cancelShare = (): void => {
  syncSeq += 1

  if (appliedImage) {
    appliedImage = null

    setShareImageMetas(DEFAULT_IMAGE)
  }
}

/**
 * Test/state reset — clears the manifest caches, pick state and sequence
 * guard so suites exercise loadShareImages branches in isolation without
 * jest.resetModules (which would discard recorded istanbul hits).
 */
export const resetShareGallery = (): void => {
  syncSeq = 0
  setStates.clear()
  appliedImage = null
}
