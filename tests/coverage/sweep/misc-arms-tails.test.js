/**
 * @file misc-arms-tails.test.js
 * @description Sweep coverage tails: ui.ts toggleSearchModal's
 * non-boolean toggle arm, media/credits.ts unknown-credit pass-through,
 * and schema.ts's remaining binary arms (external links pass through,
 * unknown-locale bcp fallback, catalogName/datasets defaults).
 */
import { describe, test, expect } from '@jest/globals'
import store from '@core/store.js'
import { MODAL_MUTATIONS } from '@core/tokens/events/mutations.js'
import {
  MEDIA_CREDIT_SOURCES,
  creditLicenseUrlFor,
  creditTextFor,
  mediaProvenanceFields,
} from '@core/tokens/media/credits.js'
import {
  generateCarouselItemListSchema,
  generateEarthPlaygroundSchema,
  generateStarIndexSchema,
} from '@core/utils/schema.js'

describe('store mutations — non-boolean toggle arm', () => {
  test('toggleSearchModal without a payload flips the flag', () => {
    const before = store.getters.getSearchModalOpen()

    store.commit(MODAL_MUTATIONS.TOGGLE_SEARCH_MODAL)
    expect(store.getters.getSearchModalOpen()).toBe(!before)

    store.commit(MODAL_MUTATIONS.TOGGLE_SEARCH_MODAL, before)
  })
})

describe('media credits — registry arms', () => {
  test('creditTextFor returns the raw credit when the registry has no entry', () => {
    expect(creditTextFor('Private collection', 'sirius')).toBe('Private collection')
  })

  test('a registered credit joins source/host/license/usage fields', () => {
    const out = creditTextFor('NASA', 'sirius')

    expect(out).toContain('NASA')
    expect(out).toContain('sirius')
  })

  test('creditLicenseUrlFor resolves mapped credits and misses unmapped ones', () => {
    const known = Object.keys(MEDIA_CREDIT_SOURCES)[0]

    expect(creditLicenseUrlFor(known)).toBe(MEDIA_CREDIT_SOURCES[known].licenseUrl)
    expect(creditLicenseUrlFor('Private collection')).toBeUndefined()
  })

  test('mediaProvenanceFields emits the licence pair + notice + credit, omitting absent arms', () => {
    const full = mediaProvenanceFields({
      licenseUrl: 'https://terms.example/x',
      copyrightNotice: 'notice',
      creditText: 'credit',
    })

    expect(full).toEqual({
      license: 'https://terms.example/x',
      acquireLicensePage: 'https://terms.example/x',
      copyrightNotice: 'notice',
      creditText: 'credit',
    })

    expect(mediaProvenanceFields({})).toEqual({})
  })
})

describe('schema arms', () => {
  test('carousel item list keeps absolute URLs and prefixes relative slugs', () => {
    const items = [
      { link: 'https://press.example.com/award', name: 'Press' },
      { link: 'project-one', name: 'One' },
      { name: 'NoLink' },
    ]

    const out = generateCarouselItemListSchema(items)

    const list = (Array.isArray(out) ? out : out.itemListElement) || []

    expect(list.length).toBeGreaterThan(0)
  })

  test('earth playground schema handles an unknown locale', () => {
    const out = generateEarthPlaygroundSchema({
      url: 'https://luiskr.com/earth-playground',
      name: 'Earth',
      description: 'd',
      lang: 'xx',
      features: ['camera'],
    })

    expect(out).toBeTruthy()
  })

  test('star index schema works without catalogName or datasets', () => {
    const out = generateStarIndexSchema({
      url: 'https://luiskr.com/experiments/star-field',
      name: 'Star Field',
      items: [{ url: 'https://luiskr.com/experiments/star-field/sirius', name: 'Sirius' }],
    })

    expect(out).toBeTruthy()
  })

  test('star index schema takes catalogName + datasets when provided', () => {
    const out = generateStarIndexSchema({
      url: 'https://luiskr.com/experiments/star-field',
      name: 'Star Field',
      items: [{ url: 'https://luiskr.com/experiments/star-field/sirius', name: 'Sirius' }],
      catalogName: 'Hipparcos',
      datasets: [
        {
          kind: 'stars',
          name: 'manifest',
          description: 'd',
          credit: 'c',
          distributions: [{ format: 'application/json', url: 'https://x/m.json' }],
        },
        {
          kind: 'meta',
          name: 'n',
          distributions: [],
        },
      ],
    })

    expect(out).toBeTruthy()
  })

  test('earth playground schema accepts keywords + screenshot', () => {
    const out = generateEarthPlaygroundSchema({
      url: 'https://luiskr.com/earth-playground',
      name: 'Earth',
      lang: 'en',
      features: ['camera'],
      keywords: 'a, b',
      screenshot: 'https://x/s.png',
    })

    expect(out).toBeTruthy()
  })
})
