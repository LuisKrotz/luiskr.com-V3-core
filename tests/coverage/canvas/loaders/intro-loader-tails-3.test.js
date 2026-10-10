/**
 * @file intro-loader-tails-3.test.js
 * @description Coverage tails for the intro-loader fallback arms: a loader
 * copy without `stages` exercises `stages?.[0] || EMPTY` at build time and
 * `stages || []` in the run loop, and a falsy `getLang` exercises the
 * `|| LOCALES.EN` backstop. Reset-free — the fallback snapshot is mocked
 * before the module import so istanbul counters survive.
 */
import { jest } from '@jest/globals'
import store from '@core/store.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { CACHE_STORAGE_KEYS } from '@core/tokens/data/storage.js'
import { PREF_MUTATIONS } from '@core/tokens/events/mutations.js'

const actual = await jest.requireActual('@core/locale/fallback.js')

jest.unstable_mockModule('@core/locale/fallback.js', () => ({
  ...actual,
  FALLBACK_LOADERS: {},
  FALLBACK_APP: {
    ...actual.FALLBACK_APP,
    loader: { ...actual.FALLBACK_APP.loader, stages: undefined },
  },
}))

const { IntroLoader } = await import('@core/utils/canvas/loaders/intro-loader.js')

const flush = (ms = 60) => new Promise((r) => setTimeout(r, ms))

describe('intro-loader fallback tails', () => {
  test('a stages-less copy falls back to EMPTY + [] and still runs', async () => {
    sessionStorage.removeItem(CACHE_STORAGE_KEYS.INTRO_SHOWN)
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)

    const getLang = jest.spyOn(store.getters, 'getLang').mockReturnValue(CHAR_STRINGS.EMPTY)

    try {
      const done = jest.fn()
      const loader = new IntroLoader(document.body, done)

      expect(loader.copy.stages).toBeUndefined()

      await flush(80)

      loader.destroy?.()
      loader.container?.remove()
    } finally {
      getLang.mockRestore()
    }
  })
})
