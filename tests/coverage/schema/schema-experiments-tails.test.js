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
import { TEST_TEXT, TEST_PROJECTS } from '@tests/fixtures/test-constants.js'

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
