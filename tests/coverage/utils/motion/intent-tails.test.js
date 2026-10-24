/**
 * @file intent-tails.test.js
 * @description Coverage tails for core/utils/motion/intent.ts — intent
 * firing, fired-guard, listener teardown, quiet-window fallback timer,
 * and the window-less early return.
 */
import { jest } from '@jest/globals'

import { POINTER_EVENTS, KEYBOARD_EVENTS, WINDOW_EVENTS } from '@core/tokens/events/dom.js'
import { PREFETCH_CONFIG } from '@core/tokens/motion/prefetch.js'
import { onUserIntent } from '@core/utils/motion/intent.js'

describe('onUserIntent', () => {
  test('fires the callback on the first interaction signal, exactly once', () => {
    const cb = jest.fn()

    onUserIntent(cb)

    window.dispatchEvent(new window.Event(POINTER_EVENTS.POINTERDOWN))
    // second signal → fired guard + removed listeners
    window.dispatchEvent(new window.Event(KEYBOARD_EVENTS.KEYDOWN))

    expect(cb).toHaveBeenCalledTimes(1)
  })

  test('later signals after fire are ignored (listeners removed)', () => {
    const cb = jest.fn()

    onUserIntent(cb)
    window.dispatchEvent(new window.Event(WINDOW_EVENTS.SCROLL))
    window.dispatchEvent(new window.Event(POINTER_EVENTS.POINTERDOWN))

    expect(cb).toHaveBeenCalledTimes(1)
  })

  test('fires through the quiet-window timer when no interaction arrives', () => {
    jest.useFakeTimers()

    const cb = jest.fn()

    onUserIntent(cb)

    expect(cb).not.toHaveBeenCalled()

    jest.advanceTimersByTime(PREFETCH_CONFIG.INTENT_FALLBACK)

    expect(cb).toHaveBeenCalledTimes(1)

    jest.useRealTimers()
  })

  test('internal fire() re-entry hits the fired guard', () => {
    const captured = []
    const origAdd = window.addEventListener
    const cb = jest.fn()

    window.addEventListener = (type, fn) => {
      captured.push(fn)
    }

    onUserIntent(cb)

    window.addEventListener = origAdd

    captured[0]()
    captured[0]() // re-entry → fired guard early-return

    expect(cb).toHaveBeenCalledTimes(1)
  })

  test('early-returns when no window global exists', () => {
    const win = globalThis.window

    globalThis.window = undefined

    const cb = jest.fn()

    onUserIntent(cb)

    expect(cb).not.toHaveBeenCalled()

    globalThis.window = win
  })
})
