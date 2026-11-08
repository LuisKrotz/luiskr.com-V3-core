/**
 * @file nav-css-tokens.test.js
 * @description Coverage tail for core/tokens/css/nav.ts — asserts the nav
 * strip glyph paint custom-property names stay prefixed and the map stays
 * frozen (the glyph gradients and the nav-controls SCSS reference these
 * by name).
 */

import { NAV_SEARCH_CSS_PROPS } from '@core/tokens/css/nav.js'

describe('NAV_SEARCH_CSS_PROPS', () => {
  test('every member is a --nav-* custom property', () => {
    for (const name of Object.values(NAV_SEARCH_CSS_PROPS)) {
      expect(name).toMatch(/^--nav-(search|neon)-[a-z-]+$/)
    }
  })

  test('the map is frozen', () => {
    expect(Object.isFrozen(NAV_SEARCH_CSS_PROPS)).toBe(true)
  })
})
