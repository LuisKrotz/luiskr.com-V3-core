/**
 * @file schema-experiments-tails.test.js
 * @description Coverage tails for the experiment JSON-LD builders in
 * core/utils/schema.ts — generateEarthPlaygroundSchema (route base +
 * WebApplication feature list), generateStarIndexSchema (body ItemList +
 * registry DataCatalog) and generateStarBodySchema (Article/Thing
 * dossier graph) — every lang/fallback arm included.
 */
import { describe, test, expect } from '@jest/globals'
import {
  generateEarthPlaygroundSchema,
  generateStarIndexSchema,
  generateStarBodySchema,
  generateProjectSchema,
} from '@core/utils/schema.js'
import { LOCALES } from '@core/tokens/locales.js'
import { MEDIA_CREDIT_SOURCES } from '@core/tokens/media/credits.js'
import { NET_STRINGS } from '@core/tokens/strings/net.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { BASE_TITLE } from '@core/tokens/routes.js'
import { TEST_TEXT, TEST_PROJECTS, TEST_URLS } from '@tests/fixtures/test-constants.js'

/** Experiment URLs the schema emitters assert against. */
const URL_A = 'https://luiskr.com/earth-playground'
const URL_B = 'https://luiskr.com/star-field-experiment'

describe('experiment schema builders', () => {
  test('earth playground graph carries route base + WebApplication features', () => {
    const graph = generateEarthPlaygroundSchema({
      url: URL_A,
      name: 'Earth Playground',
      description: 'desc',
      lang: LOCALES.BR,
      features: ['Camera', 'FOV', 'Bloom'],
    })

    const app = graph.find((e) => e['@type'] === 'WebApplication')

    expect(app['@id']).toBe(`${URL_A}#app`)
    expect(app.featureList).toEqual(['Camera', 'FOV', 'Bloom'])
    expect(app.inLanguage).toBe('pt-BR')
    expect(app.isPartOf['@id']).toBe(`${URL_A}#webpage`)
    expect(graph.some((e) => e['@type'] === 'WebPage')).toBe(true)
  })

  test('earth playground lang fallback keeps raw code / en default', () => {
    const unknown = generateEarthPlaygroundSchema({
      url: URL_A,
      name: 'Earth',
      lang: 'xx',
      features: [],
    })

    expect(unknown.find((e) => e['@type'] === 'WebApplication').inLanguage).toBe('xx')

    const def = generateEarthPlaygroundSchema({ url: URL_A, name: 'Earth', features: [] })

    expect(def.find((e) => e['@type'] === 'WebApplication').inLanguage).toBe('en')
  })

  test('star index graph emits body ItemList + full DataCatalog datasets', () => {
    const graph = generateStarIndexSchema({
      url: URL_B,
      name: 'Star Field',
      lang: 'en',
      items: [{ url: `${URL_B}/mars`, name: 'Mars' }],
      catalogName: 'Deep Catalog',
      datasets: [
        {
          kind: 'star',
          name: 'Catalogued star',
          description: 'about',
          credit: 'HYG',
          distributions: [
            { url: 'https://luiskr.com/x/manifest.json', format: 'application/json' },
            { url: 'https://luiskr.com/x/star-000.json', format: 'application/json' },
          ],
        },
        {
          kind: 'dso',
          name: 'DSO',
          distributions: [{ url: 'https://luiskr.com/x/dso-000.json', format: 'application/json' }],
        },
      ],
    })

    const list = graph.find((e) => e['@type'] === 'ItemList')

    expect(list['@id']).toBe(`${URL_B}#catalog`)
    expect(list.itemListElement[0]).toMatchObject({
      position: 1,
      url: `${URL_B}/mars`,
      name: 'Mars',
    })

    const cat = graph.find((e) => e['@type'] === 'DataCatalog')

    expect(cat['@id']).toBe(`${URL_B}#data-catalog`)
    expect(cat.name).toBe('Deep Catalog')
    expect(cat.dataset).toHaveLength(2)
    expect(cat.dataset[0].creditText).toBe('HYG')
    expect(cat.dataset[0].distribution).toHaveLength(2)
    expect(cat.dataset[1].description).toBeUndefined()
    expect(cat.dataset[1].creditText).toBeUndefined()
    expect(cat.dataset[1].distribution[0]['@type']).toBe('DataDownload')
  })

  test('star index graph omits DataCatalog without datasets', () => {
    const none = generateStarIndexSchema({
      url: URL_B,
      name: 'Star Field',
      items: [],
    })

    expect(none.some((e) => e['@type'] === 'DataCatalog')).toBe(false)

    const empty = generateStarIndexSchema({
      url: URL_B,
      name: 'Star Field',
      items: [],
      datasets: [],
    })

    expect(empty.some((e) => e['@type'] === 'DataCatalog')).toBe(false)
  })

  test('star body graph emits Article/Thing with PropertyValue facts', () => {
    const graph = generateStarBodySchema({
      url: `${URL_B}/mars`,
      indexUrl: URL_B,
      indexName: 'Star Field',
      name: 'Mars',
      tagline: 'The red planet',
      facts: [{ label: 'Diameter', value: '6,779 km' }],
      lang: 'en',
    })

    const article = graph.find((e) => e['@type'] === 'Article')

    expect(article['@id']).toBe(`${URL_B}/mars#article`)
    expect(article.headline).toBe('Mars')
    expect(article.about['@id']).toBe(`${URL_B}/mars#object`)
    expect(article.about.additionalProperty[0]).toMatchObject({
      '@type': 'PropertyValue',
      name: 'Diameter',
      value: '6,779 km',
    })
    expect(article.isPartOf['@id']).toBe(`${URL_B}#webpage`)

    const crumbs = graph.find((e) => e['@type'] === 'BreadcrumbList')

    expect(crumbs.itemListElement).toHaveLength(3)
    expect(crumbs.itemListElement[1].item).toBe(URL_B)
  })

  test('star body graph exposes credited images and videos without invented dates', () => {
    const graph = generateStarBodySchema({
      url: `${URL_B}/earth`,
      indexUrl: URL_B,
      indexName: 'Star Field',
      name: 'Earth',
      tagline: TEST_TEXT.BODY,
      media: {
        images: [
          { src: TEST_URLS.IMG, caption: TEST_TEXT.HEADING, credit: TEST_TEXT.BODY },
          { src: TEST_URLS.B, caption: TEST_TEXT.HEADING },
          { src: '' },
        ],
        videos: [
          {
            src: TEST_URLS.VIDEO,
            caption: TEST_TEXT.HEADING,
            credit: TEST_TEXT.BODY,
            poster: TEST_URLS.A,
          },
          { src: TEST_URLS.B, poster: 'poster-relative' },
          { src: '' },
        ],
      },
    })

    const page = graph.find((entity) => entity['@type'] === 'WebPage')
    const article = graph.find((entity) => entity['@type'] === 'Article')
    const images = graph.filter((entity) => entity['@type'] === 'ImageObject')
    const videos = graph.filter((entity) => entity['@type'] === 'VideoObject')

    expect(page.primaryImageOfPage.url).toBe(TEST_URLS.IMG)
    expect(page.mainEntity['@id']).toBe(`${URL_B}/earth#article`)
    expect(article.image).toEqual([TEST_URLS.IMG, TEST_URLS.B])
    expect(article.about.image).toBe(TEST_URLS.IMG)
    expect(images).toHaveLength(2)
    expect(images[0].creditText).toBe(TEST_TEXT.BODY)
    expect(images[0].representativeOfPage).toBe(true)
    expect(images[1].representativeOfPage).toBe(false)
    expect(videos).toHaveLength(2)
    expect(videos[0].thumbnailUrl).toEqual([TEST_URLS.A])
    expect(videos[1].thumbnailUrl).toEqual([TEST_URLS.IMG])
    expect(videos[0].creditText).toBe(TEST_TEXT.BODY)
    expect(videos[0].uploadDate).toBeUndefined()
    expect(videos[0].duration).toBeUndefined()
    expect(videos[0].embedUrl).toBeUndefined()

    const withoutPoster = generateStarBodySchema({
      url: `${URL_B}/moon`,
      indexUrl: URL_B,
      indexName: 'Star Field',
      name: 'Moon',
      media: { videos: [{ src: TEST_URLS.VIDEO }] },
    })

    expect(withoutPoster.some((entity) => entity['@type'] === 'VideoObject')).toBe(false)
  })

  test('credited dossier media resolves the source licence provenance', () => {
    const credit = Object.keys(MEDIA_CREDIT_SOURCES)[0]

    const graph = generateStarBodySchema({
      url: `${URL_B}/sirius`,
      indexUrl: URL_B,
      indexName: 'Star Field',
      name: 'Sirius',
      lang: 'en',
      media: { images: [{ src: TEST_URLS.IMG, credit }] },
    })

    const image = graph.find(
      (entity) => entity['@type'] === 'ImageObject' && entity['@id']?.endsWith('#image-1')
    )

    const page = graph.find((entity) => entity['@type'] === 'WebPage')

    // Third-party assets point at the SOURCE's terms page — the site's
    // MPL license never covers NASA/ESA imagery — and carry no creator
    // ref back to the site person.
    expect(image.license).toBe(MEDIA_CREDIT_SOURCES[credit].licenseUrl)
    expect(image.acquireLicensePage).toBe(MEDIA_CREDIT_SOURCES[credit].licenseUrl)
    expect(image.copyrightNotice).toBe(credit)
    expect(image.creditText).toContain('Source:')
    expect(image.creator).toBeUndefined()

    // The WebPage's representative image carries the same provenance.
    expect(page.primaryImageOfPage.license).toBe(MEDIA_CREDIT_SOURCES[credit].licenseUrl)
    expect(page.primaryImageOfPage.copyrightNotice).toBe(credit)
    expect(page.primaryImageOfPage.creator).toBeUndefined()
  })

  test('uncredited dossier media falls back to the site-owned provenance', () => {
    const graph = generateStarBodySchema({
      url: `${URL_B}/sol`,
      indexUrl: URL_B,
      indexName: 'Star Field',
      name: 'Sol',
      lang: 'en',
      media: { images: [{ src: TEST_URLS.IMG }] },
    })

    const image = graph.find(
      (entity) => entity['@type'] === 'ImageObject' && entity['@id']?.endsWith('#image-1')
    )

    expect(image.license).toBe(`${NET_STRINGS.SITE_URL}/license`)
    expect(image.acquireLicensePage).toBe(`${NET_STRINGS.SITE_URL}/license`)
    expect(image.copyrightNotice).toBe(`${CHAR_STRINGS.COPYRIGHT} ${BASE_TITLE}`)
    expect(image.creditText).toBe(BASE_TITLE)
  })

  test('star body graph falls back to empty description and no facts', () => {
    const graph = generateStarBodySchema({
      url: `${URL_B}/${TEST_TEXT.SLUG || 'x'}`,
      indexUrl: URL_B,
      indexName: 'Star Field',
      name: 'X',
    })

    const article = graph.find((e) => e['@type'] === 'Article')

    expect(article.description).toBe('')
    expect(article.about.additionalProperty).toEqual([])
  })

  test('project schema returns an empty graph for missing inputs', () => {
    expect(generateProjectSchema(null, TEST_PROJECTS.CICB)).toEqual([])
    expect(generateProjectSchema({ title: TEST_TEXT.HEADING }, '')).toEqual([])
  })
})
