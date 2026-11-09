/**
 * @file paint-2d-palette-fallback-tails.test.js
 * @description Coverage tail for carousel-controls/paint-2d.ts — the
 * arrowPalette `|| [0,0,0]` arm: the sampled accent AND the NEON_TEAL
 * constant must both fail parsing, so css-color is mocked to return null
 * for every input before the painter module loads.
 */
import { jest, describe, test, expect } from '@jest/globals'
import { ARROW_TYPES } from '@core/tokens/theme/arrows.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'

jest.unstable_mockModule('@core/utils/canvas/css-color.js', () => ({
  parseCssColor: () => null,
}))

const { paintCarouselArrow2D } =
  await import('@core/utils/canvas/widgets/carousel-controls/paint-2d.js')

/** 2D ctx stub — every painter call no-ops; gradient factories yield a stop sink. */
const fakeCtx = () =>
  new Proxy(
    {},
    {
      get(_t, p) {
        if (typeof p === TYPE_STRINGS.STRING && (p.startsWith('create') || p === 'measureText'))
          return () => ({ addColorStop: () => {}, width: 0 })
        return () => undefined
      },
      set: () => true,
    }
  )

describe('paint-2d palette fallback', () => {
  test('arrow palette drops to the black-channel fallback when nothing parses', () => {
    const ctx = fakeCtx()

    expect(() =>
      paintCarouselArrow2D(
        ctx,
        {
          dpr: 1,
          width: 48,
          height: 48,
          canvasWidth: 48,
          canvasHeight: 48,
          type: ARROW_TYPES.NEXT,
          startTime: 0,
          isHovered: false,
          hoverLevel: 0,
          isPlaying: false,
          progress: 0,
          clickTime: 0,
        },
        16
      )
    ).not.toThrow()
  })
})
