/**
 * @file orphan-seps-tails.test.js
 * @description Coverage for core/utils/dom/orphan-seps.ts — the footer
 * orphan-separator watcher: missing-ResizeObserver no-op teardown, the
 * synchronous leader-marking pass over wrap-leading pairs, RO refires,
 * and the disconnect teardown.
 */
import { describe, test, expect, afterEach, jest } from '@jest/globals'
import { watchOrphanSeps } from '@core/utils/dom/orphan-seps.js'

/** Captured RO instance + callback for refire tests. */
let capturedRoCb = null
let lastRo = null

/** Minimal ResizeObserver stub recording observe/disconnect. */
const MockRO = class {
  constructor(cb) {
    capturedRoCb = cb
    lastRo = this
    this.observe = jest.fn()
    this.disconnect = jest.fn()
  }
}

/** Builds a nav with `count` pair spans whose tops come from `tops`. */
const makeNav = (tops) => {
  const nav = document.createElement('nav')

  tops.forEach((top) => {
    const pair = document.createElement('span')

    pair.classList.add('pair')
    pair.getBoundingClientRect = () => ({ top })
    nav.appendChild(pair)
  })

  document.body.appendChild(nav)

  return nav
}

describe('orphan-seps watcher', () => {
  afterEach(() => {
    document.body.innerHTML = ''

    delete globalThis.ResizeObserver
    capturedRoCb = null
    lastRo = null
  })

  test('returns a no-op teardown when ResizeObserver is undefined', () => {
    const teardown = watchOrphanSeps(document.createElement('nav'), 'pair', 'lead')

    expect(typeof teardown).toBe('function')
    expect(teardown()).toBeUndefined()
  })

  test('marks only pairs that lead a wrapped line', () => {
    globalThis.ResizeObserver = MockRO

    const nav = makeNav([10, 10, 40, 40, 90])
    const teardown = watchOrphanSeps(nav, 'pair', 'lead')
    const pairs = nav.querySelectorAll('.pair')

    expect(pairs[0].classList.contains('lead')).toBe(false)
    expect(pairs[1].classList.contains('lead')).toBe(false)
    expect(pairs[2].classList.contains('lead')).toBe(true)
    expect(pairs[3].classList.contains('lead')).toBe(false)
    expect(pairs[4].classList.contains('lead')).toBe(true)
    expect(lastRo.observe).toHaveBeenCalledWith(nav)

    // Refire after a relayout — pair 2 rejoins line one, pair 5 wraps up.
    const reTops = [10, 40, 40, 40, 90]

    nav.querySelectorAll('.pair').forEach((p, i) => {
      p.getBoundingClientRect = () => ({ top: reTops[i] })
    })

    capturedRoCb()

    expect(pairs[1].classList.contains('lead')).toBe(true)
    expect(pairs[2].classList.contains('lead')).toBe(false)

    teardown()

    expect(lastRo.disconnect).toHaveBeenCalled()
  })

  test('an empty nav marks nothing and still wires the observer', () => {
    globalThis.ResizeObserver = MockRO

    const nav = document.createElement('nav')

    document.body.appendChild(nav)

    const teardown = watchOrphanSeps(nav, 'pair', 'lead')

    expect(nav.querySelectorAll('.lead').length).toBe(0)
    expect(lastRo.observe).toHaveBeenCalledWith(nav)

    teardown()
  })
})
