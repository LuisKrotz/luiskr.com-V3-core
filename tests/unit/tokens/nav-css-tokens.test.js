/**
 * @file nav-css-tokens.test.js
 * @description Coverage tail for core/tokens/css/nav.ts — asserts every
 * nav-gear paint custom-property name in the frozen map is present and
 * stable (the .nav-gear-svg gradients reference these by name).
 */

import { NAV_GEAR_CSS_PROPS } from '@core/tokens/css/nav.js'

describe('NAV_GEAR_CSS_PROPS', () => {
  test('exposes every gear paint stop name', () => {
    expect(NAV_GEAR_CSS_PROPS).toEqual({
      GEAR_HI: '--nav-gear-hi',
      GEAR_MID: '--nav-gear-mid',
      GEAR_LO: '--nav-gear-lo',
      GEAR_EDGE_HI: '--nav-gear-edge-hi',
      GEAR_EDGE_LO: '--nav-gear-edge-lo',
      GEAR_HOLE: '--nav-gear-hole',
      GEAR_HOLE_LO: '--nav-gear-hole-lo',
      GEAR_HOLE_HI: '--nav-gear-hole-hi',
      GEAR_GLINT: '--nav-gear-glint',
    })
  })

  test('the map is frozen', () => {
    expect(Object.isFrozen(NAV_GEAR_CSS_PROPS)).toBe(true)
  })
})
