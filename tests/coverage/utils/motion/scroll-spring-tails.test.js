/**
 * @file scroll-spring-tails.test.js
 * @description Coverage for core/utils/motion/scroll-spring.ts — the
 * carousel scroll-chase spring. Drives the rAF loop with a manual queue
 * (deterministic frame timestamps, no real-time waits) and covers: the
 * first-frame vs clamped dt arms, the settle path (class lift + onSettle
 * + scrollLeft snap), the MAX_MS watchdog force-settle, mid-flight
 * retarget (running-frame early return), the instant/min-travel arm
 * including cancelation of a live rAF, the default-arg onSettle, and
 * cancelSpringScroll with and without a live state.
 */
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { springScrollTo, cancelSpringScroll } from '@core/utils/motion/scroll-spring.js'
import { framePool } from '@core/utils/motion/frame.js'
import { CAROUSEL_SPRING } from '@core/tokens/motion/carousel.js'
import { CAROUSEL_CLASSES } from '@core/tokens/classes/carousel.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'

const ANIM = CAROUSEL_CLASSES.CAROUSEL_TRACK_ANIMATING

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

/** Fresh scrollable element — WeakMap-keyed state must not leak between tests. */
const makeTrack = () => {
  const el = document.createElement(HTML_TAGS.DIV)
  el.scrollLeft = 0
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

describe('scroll-spring tails', () => {
  test('springs scrollLeft onto the target, overshoots, then lifts the animating class on settle', () => {
    const el = makeTrack()
    const onSettle = jest.fn()

    springScrollTo(el, 500, ANIM, onSettle)

    expect(el.classList.contains(ANIM)).toBe(true)

    pump(200)

    expect(el.scrollLeft).toBe(500)
    expect(el.classList.contains(ANIM)).toBe(false)
    expect(onSettle).toHaveBeenCalledTimes(1)
  })

  test('the critically-damped settle parks on the target without a visible bounce', () => {
    const el = makeTrack()
    let maxSeen = 0

    springScrollTo(el, 300, ANIM)

    // Sample every frame — ζ≈1.02 keeps the approach one-sided; Euler
    // discretization may still wobble a hair past, never a bounce.
    for (let i = 0; i < 200; i++) {
      pump(1)
      if (el.scrollLeft > maxSeen) maxSeen = el.scrollLeft
    }

    expect(maxSeen).toBeLessThanOrEqual(302)
    expect(el.scrollLeft).toBe(300)
  })

  test('watchdog force-settles when the spring cannot finish inside MAX_MS', () => {
    const el = makeTrack()
    const onSettle = jest.fn()

    // A 1e6px chase cannot converge inside 1400ms of simulated frames —
    // dt clamps to DT_MAX_S so each tick accrues 50ms of elapsed.
    springScrollTo(el, 1e6, ANIM, onSettle)
    pump(Math.ceil(CAROUSEL_SPRING.MAX_MS / (CAROUSEL_SPRING.DT_MAX_S * 1000)) + 5, 50)

    expect(el.scrollLeft).toBe(1e6)
    expect(el.classList.contains(ANIM)).toBe(false)
    expect(onSettle).toHaveBeenCalledTimes(1)
  })

  test('mid-flight retarget keeps the running frame and lands on the new target', () => {
    const el = makeTrack()
    const first = jest.fn()
    const second = jest.fn()

    springScrollTo(el, 400, ANIM, first)
    pump(3)
    springScrollTo(el, 800, ANIM, second)
    pump(200)

    expect(el.scrollLeft).toBe(800)
    // The retarget replaces the settle callback — a nav's latest target wins.
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
    expect(el.classList.contains(ANIM)).toBe(false)
  })

  test('instant arm writes the target and fires settle synchronously', () => {
    const el = makeTrack()
    const onSettle = jest.fn()

    springScrollTo(el, 300, ANIM, onSettle, true)

    expect(el.scrollLeft).toBe(300)
    expect(onSettle).toHaveBeenCalledTimes(1)
    expect(el.classList.contains(ANIM)).toBe(false)
    expect(rafQueue).toHaveLength(0)
  })

  test('sub-threshold travel takes the instant arm without a frame', () => {
    const el = makeTrack()

    el.scrollLeft = 1

    springScrollTo(el, 1 + CAROUSEL_SPRING.MIN_TRAVEL_PX - 1, ANIM)

    expect(el.scrollLeft).toBe(2)
    expect(rafQueue).toHaveLength(0)
  })

  test('instant arm during flight cancels the live raf and clears the class', () => {
    const el = makeTrack()
    const onSettle = jest.fn()

    springScrollTo(el, 400, ANIM, onSettle)
    pump(2)

    expect(rafQueue.length).toBeGreaterThan(0)

    springScrollTo(el, 900, ANIM, onSettle, true)

    expect(el.scrollLeft).toBe(900)
    expect(el.classList.contains(ANIM)).toBe(false)

    // The live frame was cancelled — pumping does not move scrollLeft.
    pump(10)

    expect(el.scrollLeft).toBe(900)
  })

  test('cancelSpringScroll lifts the class and drops the live frame', () => {
    const el = makeTrack()

    springScrollTo(el, 400, ANIM)
    pump(2)

    cancelSpringScroll(el, ANIM)

    expect(el.classList.contains(ANIM)).toBe(false)

    pump(50)

    // Cancelled mid-flight: never snaps to the target, never settles.
    expect(el.scrollLeft).not.toBe(400)
  })

  test('cancelSpringScroll on an idle track is a no-op', () => {
    const el = makeTrack()

    cancelSpringScroll(el, ANIM)

    expect(el.scrollLeft).toBe(0)
  })

  test('cancelSpringScroll clears a state whose frame never armed', () => {
    // framePool.request returning 0 leaves the state registered with
    // raf = 0 — cancel must skip `if (s.raf)` and still drop the state.
    const el = makeTrack()
    const spy = jest.spyOn(framePool, 'request').mockImplementation(() => 0)

    springScrollTo(el, 400, ANIM)
    spy.mockRestore()

    expect(el.classList.contains(ANIM)).toBe(true)

    cancelSpringScroll(el, ANIM)

    expect(el.classList.contains(ANIM)).toBe(false)
  })
})
