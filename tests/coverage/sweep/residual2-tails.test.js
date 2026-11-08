/**
 * @file residual2-tails.test.js
 * @description Residual branch arms: schema.ts carousel targetUrl
 * (link/slug/empty + http + bcp arms), project-article cover-video
 * guards, earth-schema optional spreads, nav-glyph guard arms.
 */
import { describe, test, expect, jest, afterEach } from '@jest/globals'
import {
  generateCarouselItemListSchema,
  generateProjectArticleSchema,
  generateRouteSchema,
  generateEarthPlaygroundSchema,
} from '@core/utils/schema.js'
import { NAV_CLASSES } from '@core/tokens/classes/nav.js'
import { NAV_GLYPH } from '@core/tokens/data/nav-glyph.js'
import { NAV_SEARCH_CSS_PROPS } from '@core/tokens/css/nav.js'

/** Two neon palette vars — enough to cover the multi-color arm. */
const COLORS = [NAV_SEARCH_CSS_PROPS.NEON_TEAL, NAV_SEARCH_CSS_PROPS.NEON_GREEN]

/** Host with a shadow root + canvas whose getContext returns `ctxResult`. */
const makeHost = (ctxResult) => {
  const host = document.createElement('div')

  host.attachShadow({ mode: 'open' })

  const canvas = document.createElement('canvas')

  canvas.className = NAV_CLASSES.NAV_GLYPH_CANVAS
  canvas.getContext = ctxResult
  host.shadowRoot.appendChild(canvas)

  const chip = document.createElement('button')

  chip.appendChild(host)
  document.body.appendChild(chip)

  return { host }
}

describe('schema residual arms', () => {
  test('carousel items — slug-only and empty link arms', () => {
    const out = generateCarouselItemListSchema(
      [
        { name: 'A', slug: 'one' },
        { name: 'B', link: '' },
        { name: 'C', link: 'http://ext.com/x' },
      ],
      'https://luiskr.com'
    )

    expect(out).toBeTruthy()
  })

  test('project article — cover missing and video-without-src arms', () => {
    const base = { url: 'https://luiskr.com/p', folder: 'f', title: 'T', description: 'd' }
    const noCover = { page: 'P' }
    const videoNoSrc = { page: 'P', cover: { isVideo: true } }

    expect(generateProjectArticleSchema(noCover, base)).toBeTruthy()
    expect(generateProjectArticleSchema(videoNoSrc, base)).toBeTruthy()
  })

  test('route schema — minimal options + unknown locale', () => {
    expect(generateRouteSchema({ url: 'https://luiskr.com/x', name: 'X' })).toBeTruthy()
  })

  test('earth schema — keywords+screenshot present and absent', () => {
    const base = { url: 'https://luiskr.com/e', name: 'E', features: ['a'] }

    expect(
      generateEarthPlaygroundSchema({ ...base, lang: 'en', keywords: 'k', screenshot: 's' })
    ).toBeTruthy()
    expect(generateEarthPlaygroundSchema({ ...base, lang: 'xx' })).toBeTruthy()
  })
})

describe('nav-glyph remaining guard arms', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    delete window.matchMedia
  })

  test('canvas with a null getContext result → null session', async () => {
    window.matchMedia = () => ({ matches: false })

    const { host } = makeHost(() => null)

    let session = 'unset'

    await jest.isolateModulesAsync(async () => {
      const { mountNavGlyph } = await import('@core/utils/wasm/nav-glyph.js')

      session = await mountNavGlyph(host, NAV_GLYPH.KIND_STREAK, COLORS, async () => ({
        default: async () => ({ memory: { buffer: new ArrayBuffer(8) } }),
        GlyphFx: () => ({}),
      }))
    })

    expect(session).toBeNull()
  })
})
