/**
 * @file expand-spring-tails.test.js
 * @description Coverage for core/utils/motion/expand-spring.ts — the
 * px-space height chase spring. Drives the rAF loop with a manual queue
 * (deterministic frame timestamps, no real-time waits) and covers: the
 * first-frame vs clamped dt arms, the settle path (onSettle + height
 * snap), the MAX_MS watchdog force-settle, mid-flight retarget
 * (running-frame early return), the instant/min-travel arm including
 * cancellation of a live rAF, the default-arg onSettle, and
 * cancelExpandSpring with and without a live state.
 */
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { springExpandTo, cancelExpandSpring } from '@core/utils/motion/expand-spring.js'
import { framePool } from '@core/utils/motion/frame.js'
import { EXPAND_SPRING } from '@core/tokens/motion/expand.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'

const realRaf = globalThis.requestAnimationFrame
const realCaf = globalThis.cancelAnimationFrame

/** Pending rAF callbacks — index is the returned handle minus 1. */
let rafQueue = []
/** Virtual clock (ms) fed to the queued callbacks. */
let now = 0

/**
 * Runs `frames` rAF ticks, advancing the virtual clock by `dt` ms each.
 * Callbacks re-armed during a tick land in the next queue.
 * @param {number} frames Ticks to pump.
 * @param {number} dt Virtual frame delta in ms.
 */
const pump = (frames, dt = 16) => {
  for (let i = 0; i < frames; i++) {
    now += dt
    const q = rafQueue
    rafQueue = []
    q.forEach((cb) => cb && cb(now))
  }
}

/**
 * Fresh element with a mocked rect — happy-dom reports 0 for every box
 * so the chase's px measurement comes from a controllable `_h` field,
 * and an inline `style.height` written by the spring reflects back.
 * @param {number} natural The element's rest height when unconstrained.
 */
const makeEl = (natural = 0) => {
  const el = document.createElement(HTML_TAGS.DIV)

  el._h = natural

  el.getBoundingClientRect = () => {
    const inline = parseFloat(el.style.height)

    return { height: Number.isNaN(inline) ? el._h : inline }
  }

  return el
}

beforeEach(() => {
  rafQueue = []
  now = 0
  globalThis.requestAnimationFrame = (cb) => {
    rafQueue.push(cb)
    return rafQueue.length
  }
  globalThis.cancelAnimationFrame = (id) => {
    rafQueue[id - 1] = null
  }
})

afterEach(() => {
  globalThis.requestAnimationFrame = realRaf
  globalThis.cancelAnimationFrame = realCaf
})

describe('expand-spring tails', () => {
  test('springs height onto the target and fires onSettle', () => {
    const el = makeEl()
    const onSettle = jest.fn()

    springExpandTo(el, 400, onSettle)

    pump(200)

    expect(el.style.height).toBe('400px')
    expect(onSettle).toHaveBeenCalledTimes(1)
  })

  test('the critically-damped settle parks on the target without a visible bounce', () => {
    const el = makeEl()
    let maxSeen = 0

    springExpandTo(el, 300)

    // Sample every frame — ζ≈1.0 keeps the approach one-sided; Euler
    // discretization may still wobble a hair past, never a bounce.
    for (let i = 0; i < 200; i++) {
      pump(1)
      const h = parseFloat(el.style.height)
      if (h > maxSeen) maxSeen = h
    }

    expect(maxSeen).toBeLessThanOrEqual(302)
    expect(el.style.height).toBe('300px')
  })

  test('watchdog force-settles when the spring cannot finish inside MAX_MS', () => {
    const el = makeEl()
    const onSettle = jest.fn()

    // A 1e6px chase cannot converge inside 900ms of simulated frames —
    // dt clamps to DT_MAX_S so each tick accrues 50ms of elapsed.
    springExpandTo(el, 1e6, onSettle)
    pump(Math.ceil(EXPAND_SPRING.MAX_MS / (EXPAND_SPRING.DT_MAX_S * 1000)) + 5, 50)

    expect(el.style.height).toBe('1000000px')
    expect(onSettle).toHaveBeenCalledTimes(1)
  })

  test('mid-flight retarget keeps the running frame and lands on the new target', () => {
    const el = makeEl()
    const first = jest.fn()
    const second = jest.fn()

    springExpandTo(el, 400, first)
    pump(3)
    springExpandTo(el, 800, second)
    pump(200)

    expect(el.style.height).toBe('800px')
    // The retarget replaces the settle callback — the latest target wins.
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
  })

  test('instant arm writes the target and fires settle synchronously', () => {
    const el = makeEl()
    const onSettle = jest.fn()

    springExpandTo(el, 300, onSettle, true)

    expect(el.style.height).toBe('300px')
    expect(onSettle).toHaveBeenCalledTimes(1)
    expect(rafQueue).toHaveLength(0)
  })

  test('sub-threshold travel takes the instant arm without a frame', () => {
    const el = makeEl(1)

    springExpandTo(el, 1 + EXPAND_SPRING.MIN_TRAVEL_PX - 1)

    expect(el.style.height).toBe(`${1 + EXPAND_SPRING.MIN_TRAVEL_PX - 1}px`)
    expect(rafQueue).toHaveLength(0)
  })

  test('instant arm during flight cancels the live raf', () => {
    const el = makeEl()
    const onSettle = jest.fn()

    springExpandTo(el, 400, onSettle)
    pump(2)

    expect(rafQueue.length).toBeGreaterThan(0)

    springExpandTo(el, 900, onSettle, true)

    expect(el.style.height).toBe('900px')

    // The live frame was cancelled — pumping does not move the height.
    pump(10)

    expect(el.style.height).toBe('900px')
  })

  test('cancelExpandSpring drops the live frame without settling', () => {
    const el = makeEl()
    const onSettle = jest.fn()

    springExpandTo(el, 400, onSettle)
    pump(2)

    cancelExpandSpring(el)

    pump(50)

    // Cancelled mid-flight: never snaps to the target, never settles.
    expect(el.style.height).not.toBe('400px')
    expect(onSettle).not.toHaveBeenCalled()
  })

  test('cancelExpandSpring on an idle element is a no-op', () => {
    const el = makeEl()

    cancelExpandSpring(el)

    expect(el.style.height).toBe('')
  })

  test('custom write hook + from origin — composited reveals chase px without touching height', () => {
    const el = makeEl(500)
    const seen = []

    springExpandTo(el, 400, null, false, (_e, v) => seen.push(v), 0)

    pump(200)

    // Fresh start at the supplied origin — the rect's natural 500 is
    // ignored — and the landing frame writes the exact target.
    expect(seen[0]).toBeLessThan(400)
    expect(seen[seen.length - 1]).toBe(400)
    expect(el.style.height).toBe('')
  })

  test('live-state measured — retarget during collapse reads the chase position, not the rect', () => {
    const el = makeEl(500)

    // Open chase to 400 — parks the live spring mid-flight.
    springExpandTo(el, 400)
    pump(2)

    // Retarget while live — measured must be the spring's currentP
    // (not the rect's natural 500), so the chase doesn't restart.
    springExpandTo(el, 600)
    pump(200)

    expect(el.style.height).toBe('600px')
  })

  test('cancelExpandSpring clears a state whose frame never armed', () => {
    // framePool.request returning 0 leaves the state registered with
    // raf = 0 — cancel must skip `if (s.raf)` and still drop the state.
    const el = makeEl()
    const spy = jest.spyOn(framePool, 'request').mockImplementation(() => 0)

    springExpandTo(el, 400)
    spy.mockRestore()

    cancelExpandSpring(el)

    // The state is gone — a later call starts a fresh spring.
    springExpandTo(el, 800)
    pump(200)

    expect(el.style.height).toBe('800px')
  })
})
