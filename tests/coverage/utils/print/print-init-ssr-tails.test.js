/**
 * @file print-init-ssr-tails.test.js
 * @description Coverage for core/utils/print/print.ts — the document-less
 * eval arm inside initPrintSupport: the deferred boot import can eval
 * where no document exists, so the load warm-up skips its document
 * capture listener entirely. Runs on its own module registry — install
 * latches once per instance, so this arm cannot share a file with the
 * sweep coverage.
 */
import { initPrintSupport } from '@core/utils/print/print.js'
import { FORM_EVENTS } from '@core/tokens/events/dom.js'

describe('initPrintSupport document-less eval', () => {
  let origMatchMedia
  let mqlListener = null

  beforeAll(() => {
    origMatchMedia = window.matchMedia

    // The install path queries the print channel before the document
    // guard — capturing the change listener proves the probe got past
    // matchMedia and reached the guard deterministically.
    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: (ev, fn) => {
        if (ev === FORM_EVENTS.CHANGE) mqlListener = fn
      },
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })
  })

  afterAll(() => {
    window.matchMedia = origMatchMedia
  })

  test('returns before the bridge sweep + document load listener', () => {
    const origDocument = globalThis.document

    delete globalThis.document

    try {
      expect(() => initPrintSupport()).not.toThrow()
      expect(mqlListener).toBeInstanceOf(Function)
    } finally {
      globalThis.document = origDocument
    }
  })
})
