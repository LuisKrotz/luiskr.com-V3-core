/**
 * @file schema-shims-schema-generators.test.js
 * @description Split from schema-shims.test.js — covers the "schema generators" describe.
 */
import {
  generateBreadcrumbSchema,
  generateCarouselItemListSchema,
  generateProjectArticleSchema,
  generateProjectSchema,
  generateRouteSchema,
  generateWebsiteSchema,
  updateJsonLd,
} from '@core/utils/schema.js'
import { TEST_PROJECTS, TEST_TEXT, TEST_URLS } from '@tests/fixtures/test-constants.js'
import { CDN_URLS } from '@core/tokens/media/urls.js'
import { NET_STRINGS } from '@core/tokens/strings/net.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { SCHEMA_STRINGS } from '@core/tokens/strings/schema.js'

// ─── schema.js generators ────────────────────────────────────────────────────
describe('schema generators', () => {
  test('generateCarouselItemListSchema wraps items in an ItemList', () => {
    const schema = generateCarouselItemListSchema([
      { label: TEST_TEXT.HEADING, src: TEST_URLS.IMG, link: TEST_PROJECTS.CICB },
      { title: 'NoImage', slug: TEST_PROJECTS.CICB },
      { label: 'Cdn', src: `${TEST_PROJECTS.CICB}/cover`, link: TEST_URLS.IMG },
      { label: 'Bare' },
    ])

    expect(schema['@type']).toBe('ItemList')
    expect(schema.itemListElement).toHaveLength(4)
    expect(schema.itemListElement[0].image).toBe(TEST_URLS.IMG)
    expect(schema.itemListElement[1].image).toBeUndefined()
    expect(schema.itemListElement[2].url).toBe(TEST_URLS.IMG)
    expect(schema.itemListElement[3].url).toBe(`${NET_STRINGS.SITE_URL}${ROUTE_PATHS.PORTFOLIO}`)
  })

  test('generateCarouselItemListSchema maps covers-folder basenames and descriptions', () => {
    const schema = generateCarouselItemListSchema([
      {
        label: TEST_TEXT.HEADING,
        image: 'cover-name',
        link: TEST_PROJECTS.CICB,
        description: TEST_TEXT.BODY,
      },
      { label: 'Bare' },
    ])

    expect(schema.itemListElement[0].image).toBe(`${CDN_URLS.CDN_BASE}covers/cover-name.jpg`)
    expect(schema.itemListElement[0].description).toBe(TEST_TEXT.BODY)
    expect(schema.itemListElement[1].image).toBeUndefined()
    expect(schema.itemListElement[1].description).toBeUndefined()
  })

  test('generateCarouselItemListSchema returns null for empty input', () => {
    expect(generateCarouselItemListSchema()).toBeNull()
    expect(generateCarouselItemListSchema(null)).toBeNull()
  })

  test('generateProjectArticleSchema returns [] for missing inputs', () => {
    expect(generateProjectArticleSchema(null, TEST_PROJECTS.CICB)).toEqual([])
    expect(generateProjectArticleSchema({}, '')).toEqual([])
  })

  test('generateProjectArticleSchema builds Article + VideoObject entities', () => {
    const project = {
      title: `<p>${TEST_TEXT.HEADING}</p>`,
      folder: `${TEST_PROJECTS.CICB}/`,
      cover: { src: 'cover', isVideo: true },
    }

    const entities = generateProjectArticleSchema(project, TEST_PROJECTS.CICB)

    expect(entities[0]['@type']).toBe('Article')
    // A video cover resolves the Article image to the real poster asset —
    // the hypothetical -16x9/-4x3/-1x1 variants never existed on the CDN.
    expect(entities[0].image).toEqual([
      `${CDN_URLS.CDN_BASE}${TEST_PROJECTS.CICB}/cover.mp4.jpg-thumb.jpg`,
    ])
    expect(entities[1]['@type']).toBe('VideoObject')
    expect(entities[1].contentUrl).toBe(`${CDN_URLS.CDN_BASE}${TEST_PROJECTS.CICB}/cover.mp4`)
  })

  test('generateProjectArticleSchema uses the uncompressed mozjpg for image covers', () => {
    const entities = generateProjectArticleSchema(
      {
        title: TEST_TEXT.HEADING,
        folder: `${TEST_PROJECTS.CICB}/`,
        cover: { src: 'cover' },
      },
      TEST_PROJECTS.CICB
    )

    expect(entities[0].image).toEqual([
      `${CDN_URLS.CDN_BASE}${TEST_PROJECTS.CICB}/cover-mozjpg-uncompressed.jpg`,
    ])
    expect(entities).toHaveLength(1)
  })

  test('generateProjectArticleSchema falls back to the share image without a cover', () => {
    const entities = generateProjectArticleSchema({ title: TEST_TEXT.HEADING }, TEST_PROJECTS.CICB)

    expect(entities[0].image).toHaveLength(1)
    expect(entities).toHaveLength(1)
  })

  test('generateProjectArticleSchema uses slug title and cover without src', () => {
    const entities = generateProjectArticleSchema({ cover: {} }, TEST_PROJECTS.CICB)

    expect(entities[0].headline).toBe(TEST_PROJECTS.CICB)
    expect(entities[0].image).toHaveLength(1)
  })

  test('generateProjectArticleSchema video entity tolerates a missing folder', () => {
    const entities = generateProjectArticleSchema(
      { title: TEST_TEXT.HEADING, cover: { src: 'c', isVideo: true } },
      TEST_PROJECTS.CICB
    )

    expect(entities[1]['@type']).toBe('VideoObject')
  })

  test('generateWebsiteSchema emits Organization + WebSite entities', () => {
    const schema = generateWebsiteSchema()

    expect(schema.find((e) => e['@type'] === 'WebSite')).toBeTruthy()
    expect(schema.find((e) => e['@type'] === 'Organization')).toBeTruthy()
  })

  test('updateJsonLd injects a script node and replaces an existing one', () => {
    updateJsonLd({ '@type': 'One' })

    const first =
      document.getElementById(SCHEMA_STRINGS.JSON_LD_SCRIPT_ID) ||
      document.querySelector('script[type="application/ld+json"]')

    expect(first).toBeTruthy()

    updateJsonLd({ '@type': 'Two' })

    const scripts = document.querySelectorAll('script[type="application/ld+json"]')

    expect(scripts.length).toBe(1)

    expect(() => updateJsonLd(null)).not.toThrow()
  })

  test('generateBreadcrumbSchema numbers crumbs 1-based and supports null input', () => {
    const crumbs = generateBreadcrumbSchema(
      [
        { name: 'Home', url: `${NET_STRINGS.SITE_URL}/` },
        { name: 'Page', url: `${NET_STRINGS.SITE_URL}/page` },
      ],
      `${NET_STRINGS.SITE_URL}/page#breadcrumbs`
    )

    expect(crumbs['@type']).toBe('BreadcrumbList')
    expect(crumbs['@id']).toBe(`${NET_STRINGS.SITE_URL}/page#breadcrumbs`)
    expect(crumbs.itemListElement[0].position).toBe(1)
    expect(crumbs.itemListElement[1].position).toBe(2)
    expect(generateBreadcrumbSchema([])).toBeNull()
    expect(generateBreadcrumbSchema(null)).toBeNull()
  })

  test('generateRouteSchema emits Org + WebSite + WebPage + BreadcrumbList', () => {
    const pageUrl = `${NET_STRINGS.SITE_URL}/about`

    const graph = generateRouteSchema({
      url: pageUrl,
      name: 'About',
      description: TEST_TEXT.BODY,
      lang: 'br',
      breadcrumb: [
        { name: 'Luis Krötz', url: `${NET_STRINGS.SITE_URL}/` },
        { name: 'About', url: pageUrl },
      ],
    })

    const types = graph.map((e) => e['@type'])

    expect(types).toEqual(['Organization', 'WebSite', 'WebPage', 'BreadcrumbList'])

    const webPage = graph.find((e) => e['@type'] === 'WebPage')

    expect(webPage['@id']).toBe(`${pageUrl}#webpage`)
    expect(webPage.inLanguage).toBe('pt-BR')
    expect(webPage.description).toBe(TEST_TEXT.BODY)
    expect(webPage.breadcrumb['@id']).toBe(`${pageUrl}#breadcrumbs`)
    expect(graph.find((e) => e['@type'] === 'WebSite').inLanguage).toBe('pt-BR')
  })

  test('generateRouteSchema falls back to share image + site description without crumbs', () => {
    const graph = generateRouteSchema({ url: `${NET_STRINGS.SITE_URL}/`, name: 'Luis Krötz' })

    expect(graph).toHaveLength(3)

    const webPage = graph.find((e) => e['@type'] === 'WebPage')

    expect(webPage.description).toBe(SCHEMA_STRINGS.SCHEMA_SITE_DESCRIPTION)
    expect(webPage.primaryImageOfPage.url).toBe(
      `${NET_STRINGS.SITE_URL}${SCHEMA_STRINGS.SCHEMA_SHARE_IMAGE}`
    )
    expect(webPage.breadcrumb).toBeUndefined()
  })

  test('generateProjectSchema composes route graph + Article + ItemList + videos', () => {
    const project = {
      title: TEST_TEXT.HEADING,
      folder: 'melissa/',
      cover: { src: 'cover', isVideo: true },
      sections: [
        ['body copy'],
        [
          { src: 'img-one', label: 'Still One' },
          { src: 'vid-one', label: 'Vid One', isVideo: true },
          [{ src: 'img-two', label: 'Still Two' }],
        ],
      ],
    }

    const graph = generateProjectSchema(project, TEST_PROJECTS.CICB, 'de')
    const types = graph.map((e) => e['@type'])

    expect(types).toContain('Organization')
    expect(types).toContain('WebSite')
    expect(types).toContain('WebPage')
    expect(types).toContain('BreadcrumbList')
    expect(types).toContain('Article')
    expect(types).toContain('ItemList')
    expect(types.filter((t) => t === 'VideoObject')).toHaveLength(2) // cover + section

    const list = graph.find((e) => e['@type'] === 'ItemList')
    const base = `${NET_STRINGS.SITE_URL}${ROUTE_PATHS.PORTFOLIO}${TEST_PROJECTS.CICB}`

    expect(list.itemListElement).toHaveLength(3)
    expect(list.itemListElement[0].url).toBe(`${base}/still-one`)
    expect(list.itemListElement[0].image).toBe(
      `${CDN_URLS.CDN_BASE}melissa/img-one-mozjpg-uncompressed.jpg`
    )
    expect(list.itemListElement[1].image).toBe(
      `${CDN_URLS.CDN_BASE}melissa/vid-one.mp4.jpg-thumb.jpg`
    )

    const webPage = graph.find((e) => e['@type'] === 'WebPage')

    expect(webPage.inLanguage).toBe('de')
    expect(webPage.description).toBe('body copy')
    expect(webPage.primaryImageOfPage.url).toBe(
      `${CDN_URLS.CDN_BASE}melissa/cover.mp4.jpg-thumb.jpg`
    )
  })

  test('generateProjectSchema returns [] for missing inputs', () => {
    expect(generateProjectSchema(null, TEST_PROJECTS.CICB)).toEqual([])
    expect(generateProjectSchema({ title: TEST_TEXT.HEADING }, '')).toEqual([])
  })

  test('generateProjectSchema recenters the graph on a media deep link', () => {
    const project = {
      title: TEST_TEXT.HEADING,
      folder: 'p/',
      cover: { src: 'cover' },
      sections: [
        ['body copy'],
        [
          { src: 'img-one', label: 'Still One' },
          { src: 'vid-one', label: 'Vid One', isVideo: true },
        ],
      ],
    }

    const base = `${NET_STRINGS.SITE_URL}${ROUTE_PATHS.PORTFOLIO}${TEST_PROJECTS.CICB}`

    // Image deep link → WebPage + crumb recenter, ImageObject entity.
    const imgGraph = generateProjectSchema(project, TEST_PROJECTS.CICB, 'en', 'still-one')
    const imgPage = imgGraph.find((e) => e['@type'] === 'WebPage')
    const imgObj = imgGraph.find((e) => e['@type'] === 'ImageObject')
    const imgCrumbs = imgGraph.find((e) => e['@type'] === 'BreadcrumbList')

    expect(imgPage.url).toBe(`${base}/still-one`)
    expect(imgPage.name).toBe('Still One')
    expect(imgPage.primaryImageOfPage.url).toBe(
      `${CDN_URLS.CDN_BASE}p/img-one-mozjpg-uncompressed.jpg`
    )
    expect(imgObj.contentUrl).toBe(`${CDN_URLS.CDN_BASE}p/img-one-mozjpg-uncompressed.jpg`)
    expect(imgCrumbs.itemListElement).toHaveLength(3)

    // Video deep link → VideoObject for the active asset.
    const vidGraph = generateProjectSchema(project, TEST_PROJECTS.CICB, 'en', 'vid-one')
    const vidPage = vidGraph.find((e) => e['@type'] === 'WebPage')
    const vidObjs = vidGraph.filter((e) => e['@type'] === 'VideoObject')

    expect(vidPage.primaryImageOfPage.url).toBe(`${CDN_URLS.CDN_BASE}p/vid-one.mp4.jpg-thumb.jpg`)
    // The active video leads the graph once — the section-videos pass
    // skips it so the same asset isn't declared twice.
    expect(vidObjs).toHaveLength(1)
    expect(vidObjs[0].contentUrl).toBe(`${CDN_URLS.CDN_BASE}p/vid-one.mp4`)

    // Unknown media slug → plain project graph (no recentering).
    const missGraph = generateProjectSchema(project, TEST_PROJECTS.CICB, 'en', 'nope')
    const missPage = missGraph.find((e) => e['@type'] === 'WebPage')

    expect(missPage.url).toBe(base)
    expect(missGraph.find((e) => e['@type'] === 'ImageObject')).toBeUndefined()
  })

  test('generateProjectSchema tolerates sparse projects — no title/folder/cover, unlabeled media', () => {
    const graph = generateProjectSchema(
      {
        // No title → slug name; no folder → empty CDN prefix; no cover →
        // share image; sections with a falsy-src node, an unlabeled media
        // node and an empty nested array exercise the walker's guard arms.
        sections: [[{ src: '' }, { label: '' }], [[[]]], [{ src: 'v', isVideo: true }]],
      },
      TEST_PROJECTS.CICB
    )

    const webPage = graph.find((e) => e['@type'] === 'WebPage')
    const article = graph.find((e) => e['@type'] === 'Article')

    expect(webPage.name).toBe(TEST_PROJECTS.CICB)
    expect(webPage.primaryImageOfPage.url).toBe(
      `${NET_STRINGS.SITE_URL}${SCHEMA_STRINGS.SCHEMA_SHARE_IMAGE}`
    )
    expect(graph.find((e) => e['@type'] === 'ItemList')).toBeUndefined()
    // Video without text sections → authored fallback description.
    expect(graph.find((e) => e['@type'] === 'VideoObject').description).toContain('Showcase video')
    expect(article.description).toContain('Case study')
  })

  test('generateRouteSchema passes unknown locales through to inLanguage', () => {
    const graph = generateRouteSchema({
      url: `${NET_STRINGS.SITE_URL}/x`,
      name: 'X',
      lang: 'xx',
    })

    expect(graph.find((e) => e['@type'] === 'WebPage').inLanguage).toBe('xx')
  })

  test('generateProjectArticleSchema passes unknown locales through to inLanguage', () => {
    const entities = generateProjectArticleSchema(
      { title: TEST_TEXT.HEADING },
      TEST_PROJECTS.CICB,
      'xx'
    )

    expect(entities[0].inLanguage).toBe('xx')
    expect(entities[0].isPartOf.inLanguage).toBe('xx')
  })

  test('generateBreadcrumbSchema omits @id when none is supplied', () => {
    const crumbs = generateBreadcrumbSchema([{ name: 'A', url: `${NET_STRINGS.SITE_URL}/a` }])

    expect(crumbs['@id']).toBeUndefined()
    expect(crumbs.itemListElement).toHaveLength(1)
  })
})
