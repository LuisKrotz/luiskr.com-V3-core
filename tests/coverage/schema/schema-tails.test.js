/**
 * @file schema-tails.test.js
 * @description Split from coverage-tails-4.test.js — covers the "schema tails" describe.
 */
import {
  generateCarouselItemListSchema,
  generateProjectArticleSchema,
  generateProjectSchema,
  generateStarIndexSchema,
  setRobotsMeta,
  updateJsonLd,
} from '@core/utils/schema.js'
import { SCHEMA_STRINGS } from '@core/tokens/strings/schema.js'

import { TEST_TEXT, TEST_PROJECTS } from '@tests/fixtures/test-constants.js'
import '@website/components/feedback/CookieBanner.js'
import '@website/components/home/ContactSection.js'
import '@website/views/not-found/NotFound.js'

describe('schema tails', () => {
  test('carousel ItemList handles empty, title-only and CDN paths', () => {
    expect(generateCarouselItemListSchema([])).toBeNull()
    expect(generateCarouselItemListSchema(null)).toBeNull()
    expect(generateCarouselItemListSchema()).toBeNull()

    const list = generateCarouselItemListSchema([
      { label: TEST_TEXT.HEADING, link: '/a', src: 'covers/x.jpg' },
      { title: TEST_TEXT.SECOND, link: '/b', src: 'https://cdn.test/y.jpg' },
      { link: '/c' },
    ])

    expect(list.itemListElement.length).toBe(3)
    expect(list.itemListElement[2].name).toContain('Item')
  })

  test('carousel ItemList resolves absolute links, covers/ images, slugs and descriptions', () => {
    const list = generateCarouselItemListSchema([
      // Absolute external link passes through verbatim; image (no src)
      // resolves through the covers/ CDN folder.
      {
        label: TEST_TEXT.HEADING,
        link: 'https://press.example.com/story',
        image: 'press-shot',
        description: 'External press mention',
      },
      // No link at all — the slug arm builds the canonical project URL.
      { slug: 'slug-only', label: TEST_TEXT.SECOND },
    ])

    const first = list.itemListElement[0]
    const second = list.itemListElement[1]

    expect(first.url).toBe('https://press.example.com/story')
    expect(first.image).toContain('press-shot')
    expect(first.description).toBe('External press mention')
    expect(second.url).toContain('slug-only')
    expect(second.image).toBeUndefined()
    expect(second.description).toBeUndefined()
  })

  test('updateJsonLd wraps an entity array in a @graph container', () => {
    updateJsonLd([{ '@type': 'One' }, { '@type': 'Two' }])

    const el = document.getElementById(SCHEMA_STRINGS.JSON_LD_SCRIPT_ID)
    const payload = JSON.parse(el.textContent)

    expect(payload['@graph']).toHaveLength(2)
    expect(payload['@graph'][0]['@type']).toBe('One')
  })

  test('project schema returns an empty graph for missing inputs', () => {
    expect(generateProjectSchema(null, TEST_PROJECTS.CICB)).toEqual([])
    expect(generateProjectSchema({ title: TEST_TEXT.HEADING }, '')).toEqual([])
  })

  test('an unmapped locale ships its raw code as inLanguage', () => {
    // 'xx' has no LOCALE_TAGS entry — the `|| lang` arm emits the code
    // verbatim instead of dropping the language hint entirely. The video
    // cover routes through videoObjectFor's own inLanguage line.
    const graph = generateProjectArticleSchema(
      {
        title: TEST_TEXT.HEADING,
        folder: 'demo',
        cover: { src: 'clip.mp4', isVideo: true },
        sections: [],
      },
      TEST_PROJECTS.CICB,
      'xx'
    )

    const video = graph.find((e) => e['@type'] === 'VideoObject')

    expect(video.inLanguage).toBe('xx')
  })

  test('setRobotsMeta early-returns without a DOM', () => {
    const doc = globalThis.document

    delete globalThis.document

    expect(() => setRobotsMeta(true)).not.toThrow()

    globalThis.document = doc
  })

  test('star index graph falls back to the page name without a catalog name', () => {
    const graph = generateStarIndexSchema({
      url: 'https://luiskr.com/star-field-experiment',
      name: 'Star Field',
      items: [],
      datasets: [
        {
          kind: 'star',
          name: 'Catalogued star',
          distributions: [
            { url: 'https://luiskr.com/x/star-000.json', format: 'application/json' },
          ],
        },
      ],
    })

    const cat = graph.find((e) => e['@type'] === 'DataCatalog')

    expect(cat.name).toBe('Star Field')
  })
})
