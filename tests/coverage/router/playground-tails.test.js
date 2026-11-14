/**
 * @file playground-tails.test.js — coverage tails for router/playground.ts
 * plus the applyTheme playground arm in store/mutations/theme.ts.
 * No jest.resetModules(): istanbul counters live per module instance, so
 * re-imports after a reset discard recorded hits in the merged report.
 */

import store from '@core/store.js'
import {
  isEarthPlaygroundRoute,
  isStarFieldRoute,
  isPlaygroundRoute,
} from '@core/router/playground.js'
import { LANG_SLUGS } from '@core/i18n.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { PREF_MUTATIONS } from '@core/tokens/events/mutations.js'
import { ROUTE_NAMES } from '@core/tokens/routes/names.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { THEME } from '@core/tokens/theme/theme.js'

/** Temporarily parks the live pathname around a callback. */
const withPath = (pathname, fn) => {
  const prev = window.location.pathname

  window.history.replaceState({}, ATTR_VALUES.EMPTY, pathname)

  try {
    return fn()
  } finally {
    window.history.replaceState({}, ATTR_VALUES.EMPTY, prev)
  }
}

describe('router/playground predicates', () => {
  test('isEarthPlaygroundRoute — route name fast path wins over the path', () => {
    expect(isEarthPlaygroundRoute(ROUTE_NAMES.EARTH_PLAYGROUND, ROUTE_PATHS.ABOUT)).toBe(true)
  })

  test('isEarthPlaygroundRoute — canonical + space-playground alias segments', () => {
    expect(isEarthPlaygroundRoute(null, `/${ROUTE_PATHS.EARTH_PLAYGROUND_SEGMENT}`)).toBe(true)
    expect(isEarthPlaygroundRoute(null, `/${ROUTE_PATHS.SPACE_PLAYGROUND_SEGMENT}`)).toBe(true)
  })

  test('isEarthPlaygroundRoute — localized slugs and misses', () => {
    // One non-English slug covers the flattened LANG_SLUGS set; 'en'
    // duplicates the canonical segment so it proves nothing on its own.
    const localized = Object.values(LANG_SLUGS)
      .map((s) => s.earthPlayground)
      .find((slug) => slug && slug !== ROUTE_PATHS.EARTH_PLAYGROUND_SEGMENT)

    expect(isEarthPlaygroundRoute(null, `/x/${localized}`)).toBe(true)
    expect(isEarthPlaygroundRoute(ROUTE_NAMES.HOME, ROUTE_PATHS.ABOUT)).toBe(false)
  })

  test('isStarFieldRoute — name, canonical segment, localized slug, miss', () => {
    expect(isStarFieldRoute(ROUTE_NAMES.STAR_FIELD, ROUTE_PATHS.ABOUT)).toBe(true)
    expect(isStarFieldRoute(null, `/${ROUTE_PATHS.STAR_FIELD_SEGMENT}`)).toBe(true)

    const localized = Object.values(LANG_SLUGS)
      .map((s) => s.starField)
      .find((slug) => slug && slug !== ROUTE_PATHS.STAR_FIELD_SEGMENT)

    expect(isStarFieldRoute(null, `/${localized}`)).toBe(true)
    expect(isStarFieldRoute(ROUTE_NAMES.HOME, ROUTE_PATHS.ABOUT)).toBe(false)
  })

  test('isPlaygroundRoute — either experiment matches, ordinary routes do not', () => {
    expect(isPlaygroundRoute(ROUTE_NAMES.EARTH_PLAYGROUND, ROUTE_PATHS.ABOUT)).toBe(true)
    expect(isPlaygroundRoute(null, `/${ROUTE_PATHS.STAR_FIELD_SEGMENT}`)).toBe(true)
    expect(isPlaygroundRoute(ROUTE_NAMES.HOME, ROUTE_PATHS.ABOUT)).toBe(false)
    expect(isPlaygroundRoute(null, ATTR_VALUES.EMPTY)).toBe(false)
  })

  test('no-arg calls read the live location; off-DOM resolves false', () => {
    withPath(`/${ROUTE_PATHS.EARTH_PLAYGROUND_SEGMENT}`, () => {
      expect(isEarthPlaygroundRoute()).toBe(true)
      expect(isPlaygroundRoute()).toBe(true)
    })

    withPath(`/${ROUTE_PATHS.STAR_FIELD_SEGMENT}`, () => {
      expect(isStarFieldRoute()).toBe(true)
    })

    const w = globalThis.window

    try {
      // Simulate an SSR/globalless environment — livePath resolves '',
      // which never matches a playground slug.
      globalThis.window = undefined

      expect(isPlaygroundRoute()).toBe(false)
    } finally {
      globalThis.window = w
    }
  })
})

describe('applyTheme — playground routes force dark', () => {
  test('a playground path forces dark-mode over a stored light pref, restored on leave', () => {
    const prevTheme = store.getters.getTheme()

    store.commit(PREF_MUTATIONS.SET_THEME, THEME.LIGHT)

    withPath(`/${ROUTE_PATHS.EARTH_PLAYGROUND_SEGMENT}`, () => {
      store.commit(PREF_MUTATIONS.APPLY_THEME)

      expect(document.documentElement.classList.contains(STATE_CLASSES.DARK_MODE)).toBe(true)
      expect(store.getters.getEffectiveTheme()).toBe(THEME.DARK)
    })

    // Ordinary route → the stored light preference resumes.
    store.commit(PREF_MUTATIONS.APPLY_THEME)

    expect(document.documentElement.classList.contains(STATE_CLASSES.DARK_MODE)).toBe(false)

    store.commit(PREF_MUTATIONS.SET_THEME, prevTheme)
  })

  test('star-field forces dark the same way', () => {
    const prevTheme = store.getters.getTheme()

    store.commit(PREF_MUTATIONS.SET_THEME, THEME.LIGHT)

    withPath(`/${ROUTE_PATHS.STAR_FIELD_SEGMENT}`, () => {
      store.commit(PREF_MUTATIONS.APPLY_THEME)

      expect(document.documentElement.classList.contains(STATE_CLASSES.DARK_MODE)).toBe(true)
    })

    store.commit(PREF_MUTATIONS.APPLY_THEME)
    store.commit(PREF_MUTATIONS.SET_THEME, prevTheme)
  })
})
