/**
 * @file coverage/utils/wasm/nav-glyph-tails.test.js
 * @description Coverage tail for utils/wasm/nav-glyph.ts — the nav glyph
 * bridge's guard arms: missing canvas, missing owning chip, reduced motion,
 * and the wasm-unavailable fallback that keeps the CSS loops in charge.
 */
import { describe, test, expect, afterEach } from '@jest/globals'
import { mountNavGlyph } from '@core/utils/wasm/nav-glyph.js'
import { NAV_CLASSES } from '@core/tokens/classes/nav.js'
import { NAV_GLYPH } from '@core/tokens/data/nav-glyph.js'
import { NAV_SEARCH_CSS_PROPS } from '@core/tokens/css/nav.js'

/** Two metal palette vars — enough to cover the multi-color arm. */
const COLORS = [NAV_SEARCH_CSS_PROPS.METAL_SILVER, NAV_SEARCH_CSS_PROPS.METAL_STEEL]

/**
 * Builds an icon-like host inside a chip button, with the glyph canvas in its
 * shadow root (or without one when `withCanvas` is false).
 * @param withCanvas whether the shadow root carries the glyph canvas
 * @param inChip whether the host sits inside a <button>
 * @returns the host element
 */
const makeHost = (withCanvas, inChip) => {
  const host = document.createElement('div')

  host.attachShadow({ mode: 'open' })

  if (withCanvas) {
    const canvas = document.createElement('canvas')

    canvas.className = NAV_CLASSES.NAV_GLYPH_CANVAS
    host.shadowRoot.appendChild(canvas)
  }

  if (inChip) {
    const chip = document.createElement('button')

    chip.appendChild(host)
    document.body.appendChild(chip)
  } else {
    document.body.appendChild(host)
  }

  return host
}

describe('nav-glyph bridge guards', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    delete window.matchMedia
  })

  test('no glyph canvas in the shadow root → null', async () => {
    const host = makeHost(false, true)

    expect(await mountNavGlyph(host, NAV_GLYPH.KIND_STREAK, COLORS)).toBeNull()
  })

  test('an icon outside a chip button has nothing to wake → null', async () => {
    const host = makeHost(true, false)

    expect(await mountNavGlyph(host, NAV_GLYPH.KIND_SWOOSH, COLORS)).toBeNull()
  })

  test('reduced motion keeps the glyph on its CSS loops → null', async () => {
    window.matchMedia = () => ({ matches: true })

    const host = makeHost(true, true)

    expect(await mountNavGlyph(host, NAV_GLYPH.KIND_STREAK, COLORS)).toBeNull()
  })

  test('an unavailable wasm artifact falls back to CSS → null', async () => {
    window.matchMedia = () => ({ matches: false })

    const host = makeHost(true, true)

    expect(await mountNavGlyph(host, NAV_GLYPH.KIND_SWOOSH, COLORS)).toBeNull()
  })
})
