/**
 * @file intro-loader-tails-4.test.js
 * @description Covers the static-markup adoption paths — emitted pages
 * ship the intro-loader DOM so the designed veil paints before the JS
 * bundle arrives; init() adopts that node instead of building a second
 * overlay, and the early-return gates remove it so a stale static veil
 * never covers the document.
 */
import { jest } from '@jest/globals'
import store from '@core/store.js'

import { IntroLoader } from '@core/utils/canvas/loaders/intro-loader.js'
import { LOADER_CLASSES } from '@core/tokens/classes/loader.js'
import { LOADER_SELECTORS } from '@core/tokens/selectors/loader.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { CACHE_STORAGE_KEYS } from '@core/tokens/data/storage.js'
import { PREF_MUTATIONS } from '@core/tokens/events/mutations.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'

const flush = (ms = 60) => new Promise((r) => setTimeout(r, ms))

/** Mounts the same markup index.html emits statically (mirrors LOADER_CLASSES). */
const mountStaticLoader = () => {
  const el = document.createElement(HTML_TAGS.DIV)

  el.className = LOADER_CLASSES.INTRO_LOADER

  const percent = document.createElement(HTML_TAGS.DIV)

  percent.className = LOADER_CLASSES.INTRO_LOADER_PERCENT

  const msg = document.createElement(HTML_TAGS.DIV)

  msg.className = LOADER_CLASSES.INTRO_LOADER_MSG

  const bar = document.createElement(HTML_TAGS.DIV)

  bar.className = LOADER_CLASSES.INTRO_LOADER_BAR

  const fill = document.createElement(HTML_TAGS.DIV)

  fill.className = LOADER_CLASSES.INTRO_LOADER_BAR_FILL

  bar.appendChild(fill)
  el.appendChild(percent)
  el.appendChild(msg)
  el.appendChild(bar)

  document.body.appendChild(el)

  return el
}

describe('intro-loader static-markup adoption', () => {
  afterEach(() => {
    sessionStorage.removeItem(CACHE_STORAGE_KEYS.INTRO_SHOWN)
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
    document
      .querySelectorAll(`${LOADER_SELECTORS.INTRO_LOADER},.${LOADER_CLASSES.INTRO_LOADER_RETIRED}`)
      .forEach((el) => el.remove())
  })

  test('adopts the statically-emitted node instead of building a second overlay', async () => {
    const el = mountStaticLoader()

    const loader = new IntroLoader(document.body, jest.fn())

    expect(loader.container).toBe(el)
    expect(loader.percentEl).toBe(el.querySelector(LOADER_SELECTORS.PERCENT))
    expect(loader.msgEl).toBe(el.querySelector(LOADER_SELECTORS.MSG))
    expect(loader.barEl).toBe(el.querySelector(LOADER_SELECTORS.BAR))
    expect(document.querySelectorAll(LOADER_SELECTORS.INTRO_LOADER)).toHaveLength(1)

    await flush(30)

    loader.destroy?.()
    loader.container?.remove()
  })

  test('once-per-session early return retires the static veil', () => {
    sessionStorage.setItem(CACHE_STORAGE_KEYS.INTRO_SHOWN, '1')

    const el = mountStaticLoader()
    const done = jest.fn()
    const loader = new IntroLoader(document.body, done)

    expect(done).toHaveBeenCalled()
    expect(loader.container).toBeNull()

    // Retired, never detached — disconnecting would retract a painted
    // LQIP's LCP candidacy; the node swaps to the --retired class and
    // drops off .intro-loader selectors instead.
    expect(el.isConnected).toBe(true)
    expect(el.className).toBe(LOADER_CLASSES.INTRO_LOADER_RETIRED)
    expect(el.getAttribute(ARIA_ATTRS.ARIA_HIDDEN)).toBe(ATTR_VALUES.TRUE)
  })

  test('reduced-motion early return retires the static veil', () => {
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)

    const el = mountStaticLoader()
    const done = jest.fn()
    const loader = new IntroLoader(document.body, done)

    expect(done).toHaveBeenCalled()
    expect(loader.container).toBeNull()
    expect(el.isConnected).toBe(true)
    expect(el.className).toBe(LOADER_CLASSES.INTRO_LOADER_RETIRED)
  })
})
