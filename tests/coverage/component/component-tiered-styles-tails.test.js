/**
 * @file component-tiered-styles-tails.test.js
 * @description Coverage tails for the `?tiers` adoption path in
 * core/Component.ts — base sheet adopted synchronously, the viewport's
 * cumulative media tier loading lazily into adoptedStyleSheets (or the
 * legacy <style> node), grow-watcher upgrades replacing the narrower
 * sheet in place, and dedup/teardown guards around the lazy loads.
 */
import { BaseComponent } from '@core/Component.js'
import { getDevLog, clearDevLog } from '@core/devlog.js'
import { LOG_LEVELS } from '@core/tokens/data/log.js'
import { TEST_TEXT } from '@tests/fixtures/test-constants.js'

const BASE_CSS = '.tier-base { display: block; }'
const MOBILE_CSS = '@media (min-width: 319px) { .tier-m { margin: 0; } }'
const DESKTOP_CSS = MOBILE_CSS + '@media (min-width: 1279px) { .tier-d { margin: 0; } }'

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

const TAG = 'test-tiered-component'
const HOST_TAG = 'test-tiered-host'

if (!customElements.get(TAG)) customElements.define(TAG, TieredComponent)
if (!customElements.get(HOST_TAG)) customElements.define(HOST_TAG, TieredHost)

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
})
