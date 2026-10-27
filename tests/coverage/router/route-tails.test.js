/**
 * @file route-tails.test.js — coverage tails for routing modules.
 * No jest.resetModules(): istanbul counters live per module instance, so
 * re-imports after a reset discard recorded hits in the merged report.
 */

import { jest } from '@jest/globals'
import store from '@core/store.js'
import router from '@core/router/router.js'
import { ROUTE_STRINGS } from '@core/tokens/strings/routes.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { ROUTE_NAMES } from '@core/tokens/routes/names.js'
import { SECTION_IDS } from '@core/tokens/ids/sections.js'
import { VIEW_TAGS } from '@core/tokens/elements/views.js'
import {
  buildRouteJsonLd,
  handleNavigation,
  syncDocumentHead,
  setMetaContent,
  setMetaDescription,
} from '@core/router/navigate.js'
import { parsePath, normalizeProjectKey } from '@core/router/parse-path.js'
import { LANG_SLUGS } from '@core/i18n.js'
import { LOCALES } from '@core/tokens/locales.js'
import { QUERY_STRINGS } from '@core/tokens/strings/queries.js'
import { SCHEMA_STRINGS } from '@core/tokens/strings/schema.js'
import { updateRobotsMeta, resolveProjectSlug } from '@website/views/project/data.js'
import { checkAutoOpenModal } from '@website/views/project/modal.js'
import { renderProject } from '@website/views/project/render.js'
import { patchViewProject } from '@core/safari/patches/view-project.js'

import '@website/views/not-found/NotFound.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { LANG_MUTATIONS, MODAL_MUTATIONS } from '@core/tokens/events/mutations.js'

const flush = (ms = 60) => new Promise((r) => setTimeout(r, ms))

describe('route tails', () => {
  test('handleNavigation — /admin first-segment hits CMS hard-nav arm', async () => {
    const host = { currentRoute: null, push: jest.fn(async () => true) }

    const orig = window.location.replace
    let replaced = ''

    window.location.replace = (u) => {
      replaced = u
    }

    await handleNavigation(host, `/${ROUTE_STRINGS.ADMIN}/panel`)

    expect(replaced).toContain('/cms')

    window.location.replace = orig
  })

  test('parsePath — legal route with missing links entry → EMPTY fallback', () => {
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, { 'legal-footer': { links: [{ page: 'p0' }] } })

    const r = parsePath(`/${ROUTE_STRINGS.PRIVACY}`)

    expect(r.name).toBeTruthy()

    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, null)
  })

  test('parsePath — contact slug routes home with the contact scroll target', () => {
    const r = parsePath(`/${ROUTE_STRINGS.CONTACT}`)

    expect(r.name).toBe(ROUTE_NAMES.CONTACT)
    expect(r.view).toBe(VIEW_TAGS.VIEW_HOME)
    expect(r.meta.scrollTo).toBe(SECTION_IDS.CONTACT)
  })

  test('parsePath — star-field body segment deep-links feed params.body', () => {
    const r = parsePath(`${ROUTE_PATHS.STAR_FIELD}/sun`)

    expect(r.view).toBe(VIEW_TAGS.VIEW_STAR_FIELD)
    expect(r.params.body).toBe('sun')
  })

  test('parsePath — animations reference: localized slug + English-segment alias', () => {
    const en = parsePath(`/${ROUTE_PATHS.ANIMATIONS_SEGMENT}`)

    expect(en.name).toBe(ROUTE_NAMES.ANIMATIONS)
    expect(en.view).toBe(VIEW_TAGS.VIEW_ANIMATIONS)
    expect(en.meta.canonical).toBe(`/${LANG_SLUGS.en.animations}`)

    // Localized slug — the German route resolves the view with its own canonical.
    const de = parsePath(`/de/${LANG_SLUGS.de.animations}`)

    expect(de.name).toBe(ROUTE_NAMES.ANIMATIONS)
    expect(de.lang).toBe(LOCALES.DE)
    expect(de.meta.canonical).toBe(`/de/${LANG_SLUGS.de.animations}`)

    // English-segment alias under a locale prefix canonicalizes localized.
    const alias = parsePath(`/de/${LANG_SLUGS.en.animations}`)

    expect(alias.view).toBe(VIEW_TAGS.VIEW_ANIMATIONS)
    expect(alias.meta.canonical).toBe(`/de/${LANG_SLUGS.de.animations}`)
  })

  test('updateRobotsMeta — create, reuse, index/noindex arms', () => {
    updateRobotsMeta(true)
    updateRobotsMeta(true)

    expect(document.querySelector(QUERY_STRINGS.META_ROBOTS)?.content).toBe(
      SCHEMA_STRINGS.NOINDEX_NOFOLLOW
    )

    updateRobotsMeta(false)
    updateRobotsMeta(false)

    expect(document.querySelector(QUERY_STRINGS.META_ROBOTS)?.content).toBe(
      SCHEMA_STRINGS.INDEX_RICH_DIRECTIVES
    )
  })

  test('checkAutoOpenModal — translations without folder → EMPTY arm', () => {
    const prev = router.currentRoute

    router.currentRoute = { params: { slug: 'nothing-matches' } }

    expect(() =>
      checkAutoOpenModal({ translations: { sections: [] }, updateRobotsMeta: jest.fn() })
    ).not.toThrow()

    router.currentRoute = prev
  })

  test('checkAutoOpenModal — matching media item commits the modal', () => {
    const prev = router.currentRoute

    router.currentRoute = { params: { slug: 'my-item' } }

    const c = {
      translations: {
        folder: 'f/',
        sections: [
          [
            ['t'],
            [
              { label: 'Other', src: 's', size: [1, 2], isVideo: false },
              { label: 'My Item', src: 's', size: [1, 2], isVideo: false },
            ],
          ],
        ],
      },
      updateRobotsMeta: jest.fn(),
    }

    checkAutoOpenModal(c)

    expect(store.getters.getModal()?.open).toBe(true)

    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: false })

    // isVideo item → video URL arm; label-less item → label||EMPTY arm;
    // matching item without isVideo → `isVideo ?? false` nullish arm
    router.currentRoute = { params: { slug: 'vid-item' } }
    checkAutoOpenModal({
      translations: {
        sections: [[['t'], [{ label: 'Vid Item', src: 's', size: [1, 2], isVideo: true }]]],
      },
      updateRobotsMeta: jest.fn(),
    })

    router.currentRoute = { params: { slug: 'no-flag' } }
    checkAutoOpenModal({
      translations: { sections: [[['t'], [{ label: 'No Flag', src: 's', size: [1, 2] }]]] },
      updateRobotsMeta: jest.fn(),
    })
    checkAutoOpenModal({
      translations: { sections: [[['t'], [{ src: 's', size: [1, 2] }]]] },
      updateRobotsMeta: jest.fn(),
    })

    // !slug arm → return before reading translations
    router.currentRoute = { params: {} }
    checkAutoOpenModal({ translations: { sections: [] } })

    // !c.translations arm
    router.currentRoute = { params: { slug: 'x' } }
    checkAutoOpenModal({ translations: null })

    // translations present, sections missing → sections || [] arm
    checkAutoOpenModal({ translations: {}, updateRobotsMeta: jest.fn() })

    router.currentRoute = prev
    store.commit(MODAL_MUTATIONS.SET_MODAL, { open: false })
  })

  test('resolveProjectSlug — no slug + no window → EMPTY arm', () => {
    const prev = router.currentRoute
    const desc = Object.getOwnPropertyDescriptor(globalThis, 'window')

    router.currentRoute = { params: {} }

    if (desc?.configurable) delete globalThis.window

    const slug = resolveProjectSlug({})

    if (desc?.configurable) Object.defineProperty(globalThis, 'window', desc)

    router.currentRoute = prev

    expect(slug).toBe('')
  })

  test('syncDocumentHead — descriptor without title → BASE_TITLE arm', () => {
    const prev = document.title

    syncDocumentHead({ name: 'x', view: 'v', lang: 'en', path: '/x', meta: {}, params: {} })

    expect(document.title).toBeTruthy()

    document.title = prev
  })

  test('renderProject — translation without cover renders placeholder arm', () => {
    const vnode = renderProject({ translations: { title: 'T' } })

    expect(vnode).toBeTruthy()
  })

  test('renderProject — cover without folder → EMPTY prefix arm', () => {
    const vnode = renderProject({
      translations: { title: 'T', cover: { src: 's', size: [1, 1], label: 'l' } },
    })

    expect(vnode).toBeTruthy()
  })

  test('NotFound — translations present but title empty → EMPTY label arm', async () => {
    const el = document.createElement(VIEW_TAGS.VIEW_NOT_FOUND)

    document.body.appendChild(el)

    await flush()

    el.translations = {}
    el._updateDom()

    el.remove()
  })

  test('NotFound — mounts with no translations → link-binding else arm', async () => {
    const el = document.createElement(VIEW_TAGS.VIEW_NOT_FOUND)

    document.body.appendChild(el)

    await flush()

    el.remove()
  })

  test('patchViewProject — customElements.get undefined → early return', async () => {
    const origGet = customElements.get
    const origDef = customElements.whenDefined

    customElements.get = () => undefined
    customElements.whenDefined = () => Promise.resolve()

    patchViewProject()

    await flush()

    customElements.get = origGet
    customElements.whenDefined = origDef
  })

  test('syncDocumentHead — syncs title/url/canonical mirrors + description', () => {
    const prevHead = document.head.innerHTML

    document.head.insertAdjacentHTML(
      'beforeend',
      '<meta property="og:title" content="old"><meta name="twitter:title" content="old">' +
        '<meta name="DC.Title" content="old"><meta property="og:url" content="old">' +
        '<meta name="twitter:url" content="old"><meta name="description" content="old">' +
        '<meta property="og:description" content="old">' +
        '<meta name="twitter:description" content="old">' +
        '<meta name="DC.Description" content="old">' +
        '<meta property="og:image:alt" content="old">'
    )

    syncDocumentHead({
      name: 'x',
      view: 'v',
      lang: 'en',
      path: '/portfolio/brazilian-leather',
      meta: {
        title: 'T',
        description: 'D',
        canonical: '/portfolio/cicb',
      },
      params: {},
    })

    const q = (sel) => document.head.querySelector(sel)?.content

    expect(q(QUERY_STRINGS.META_OG_TITLE)).toBe('T')
    expect(q(QUERY_STRINGS.META_TW_TITLE)).toBe('T')
    expect(q(QUERY_STRINGS.META_DC_TITLE)).toBe('T')
    expect(q(QUERY_STRINGS.META_DESCRIPTION)).toBe('D')
    expect(q(QUERY_STRINGS.META_OG_DESCRIPTION)).toBe('D')
    expect(q(QUERY_STRINGS.META_TW_DESCRIPTION)).toBe('D')
    expect(q(QUERY_STRINGS.META_DC_DESCRIPTION)).toBe('D')
    expect(q(QUERY_STRINGS.META_OG_IMAGE_ALT)).toBe('D')
    expect(q(QUERY_STRINGS.META_OG_URL)).toBe('https://luiskr.com/portfolio/cicb')
    expect(q(QUERY_STRINGS.META_TW_URL)).toBe('https://luiskr.com/portfolio/cicb')
    expect(document.head.querySelector(QUERY_STRINGS.LINK_CANONICAL).href).toBe(
      'https://luiskr.com/portfolio/cicb'
    )

    document.head.innerHTML = prevHead
  })

  test('setMetaContent/setMetaDescription — absent metas no-op, present metas update', () => {
    setMetaContent('meta[name="totally-absent"]', 'x')
    setMetaDescription(CHAR_STRINGS.EMPTY)
    setMetaDescription('snippet')

    document.head.insertAdjacentHTML('beforeend', '<meta name="description" content="old">')

    setMetaContent(QUERY_STRINGS.META_DESCRIPTION, 'fresh')
    setMetaDescription('snippet')

    expect(document.head.querySelector(QUERY_STRINGS.META_DESCRIPTION).content).toBe('snippet')

    document.head.querySelector(QUERY_STRINGS.META_DESCRIPTION).remove()
  })

  test('buildRouteJsonLd — no override recomputes canonical; description + prefix-strip arms', () => {
    const graph = buildRouteJsonLd(
      {
        name: 'x',
        view: 'v',
        lang: 'en',
        path: '/about',
        meta: { title: 'Luis Krötz | About', description: 'fallback' },
        params: {},
      },
      undefined,
      'resolved bio'
    )

    const webPage = graph.find((e) => e['@type'] === 'WebPage')

    expect(webPage.url).toBe('https://luiskr.com/about')
    expect(webPage.name).toBe('About')
    expect(webPage.description).toBe('resolved bio')

    const crumbs = graph.find((e) => e['@type'] === 'BreadcrumbList')

    expect(crumbs.itemListElement[1].name).toBe('About')
  })

  test('buildRouteJsonLd — home route emits no breadcrumb', () => {
    const graph = buildRouteJsonLd({
      name: 'x',
      view: 'v',
      lang: 'en',
      path: '/',
      meta: { title: 'Luis Krötz' },
      params: {},
    })

    expect(graph.find((e) => e['@type'] === 'BreadcrumbList')).toBeUndefined()
    expect(graph.find((e) => e['@type'] === 'WebPage').url).toBe('https://luiskr.com')
  })

  test('syncDocumentHead — writes the route JSON-LD graph into head', () => {
    syncDocumentHead({
      name: 'x',
      view: 'v',
      lang: 'br',
      path: '/br/portfolio/melissa',
      meta: { title: 'Luis Krötz | Melissa', canonical: '/br/portfolio/melissa' },
      params: {},
    })

    const script = document.getElementById('jsonld-graph')
    const graph = JSON.parse(script.textContent)['@graph']
    const webPage = graph.find((e) => e['@type'] === 'WebPage')

    expect(webPage.url).toBe('https://luiskr.com/br/portfolio/melissa')
    expect(webPage.inLanguage).toBe('pt-BR')
    expect(graph.find((e) => e['@type'] === 'BreadcrumbList')).toBeTruthy()
  })

  test('parsePath — contact route carries the composed channel description', () => {
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, {
      contact: {
        title: 'Contact',
        line1: [{ description: 'Mail' }, { description: 'Phone' }, { link: 'no-desc' }],
      },
    })

    const r = parsePath(`/${ROUTE_STRINGS.CONTACT}`)

    expect(r.meta.description).toBe('Contact | Mail, Phone')
  })

  test('parsePath — empty contact title → undefined description arm', () => {
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, { contact: { title: '', line1: [] } })

    const r = parsePath(`/${ROUTE_STRINGS.CONTACT}`)

    expect(r.meta.description).toBeUndefined()
  })

  test('parsePath — contact node without line1 → line1||[] arm', () => {
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, { contact: { title: 'Contact' } })

    const r = parsePath(`/${ROUTE_STRINGS.CONTACT}`)

    expect(r.name).toBe(ROUTE_NAMES.CONTACT)

    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, null)
  })

  test('parsePath — license and docs routes resolve their descriptors', () => {
    const lic = parsePath(ROUTE_PATHS.LICENSE)

    expect(lic.view).toBe(VIEW_TAGS.VIEW_LEGAL)
    expect(lic.meta.legalRoute).toBe(true)

    const docs = parsePath(`${ROUTE_PATHS.DOCS}/reports`)

    expect(docs.view).toBe(VIEW_TAGS.VIEW_DOCS)
    expect(docs.meta.docsRoute).toBe(true)
    expect(docs.params.docsPath).toBe('reports')
  })

  test('parsePath — project canonical normalizes aliases + locale + media', () => {
    const alias = parsePath('/portfolio/brazilian-leather')

    expect(alias.meta.canonical).toBe('/portfolio/cicb')

    const loc = parsePath('/de/portfolio/minimelissa')

    expect(loc.meta.canonical).toBe('/de/portfolio/mini-melissa')

    const media = parsePath('/portfolio/cicb/some-media')

    expect(media.meta.canonical).toBe('/portfolio/cicb/some-media')
    expect(media.params.slug).toBe('some-media')
  })

  test('parsePath — legal aliases canonicalize onto the locale slug', () => {
    const en = LANG_SLUGS.en
    const br = LANG_SLUGS.br
    const de = LANG_SLUGS.de

    expect(parsePath(`/${ROUTE_STRINGS.TERMS}`).meta.canonical).toBe(`/${en.terms}`)
    expect(parsePath(`/${ROUTE_STRINGS.PRIVACY}`).meta.canonical).toBe(`/${en.privacy}`)
    expect(parsePath(`/br/${en.privacy}`).meta.canonical).toBe(`/br/${br.privacy}`)
    expect(parsePath(`/br/${en.terms}`).meta.canonical).toBe(`/br/${br.terms}`)
    expect(parsePath(`/de/${en.gdpr}`).meta.canonical).toBe(`/de/${de.gdpr}`)
    expect(parsePath(`/br/${br.terms}`).meta.canonical).toBe(`/br/${br.terms}`)
  })

  test('parsePath — playground + star-field aliases canonicalize localized', () => {
    const en = LANG_SLUGS.en
    const br = LANG_SLUGS.br

    expect(parsePath(`/${ROUTE_PATHS.SPACE_PLAYGROUND_SEGMENT}`).meta.canonical).toBe(
      `/${en.earthPlayground}`
    )
    expect(parsePath(`/br/${ROUTE_PATHS.SPACE_PLAYGROUND_SEGMENT}`).meta.canonical).toBe(
      `/br/${br.earthPlayground}`
    )
    expect(parsePath(`/br/${en.earthPlayground}`).meta.canonical).toBe(`/br/${br.earthPlayground}`)
    expect(parsePath(`/br/${en.starField}`).meta.canonical).toBe(`/br/${br.starField}`)
    expect(parsePath(`/br/${br.starField}/mars`).meta.canonical).toBe(`/br/${br.starField}/mars`)
    expect(parsePath(`/${en.starField}/mars`).meta.canonical).toBe(`/${en.starField}/mars`)
  })

  test('parsePath — docs strips the locale prefix from its canonical', () => {
    expect(parsePath('/docs/core/router').meta.canonical).toBe('/docs/core/router')
    expect(parsePath('/br/docs/core/router').meta.canonical).toBe('/docs/core/router')
  })

  test('parsePath — trailing slashes collapse into the canonical path', () => {
    const en = LANG_SLUGS.en

    expect(parsePath(`/${en.about}/`).path).toBe(`/${en.about}`)
    expect(parsePath('/br/').path).toBe('/br')
    expect(parsePath('/portfolio/metcha/').meta.canonical).toBe('/portfolio/metcha')
  })

  test('parsePath — unmatched paths resolve the not-found view', () => {
    const r = parsePath('/this-route-does-not-exist')

    expect(r.name).toBe(ROUTE_NAMES.NOT_FOUND)
    expect(r.view).toBe(VIEW_TAGS.VIEW_NOT_FOUND)

    const loc = parsePath('/de/gibt-es-nicht')

    expect(loc.name).toBe(ROUTE_NAMES.NOT_FOUND)
    expect(loc.lang).toBe(LOCALES.DE)
  })

  test('parsePath — empty path falls back to the root descriptor', () => {
    const r = parsePath(CHAR_STRINGS.EMPTY)

    expect(r.name).toBe(ROUTE_NAMES.HOME)
    expect(r.view).toBe(VIEW_TAGS.VIEW_HOME)
  })

  test('normalizeProjectKey — empty slug returns EMPTY without aliasing', () => {
    expect(normalizeProjectKey(CHAR_STRINGS.EMPTY)).toBe(CHAR_STRINGS.EMPTY)
  })
})
