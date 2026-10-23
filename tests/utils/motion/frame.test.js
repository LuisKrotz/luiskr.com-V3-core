/**
 * @file frame.test.js
 * @description Shared frame scheduler (`utils/motion/frame.ts`) — pump
 * semantics: native-rAF parity for consume / re-arm / cancel ordering,
 * plus the failure-isolation contract (a throwing callback cannot wedge
 * the shared pump, poison siblings, or leak the queue). The setup's
 * setTimeout-based rAF is replaced with a manually-fired stub so each
 * pump is deterministic; the module's queue is drained by pumping frames
 * rather than resetting modules.
 */
import { framePool } from '@core/utils/motion/frame.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'

/** The armed pump callback captured from the stubbed rAF (null = idle). */
let armed = null

/**
 * Fires one frame: invokes the armed pump once with `ts` (the callback
 * is consumed before invocation, mirroring the native handle).
 * @param {number} [ts] The frame timestamp handed to every callback.
 */
const flushFrame = (ts = 16) => {
  const cb = armed

  armed = null
  cb?.(ts)
}

describe('framePool', () => {
  beforeEach(() => {
    globalThis.requestAnimationFrame = (cb) => {
      armed = cb

      return 1
    }
    globalThis.cancelAnimationFrame = () => {
      armed = null
    }
  })

  test('request queues a callback onto the next pump and returns a numeric id', () => {
    let ran = 0

    const id = framePool.request(() => ran++)

    expect(typeof id).toBe(TYPE_STRINGS.NUMBER)
    expect(ran).toBe(0)

    flushFrame()

    expect(ran).toBe(1)
    expect(framePool.size()).toBe(0)
  })

  test('a callback re-requesting inside the pump lands on the NEXT frame', () => {
    const stamps = []

    const tick = (now) => {
      stamps.push(now)

      if (stamps.length < 3) framePool.request(tick)
    }

    framePool.request(tick)

    flushFrame(16)
    expect(stamps).toEqual([16])
    expect(framePool.size()).toBe(1)

    flushFrame(32)
    flushFrame(48)

    expect(stamps).toEqual([16, 32, 48])
    expect(framePool.size()).toBe(0)
  })

  test('cancel removes a pending callback; stale ids are a no-op', () => {
    let ran = 0

    const id = framePool.request(() => ran++)

    framePool.cancel(id)
    flushFrame()

    expect(ran).toBe(0)
    expect(framePool.size()).toBe(0)

    framePool.cancel(id)
    framePool.cancel(Number.MAX_SAFE_INTEGER)
  })

  test('cancelling a later callback mid-drain skips it in the same frame', () => {
    const order = []
    let second = 0

    framePool.request(() => {
      order.push('first')
      framePool.cancel(second)
    })

    second = framePool.request(() => order.push('second'))

    flushFrame()

    expect(order).toEqual(['first'])
    expect(framePool.size()).toBe(0)
  })

  test('a throwing callback cannot wedge the pump, poison siblings, or leak the queue', () => {
    const timers = []
    const realTimeout = globalThis.setTimeout

    globalThis.setTimeout = (fn) => {
      timers.push(fn)

      return 0
    }

    try {
      const order = []

      framePool.request(() => {
        order.push('thrower')

        throw new Error('boom')
      })
      framePool.request(() => order.push('sibling'))

      flushFrame()

      // The sibling still ran this frame; the thrower was consumed once;
      // the queue compacted and the pump stays functional afterwards.
      expect(order).toEqual(['thrower', 'sibling'])
      expect(framePool.size()).toBe(0)

      let again = 0

      framePool.request(() => again++)
      flushFrame()

      expect(again).toBe(1)
    } finally {
      globalThis.setTimeout = realTimeout
    }

    // The failure is still reported — asynchronously, from a fresh task.
    expect(timers.length).toBe(1)
    expect(() => timers[0]()).toThrow('boom')
  })

  test('a callback queued mid-drain by a throwing sibling still runs next frame', () => {
    const realTimeout = globalThis.setTimeout

    globalThis.setTimeout = () => 0

    try {
      const order = []

      framePool.request(() => {
        order.push('first')

        framePool.request(() => order.push('queued-during-drain'))

        throw new Error('boom')
      })

      flushFrame()
      flushFrame()

      expect(order).toEqual(['first', 'queued-during-drain'])
      expect(framePool.size()).toBe(0)
    } finally {
      globalThis.setTimeout = realTimeout
    }
  })
})
