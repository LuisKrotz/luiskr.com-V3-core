/**
 * @file field-css-tokens.test.js
 * @description Coverage tail for core/tokens/css/field.ts — asserts the
 * backdrop-field palette property names stay prefixed, the shader slot
 * list mirrors the map order, and both maps stay frozen (the page
 * backdrop's theme sampler and the GLSL lobe table index these).
 */

import { FIELD_CSS_PROPS, FIELD_CSS_PROP_LIST } from '@core/tokens/css/field.js'

describe('FIELD_CSS_PROPS', () => {
  test('every material pole is a --field-* custom property', () => {
    for (const [key, name] of Object.entries(FIELD_CSS_PROPS)) {
      if (key === 'SPECULAR') {
        expect(name).toBe('--color-white-raw')
      } else {
        expect(name).toMatch(/^--field-[a-z]+$/)
      }
    }
  })

  test('the map is frozen', () => {
    expect(Object.isFrozen(FIELD_CSS_PROPS)).toBe(true)
  })
})

describe('FIELD_CSS_PROP_LIST', () => {
  test('the list carries only declared field poles in shader order', () => {
    expect(FIELD_CSS_PROP_LIST).toEqual([
      FIELD_CSS_PROPS.CREAM,
      FIELD_CSS_PROPS.SAND,
      FIELD_CSS_PROPS.BONE,
      FIELD_CSS_PROPS.PARCHMENT,
      FIELD_CSS_PROPS.OCHRE,
      FIELD_CSS_PROPS.CANVAS,
      FIELD_CSS_PROPS.UMBER,
    ])
  })

  test('the shader slot count matches the declared poles', () => {
    expect(FIELD_CSS_PROP_LIST).toHaveLength(7)
  })

  test('the list is frozen', () => {
    expect(Object.isFrozen(FIELD_CSS_PROP_LIST)).toBe(true)
  })
})
