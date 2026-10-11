/**
 * @file dom-font-tails.test.js
 * @description Coverage tails for core/utils/canvas/dom-font.ts — the
 * guarded per-axis copies in applyFontExtras (property present vs absent
 * on the target context), every canvasTransformText keyword, and the
 * three whenFontsReady resolution paths (fonts.ready promise, missing
 * FontFaceSet, documentless environment).
 */
import { describe, test, expect, jest } from '@jest/globals'
import { syncCanvasFont, canvasTransformText, whenFontsReady } from '@core/utils/canvas/dom-font.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'

/** A computed-style stand-in carrying every optional font axis. */
const FULL_STYLE = {
  fontStyle: 'oblique',
  fontWeight: '700',
  fontSize: '17px',
  fontFamily: 'serif',
  color: 'ink',
  fontStretch: 'expanded',
  fontVariantCaps: 'small-caps',
  fontKerning: 'none',
  letterSpacing: '2px',
  fontFeatureSettings: '"liga"',
  fontVariationSettings: '"wght" 620',
}

describe('dom-font tails', () => {
  test('syncCanvasFont copies every optional axis the context exposes', () => {
    const ctx = {
      font: CHAR_STRINGS.EMPTY,
      fillStyle: CHAR_STRINGS.EMPTY,
      fontStretch: CHAR_STRINGS.EMPTY,
      fontVariantCaps: CHAR_STRINGS.EMPTY,
      fontKerning: CHAR_STRINGS.EMPTY,
      letterSpacing: CHAR_STRINGS.EMPTY,
      fontFeatureSettings: CHAR_STRINGS.EMPTY,
      fontVariationSettings: CHAR_STRINGS.EMPTY,
    }

    syncCanvasFont(ctx, FULL_STYLE)

    expect(ctx.fontStretch).toBe(FULL_STYLE.fontStretch)
    expect(ctx.fontVariantCaps).toBe(FULL_STYLE.fontVariantCaps)
    expect(ctx.fontKerning).toBe(FULL_STYLE.fontKerning)
    expect(ctx.letterSpacing).toBe(FULL_STYLE.letterSpacing)
    expect(ctx.fontFeatureSettings).toBe(FULL_STYLE.fontFeatureSettings)
    expect(ctx.fontVariationSettings).toBe(FULL_STYLE.fontVariationSettings)
    expect(ctx.fillStyle).toBe(FULL_STYLE.color)
  })

  test('percentage font-stretch maps to the nearest canvas keyword', () => {
    const ctx = { font: CHAR_STRINGS.EMPTY, fillStyle: CHAR_STRINGS.EMPTY, fontStretch: CHAR_STRINGS.EMPTY }

    syncCanvasFont(ctx, { ...FULL_STYLE, fontStretch: '100%' })
    expect(ctx.fontStretch).toBe('normal')

    syncCanvasFont(ctx, { ...FULL_STYLE, fontStretch: '87.5%' })
    expect(ctx.fontStretch).toBe('semi-condensed')

    syncCanvasFont(ctx, { ...FULL_STYLE, fontStretch: '140%' })
    expect(ctx.fontStretch).toBe('extra-expanded')

    syncCanvasFont(ctx, { ...FULL_STYLE, fontStretch: '10%' })
    expect(ctx.fontStretch).toBe('ultra-condensed')
  })

  test('a malformed percentage font-stretch passes through untouched', () => {
    const ctx = { font: CHAR_STRINGS.EMPTY, fillStyle: CHAR_STRINGS.EMPTY, fontStretch: CHAR_STRINGS.EMPTY }

    syncCanvasFont(ctx, { ...FULL_STYLE, fontStretch: 'abc%' })

    expect(ctx.fontStretch).toBe('abc%')
  })

  test('guarded axes stay unset on contexts that lack the property', () => {
    const ctx = { font: CHAR_STRINGS.EMPTY, fillStyle: CHAR_STRINGS.EMPTY }

    syncCanvasFont(ctx, FULL_STYLE)

    expect('fontStretch' in ctx).toBe(false)
    expect('fontVariantCaps' in ctx).toBe(false)
    expect('fontKerning' in ctx).toBe(false)
    expect('letterSpacing' in ctx).toBe(false)
    expect('fontFeatureSettings' in ctx).toBe(false)
    expect('fontVariationSettings' in ctx).toBe(false)
  })

  test('canvasTransformText applies upper/lower/capitalize and passes other keywords through', () => {
    expect(canvasTransformText('aB c', 'uppercase')).toBe('AB C')
    expect(canvasTransformText('Ab C', 'lowercase')).toBe('ab c')
    expect(canvasTransformText('ab cd', 'capitalize')).toBe('Ab Cd')
    expect(canvasTransformText('xy zw', 'none')).toBe('xy zw')
  })

  test('whenFontsReady resolves through fonts.ready when a FontFaceSet exists', async () => {
    const desc = Object.getOwnPropertyDescriptor(document, 'fonts')

    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: Promise.resolve() },
    })

    try {
      const cb = jest.fn()

      whenFontsReady(cb)

      expect(cb).not.toHaveBeenCalled()

      await Promise.resolve()
      await Promise.resolve()

      expect(cb).toHaveBeenCalledTimes(1)
    } finally {
      if (desc) Object.defineProperty(document, 'fonts', desc)
      else delete document.fonts
    }
  })

  test('whenFontsReady fires synchronously without a usable FontFaceSet', () => {
    const desc = Object.getOwnPropertyDescriptor(document, 'fonts')

    Object.defineProperty(document, 'fonts', { configurable: true, value: undefined })

    try {
      const cb = jest.fn()

      whenFontsReady(cb)

      expect(cb).toHaveBeenCalledTimes(1)
    } finally {
      if (desc) Object.defineProperty(document, 'fonts', desc)
      else delete document.fonts
    }
  })

  test('whenFontsReady fires synchronously in a documentless environment', () => {
    const desc = Object.getOwnPropertyDescriptor(globalThis, 'document')

    Object.defineProperty(globalThis, 'document', { configurable: true, value: undefined })

    try {
      const cb = jest.fn()

      whenFontsReady(cb)

      expect(cb).toHaveBeenCalledTimes(1)
    } finally {
      Object.defineProperty(globalThis, 'document', desc)
    }
  })
})
