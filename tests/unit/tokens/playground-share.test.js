/**
 * @file playground-share.test.js
 * @description Coverage tail for core/tokens/playground/share.ts — the
 * playground share-capture contracts (bucket prefix, manifest URL,
 * accepted image extensions) for both share sets.
 */

import { EARTH_SHARE, STAR_SHARE } from '@core/tokens/playground/share.js'

describe('EARTH_SHARE', () => {
  test('exposes the share prefix, manifest URL and image extensions', () => {
    expect(Object.isFrozen(EARTH_SHARE)).toBe(true)
    expect(EARTH_SHARE.PREFIX).toBe('experiments/earth-playground/share/')
    expect(EARTH_SHARE.MANIFEST_URL).toBe('/meta/earth-playground-share.json')
    expect(EARTH_SHARE.IMAGE_EXTS).toContain('.webp')
  })
})

describe('STAR_SHARE', () => {
  test('exposes the share prefix, manifest URL and image extensions', () => {
    expect(Object.isFrozen(STAR_SHARE)).toBe(true)
    expect(STAR_SHARE.PREFIX).toBe('experiments/star-field/share/')
    expect(STAR_SHARE.MANIFEST_URL).toBe('/meta/star-field-share.json')
    expect(STAR_SHARE.IMAGE_EXTS).toBe(EARTH_SHARE.IMAGE_EXTS)
  })
})
