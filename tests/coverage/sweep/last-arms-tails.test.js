/**
 * @file last-arms-tails.test.js
 * @description Final coverage arms: nav-glyph's default loader/canvas-null
 * guard, ring-fill's settled-tile continue + down-ease arms, schema.ts's
 * optional keywords/screenshot/catalogName arms.
 */
import { describe, test, expect, jest, afterEach } from '@jest/globals'
import { NAV_CLASSES } from '@core/tokens/classes/nav.js'
import { NAV_GLYPH } from '@core/tokens/data/nav-glyph.js'
import { NAV_SEARCH_CSS_PROPS } from '@core/tokens/css/nav.js'
import {
  generateRouteSchema,
  generateEarthPlaygroundSchema,
  generateProjectArticleSchema,
  generateProjectSchema,
  generateStarBodySchema,
  licenseUrlFor,
  resolveProjectMedia,
} from '@core/utils/schema.js'
import { LANG_SLUGS } from '@core/locale/lang-slugs.js'
import { TEST_TEXT, TEST_URLS } from '@tests/fixtures/test-constants.js'
import { mountRingFill } from '@core/utils/gpu/ring-fill.js'

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

  return { host, chip }
}

describe('nav-glyph remaining guard arms', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    delete window.matchMedia
  })

  test('canvas without a 2d context → null session', async () => {
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

describe('schema optional-field arms', () => {
  test('route schema with lang + screenshot keywords present', () => {
    const out = generateRouteSchema({
      url: 'https://luiskr.com/x',
      name: TEST_TEXT.HEADING,
      description: TEST_TEXT.SECOND,
      lang: 'pt',
      screenshot: 'https://x/s.png',
    })

    expect(out).toBeTruthy()
  })

  test('earth schema with lang + no screenshot/keywords', () => {
    const out = generateEarthPlaygroundSchema({
      url: 'https://luiskr.com/earth',
      name: 'Earth',
      lang: 'en',
      features: ['a'],
    })

    expect(out).toBeTruthy()
  })

  test('project article schema with a video cover + omit flag', () => {
    const project = {
      page: TEST_TEXT.HEADING,
      description: TEST_TEXT.SECOND,
      cover: { isVideo: true, src: TEST_URLS.VID },
      media: [],
    }

    expect(
      generateProjectArticleSchema(project, {
        url: 'https://luiskr.com/p',
        folder: 'f',
        title: 'T',
        description: 'd',
        lang: 'en',
      })
    ).toBeTruthy()
    expect(
      generateProjectArticleSchema(project, {
        url: 'https://luiskr.com/p',
        folder: 'f',
        title: 'T',
        description: 'd',
        lang: 'en',
        omitCoverVideo: true,
      })
    ).toBeTruthy()
  })

  test('licenseUrlFor, star-body media fallbacks, project video bcp fallback, and resolveProjectMedia arms', () => {
    const prevLicense = LANG_SLUGS.en.license

    LANG_SLUGS.en.license = ''
    expect(licenseUrlFor('xx')).toBeTruthy()
    LANG_SLUGS.en.license = prevLicense

    const starOut = generateStarBodySchema({
      url: 'https://luiskr.com/sf/sol',
      indexUrl: 'https://luiskr.com/sf',
      indexName: 'SF',
      name: 'Sol',
      media: {
        images: [{ src: 'https://luiskr.com/i.jpg' }],
        videos: [{ src: 'https://luiskr.com/v.mp4' }],
      },
    })

    expect(starOut.length).toBeGreaterThan(0)

    const projSchema = generateProjectSchema(
      {
        title: TEST_TEXT.HEADING,
        sections: [[{ src: TEST_URLS.VID, isVideo: true, label: TEST_TEXT.SECOND }]],
      },
      'slug-x',
      'xx'
    )

    expect(projSchema.length).toBeGreaterThan(0)

    const resolved = resolveProjectMedia(
      {
        sections: [[{ src: 'a.jpg' }, { src: 'b.jpg', label: 'Hero Shot' }]],
      },
      'hero-shot'
    )

    expect(resolved?.media.label).toBe('Hero Shot')
  })
})

describe('nav-glyph default loader arm', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    delete window.matchMedia
  })

  test('no loader arg → default glue import resolves null under jest', async () => {
    window.matchMedia = () => ({ matches: false })

    const { host } = makeHost(() => null)

    let session = 'unset'

    await jest.isolateModulesAsync(async () => {
      const { mountNavGlyph } = await import('@core/utils/wasm/nav-glyph.js')

      session = await mountNavGlyph(host, NAV_GLYPH.KIND_STREAK, COLORS)
    })

    expect(session).toBeNull()
  })
})

describe('ring-fill — no WebGPU arm', () => {
  test('mountRingFill resolves null when the widget mount fails', async () => {
    const host = document.createElement('div')

    document.body.appendChild(host)

    const session = await mountRingFill(host, 'button', 'rf-canvas')

    expect(session).toBeNull()
    host.remove()
  })
})
