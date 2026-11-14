/**
 * @file warm-bridge.test.js
 * @description Coverage for core/utils/print/warm-bridge.ts — the eager
 * seam that forwards shadow-root img `load` events to the lazily loaded
 * print module's warm hook (`load` is non-composed, so a document-level
 * capture listener never sees shadow imgs). Covers the null-root guard,
 * the pre-install queue, the queued-root wiring + sweep return, the
 * post-install direct attach, and the listener's img-vs-other arms.
 */
import { bindPrintWarm, installPrintWarm } from '@core/utils/print/warm-bridge.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { WINDOW_EVENTS } from '@core/tokens/events/dom.js'

describe('print warm bridge', () => {
  test('roots queue before install, wire on install, and attach directly after', () => {
    // Null root → the guard returns without queuing.
    bindPrintWarm(null)

    const host = document.createElement(HTML_TAGS.DIV)
    const root = host.attachShadow({ mode: COMMON_ATTRS.OPEN })

    // Before install the hook is null → the root queues for the sweep.
    bindPrintWarm(root)

    let warmed = 0
    const warm = () => warmed++

    const returned = installPrintWarm(warm)

    expect(returned).toEqual([root])

    // The queued root's listener now forwards img loads to the hook —
    // while a non-img target takes the else arm and never calls.
    const img = document.createElement(HTML_TAGS.IMG)

    img.setAttribute(MEDIA_ATTRS.SRC, 'https://cdn.example/x.jpg')
    root.appendChild(img)
    img.dispatchEvent(new window.Event(WINDOW_EVENTS.LOAD))
    img.dispatchEvent(new window.Event(WINDOW_EVENTS.LOAD))

    const notImg = document.createElement(HTML_TAGS.DIV)

    root.appendChild(notImg)
    notImg.dispatchEvent(new window.Event(WINDOW_EVENTS.LOAD))

    expect(warmed).toBe(2)

    // Post-install registration wires the listener immediately.
    const host2 = document.createElement(HTML_TAGS.DIV)
    const root2 = host2.attachShadow({ mode: COMMON_ATTRS.OPEN })

    bindPrintWarm(root2)

    const img2 = document.createElement(HTML_TAGS.IMG)

    img2.setAttribute(MEDIA_ATTRS.SRC, 'https://cdn.example/y.jpg')
    root2.appendChild(img2)
    img2.dispatchEvent(new window.Event(WINDOW_EVENTS.LOAD))

    expect(warmed).toBe(3)
  })
})
