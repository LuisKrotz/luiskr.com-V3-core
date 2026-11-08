/**
 * @file coverage/utils/wasm/wasm-search-tails.test.js
 * @description Coverage tail for utils/wasm/wasm-search.ts — the
 * route-search scorer. Covers the JS scorer's weight ladder
 * (exact/prefix/contains/keyword/path/preview), the AND-semantics
 * early-out, the sort tie-break, the empty-query list-everything arm,
 * and the pool dispatch paths (reply, malformed rows, null → fallback).
 */
import { describe, test, expect, jest } from '@jest/globals'

/** Mutable pool-mock state — dispatch() reads these per-call so tests
 *  steer the reply and record every dispatched payload. */
let dispatchReply = null
let dispatchCalls = []

jest.unstable_mockModule('@core/utils/wasm/wasm-pool.js', () => ({
  wasmPool: {
    dispatch: async (type, payload) => {
      dispatchCalls.push([type, payload])

      return dispatchReply
    },
  },
}))

/** Search-row fixtures — title/path/preview fields cover the rank arms. */
const items = [
  {
    title: 'Privacy Policy',
    path: '/privacy-policy',
    preview: 'legal page',
    keywords: ['gdpr', 'data'],
  },
  { title: 'GDPR', path: '/gdpr', preview: 'privacy summary', keywords: ['privacy'] },
  { title: 'Portfolio', path: '/portfolio', preview: 'selected work', keywords: ['work'] },
  { title: 'Home', path: '/', preview: '', keywords: [] },
]

describe('wasm-search', () => {
  let searchRoutes
  let scoreRoutesJs
  let normalizeSearchText

  beforeEach(async () => {
    dispatchReply = null
    dispatchCalls = []

    const mod = await import('@core/utils/wasm/wasm-search.js')

    searchRoutes = mod.searchRoutes
    scoreRoutesJs = mod.scoreRoutesJs
    normalizeSearchText = mod.normalizeSearchText
  })

  test('normalizeSearchText folds case, diacritics and whitespace', () => {
    expect(normalizeSearchText('  Krötz  ')).toBe('krotz')
    expect(normalizeSearchText('A   B')).toBe('a b')
    expect(normalizeSearchText('')).toBe('')
    expect(normalizeSearchText(null)).toBe('')
  })

  test('empty query returns the whole catalog in order', () => {
    const hits = scoreRoutesJs(items, '')

    expect(hits.map((h) => h.index)).toEqual([0, 1, 2, 3])

    const ws = scoreRoutesJs(items, '   ')

    expect(ws).toHaveLength(items.length)
  })

  test('title exact > prefix > contains > keywords > path > preview', () => {
    const ranked = [
      { title: 'work', path: '/x', preview: '', keywords: [] }, // exact 100
      { title: 'workbench', path: '/y', preview: '', keywords: [] }, // prefix 60
      { title: 'rework', path: '/z', preview: '', keywords: [] }, // contains 40
      { title: 'Other', path: '/w', preview: '', keywords: ['work'] }, // kw 25
      { title: 'Other2', path: '/work-page', preview: '', keywords: [] }, // path 15
      { title: 'Other3', path: '/v', preview: 'the work inside', keywords: [] }, // preview 10
      { title: 'Nope', path: '/u', preview: '', keywords: [] }, // no hit
    ]
    const hits = scoreRoutesJs(ranked, 'work')

    expect(hits.map((h) => h.index)).toEqual([0, 1, 2, 3, 4, 5])
  })

  test('AND semantics — every term must hit the same item; else excluded', () => {
    const hits = scoreRoutesJs(items, 'privacy gdpr')

    expect(hits.map((h) => h.index)).toEqual([1, 0])
    expect(scoreRoutesJs(items, 'zzz nothing')).toHaveLength(0)
  })

  test('ties break on catalog order', () => {
    const tied = [
      { title: 'alpha match', path: '/a', preview: '', keywords: [] },
      { title: 'beta match', path: '/b', preview: '', keywords: [] },
    ]
    const hits = scoreRoutesJs(tied, 'match')

    expect(hits.map((h) => h.index)).toEqual([0, 1])
  })

  test('a row without keywords still scores on its other fields', () => {
    const bare = [{ title: 'Contact', path: '/contact', preview: 'say hi' }]
    const hits = scoreRoutesJs(bare, 'contact')

    expect(hits).toHaveLength(1)
    expect(hits[0].score).toBeGreaterThan(0)
  })

  test('searchRoutes maps a valid worker reply back to hits', async () => {
    dispatchReply = {
      results: [
        { i: 2, s: 100 },
        { i: 0, s: 50 },
      ],
    }

    const hits = await searchRoutes(items, 'q')

    expect(hits).toEqual([
      { index: 2, score: 100 },
      { index: 0, score: 50 },
    ])
    expect(dispatchCalls).toHaveLength(1)
    expect(dispatchCalls[0][1].items).toHaveLength(items.length)
  })

  test('searchRoutes filters malformed reply rows', async () => {
    dispatchReply = {
      results: [
        null,
        { i: 'x', s: 1 },
        { i: -1, s: 1 },
        { i: 99, s: 1 },
        { i: 1 },
        { i: 1, s: 'x' },
        { i: 1, s: 42 },
      ],
    }

    const hits = await searchRoutes(items, 'q')

    expect(hits).toEqual([{ index: 1, score: 42 }])
  })

  test('searchRoutes falls back to the JS scorer on a null reply', async () => {
    dispatchReply = null

    const hits = await searchRoutes(items, 'privacy')

    expect(hits.length).toBe(2)
    expect(hits[0].index).toBe(0)
  })

  test('searchRoutes falls back when results is missing/non-array', async () => {
    dispatchReply = { results: 'nope' }

    const hits = await searchRoutes(items, '')

    expect(hits).toHaveLength(items.length)
  })
})
