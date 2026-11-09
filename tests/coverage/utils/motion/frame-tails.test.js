/**
 * @file frame-tails.test.js
 * @description Coverage tails for the shared frame scheduler — the flush arm
 * that drains queued callbacks while the armed rAF handle reads falsy, and the
 * compactor drop for a tail slot cancelled mid-drain.
 */
import { jest } from '@jest/globals'

import { framePool } from '@core/utils/motion/frame.js'

describe('frame pool tails', () => {
  test('flush drains queued callbacks when the armed rAF handle is falsy', () => {
    // A zero-returning rAF leaves `rafId` falsy after arm() — the flush guard
    // then falls through to the queued-callbacks arm.
    const realRaf = window.requestAnimationFrame
    window.requestAnimationFrame = () => 0

    const cb = jest.fn()
    framePool.request(cb)
    framePool.flush(16)

    expect(cb).toHaveBeenCalledWith(16)

    window.requestAnimationFrame = realRaf
  })

  test('compactor drops a tail entry cancelled mid-drain', () => {
    // A drained callback that re-queues and immediately cancels leaves a null
    // slot in the tail the compactor must skip.
    const late = jest.fn()

    const cb = jest.fn(() => {
      const id = framePool.request(late)
      framePool.cancel(id)
    })

    framePool.request(cb)
    framePool.flush(16)

    expect(cb).toHaveBeenCalledTimes(1)
    expect(late).not.toHaveBeenCalled()
  })
})
