/**
 * @file schema.ts
 * @description JSON-LD structured-data builders (Schema.org entities for
 * Organization, WebSite, WebPage, BreadcrumbList, ItemList/carousel,
 * Article, VideoObject) plus updateJsonLd() which maintains the single
 * <script id="json-ld"> node in <head>. Every resolved route emits a
 * base graph via generateRouteSchema; Home and Project views layer
 * their rich entities (carousel ItemList, project Article + media) on
 * top so search engines always see the current page's full graph.
 */

import { LOCALES, LOCALE_TAGS } from '@core/tokens/locales.js'
import { BASE_TITLE } from '@core/tokens/routes.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { DOCS_STRINGS } from '@core/tokens/strings/docs.js'
import { ROUTE_NAMES } from '@core/tokens/routes/names.js'
import { DB_PATHS, ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { NET_STRINGS } from '@core/tokens/strings/net.js'
import { SCHEMA_STRINGS } from '@core/tokens/strings/schema.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { QUERY_STRINGS } from '@core/tokens/strings/queries.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { mediaSlugSeq, stripHtml, toMetaDescription } from './string.js'
import { buildMediaUrls } from './media.js'
import { CDN_URLS, SOCIAL_URLS } from '@core/tokens/media/urls.js'

/** Award/press item as handed to the ItemList builder — label/title are display names, link/slug feed the target URL. */
interface CarouselSchemaItem {
  label?: string
  link?: string
  slug?: string
  title?: string
  src?: string
  /** Cover basename (no extension) under the CDN `covers/` folder. */
  image?: string
  description?: string
}

/** Ordered crumb for the BreadcrumbList builder — display name + absolute item URL. */
interface BreadcrumbItem {
  name: string
  url: string
}

/** Inputs for the per-route base graph (Org + WebSite + WebPage + BreadcrumbList). */
interface RouteSchemaOptions {
  /** Canonical absolute page URL — also the WebPage @id base. */
  url: string
  /** Localized page name (what the SERP shows). */
  name: string
  /** Localized meta description; falls back to the site description. */
  description?: string
  /** Locale code ('br', 'de', …) — resolved to BCP-47 via LOCALE_TAGS. */
  lang?: string
  /** primaryImageOfPage URL; defaults to the global share image. */
  image?: string
  /** Ordered crumbs ending at this page — emits BreadcrumbList when ≥2. */
  breadcrumb?: BreadcrumbItem[]
}

/** Media descriptor inside project `sections` (and the project cover). */
interface ProjectMediaNode {
  src?: string
  label?: string
  isVideo?: boolean
  size?: Array<number | string>
}

/** Project translation slice the Article/VideoObject builders read — cover drives both image variants and the optional VideoObject. */
interface ProjectSchemaSource {
  title?: string
  folder?: string
  cover?: { src?: string; isVideo?: boolean; label?: string }
  sections?: unknown
}

/**
 * Generates WebSite and Organization schema for the homepage.
 * @returns JSON-LD entities
 */
export const generateWebsiteSchema = (): Record<string, unknown>[] => {
  return [
    {
      '@context': SCHEMA_STRINGS.SCHEMA_CONTEXT,
      '@type': 'Organization',
      '@id': `${NET_STRINGS.SITE_URL}#organization`,
      legalName: 'Jacson Luis Krötz',
      name: 'Luis Krötz',
      url: NET_STRINGS.SITE_URL,
      logo: `${NET_STRINGS.SITE_URL}${SCHEMA_STRINGS.SCHEMA_ORG_LOGO}`,
      image: `${NET_STRINGS.SITE_URL}${SCHEMA_STRINGS.SCHEMA_SHARE_IMAGE}`,
      sameAs: [
        SOCIAL_URLS.WHATSAPP,
        SOCIAL_URLS.GITHUB,
        SOCIAL_URLS.LINKEDIN,
        SOCIAL_URLS.INSTAGRAM,
      ],
    },
    {
      '@context': SCHEMA_STRINGS.SCHEMA_CONTEXT,
      '@type': 'WebSite',
      '@id': `${NET_STRINGS.SITE_URL}#website`,
      url: NET_STRINGS.SITE_URL,
      name: BASE_TITLE,
      description: SCHEMA_STRINGS.SCHEMA_SITE_DESCRIPTION,
      image: `${NET_STRINGS.SITE_URL}${SCHEMA_STRINGS.SCHEMA_SHARE_IMAGE}`,
      publisher: {
        '@id': `${NET_STRINGS.SITE_URL}#organization`,
      },
    },
  ]
}

/**
 * Generates an ItemList matching Google Carousel rich results guidelines —
 * `position` is 1-based per the spec, and `image` is only emitted when the
 * item carries a src (an absent property beats an empty one for parsers).
 * @returns ItemList entity, or null when there is nothing to list.
 */
export const generateCarouselItemListSchema = (
  items: CarouselSchemaItem[] = [],
  baseUrl: string = NET_STRINGS.SITE_URL
): Record<string, unknown> | null => {
  if (!Array.isArray(items) || items.length === 0) return null

  return {
    '@context': SCHEMA_STRINGS.SCHEMA_CONTEXT,
    '@type': 'ItemList',
    itemListElement: items.map((item, idx) => {
      // Absolute links (external press) pass through verbatim; internal
      // slugs get prefixed with the portfolio route so crawlers resolve
      // to canonical project pages rather than bare fragments.
      const targetUrl = item.link?.startsWith('http')
        ? item.link
        : `${baseUrl}${ROUTE_PATHS.PORTFOLIO}${item.link || item.slug || ''}`

      // Image resolution order: absolute src → CDN-relative src → the
      // covers/ folder basename the portfolio list stores (`image`).
      const imageUrl = item.src
        ? item.src.startsWith('http')
          ? item.src
          : `${CDN_URLS.CDN_BASE}${item.src}`
        : item.image
          ? `${CDN_URLS.CDN_BASE}${DB_PATHS.COVERS}${item.image}.jpg`
          : null

      return {
        '@type': 'ListItem',
        position: idx + 1,
        url: targetUrl,
        name: item.label || item.title || `Item ${idx + 1}`,
        ...(imageUrl ? { image: imageUrl } : {}),
        ...(item.description ? { description: item.description } : {}),
      }
    }),
  }
}

/**
 * Recursively walks project `sections` (nested arrays of text strings
 * and media descriptors) yielding every node that carries a `src`. The
 * generator shape keeps traversal total — media descriptors are leaf
 * objects, so a matched node is yielded rather than descended into.
 */
function* walkMedia(node: unknown): Generator<ProjectMediaNode, void, void> {
  if (Array.isArray(node)) {
    for (const child of node) yield* walkMedia(child)

    return
  }

  if (node && typeof node === TYPE_STRINGS.OBJECT) {
    const rec = node as ProjectMediaNode

    if (typeof rec.src === TYPE_STRINGS.STRING && rec.src) yield rec
  }
}

/**
 * First text string in the nested sections array — the same paragraph
 * the project view promotes to the meta description, reused here so
 * Article/VideoObject descriptions match the emitted page text.
 */
const firstSectionText = (node: unknown): string => {
  if (typeof node === TYPE_STRINGS.STRING) return node as string

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = firstSectionText(item)

      if (found) return found
    }
  }

  return ATTR_VALUES.EMPTY
}

/**
 * VideoObject entity for one media descriptor — contentUrl/embedUrl
 * point at the CDN mp4 and thumbnailUrl at its jpg poster, the two
 * URLs Google's video crawler needs to index the asset.
 */
const videoObjectFor = (
  media: ProjectMediaNode,
  folder: string,
  title: string,
  description: string
): Record<string, unknown> => {
  const { source, thumb } = buildMediaUrls(CDN_URLS.CDN_BASE, folder, media)

  return {
    '@context': SCHEMA_STRINGS.SCHEMA_CONTEXT,
    '@type': 'VideoObject',
    name: media.label || `${title} Video`,
    description: description || `Showcase video for ${title}`,
    thumbnailUrl: [thumb],
    uploadDate: SCHEMA_STRINGS.SCHEMA_PUBLISHED_DATE,
    duration: SCHEMA_STRINGS.SCHEMA_VIDEO_DURATION,
    contentUrl: source,
    embedUrl: source,
  }
}

/**
 * Generates an Article and cover VideoObject graph for a project detail
 * page. The Article `image` carries the real CDN asset — the full
 * uncompressed mozjpg for image covers, the video poster for video
 * covers — since the hypothetical aspect-ratio variants (-16x9/-4x3/
 * -1x1) never existed on the bucket and 404'd for crawlers.
 * @param project - Project translation data
 * @param slug - Project URL slug
 * @param locale - Page locale (defaults to LOCALES.EN)
 * @param omitCoverVideo - Skip the cover VideoObject (deep-link watch
 *   pages declare only their own media entity)
 * @returns Array of Schema.org entities
 */
export const generateProjectArticleSchema = (
  project: ProjectSchemaSource | null,
  slug: string,
  locale: string = LOCALES.EN,
  omitCoverVideo = false
): Record<string, unknown>[] => {
  if (!project || !slug) return []

  const canonicalUrl = `${NET_STRINGS.SITE_URL}${ROUTE_PATHS.PORTFOLIO}${slug}`

  const title = project.title ? stripHtml(project.title) : slug

  const folder = project.folder || ATTR_VALUES.EMPTY

  const cover = buildMediaUrls(CDN_URLS.CDN_BASE, folder, project.cover || null)

  const images = cover.source
    ? [cover.isVideo ? cover.thumb : cover.source]
    : [`${NET_STRINGS.SITE_URL}${SCHEMA_STRINGS.SCHEMA_SHARE_IMAGE}`]

  const description =
    toMetaDescription(firstSectionText(project.sections)) ||
    `Case study for ${title} built by Software Engineer Luis Krötz.`

  const article: Record<string, unknown> = {
    '@context': SCHEMA_STRINGS.SCHEMA_CONTEXT,
    '@type': 'Article',
    '@id': `${canonicalUrl}#article`,
    isPartOf: {
      '@type': 'WebPage',
      '@id': `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: title,
      inLanguage: LOCALE_TAGS[locale]?.bcp || locale,
    },
    headline: title,
    inLanguage: LOCALE_TAGS[locale]?.bcp || locale,
    mainEntityOfPage: canonicalUrl,
    datePublished: SCHEMA_STRINGS.SCHEMA_PUBLISHED_DATE,
    dateModified: SCHEMA_STRINGS.SCHEMA_PUBLISHED_DATE,
    author: {
      '@type': 'Person',
      name: BASE_TITLE,
      url: NET_STRINGS.SITE_URL,
    },
    publisher: {
      '@type': 'Person',
      name: BASE_TITLE,
      url: NET_STRINGS.SITE_URL,
    },
    image: images,
    description,
  }

  const entities: Record<string, unknown>[] = [article]

  // Add VideoObject schema if project has a cover video or section videos
  if (!omitCoverVideo && project.cover?.isVideo && project.cover.src) {
    entities.push(videoObjectFor(project.cover, folder, title, description))
  }

  return entities
}

/**
 * BreadcrumbList entity from an ordered crumb trail — positions are
 * 1-based per the spec. Returns null for an empty/absent trail so
 * callers can spread the result unconditionally.
 * @param items Ordered crumbs ending at the current page.
 * @param id    Optional @id the page entity's `breadcrumb` can point at.
 * @returns BreadcrumbList entity or null.
 */
export const generateBreadcrumbSchema = (
  items: BreadcrumbItem[] = [],
  id?: string
): Record<string, unknown> | null => {
  if (!Array.isArray(items) || items.length === 0) return null

  return {
    '@context': SCHEMA_STRINGS.SCHEMA_CONTEXT,
    '@type': 'BreadcrumbList',
    ...(id ? { '@id': id } : {}),
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

/**
 * Base per-route JSON-LD graph — Organization + WebSite (localized
 * inLanguage) + WebPage + optional BreadcrumbList. Emitted on every
 * navigation so crawlers never see a stale homepage graph on deep
 * links; views that own richer entities (project Article, docs
 * TechArticle) replace or extend this graph once their data resolves.
 * @param options Route URL/name/description/locale/image/breadcrumb.
 * @returns JSON-LD entities for updateJsonLd().
 */
export const generateRouteSchema = (options: RouteSchemaOptions): Record<string, unknown>[] => {
  const { url, name, description, lang, image, breadcrumb } = options

  const bcp = (lang && LOCALE_TAGS[lang]?.bcp) || lang || LOCALES.EN

  const [org, website] = generateWebsiteSchema()

  website.inLanguage = bcp

  const crumbs = generateBreadcrumbSchema(breadcrumb, `${url}#breadcrumbs`)

  const webPage: Record<string, unknown> = {
    '@context': SCHEMA_STRINGS.SCHEMA_CONTEXT,
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name,
    description: description || SCHEMA_STRINGS.SCHEMA_SITE_DESCRIPTION,
    inLanguage: bcp,
    isPartOf: { '@id': `${NET_STRINGS.SITE_URL}#website` },
    publisher: { '@id': `${NET_STRINGS.SITE_URL}#organization` },
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: image || `${NET_STRINGS.SITE_URL}${SCHEMA_STRINGS.SCHEMA_SHARE_IMAGE}`,
    },
    ...(crumbs ? { breadcrumb: { '@id': `${url}#breadcrumbs` } } : {}),
  }

  return crumbs ? [org, website, webPage, crumbs] : [org, website, webPage]
}

/** Inputs for the Earth Playground graph — route base + WebApplication declaring the canvas-rendered control surface. */
interface EarthPlaygroundSchemaOptions {
  /** Canonical absolute page URL — also the app entity @id base. */
  url: string
  /** Localized page name. */
  name: string
  /** Localized meta description; falls back to the site description. */
  description?: string
  /** Locale code — resolved to BCP-47 via LOCALE_TAGS. */
  lang?: string
  /** Localized labels of every control group, row and action — WebApplication.featureList. */
  features: string[]
}

/**
 * Earth Playground JSON-LD graph — the route base plus a WebApplication
 * entity whose `featureList` enumerates the whole localized control
 * surface (the panel is a WebGL canvas at runtime, so the schema is the
 * crawler-legible form of it). Mirrors the build-time entity emitted by
 * build-locale-pages.mjs so the post-hydration graph keeps parity with
 * the served document.
 * @param options Route URL/name/description/locale + localized feature labels.
 * @returns JSON-LD entities for updateJsonLd().
 */
export const generateEarthPlaygroundSchema = (
  options: EarthPlaygroundSchemaOptions
): Record<string, unknown>[] => {
  const { url, name, description, lang, features } = options

  const bcp = (lang && LOCALE_TAGS[lang]?.bcp) || lang || LOCALES.EN

  return [
    ...generateRouteSchema({ url, name, description, lang }),
    {
      '@context': SCHEMA_STRINGS.SCHEMA_CONTEXT,
      '@type': 'WebApplication',
      '@id': `${url}#app`,
      name,
      url,
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Web browser',
      browserRequirements: 'Requires WebGL; WebGPU preferred',
      inLanguage: bcp,
      isAccessibleForFree: true,
      isPartOf: { '@id': `${url}#webpage` },
      author: { '@type': 'Person', name: BASE_TITLE, url: NET_STRINGS.SITE_URL },
      featureList: features,
    },
  ]
}

/** One distribution file for a Dataset entity — absolute URL + encoding format. */
interface StarCatalogDistribution {
  url: string
  format: string
}

/** Prepared Dataset input — name/description/credit plus its downloadable files. */
interface StarCatalogDataset {
  /** Dataset @id slug appended to the index URL (e.g. 'star' → #dataset-star). */
  kind: string
  name: string
  description?: string
  credit?: string
  distributions: StarCatalogDistribution[]
}

/** Inputs for the star-field index graph — route base + body ItemList + registry DataCatalog. */
interface StarIndexSchemaOptions {
  /** Canonical absolute index URL — entity @id bases derive from it. */
  url: string
  /** Localized page name. */
  name: string
  /** Localized meta description; falls back to the site description. */
  description?: string
  /** Locale code — resolved to BCP-47 via LOCALE_TAGS. */
  lang?: string
  /** Authored-body deep links — ItemList entries in catalog order. */
  items: Array<{ url: string; name: string }>
  /** Localized heading for the registry DataCatalog (falls back to `name`). */
  catalogName?: string
  /** Prepared registry datasets — omitted when the manifest is unavailable. */
  datasets?: StarCatalogDataset[]
}

/**
 * Star-field index JSON-LD graph — the route base plus an ItemList that
 * enumerates every authored body deep link and a DataCatalog whose
 * Datasets point at the registry manifest, shard JSONs and the packed
 * binary, so the canvas star cloud's underlying 139,563-record catalog
 * is enumerable without WebGL. Mirrors the build-time entities emitted
 * by build-locale-pages.mjs for post-hydration parity.
 * @param options Index URL/name/locale, body items, prepared datasets.
 * @returns JSON-LD entities for updateJsonLd().
 */
export const generateStarIndexSchema = (
  options: StarIndexSchemaOptions
): Record<string, unknown>[] => {
  const { url, name, description, lang, items, catalogName, datasets } = options

  const bcp = (lang && LOCALE_TAGS[lang]?.bcp) || lang || LOCALES.EN

  const entities: Record<string, unknown>[] = [
    ...generateRouteSchema({ url, name, description, lang }),
    {
      '@context': SCHEMA_STRINGS.SCHEMA_CONTEXT,
      '@type': 'ItemList',
      '@id': `${url}#catalog`,
      name,
      itemListElement: items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: item.url,
        name: item.name,
      })),
    },
  ]

  if (datasets?.length) {
    entities.push({
      '@context': SCHEMA_STRINGS.SCHEMA_CONTEXT,
      '@type': 'DataCatalog',
      '@id': `${url}#data-catalog`,
      name: catalogName || name,
      inLanguage: bcp,
      dataset: datasets.map((d) => ({
        '@type': 'Dataset',
        '@id': `${url}#dataset-${d.kind}`,
        name: d.name,
        ...(d.description ? { description: d.description } : {}),
        ...(d.credit ? { creditText: d.credit } : {}),
        isAccessibleForFree: true,
        distribution: d.distributions.map((dist) => ({
          '@type': 'DataDownload',
          encodingFormat: dist.format,
          contentUrl: dist.url,
        })),
      })),
    })
  }

  return entities
}

/** Inputs for a star-field body dossier graph — route base + Article describing the catalogued object. */
interface StarBodySchemaOptions {
  /** Canonical absolute body-page URL — Article/object @id bases. */
  url: string
  /** Absolute star-field index URL — isPartOf + crumb target. */
  indexUrl: string
  /** Localized index name (the middle crumb + isPartOf label). */
  indexName: string
  /** Body display name — Article headline. */
  name: string
  /** Dossier tagline — Article/Thing description. */
  tagline?: string
  /** Technical dossier facts — emitted as PropertyValue pairs on the object. */
  facts?: Array<{ label?: string; value?: string }>
  /** Locale code — resolved to BCP-47 via LOCALE_TAGS. */
  lang?: string
}

/**
 * Star-field body JSON-LD graph — the route base (with a Home →
 * Star Field → body crumb) plus an Article whose `about` Thing carries
 * the dossier's technical facts as PropertyValue pairs. Mirrors the
 * build-time body entity so hydrated dossier deep links keep the same
 * structured data the static dossier pages serve.
 * @param options Body/index URLs, names, tagline, facts, locale.
 * @returns JSON-LD entities for updateJsonLd().
 */
export const generateStarBodySchema = (
  options: StarBodySchemaOptions
): Record<string, unknown>[] => {
  const { url, indexUrl, indexName, name, tagline, facts, lang } = options

  const bcp = (lang && LOCALE_TAGS[lang]?.bcp) || lang || LOCALES.EN

  return [
    ...generateRouteSchema({
      url,
      name,
      description: tagline,
      lang,
      breadcrumb: [
        { name: BASE_TITLE, url: `${NET_STRINGS.SITE_URL}${ROUTE_PATHS.ROOT}` },
        { name: indexName, url: indexUrl },
        { name, url },
      ],
    }),
    {
      '@context': SCHEMA_STRINGS.SCHEMA_CONTEXT,
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: name,
      description: tagline || ATTR_VALUES.EMPTY,
      about: {
        '@type': 'Thing',
        '@id': `${url}#object`,
        name,
        description: tagline || ATTR_VALUES.EMPTY,
        additionalProperty: (facts || []).map((f) => ({
          '@type': 'PropertyValue',
          name: f.label,
          value: f.value,
        })),
      },
      inLanguage: bcp,
      mainEntityOfPage: url,
      isPartOf: { '@id': `${indexUrl}#webpage` },
      author: { '@type': 'Person', name: BASE_TITLE, url: NET_STRINGS.SITE_URL },
    },
  ]
}

/**
 * Complete project-page JSON-LD graph — the route base (Org + WebSite
 * + WebPage + breadcrumb) plus the project Article, a media ItemList
 * whose entries deep-link to the emitted /portfolio/<p>/<media> URLs
 * (Google's carousel surface), and one VideoObject per section video
 * alongside the cover video the Article builder already emits. When a
 * `mediaSlug` deep link is active the graph recenters on that media:
 * the WebPage gets the media URL + label + its own asset, a third crumb
 * level appears, and a dedicated ImageObject/VideoObject leads the
 * graph — matching the static media pages the generator emits.
 * @param project Localized project translation node.
 * @param slug    Canonical project slug.
 * @param locale  Page locale (defaults to LOCALES.EN).
 * @param mediaSlug Active media deep-link segment (params.slug).
 * @returns JSON-LD entities for updateJsonLd().
 */
export const generateProjectSchema = (
  project: ProjectSchemaSource | null,
  slug: string,
  locale: string = LOCALES.EN,
  mediaSlug?: string
): Record<string, unknown>[] => {
  if (!project || !slug) return []

  const canonicalUrl = `${NET_STRINGS.SITE_URL}${ROUTE_PATHS.PORTFOLIO}${slug}`

  const title = project.title ? stripHtml(project.title) : slug

  const folder = project.folder || ATTR_VALUES.EMPTY

  const description = toMetaDescription(firstSectionText(project.sections))

  const cover = buildMediaUrls(CDN_URLS.CDN_BASE, folder, project.cover || null)

  const coverImage = cover.source
    ? cover.isVideo
      ? cover.thumb
      : cover.source
    : `${NET_STRINGS.SITE_URL}${SCHEMA_STRINGS.SCHEMA_SHARE_IMAGE}`

  const media = [...walkMedia(project.sections)]

  // Deep-link slug per item — document-order numbering disambiguates
  // captions that collapse to the same slug, in lockstep with the
  // emitted media pages + sitemap deep links.
  const slugSeen = new Map<string, number>()

  const deepSlugOf = (m: ProjectMediaNode) =>
    m.label ? mediaSlugSeq(slugSeen, m.label) : ATTR_VALUES.EMPTY

  // A media deep link resolves to its descriptor so the WebPage, its
  // primaryImageOfPage and the third crumb all describe the asset at
  // this URL rather than the parent project.
  const deepSlugs = media.map((m) => deepSlugOf(m))

  const activeMedia = mediaSlug ? media.find((_, i) => deepSlugs[i] === mediaSlug) : undefined

  const activeUrls = activeMedia ? buildMediaUrls(CDN_URLS.CDN_BASE, folder, activeMedia) : null

  const pageUrl = activeMedia ? `${canonicalUrl}/${mediaSlug}` : canonicalUrl

  const pageName = activeMedia?.label || title

  const pageImage = activeUrls
    ? activeUrls.isVideo
      ? activeUrls.thumb
      : activeUrls.source
    : coverImage

  const listItems = media
    .map((m, i) => ({ m, deepSlug: deepSlugs[i] }))
    .filter((e): e is { m: ProjectMediaNode & { label: string }; deepSlug: string } =>
      Boolean(e.m.label && e.deepSlug)
    )
    .map(({ m, deepSlug }, idx) => {
      const { source, thumb, isVideo } = buildMediaUrls(CDN_URLS.CDN_BASE, folder, m)

      return {
        '@type': 'ListItem',
        position: idx + 1,
        url: `${canonicalUrl}/${deepSlug}`,
        name: m.label,
        image: isVideo ? thumb : source,
      }
    })

  const mediaList: Record<string, unknown> | null = listItems.length
    ? {
        '@context': SCHEMA_STRINGS.SCHEMA_CONTEXT,
        '@type': 'ItemList',
        itemListElement: listItems,
      }
    : null

  // A media deep link is a watch page — it declares only its own
  // VideoObject (mediaEntity leads the graph), never the project's
  // cover or sibling clips, so the single-video purpose stays
  // unambiguous to Google's watch-page classifier.
  const sectionVideos = activeMedia
    ? []
    : media.filter((m) => m.isVideo).map((m) => videoObjectFor(m, folder, title, description))

  const routeGraph = generateRouteSchema({
    url: pageUrl,
    name: pageName,
    description,
    lang: locale,
    image: pageImage,
    breadcrumb: [
      { name: BASE_TITLE, url: `${NET_STRINGS.SITE_URL}${ROUTE_PATHS.ROOT}` },
      { name: title, url: canonicalUrl },
      ...(activeMedia ? [{ name: pageName, url: pageUrl }] : []),
    ],
  })

  const mediaEntity =
    activeMedia && activeUrls
      ? activeUrls.isVideo
        ? videoObjectFor(activeMedia, folder, title, description)
        : {
            '@context': SCHEMA_STRINGS.SCHEMA_CONTEXT,
            '@type': 'ImageObject',
            '@id': `${pageUrl}#image`,
            url: activeUrls.source,
            contentUrl: activeUrls.source,
            name: pageName,
          }
      : null

  return [
    ...routeGraph,
    ...(mediaEntity ? [mediaEntity] : []),
    ...generateProjectArticleSchema(project, slug, locale, Boolean(activeMedia)),
    ...(mediaList ? [mediaList] : []),
    ...sectionVideos,
  ]
}

/** Minimal manifest-node shape the docs schema reads — kept structural so `core` never imports from `experiments`. */
interface DocsSchemaNode {
  name?: string
  type?: 'dir' | 'file'
  mtime?: string
}

/**
 * Generates the docs-portal JSON-LD graph for a resolved docs path:
 * a `BreadcrumbList` mirroring the on-page crumb trail plus one page
 * entity — `CollectionPage` for the portal root and folders,
 * `TechArticle` for file pages (markdown/code/report payloads). English
 * is the only docs locale, so `inLanguage` is fixed to `en`.
 * @param docsPath Manifest-relative path ('' → the portal root).
 * @param node     Resolved manifest node (null at the root / on misses).
 * @returns JSON-LD entities for updateJsonLd().
 */
export const generateDocsSchema = (
  docsPath: string,
  node: DocsSchemaNode | null
): Record<string, unknown>[] => {
  const pageUrl = `${NET_STRINGS.SITE_URL}${ROUTE_PATHS.DOCS}${docsPath ? `/${docsPath}` : ''}`

  const segments = docsPath.split('/').filter(Boolean)

  const breadcrumb: Record<string, unknown> = {
    '@context': SCHEMA_STRINGS.SCHEMA_CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: ROUTE_NAMES.DOCS,
        item: `${NET_STRINGS.SITE_URL}${ROUTE_PATHS.DOCS}`,
      },
      ...segments.map((seg, i) => ({
        '@type': 'ListItem',
        position: i + 2,
        name: seg,
        item: `${NET_STRINGS.SITE_URL}${ROUTE_PATHS.DOCS}/${segments.slice(0, i + 1).join('/')}`,
      })),
    ],
  }

  const isFile = node?.type === 'file'

  const page: Record<string, unknown> = {
    '@context': SCHEMA_STRINGS.SCHEMA_CONTEXT,
    '@type': isFile ? 'TechArticle' : 'CollectionPage',
    '@id': pageUrl,
    url: pageUrl,
    name: isFile ? String(node?.name) : DOCS_STRINGS.TITLE,
    inLanguage: LOCALES.EN,
    isPartOf: {
      '@type': 'WebSite',
      '@id': `${NET_STRINGS.SITE_URL}#website`,
      url: NET_STRINGS.SITE_URL,
      name: 'Luis Krötz',
    },
    publisher: {
      '@id': `${NET_STRINGS.SITE_URL}#organization`,
    },
    description: isFile
      ? `${String(node?.name)} — published as part of the luiskr.com documentation portal.`
      : DOCS_STRINGS.SCHEMA_DESCRIPTION,
    ...(isFile && node?.mtime
      ? { dateModified: node.mtime, datePublished: SCHEMA_STRINGS.SCHEMA_PUBLISHED_DATE }
      : {}),
  }

  return [breadcrumb, page]
}

/**
 * Dynamically updates the JSON-LD script graph in the document head.
 * Maintains exactly one `<script type="application/ld+json">` node — an
 * array payload is wrapped in a `@graph` container so a single script can
 * carry the whole entity set (the form Google's parsers prefer), and
 * `textContent` (not innerHTML) writes it since JSON must not go through
 * the HTML parser. Passing `null`/`undefined` REMOVES the node — routes
 * that own a page-scoped graph (docs TechArticle, project Article) clear
 * it on teardown so the entity never leaks onto the next route.
 * @param graph Entity or entity array; null/undefined removes the node.
 */
export const updateJsonLd = (
  graph: Record<string, unknown> | Record<string, unknown>[] | null | undefined
): void => {
  if (typeof document === TYPE_STRINGS.UNDEFINED) return

  const scriptId = SCHEMA_STRINGS.JSON_LD_SCRIPT_ID

  let scriptEl = document.getElementById(scriptId) as HTMLScriptElement | null

  if (!graph) {
    scriptEl?.remove()

    return
  }

  if (!scriptEl) {
    scriptEl = document.createElement('script')

    scriptEl.id = scriptId

    scriptEl.type = SCHEMA_STRINGS.JSON_LD_SCRIPT_TYPE

    document.head.appendChild(scriptEl)
  }

  const payload = Array.isArray(graph)
    ? { '@context': SCHEMA_STRINGS.SCHEMA_CONTEXT, '@graph': graph }
    : graph

  scriptEl.textContent = JSON.stringify(payload)
}

/**
 * Single authority for the document's `<meta name="robots">` — sets
 * `noindex, nofollow` when `noindex` is true and removes the meta when
 * false. Every surface that can resolve to a non-indexable state must
 * route through this: the not-found route, missing project snapshots,
 * media deep-link slugs that fail to resolve in the active locale, and
 * draft projects (data.noindex). A route that serves content MUST be a
 * 200 whose canonical points at itself; anything else is a soft-404 and
 * must noindex rather than compete with the real page.
 * @param noindex Whether the current route must be excluded from indexes.
 */
export const setRobotsMeta = (noindex: boolean): void => {
  if (typeof document === TYPE_STRINGS.UNDEFINED) return

  let meta = document.querySelector<HTMLMetaElement>(QUERY_STRINGS.META_ROBOTS)

  if (noindex) {
    if (!meta) {
      meta = document.createElement(HTML_TAGS.META)

      meta.name = 'robots'

      document.head.appendChild(meta)
    }

    meta.content = SCHEMA_STRINGS.NOINDEX_NOFOLLOW
  } else {
    meta?.remove()
  }
}
