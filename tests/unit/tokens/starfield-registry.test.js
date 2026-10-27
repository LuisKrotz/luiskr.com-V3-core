/**
 * @file starfield-registry.test.js
 * @description Coverage tail for core/tokens/starfield/registry.ts —
 * the deep-catalog vocabulary leaf (shard dir, manifest name, per-kind
 * metadata, shard-record field dictionaries).
 */

import {
  SF_REGISTRY_INDEX_DIR,
  SF_REGISTRY_MANIFEST,
  SF_REGISTRY_KINDS,
  SF_REGISTRY_FIELDS,
} from '@core/tokens/starfield/registry.js'

describe('starfield registry tokens', () => {
  test('exposes the index dir and manifest names', () => {
    expect(SF_REGISTRY_INDEX_DIR).toBe('index')
    expect(SF_REGISTRY_MANIFEST).toBe('manifest.json')
  })

  test('every kind carries kind/labelKey/aboutKey/credit metadata', () => {
    expect(Object.isFrozen(SF_REGISTRY_KINDS)).toBe(true)
    expect(SF_REGISTRY_KINDS.length).toBeGreaterThan(0)

    for (const k of SF_REGISTRY_KINDS) {
      expect(typeof k.kind).toBe('string')
      expect(typeof k.labelKey).toBe('string')
      expect(typeof k.aboutKey).toBe('string')
      expect(typeof k.credit).toBe('string')
      expect(SF_REGISTRY_FIELDS[k.kind]).toBeDefined()
    }
  })
})
