/**
 * @file coverage/utils/gpu/orbit-controller-tails.test.js
 * @description Coverage tail for utils/gpu/orbit-controller.ts — the
 * OrbitControls replacement feeding surface.set_orbit. Covers every
 * spec arm (defaults + overrides + clamps), the drag/pinch/wheel
 * gesture paths (coalesced samples, pinch baseline, zoom gating),
 * the damped update loop (auto-rotate, frame-rate-independent lerp,
 * settle snap, dirty latch, CHANGE fire), setTarget/setPose, the
 * listener contract, and dispose.
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { ORBIT_EVENTS, POINTER_EVENTS, MOUSE_EVENTS } from '@core/tokens/events/dom.js'

const { bindOrbit } = await import('@core/utils/gpu/orbit-controller.js')

const fire = (el, type, init = {}) => {
  const e = new Event(type)

  Object.assign(e, init)
  el.dispatchEvent(e)

  return e
}

describe('orbit-controller', () => {
  let canvas

  beforeEach(() => {
    canvas = document.createElement('canvas')

    document.body.appendChild(canvas)
  })

  afterEach(() => {
    canvas.remove()
  })

  test('defaults: origin target, distance 10, idle pose, START/END listeners', () => {
    const ctl = bindOrbit(canvas)
    const seen = []

    ctl.addEventListener(ORBIT_EVENTS.START, () => seen.push('s'))
    ctl.addEventListener(ORBIT_EVENTS.END, () => seen.push('e'))
    ctl.addEventListener(ORBIT_EVENTS.CHANGE, () => seen.push('c'))

    expect(ctl.distance).toBe(10)
    expect(ctl.yaw).toBe(0)
    expect(ctl.pitch).toBe(0)

    // First update flushes the initial dirty latch — pose reported once.
    expect(ctl.update(1 / 60)).toBe(true)
    expect(ctl.update(1 / 60)).toBe(false)

    fire(canvas, POINTER_EVENTS.POINTERDOWN, { pointerId: 1, clientX: 5, clientY: 5 })

    expect(seen).toEqual(['c', 's'])

    fire(canvas, POINTER_EVENTS.POINTERUP, { pointerId: 1 })

    expect(seen).toEqual(['c', 's', 'e'])
  })

  test('drag rotates by rotateSpeed with pitch clamp and coalesced last-sample', () => {
    const ctl = bindOrbit(canvas, { rotateSpeed: 0.01, minPitch: -0.5, maxPitch: 0.5 })

    ctl.update(1 / 60)

    fire(canvas, POINTER_EVENTS.POINTERDOWN, { pointerId: 1, clientX: 0, clientY: 0 })

    const move = fire(canvas, POINTER_EVENTS.POINTERMOVE, {
      pointerId: 1,
      clientX: 100,
      clientY: 400,
    })

    // The controller consumes only the LAST coalesced sample.
    move.getCoalescedEvents = () => [
      { clientX: 20, clientY: 60 },
      { clientX: 50, clientY: 200 },
    ]

    fire(canvas, POINTER_EVENTS.POINTERMOVE, {
      pointerId: 1,
      clientX: 50,
      clientY: 200,
    })

    ctl.update(1)

    expect(ctl.yaw).toBeLessThan(0)
    expect(ctl.pitch).toBeLessThanOrEqual(0.5)
    expect(ctl.pitch).toBeGreaterThan(0)

    ctl.dispose()
  })

  test('an untracked pointermove/cancel is a no-op', () => {
    const ctl = bindOrbit(canvas)

    fire(canvas, POINTER_EVENTS.POINTERMOVE, { pointerId: 9, clientX: 1, clientY: 1 })
    fire(canvas, POINTER_EVENTS.POINTERCANCEL, { pointerId: 9 })

    expect(ctl.update(1 / 60)).toBe(true) // only the initial dirty latch
    expect(ctl.yaw).toBe(0)

    ctl.dispose()
  })

  test('pinch scales the distance around the captured baseline', () => {
    const ctl = bindOrbit(canvas, { distance: 100, minDistance: 1, maxDistance: 1000 })

    ctl.update(1 / 60)

    fire(canvas, POINTER_EVENTS.POINTERDOWN, { pointerId: 1, clientX: 0, clientY: 0 })
    fire(canvas, POINTER_EVENTS.POINTERDOWN, { pointerId: 2, clientX: 100, clientY: 0 })

    // Halve the span → distance doubles (clamped).
    fire(canvas, POINTER_EVENTS.POINTERMOVE, { pointerId: 2, clientX: 50, clientY: 0 })
    fire(canvas, POINTER_EVENTS.POINTERMOVE, { pointerId: 1, clientX: 0, clientY: 0 })

    ctl.update(1)

    expect(ctl.distance).toBeGreaterThan(150)
    expect(ctl.distance).toBeLessThanOrEqual(1000)

    // Releasing one pointer keeps dragging alive until the last lifts.
    const seen = []

    ctl.addEventListener(ORBIT_EVENTS.END, () => seen.push(1))
    fire(canvas, POINTER_EVENTS.POINTERUP, { pointerId: 1 })

    expect(seen).toEqual([])

    fire(canvas, POINTER_EVENTS.POINTERUP, { pointerId: 2 })

    expect(seen).toEqual([1])

    ctl.dispose()
  })

  test('wheel zooms exponentially and honors enableZoom + clamps', () => {
    const ctl = bindOrbit(canvas, { distance: 10, minDistance: 5, maxDistance: 20, zoomStep: 0.1 })

    ctl.update(1 / 60)

    fire(canvas, MOUSE_EVENTS.WHEEL, { deltaY: 10 })
    ctl.update(1)

    expect(ctl.distance).toBeLessThanOrEqual(20)
    expect(ctl.distance).toBeGreaterThan(10)

    fire(canvas, MOUSE_EVENTS.WHEEL, { deltaY: -100 })
    ctl.update(1)

    expect(ctl.distance).toBeGreaterThanOrEqual(5)

    const noZoom = bindOrbit(canvas, { enableZoom: false, distance: 10 })

    noZoom.update(1 / 60)
    fire(canvas, MOUSE_EVENTS.WHEEL, { deltaY: 50 })
    noZoom.update(1)

    expect(noZoom.distance).toBe(10)

    noZoom.dispose()
    ctl.dispose()
  })

  test('autoRotate advances the target only while idle', () => {
    const ctl = bindOrbit(canvas, { autoRotateSpeed: 1, damping: 1 })

    ctl.autoRotate = true
    ctl.update(1 / 60)

    const y0 = ctl.yaw

    ctl.update(1 / 60)

    expect(ctl.yaw).toBeGreaterThan(y0)

    // A captured pointer freezes the drift (OrbitControls semantics).
    fire(canvas, POINTER_EVENTS.POINTERDOWN, { pointerId: 1, clientX: 0, clientY: 0 })

    const y1 = ctl.yaw

    ctl.update(1 / 60)

    expect(ctl.yaw).toBeCloseTo(y1, 6)

    ctl.dispose()
  })

  test('damping converges at any frame rate and settles exactly', () => {
    const ctl = bindOrbit(canvas, { damping: 0.5, distance: 10 })

    ctl.update(1 / 60)

    fire(canvas, MOUSE_EVENTS.WHEEL, { deltaY: 300 })

    // Many small slices converge like one big slice.
    for (let i = 0; i < 240; i++) ctl.update(1 / 240)

    expect(ctl.distance).toBeGreaterThan(10)

    for (let i = 0; i < 2400; i++) ctl.update(1 / 240)

    expect(ctl.update(1 / 240)).toBe(false)

    ctl.dispose()
  })

  test('setTarget/setPose snap and flag the next update dirty', () => {
    const ctl = bindOrbit(canvas, { minDistance: 2, maxDistance: 8 })

    ctl.update(1 / 60)
    expect(ctl.update(1 / 60)).toBe(false)

    ctl.setTarget(3, 4, 5)

    expect(ctl.update(1 / 60)).toBe(true)
    expect(ctl.tx).toBe(3)
    expect(ctl.ty).toBe(4)
    expect(ctl.tz).toBe(5)

    ctl.setPose(100, 0.5, -9)

    expect(ctl.distance).toBe(8) // clamped to maxDistance
    expect(ctl.yaw).toBe(0.5)
    expect(ctl.pitch).toBeGreaterThanOrEqual(-Math.PI / 2)

    expect(ctl.getDistance()).toBe(8)

    ctl.dispose()
  })

  test('listener add/remove + dispose unbinds canvas listeners', () => {
    const ctl = bindOrbit(canvas)
    const seen = []
    const fn = () => seen.push(1)

    ctl.addEventListener(ORBIT_EVENTS.CHANGE, fn)
    ctl.addEventListener(ORBIT_EVENTS.CHANGE, fn) // Set dedupes
    ctl.update(1 / 60)

    expect(seen.length).toBe(1)

    ctl.removeEventListener(ORBIT_EVENTS.CHANGE, fn)
    ctl.setTarget(1, 1, 1)
    ctl.update(1 / 60)

    expect(seen.length).toBe(1)

    ctl.dispose()
    fire(canvas, POINTER_EVENTS.POINTERDOWN, { pointerId: 1, clientX: 0, clientY: 0 })

    expect(ctl.update(1 / 60)).toBe(false)
  })

  test('custom spec fields all apply', () => {
    const ctl = bindOrbit(canvas, {
      target: [1, 2, 3],
      distance: 50,
      yaw: 0.25,
      pitch: 0.4,
      autoRotateSpeed: 0,
      damping: 1,
      rotateSpeed: 0.02,
    })

    expect(ctl.tx).toBe(1)
    expect(ctl.distance).toBe(50)
    expect(ctl.yaw).toBe(0.25)
    expect(ctl.pitch).toBe(0.4)

    ctl.dispose()
  })
})
