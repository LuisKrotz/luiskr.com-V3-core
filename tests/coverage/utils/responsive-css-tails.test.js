/**
 * @file responsive-css-tails.test.js
 * @description Coverage tails for core/utils/responsive-css.ts — the
 * runtime half of the ?tiers stylesheet split: viewport width-class
 * evaluation, sparse cumulative-tier resolution, the shared upward-cross
 * watcher, mergeTiered concat, and isTieredStyles shape detection.
 */
import { WIDTH_CLASS_GATES } from '@core/tokens/layout/css-classes.js'
import {
  currentWidthClass,
  isTieredStyles,
  mergeTiered,
  resolveTierKey,
  watchWidthClassGrow,
} from '@core/utils/responsive-css.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'

/**
 * Installs a per-query matchMedia stub whose recorded `matches` flags are
 * flippable; `fire(query, bool)` flips one and dispatches live listeners.
 * Returns a restore function — always pair with try/finally.
 */
const stubMatchMedia = (initial = {}) => {
  const original = window.matchMedia
  const mqls = {}

  window.matchMedia = (query) => {
    if (!mqls[query]) {
      mqls[query] = {
        media: query,
        matches: Boolean(initial[query]),
        listeners: [],
        addEventListener(_t, fn) {
          this.listeners.push(fn)
        },
        removeEventListener(_t, fn) {
          this.listeners = this.listeners.filter((l) => l !== fn)
        },
      }
    }

    return mqls[query]
  }

  const fire = (query, value) => {
    const mql = window.matchMedia(query)

    mql.matches = value
    mql.listeners.slice().forEach((fn) => fn())
  }

  const restore = () => {
    window.matchMedia = original
  }

  return { fire, restore }
}

describe('isTieredStyles', () => {
  test('accepts only the {base:string, tiers:object} module shape', () => {
    expect(isTieredStyles({ base: 'x', tiers: {} })).toBe(true)
    expect(isTieredStyles({ base: 'x', tiers: { mobile: () => Promise.resolve('') } })).toBe(true)

    expect(isTieredStyles('plain css')).toBe(false)
    expect(isTieredStyles(null)).toBe(false)
    expect(isTieredStyles(undefined)).toBe(false)
    expect(isTieredStyles(3)).toBe(false)
    expect(isTieredStyles({ base: 7, tiers: {} })).toBe(false)
    expect(isTieredStyles({ base: 'x', tiers: 'nope' })).toBe(false)
  })
})

describe('currentWidthClass', () => {
  test('reports mobile when no gate matches', () => {
    const env = stubMatchMedia()

    try {
      expect(currentWidthClass()).toBe('mobile')
    } finally {
      env.restore()
    }
  })

  test('picks the smallest class covering the viewport', () => {
    const env = stubMatchMedia({
      [WIDTH_CLASS_GATES.tablet]: true,
    })

    try {
      expect(currentWidthClass()).toBe('tablet')
    } finally {
      env.restore()
    }
  })

  test('desktop and wide gates resolve to their classes', () => {
    const env = stubMatchMedia({
      [WIDTH_CLASS_GATES.tablet]: true,
      [WIDTH_CLASS_GATES.desktop]: true,
    })

    try {
      expect(currentWidthClass()).toBe('desktop')
    } finally {
      env.restore()
    }

    const env2 = stubMatchMedia({
      [WIDTH_CLASS_GATES.tablet]: true,
      [WIDTH_CLASS_GATES.desktop]: true,
      [WIDTH_CLASS_GATES.wide]: true,
    })

    try {
      expect(currentWidthClass()).toBe('wide')
    } finally {
      env2.restore()
    }
  })

  test('no window.matchMedia reports the wide (full-content) class', () => {
    const original = window.matchMedia

    window.matchMedia = undefined

    try {
      expect(currentWidthClass()).toBe('wide')
    } finally {
      window.matchMedia = original
    }
  })

  test('no window global at all also reports wide', () => {
    const saved = globalThis.window

    // SSR/tooling hosts — the guard must not touch the missing global.
    delete globalThis.window

    try {
      expect(currentWidthClass()).toBe('wide')
    } finally {
      globalThis.window = saved
    }
  })
})

describe('resolveTierKey', () => {
  test('returns undefined for empty tiers', () => {
    expect(resolveTierKey({}, 'mobile')).toBeUndefined()
    expect(resolveTierKey({}, 'wide')).toBeUndefined()
  })

  test('resolves the highest defined key at or below the viewport class', () => {
    const tiers = {
      mobile: () => Promise.resolve(''),
      desktop: () => Promise.resolve(''),
    }

    expect(resolveTierKey(tiers, 'mobile')).toBe('mobile')
    expect(resolveTierKey(tiers, 'tablet')).toBe('mobile')
    expect(resolveTierKey(tiers, 'desktop')).toBe('desktop')
    expect(resolveTierKey(tiers, 'wide')).toBe('desktop')
  })

  test('skips undefined loader slots while scanning', () => {
    const tiers = { mobile: undefined, wide: () => Promise.resolve('') }

    expect(resolveTierKey(tiers, 'mobile')).toBeUndefined()
    expect(resolveTierKey(tiers, 'tablet')).toBeUndefined()
    expect(resolveTierKey(tiers, 'wide')).toBe('wide')
  })
})

describe('watchWidthClassGrow', () => {
  test('no matchMedia → an inert disposer', () => {
    const original = window.matchMedia

    window.matchMedia = undefined

    try {
      const off = watchWidthClassGrow(() => {})

      expect(typeof off).toBe(TYPE_STRINGS.FUNCTION)
      off()
    } finally {
      window.matchMedia = original
    }
  })

  test('no window global → an inert disposer', () => {
    const saved = globalThis.window

    delete globalThis.window

    try {
      const off = watchWidthClassGrow(() => {})

      off()
    } finally {
      globalThis.window = saved
    }
  })

  test('subscribers fire once per upward cross; downward crosses are ignored', () => {
    const env = stubMatchMedia()
    const seen = []

    try {
      const off = watchWidthClassGrow((cls) => seen.push(cls))

      // Baseline is mobile — crossing tablet fires, re-firing the same
      // gate (still matching) does not, and desktop crosses cleanly.
      env.fire(WIDTH_CLASS_GATES.tablet, true)
      env.fire(WIDTH_CLASS_GATES.tablet, true)
      env.fire(WIDTH_CLASS_GATES.desktop, true)

      // Downward cross — a wider class stays adopted (its blocks go inert),
      // so subscribers hear nothing.
      env.fire(WIDTH_CLASS_GATES.desktop, false)
      env.fire(WIDTH_CLASS_GATES.tablet, false)

      expect(seen).toEqual(['tablet', 'desktop'])

      off()
    } finally {
      env.restore()
    }
  })

  test('the last unsubscribe tears down every shared gate listener', () => {
    const env = stubMatchMedia()
    const seen = []

    try {
      const offA = watchWidthClassGrow((cls) => seen.push(`a:${cls}`))
      const offB = watchWidthClassGrow((cls) => seen.push(`b:${cls}`))

      env.fire(WIDTH_CLASS_GATES.wide, true)

      expect(seen).toEqual(['a:wide', 'b:wide'])

      offA()
      offB()

      // Listeners detached — further gate flips notify nobody.
      env.fire(WIDTH_CLASS_GATES.wide, false)
      env.fire(WIDTH_CLASS_GATES.wide, true)

      expect(seen).toEqual(['a:wide', 'b:wide'])
    } finally {
      env.restore()
    }
  })
})

describe('mergeTiered', () => {
  test('joins bases in order and merges same-class tier loaders', async () => {
    const a = { base: 'A', tiers: { tablet: () => Promise.resolve({ default: 'A-t' }) } }
    const b = { base: 'B', tiers: { tablet: () => Promise.resolve('B-t'), wide: undefined } }
    const merged = mergeTiered(a, 'plain', b)

    expect(merged.base).toBe('A\nplain\nB')
    expect(Object.keys(merged.tiers)).toEqual(['tablet'])

    const css = await merged.tiers.tablet()

    expect(css).toBe('A-t\nB-t')
  })

  test('mixed parts and string-only input produce a valid module', async () => {
    const merged = mergeTiered('one', 'two')

    expect(merged.base).toBe('one\ntwo')
    expect(merged.tiers).toEqual({})
    expect(isTieredStyles(merged)).toBe(true)

    const sparse = mergeTiered({
      base: 'S',
      tiers: {
        mobile: () => Promise.resolve('S-m'),
        desktop: () => Promise.resolve({ default: 'S-d' }),
      },
    })

    expect(await sparse.tiers.mobile()).toBe('S-m')
    expect(await sparse.tiers.desktop()).toBe('S-d')
  })
})
