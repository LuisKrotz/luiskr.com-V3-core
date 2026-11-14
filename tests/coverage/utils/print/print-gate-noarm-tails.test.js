/**
 * @file print-gate-noarm-tails.test.js
 * @description Coverage for core/utils/print/print.ts — the install arm
 * where window.print is absent (happy-dom ships none): no chord gate or
 * print wrap installs at all, so Ctrl+P falls through to the browser's
 * own handling and beforeprint/enter() is the only entry — which still
 * answers a cover-only route with the single injected sheet.
 */
import { initPrintSupport } from '@core/utils/print/print.js'
import router from '@core/router/router.js'
import { PRINT_CLASSES } from '@core/tokens/classes/print.js'
import { CLIPBOARD_EVENTS, KEYBOARD_EVENTS } from '@core/tokens/events/dom.js'
import { KEYS } from '@core/tokens/primitives.js'
import { ROUTE_NAMES } from '@core/tokens/routes/names.js'

/**
 * Builds a Ctrl+P keydown — the env's KeyboardEvent mock drops modifier
 * props, so a plain cancelable Event carries the two fields the
 * listener reads.
 */
const ctrlP = () => {
  const evt = new window.Event(KEYBOARD_EVENTS.KEYDOWN, {
    bubbles: true,
    cancelable: true,
  })

  evt.key = KEYS.KEY_P
  evt.ctrlKey = true

  return evt
}

/** Dispatches the native beforeprint event the module listens for. */
const fireBeforePrint = () => window.dispatchEvent(new window.Event(CLIPBOARD_EVENTS.BEFORE_PRINT))

/** Dispatches the native afterprint event the module listens for. */
const fireAfterPrint = () => window.dispatchEvent(new window.Event(CLIPBOARD_EVENTS.AFTER_PRINT))

describe('print gate no-arm tails', () => {
  let origMatchMedia

  beforeAll(() => {
    origMatchMedia = window.matchMedia

    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })

    initPrintSupport()
  })

  afterAll(() => {
    window.matchMedia = origMatchMedia
  })

  afterEach(() => {
    fireAfterPrint()

    document.body.replaceChildren()

    router.currentRoute = null
  })

  test('no chord gate installs — a cover-only route Ctrl+P falls through', () => {
    router.currentRoute = { name: ROUTE_NAMES.SEARCH }

    const evt = ctrlP()

    window.dispatchEvent(evt)

    expect(evt.defaultPrevented).toBe(false)
  })

  test('beforeprint on a cover-only route emits the single sheet', () => {
    router.currentRoute = { name: ROUTE_NAMES.NOT_FOUND }

    fireBeforePrint()

    const back = document.querySelector(`.${PRINT_CLASSES.BACK}`)

    expect(back).toBeTruthy()
    expect(back.querySelector(`.${PRINT_CLASSES.BACK_QR}`)).toBeTruthy()
    expect(back.querySelector(`.${PRINT_CLASSES.BACK_HOME}`)).toBeTruthy()
    expect(document.querySelector(`.${PRINT_CLASSES.COVER}`)).toBeNull()
    expect(document.documentElement.classList.contains(PRINT_CLASSES.COVER_ONLY)).toBe(true)
  })
})
