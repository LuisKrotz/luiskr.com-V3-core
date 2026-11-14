/**
 * @file component-tiered-styles-tails.test.js
 * @description Coverage tails for the `?tiers` adoption path in
 * core/Component.ts — base sheet adopted synchronously, the viewport's
 * cumulative media tier loading lazily into adoptedStyleSheets (or the
 * legacy <style> node), grow-watcher upgrades replacing the narrower
 * sheet in place, and dedup/teardown guards around the lazy loads.
 */
import { jest } from '@jest/globals'

import { BaseComponent } from '@core/Component.js'
import { getDevLog, clearDevLog } from '@core/devlog.js'
import { LOG_LEVELS } from '@core/tokens/data/log.js'
import { WIDTH_CLASS_GATES } from '@core/tokens/layout/css-classes.js'
import { TEST_TEXT } from '@tests/fixtures/test-constants.js'

/** Fixture sheets — base/mobile/desktop tiers exercise the tier-merge arms. */
const BASE_CSS = '.tier-base { display: block; }'
const MOBILE_CSS = '@media (min-width: 319px) { .tier-m { margin: 0; } }'
const DESKTOP_CSS = MOBILE_CSS + '@media (min-width: 1279px) { .tier-d { margin: 0; } }'
const PRINT_CSS = '@media print { .tier-p { margin: 0; } }'

/** A TieredStyles module whose loaders resolve synchronously-queueable css. */
const tiered = (tiers = { mobile: () => Promise.resolve(MOBILE_CSS) }) => ({
  base: BASE_CSS,
  tiers,
})

class TieredComponent extends BaseComponent {
  render() {
    return '<div>tiered</div>'
  }
}

class TieredHost extends TieredComponent {
  constructor() {
    super(
      tiered({
        mobile: () => Promise.resolve(MOBILE_CSS),
        desktop: () => Promise.resolve(DESKTOP_CSS),
      })
    )
  }
}

/** Test-only custom-element tag names — guarded-define keeps re-runs safe. */
const TAG = 'test-tiered-component'
const HOST_TAG = 'test-tiered-host'

if (!customElements.get(TAG)) customElements.define(TAG, TieredComponent)
if (!customElements.get(HOST_TAG)) customElements.define(HOST_TAG, TieredHost)

/** Zero-ms flush — connected-callback renders drain within one macrotask. */
const flush = () => new Promise((r) => setTimeout(r, 0))

// The jest env installs happy-dom's `window` but not its CSSStyleSheet —
// the suite runs the constructable path under the real class (the legacy
// <style> test deletes it explicitly), mirroring the existing tails file.
const SAVED_CSS_SHEET = globalThis.CSSStyleSheet

beforeAll(() => {
  globalThis.CSSStyleSheet =
    window.CSSStyleSheet ||
    class CSSStyleSheet {
      replaceSync() {}
    }
})

afterAll(() => {
  globalThis.CSSStyleSheet = SAVED_CSS_SHEET
})

describe('Component ?tiers adoption tails', () => {
  test('base sheet adopts synchronously; the viewport media tier follows lazily', async () => {
    const el = document.createElement(HOST_TAG)

    document.body.appendChild(el)

    // Base alone until the tier promise lands.
    expect(el._tierSheet).toBeNull()
    expect(el.shadowRoot.adoptedStyleSheets.length).toBe(1)

    await flush()

    expect(el._tierSheet).toBeTruthy()
    expect(el._tierKey).toBe('mobile')
    expect(el.shadowRoot.adoptedStyleSheets.length).toBe(2)

    el.remove()
  })

  test('upward growth replaces the narrower tier sheet in place', async () => {
    const el = document.createElement(HOST_TAG)

    document.body.appendChild(el)
    await flush()

    const mobileSheet = el._tierSheet

    expect(el._tierKey).toBe('mobile')
    expect(mobileSheet).toBeTruthy()

    el._adoptWidthTier('desktop', el._componentStyles)
    await flush()

    // The cumulative desktop file superseded the mobile one.
    expect(el._tierKey).toBe('desktop')
    expect(el._tierSheet).toBeTruthy()
    expect(el._tierSheet).not.toBe(mobileSheet)

    el.remove()
  })

  test('re-mount re-adopts the tier after adoptedStyleSheets resets', async () => {
    const el = document.createElement(HOST_TAG)

    document.body.appendChild(el)
    await flush()

    el.remove()
    document.body.appendChild(el)
    await flush()

    expect(el._tierKey).toBe('mobile')
    expect(el._tierSheet).toBeTruthy()

    el.remove()
  })

  test('dedup guards: same class is never loaded or adopted twice', async () => {
    const el = document.createElement(HOST_TAG)

    document.body.appendChild(el)
    await flush()

    el._adoptWidthTier('mobile', el._componentStyles) // _tierKey already mobile
    el._adoptWidthTier('wide', el._componentStyles) // resolves to desktop tier
    await flush()

    expect(el._tierKey).toBe('desktop')

    // _tierPending dedup — a second call while a load is in flight no-ops.
    let calls = 0
    const slow = {
      base: BASE_CSS,
      tiers: {
        desktop: () => {
          calls++
          return Promise.resolve(DESKTOP_CSS)
        },
      },
    }

    el._tierKey = undefined
    el._adoptWidthTier('desktop', slow)
    el._adoptWidthTier('desktop', slow)
    await flush()

    expect(calls).toBe(1)

    el.remove()
  })

  test('empty tiers and unmounted elements adopt nothing', async () => {
    const none = tiered({})

    const el = document.createElement(TAG)

    el._componentStyles = none
    document.body.appendChild(el)
    await flush()

    expect(el._tierSheet).toBeNull()

    // Resolution lands while detached — the !this._isMounted arm skips adoption.
    const gone = document.createElement(HOST_TAG)

    document.body.appendChild(gone)
    gone.remove()
    await flush()

    expect(gone._tierSheet).toBeNull()

    el.remove()
  })

  test('a rejected tier load warns through devlog and clears the pending key', async () => {
    clearDevLog()

    const failing = tiered({ mobile: () => Promise.reject(new Error(TEST_TEXT.STALE)) })
    const el = document.createElement(TAG)

    el._componentStyles = failing
    document.body.appendChild(el)
    await flush()

    expect(el._tierKey).toBeUndefined()
    expect(el._tierPending).toBeUndefined()
    expect(getDevLog().some((e) => e.level === LOG_LEVELS.WARN)).toBe(true)

    el.remove()
  })

  test('legacy <style> path swaps cumulative tier text without duplication', async () => {
    const saved = globalThis.CSSStyleSheet

    delete globalThis.CSSStyleSheet

    try {
      const el = document.createElement(HOST_TAG)

      document.body.appendChild(el)

      const styleEl = el.shadowRoot.querySelector('style')

      expect(styleEl).toBeTruthy()

      await flush()

      expect(styleEl.textContent).toContain(MOBILE_CSS)

      el._adoptWidthTier('desktop', el._componentStyles)
      await flush()

      // Cumulative replace — the mobile block text appears exactly once.
      expect(styleEl.textContent).toContain(DESKTOP_CSS)
      expect(styleEl.textContent.split(MOBILE_CSS).length - 1).toBe(1)

      el.remove()
    } finally {
      globalThis.CSSStyleSheet = saved
    }
  })

  test('unresolved tier keys and missing loaders no-op cleanly', async () => {
    const el = document.createElement(TAG)

    el._componentStyles = {
      base: BASE_CSS,
      tiers: { mobile: undefined, tablet: () => Promise.resolve('') },
    }
    document.body.appendChild(el)
    await flush()

    // mobile key present but loader undefined → falls to nothing below
    // mobile; the tablet loader resolves empty css → _adoptTierText no-ops.
    expect(el._tierKey).toBeUndefined()

    el._adoptWidthTier('tablet', el._componentStyles)
    await flush()

    expect(el._tierKey).toBe('tablet')
    expect(el._tierSheet).toBeNull() // '' css never adopts

    el.remove()
  })

  test('a second mount hits the shared-sheet cache for the same tier text', async () => {
    const first = document.createElement(HOST_TAG)
    const second = document.createElement(HOST_TAG)

    document.body.appendChild(first)
    await flush()

    document.body.appendChild(second)
    await flush()

    // Identical tier text resolves to the identical cached sheet object.
    expect(first._tierSheet).toBe(second._tierSheet)

    first.remove()
    second.remove()
  })

  test('stale and superseded resolutions never adopt out of order', async () => {
    const el = document.createElement(TAG)

    const slow = tiered({
      desktop: () => Promise.resolve({ default: DESKTOP_CSS }),
      wide: () =>
        Promise.resolve(DESKTOP_CSS + '@media (min-width: 2559px) { .tier-w { margin: 0; } }'),
    })

    el._componentStyles = slow
    document.body.appendChild(el)

    // Queue desktop then wide before either resolves — pending moves to
    // wide, so desktop's late resolution hits the pending-mismatch arm and
    // still adopts; wide then replaces it.
    el._adoptWidthTier('desktop', slow)
    el._adoptWidthTier('wide', slow)
    await flush()

    expect(el._tierKey).toBe('wide')
    expect(el._tierSheet).toBeTruthy()

    // A resolution arriving after _tierKey already holds the same key skips
    // re-adoption — the dedupe arm inside the loader callback.
    el._adoptWidthTier('mobile', tiered({ mobile: () => Promise.resolve(MOBILE_CSS) }))
    el._tierKey = 'mobile'
    await flush()

    expect(el._tierSheet).toBeTruthy()

    el.remove()
  })

  test('the shared grow watcher re-adopts a wider tier on an upward cross', async () => {
    const listeners = []
    const realMM = window.matchMedia
    let grew = false

    window.matchMedia = (query) => ({
      media: query,
      get matches() {
        return grew && query === WIDTH_CLASS_GATES.desktop
      },
      addEventListener: (_type, fn) => listeners.push(fn),
      removeEventListener: () => {},
    })

    try {
      const el = document.createElement(HOST_TAG)

      document.body.appendChild(el)
      await flush()

      expect(el._tierKey).toBe('mobile')

      grew = true
      listeners.forEach((fn) => fn())
      await flush()

      expect(el._tierKey).toBe('desktop')

      el.remove()
    } finally {
      window.matchMedia = realMM
    }
  })

  test('a rejected stale tier load leaves the newer pending key intact', async () => {
    clearDevLog()

    const stale = tiered({
      desktop: () => Promise.reject(new Error(TEST_TEXT.STALE)),
      wide: () => Promise.resolve('@media (min-width: 2559px) { .tier-w { margin: 0; } }'),
    })
    const el = document.createElement(TAG)

    el._componentStyles = stale
    document.body.appendChild(el)

    // desktop's loader rejects after pending already moved to wide — the
    // catch-arm that must NOT clear a key it no longer owns.
    el._adoptWidthTier('desktop', stale)
    el._adoptWidthTier('wide', stale)
    await flush()

    expect(el._tierKey).toBe('wide')
    expect(getDevLog().some((e) => e.level === LOG_LEVELS.WARN)).toBe(true)

    el.remove()
  })

  test('re-running _renderInitial while subscribed keeps the single watcher', async () => {
    const el = document.createElement(HOST_TAG)

    document.body.appendChild(el)
    await flush()

    const growOff = el._tierGrowOff

    el._renderInitial()

    expect(el._tierGrowOff).toBe(growOff)

    el.remove()

    expect(el._tierGrowOff).toBeNull()
  })

  test('the print tier loads on idle and adopts permanently beside the tier sheets', async () => {
    const el = document.createElement(TAG)

    el._componentStyles = {
      base: BASE_CSS,
      tiers: { mobile: () => Promise.resolve(MOBILE_CSS) },
      print: () => Promise.resolve({ default: PRINT_CSS }),
    }
    document.body.appendChild(el)
    await flush()

    // base + width tier + print — the object-form module resolves .default.
    expect(el._printText).toBe(PRINT_CSS)
    expect(el.shadowRoot.adoptedStyleSheets.length).toBe(3)

    el.remove()
  })

  test('a missing print key never schedules; empty print css adopts nothing', async () => {
    const bare = document.createElement(TAG)

    bare._componentStyles = { base: BASE_CSS, tiers: {} }
    document.body.appendChild(bare)
    await flush()

    expect(bare._printPending).toBe(false)
    expect(bare._printText).toBe('')
    bare.remove()

    const el = document.createElement(TAG)

    el._componentStyles = { base: BASE_CSS, tiers: {}, print: () => Promise.resolve('') }
    document.body.appendChild(el)
    await flush()

    // '' css resolves but never adopts — the sheet list stays at base.
    expect(el.shadowRoot.adoptedStyleSheets.length).toBe(1)
    el.remove()
  })

  test('a pending print load dedupes; re-mount re-adopts the cached text', async () => {
    let calls = 0
    const withPrint = {
      base: BASE_CSS,
      tiers: {},
      print: () => {
        calls++
        return Promise.resolve(PRINT_CSS)
      },
    }
    const el = document.createElement(TAG)

    el._componentStyles = withPrint
    document.body.appendChild(el)
    el._adoptPrintTier(withPrint) // in-flight dedup — never a second fetch
    await flush()

    expect(calls).toBe(1)
    expect(el._printText).toBe(PRINT_CSS)

    el._adoptPrintText(PRINT_CSS) // already-adopted sheet → includes-guard
    expect(el.shadowRoot.adoptedStyleSheets.length).toBe(2)

    // Re-mount resets adoptedStyleSheets — the stashed text re-adopts
    // synchronously without touching the loader again.
    el.remove()
    document.body.appendChild(el)
    await flush()

    expect(el.shadowRoot.adoptedStyleSheets.length).toBe(2)
    expect(calls).toBe(1)

    el.remove()
  })

  test('a rejected print load warns through devlog and clears the pending flag', async () => {
    clearDevLog()

    const el = document.createElement(TAG)

    el._componentStyles = {
      base: BASE_CSS,
      tiers: {},
      print: () => Promise.reject(new Error(TEST_TEXT.STALE)),
    }
    document.body.appendChild(el)
    await flush()

    expect(el._printPending).toBe(false)
    expect(el._printText).toBe('')
    expect(getDevLog().some((e) => e.level === LOG_LEVELS.WARN)).toBe(true)

    el.remove()
  })

  test('a print resolution landing while detached stashes text without adopting', async () => {
    const el = document.createElement(TAG)

    el._componentStyles = {
      base: BASE_CSS,
      tiers: {},
      print: () => Promise.resolve(PRINT_CSS),
    }
    document.body.appendChild(el)
    el.remove()
    await flush()

    // Unmounted at resolution — the text caches for the next mount.
    expect(el._printText).toBe(PRINT_CSS)
  })

  test('legacy <style> path appends print text after the tier text', async () => {
    const saved = globalThis.CSSStyleSheet

    delete globalThis.CSSStyleSheet

    try {
      const el = document.createElement(TAG)

      el._componentStyles = {
        base: BASE_CSS,
        tiers: { mobile: () => Promise.resolve(MOBILE_CSS) },
        print: () => Promise.resolve(PRINT_CSS),
      }
      document.body.appendChild(el)
      await flush()

      const styleEl = el.shadowRoot.querySelector('style')
      const iTier = styleEl.textContent.indexOf(MOBILE_CSS)
      const iPrint = styleEl.textContent.indexOf(PRINT_CSS)

      expect(iTier).toBeGreaterThan(-1)
      expect(iPrint).toBeGreaterThan(iTier)

      el.remove()
    } finally {
      globalThis.CSSStyleSheet = saved
    }
  })

  test('legacy composition keeps the print text when the tier lands after it', async () => {
    const saved = globalThis.CSSStyleSheet

    delete globalThis.CSSStyleSheet

    try {
      const el = document.createElement(TAG)
      let resolveTier

      el._componentStyles = {
        base: BASE_CSS,
        tiers: {
          mobile: () =>
            new Promise((r) => {
              resolveTier = r
            }),
        },
        print: () => Promise.resolve(PRINT_CSS),
      }
      document.body.appendChild(el)
      await flush() // print lands first, tier still pending

      resolveTier(MOBILE_CSS)
      await flush()

      const styleEl = el.shadowRoot.querySelector('style')

      expect(styleEl.textContent).toContain(MOBILE_CSS)
      expect(styleEl.textContent).toContain(PRINT_CSS)

      el.remove()
    } finally {
      globalThis.CSSStyleSheet = saved
    }
  })

  test('the print tier still loads when requestIdleCallback is absent (setTimeout fallback)', async () => {
    const saved = window.requestIdleCallback

    window.requestIdleCallback = undefined

    try {
      const el = document.createElement(TAG)

      el._componentStyles = {
        base: BASE_CSS,
        tiers: {},
        print: () => Promise.resolve(PRINT_CSS),
      }
      document.body.appendChild(el)
      // The fallback schedules a 120ms setTimeout — outwait it.
      await new Promise((r) => setTimeout(r, 140))

      expect(el._printText).toBe(PRINT_CSS)
      expect(el.shadowRoot.adoptedStyleSheets.length).toBe(2)

      el.remove()
    } finally {
      window.requestIdleCallback = saved
    }
  })

  test('destroying a component that defines onDestroy invokes it on disconnect', () => {
    const el = document.createElement(TAG)

    document.body.appendChild(el)

    const spy = jest.fn()
    el.onDestroy = spy
    el.remove()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(el._isMounted).toBe(false)
  })
})
