/**
 * @file shared-observer-tails.test.js
 * @description Core-side coverage for the pooled IntersectionObserver
 * (`utils/dom/shared-observer.ts`): pool reuse by options signature,
 * per-target routing through the real IO callback, the sole-handler
 * fallback for targetless entries, the multi-handler no-route arm,
 * ioClass-swap rebuild (test isolation), and handle disconnect/callback.
 */
import { describe, test, expect, beforeEach } from '@jest/globals'
import { observeShared } from '@core/utils/dom/shared-observer.js'

/** Stub IO — captures the pooled constructor callback + unobserve calls. */
const makeIOClass = () => {
  const seen = { cbs: [], unobserved: [] }

  globalThis.IntersectionObserver = class {
    constructor(cb) {
      seen.cbs.push(cb)
    }
    observe() {}
    unobserve(el) {
      seen.unobserved.push(el)
    }
    disconnect() {}
  }

  return seen
}

describe('shared-observer pool', () => {
  beforeEach(() => {
    makeIOClass()
  })

  test('reuses one IO instance per options signature and routes entries by target', () => {
    const seen = makeIOClass()
    const el1 = document.createElement('div')
    const el2 = document.createElement('div')
    const hits = []

    observeShared(el1, (e) => hits.push(['h1', e]), { rootMargin: '10px' })
    observeShared(el2, (e) => hits.push(['h2', e]), { rootMargin: '10px' })

    // Same signature → single pooled constructor call for both elements.
    expect(seen.cbs.length).toBe(1)

    const ioCb = seen.cbs[0]

    ioCb([{ isIntersecting: true, target: el1 }])
    ioCb([{ isIntersecting: true, target: el2 }])

    expect(hits.length).toBe(2)
    expect(hits[0][0]).toBe('h1')
    expect(hits[1][0]).toBe('h2')
  })

  test('sole-handler fallback delivers targetless entries; multi-handler drops them', () => {
    const seen = makeIOClass()
    const el = document.createElement('div')
    const hits = []

    observeShared(el, (e) => hits.push(e), { rootMargin: '20px' })

    const ioCb = seen.cbs[seen.cbs.length - 1]

    // One registered handler + a targetless entry → unambiguous delivery.
    ioCb([{ isIntersecting: true }])

    expect(hits.length).toBe(1)

    const el2 = document.createElement('div')

    observeShared(el2, () => {}, { rootMargin: '20px' })

    // Two handlers + targetless entry → no routing ambiguity allowed.
    ioCb([{ isIntersecting: true }])

    expect(hits.length).toBe(1)
  })

  test('ioClass swap rebuilds the pool so the next observe hits the new ctor', () => {
    const el = document.createElement('div')

    observeShared(el, () => {}, { rootMargin: '30px' })

    const seen = makeIOClass()

    observeShared(el, () => {}, { rootMargin: '30px' })

    expect(seen.cbs.length).toBe(1)
  })

  test('disconnect() unobserves + drops the handler; handle.callback delivers to its own handler', () => {
    const seen = makeIOClass()
    const el = document.createElement('div')
    const hits = []

    const handle = observeShared(el, (e) => hits.push(e), { rootMargin: '40px' })

    handle.callback([{ isIntersecting: true, target: el }])

    expect(hits.length).toBe(1)

    handle.disconnect()

    expect(seen.unobserved).toContain(el)

    // Handler dropped: a later pool delivery cannot reach it.
    const ioCb = seen.cbs[seen.cbs.length - 1]

    ioCb([{ isIntersecting: true, target: el }])

    expect(hits.length).toBe(1)
  })
})
