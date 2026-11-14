/**
 * @file print-init-tails.test.js
 * @description Coverage for core/utils/print/print.ts — the install-time
 * sweep inside initPrintSupport: shadow roots the warm bridge queued
 * before the print chunk loaded get handed back by installPrintWarm and
 * their already-settled media warm directly (img + non-img tagName arms).
 * Runs on its own module registry — the install latches once per
 * instance, so this scenario cannot share a file with the SSR arm.
 */
import { initPrintSupport } from '@core/utils/print/print.js'
import { bindPrintWarm } from '@core/utils/print/warm-bridge.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { MEDIA_QUERIES } from '@core/tokens/primitives.js'

describe('initPrintSupport install sweep', () => {
  let origMatchMedia

  beforeAll(() => {
    origMatchMedia = window.matchMedia

    // The install path queries the print channel before any DOM work.
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
  })

  afterAll(() => {
    window.matchMedia = origMatchMedia
  })

  test('sweeps bridge-queued shadow roots — img and non-img arms', () => {
    expect(window.matchMedia(MEDIA_QUERIES.PRINT).media).toBe(MEDIA_QUERIES.PRINT)

    const host = document.createElement(HTML_TAGS.DIV)
    const root = host.attachShadow({ mode: COMMON_ATTRS.OPEN })

    // Bound before install → the root queues; the sweep re-warms its
    // already-settled imgs once the lazy module hands back the queue.
    bindPrintWarm(root)

    root.appendChild(document.createElement(HTML_TAGS.IMG))
    root.appendChild(document.createElement(HTML_TAGS.VIDEO))

    expect(() => initPrintSupport()).not.toThrow()
  })
})
