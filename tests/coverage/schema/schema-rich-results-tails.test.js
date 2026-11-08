/**
 * @file schema-rich-results-tails.test.js
 * @description Coverage tails for the rich-result fields added to
 * core/utils/schema.ts — the Person entity + #person refs, the
 * route-schema pageType/keywords/about/mainEntity arms, the licensed
 * ImageObject watch-page entity and resolveProjectMedia's slug walk.
 */
import {
  generatePersonSchema,
  generateProjectArticleSchema,
  generateProjectSchema,
  generateRouteSchema,
  generateWebsiteSchema,
  resolveProjectMedia,
} from '@core/utils/schema.js'
import { SCHEMA_STRINGS } from '@core/tokens/strings/schema.js'
import { NET_STRINGS } from '@core/tokens/strings/net.js'
import { LOCALES } from '@core/tokens/locales.js'
import { MEDIA_CREDIT_SOURCES } from '@core/tokens/media/credits.js'

import { TEST_TEXT, TEST_PROJECTS, TEST_URLS } from '@tests/fixtures/test-constants.js'

/** Project case-study canonical reused by rich-result schema assertions. */
const URL_P = `${NET_STRINGS.SITE_URL}/portfolio/${TEST_PROJECTS.CICB}`

/** Minimal project node carrying a still + a clip + a duplicate label. */
const projectNode = {
  title: TEST_TEXT.HEADING,
  folder: 'covers/',
  cover: { src: 'hero', isVideo: true, label: TEST_TEXT.HEADING },
  searchThemes: [TEST_TEXT.HEADING, TEST_TEXT.SECOND],
  sections: [
    ['Intro paragraph'],
    [
      { src: 'still', label: 'My still', size: [800, 600] },
      { src: 'clip', label: 'My clip', isVideo: true },
      { src: 'still-2', label: 'My still' },
    ],
  ],
}

describe('rich-result schema fields', () => {
  test('person entity carries identity + expertise fields', () => {
    const person = generatePersonSchema()

    expect(person['@type']).toBe('Person')
    expect(person['@id']).toBe(`${NET_STRINGS.SITE_URL}#person`)
    expect(person.alternateName).toBe(SCHEMA_STRINGS.SCHEMA_PERSON_ALT_NAME)
    expect(person.jobTitle).toBe(SCHEMA_STRINGS.SCHEMA_PERSON_JOB_TITLE)
    expect(person.knowsAbout.length).toBeGreaterThan(3)
    expect(person.worksFor['@id']).toBe(`${NET_STRINGS.SITE_URL}#organization`)
    expect(person.sameAs.length).toBe(4)
  })

  test('website schema emits the person entity between org and site', () => {
    const [org, person, site] = generateWebsiteSchema()

    expect(org['@type']).toBe('Organization')
    expect(person['@type']).toBe('Person')
    expect(site['@type']).toBe('WebSite')
  })

  test('route schema honors pageType/keywords/about/mainEntity arms', () => {
    const graph = generateRouteSchema({
      url: `${NET_STRINGS.SITE_URL}/about`,
      name: 'About',
      pageType: 'ProfilePage',
      keywords: 'k1, k2',
      about: { '@id': `${NET_STRINGS.SITE_URL}#person` },
      mainEntity: { '@id': `${NET_STRINGS.SITE_URL}#person` },
    })

    const page = graph.find((e) => e['@type'] === 'ProfilePage')

    expect(page.keywords).toBe('k1, k2')
    expect(page.about['@id']).toBe(`${NET_STRINGS.SITE_URL}#person`)
    expect(page.mainEntity['@id']).toBe(`${NET_STRINGS.SITE_URL}#person`)
    expect(page.dateModified).toBeUndefined()
  })

  test('route schema defaults to WebPage without optional arms', () => {
    const graph = generateRouteSchema({ url: `${NET_STRINGS.SITE_URL}/x`, name: 'X' })
    const page = graph.find((e) => e['@type'] === 'WebPage')

    expect(page.keywords).toBeUndefined()
    expect(page.about).toBeUndefined()
    expect(page.mainEntity).toBeUndefined()
  })

  test('route schema imageCredit only applies alongside an image', () => {
    const credit = Object.keys(MEDIA_CREDIT_SOURCES)[0]

    // image + credit → the representative ImageObject resolves the
    // source's terms and drops the site-person creator ref.
    const credited = generateRouteSchema({
      url: `${NET_STRINGS.SITE_URL}/sf/sol`,
      name: '',
      image: TEST_URLS.IMG,
      imageCredit: credit,
    })

    const creditedPage = credited.find((e) => e['@type'] === 'WebPage')

    expect(creditedPage.primaryImageOfPage.license).toBe(MEDIA_CREDIT_SOURCES[credit].licenseUrl)
    expect(creditedPage.primaryImageOfPage.creator).toBeUndefined()

    // imageCredit without image → the SHARE_IMAGE fallback stays
    // site-owned (license + creator present).
    const orphan = generateRouteSchema({
      url: `${NET_STRINGS.SITE_URL}/x`,
      name: 'X',
      imageCredit: credit,
    })

    const orphanPage = orphan.find((e) => e['@type'] === 'WebPage')

    expect(orphanPage.primaryImageOfPage.url).toBe(
      `${NET_STRINGS.SITE_URL}${SCHEMA_STRINGS.SCHEMA_SHARE_IMAGE}`
    )
    expect(orphanPage.primaryImageOfPage.license).toBe(`${NET_STRINGS.SITE_URL}/license`)
    expect(orphanPage.primaryImageOfPage.creator['@id']).toBe(`${NET_STRINGS.SITE_URL}#person`)
  })

  test('project article emits keywords/section/person refs', () => {
    const [article] = generateProjectArticleSchema(projectNode, TEST_PROJECTS.CICB, LOCALES.BR)

    expect(article.articleSection).toBe(SCHEMA_STRINGS.SCHEMA_ARTICLE_SECTION)
    expect(article.isAccessibleForFree).toBe(true)
    expect(article.keywords).toBe(`${TEST_TEXT.HEADING}, ${TEST_TEXT.SECOND}`)
    expect(article.author['@id']).toBe(`${NET_STRINGS.SITE_URL}#person`)
    expect(article.publisher['@id']).toBe(`${NET_STRINGS.SITE_URL}#person`)
    expect(article.inLanguage).toBe('pt-BR')
  })

  test('project article drops keywords without searchThemes', () => {
    const [article] = generateProjectArticleSchema(
      { title: TEST_TEXT.HEADING, sections: [['x']] },
      TEST_PROJECTS.CICB
    )

    expect(article.keywords).toBeUndefined()
  })

  test('project schema binds WebPage keywords + article mainEntity', () => {
    const graph = generateProjectSchema(projectNode, TEST_PROJECTS.CICB)
    const page = graph.find((e) => e['@type'] === 'WebPage')

    expect(page.keywords).toBe(`${TEST_TEXT.HEADING}, ${TEST_TEXT.SECOND}`)
    expect(page.mainEntity['@id']).toBe(`${URL_P}#article`)
    // Section videos still emit VideoObjects with the new fields.
    const videos = graph.filter((e) => e['@type'] === 'VideoObject')
    expect(videos.length).toBeGreaterThanOrEqual(2)
    expect(videos[0].uploader['@id']).toBe(`${NET_STRINGS.SITE_URL}#person`)
    expect(videos[0].isFamilyFriendly).toBe(true)
    expect(videos[0].requiresSubscription).toBe(false)
  })

  test('video watch page declares a single #video entity + og mainEntity', () => {
    const graph = generateProjectSchema(projectNode, TEST_PROJECTS.CICB, LOCALES.EN, 'my-clip')
    const page = graph.find((e) => e['@type'] === 'WebPage')

    expect(page.mainEntity['@id']).toBe(`${URL_P}/my-clip#video`)

    const videos = graph.filter((e) => e['@type'] === 'VideoObject')
    expect(videos).toHaveLength(1)
    expect(videos[0]['@id']).toBe(`${URL_P}/my-clip#video`)
    expect(videos[0].inLanguage).toBe('en')
  })

  test('image watch page emits the licensed ImageObject with dims', () => {
    const graph = generateProjectSchema(projectNode, TEST_PROJECTS.CICB, LOCALES.EN, 'my-still')
    const image = graph.find((e) => e['@type'] === 'ImageObject' && e['@id']?.endsWith('#image'))
    const page = graph.find((e) => e['@type'] === 'WebPage')

    expect(page.mainEntity['@id']).toBe(`${URL_P}/my-still#image`)
    expect(image.license).toBe(`${NET_STRINGS.SITE_URL}/license`)
    expect(image.acquireLicensePage).toBe(`${NET_STRINGS.SITE_URL}/license`)
    expect(image.creator['@id']).toBe(`${NET_STRINGS.SITE_URL}#person`)
    expect(image.copyrightNotice).toBeTruthy()
    expect(image.creditText).toBe(TEST_TEXT.HEADING)
    expect(image.width).toBe(800)
    expect(image.height).toBe(600)
  })

  test('localized image watch page binds the locale license URL', () => {
    const graph = generateProjectSchema(projectNode, TEST_PROJECTS.CICB, LOCALES.BR, 'my-still')
    const image = graph.find((e) => e['@type'] === 'ImageObject' && e['@id']?.endsWith('#image'))

    expect(image.license).toContain('/br/')
  })

  test('watch page without dims omits width/height', () => {
    const node = {
      title: TEST_TEXT.HEADING,
      folder: 'covers/',
      sections: [[{ src: 'nodims', label: 'No dims asset' }]],
    }
    const graph = generateProjectSchema(node, TEST_PROJECTS.CICB, LOCALES.EN, 'no-dims-asset')
    const image = graph.find((e) => e['@type'] === 'ImageObject' && e['@id']?.endsWith('#image'))

    expect(image.width).toBeUndefined()
    expect(image.height).toBeUndefined()
  })

  test('resolveProjectMedia walks document-order slugs', () => {
    expect(resolveProjectMedia(null, 'x')).toBeNull()
    expect(resolveProjectMedia(projectNode, undefined)).toBeNull()
    expect(resolveProjectMedia(projectNode, 'missing')).toBeNull()

    // 'My still' appears twice — the second instance resolves to my-still-2.
    const second = resolveProjectMedia(projectNode, 'my-still-2')

    expect(second.media.src).toBe('still-2')
    expect(second.urls.isVideo).toBe(false)

    const clip = resolveProjectMedia(projectNode, 'my-clip')

    expect(clip.urls.isVideo).toBe(true)
    expect(clip.urls.source).toContain('.mp4')
  })
})
