/**
 * @file coverage/utils/gpu/divider-sheen-tails.test.js
 * @description Coverage tail for utils/gpu/divider-sheen.ts — the
 * WebGPU mount for the footer divider sheen. Covers the capability
 * gates, the IO-deferred mount arms (null handle, dead-on-resolve,
 * live), the visibility/resize listeners, the pump/stop loop, and the
 * teardown idempotency.
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'

let mockGpu = false
let mountResult = null
let mountCalls = []

jest.unstable_mockModule('@core/utils/gpu/webgpu-widget.js', () => ({
  hasWebGpu: () => mockGpu,
  mountWebGpuWidget: async (...args) => {
    mountCalls.push(args)

    return mountResult
  },
  warmWidgetArtifacts: () => undefined,
}))

const flush = (ms = 30) => new Promise((r) => setTimeout(r, ms))

/** Records the fake widget's setter calls. */
let widget = null

const makeWidget = () => {
  widget = {
    frames: [],
    resizes: [],
    colors: [],
    resize: (w, h) => widget.resizes.push([w, h]),
    set_colors: (...a) => widget.colors.push(a),
    frame: (dt) => {
      widget.frames.push(dt)

      return true
    },
  }

  return widget
}

describe('divider-sheen mount', () => {
  let mountDividerSheen
  let hr
  let cleanups

  beforeEach(async () => {
    mockGpu = true
    mountResult = null
    mountCalls = []
    cleanups = []

    hr = document.createElement('hr')

    document.body.appendChild(hr)

    const mod = await import('@core/utils/gpu/divider-sheen.js')

    mountDividerSheen = mod.mountDividerSheen
  })

  afterEach(() => {
    cleanups.forEach((fn) => fn())
    hr.remove()
    delete navigator.gpu
  })

  const mount = (target = hr, cls = 'div-canvas') => {
    const td = mountDividerSheen(target, cls)

    cleanups.push(td)

    return td
  }

  test('no-ops without navigator.gpu or a null element', () => {
    mockGpu = false

    expect(mount(hr, 'x')).not.toThrow()

    expect(mountDividerSheen(null, 'x')).toBeInstanceOf(Function)
    expect(hr.parentElement.querySelector('canvas')).toBeNull()
  })

  test('mount failure keeps the is-fallback canvas removed and marks failed', async () => {
    mountResult = null

    mount()

    await flush()

    const canvas = hr.parentElement.querySelector('canvas')

    expect(canvas).toBeNull()
    expect(mountCalls.length).toBe(1)
  })

  test('live mount mirrors the box, pushes colors, drops fallback, ticks frames', async () => {
    makeWidget()
    mountResult = { canvas: null, widget, destroy: jest.fn() }

    Object.defineProperty(hr, 'offsetWidth', { value: 120, configurable: true })
    Object.defineProperty(hr, 'offsetHeight', { value: 2, configurable: true })

    mount()

    await flush()

    const canvas = hr.parentElement.querySelector('canvas')

    expect(canvas).not.toBeNull()
    expect(canvas.classList.contains(STATE_CLASSES.IS_FALLBACK)).toBe(false)
    expect(canvas.style.position).toBe('absolute')
    expect(widget.resizes.length).toBeGreaterThan(0)

    await flush(60)

    expect(widget.frames.length).toBeGreaterThan(0)
  })

  test('a teardown before the deferred mount resolves destroys the late handle', async () => {
    makeWidget()
    mountResult = { canvas: null, widget, destroy: jest.fn() }

    const td = mountDividerSheen(hr, 'div-canvas')

    // Dead before the ~10ms IO fires — the still-arriving handle takes
    // the dead-arm (destroy + canvas drop) instead of going live.
    td()
    td() // second call is a guarded no-op

    await flush(80)

    expect(mountCalls.length).toBe(1)
    expect(mountResult.destroy).toHaveBeenCalled()
    expect(hr.parentElement.querySelector('canvas')).toBeNull()
  })

  test('a frame() false disarms the loop permanently', async () => {
    makeWidget()

    let dead = false

    widget.frame = (dt) => {
      widget.frames.push(dt)

      if (dead) return false

      dead = true

      return true
    }

    mountResult = { canvas: null, widget, destroy: jest.fn() }

    mount()

    await flush(80)

    const n = widget.frames.length

    expect(n).toBeGreaterThan(0)

    await flush(60)

    // The loop stopped at the first false — no unbounded growth.
    expect(widget.frames.length).toBeLessThanOrEqual(n + 1)
  })

  test('visibilitychange hidden pauses the loop', async () => {
    makeWidget()
    mountResult = { canvas: null, widget, destroy: jest.fn() }

    mount()

    await flush(60)

    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    const n = widget.frames.length

    await flush(60)

    expect(widget.frames.length - n).toBeLessThanOrEqual(1)

    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    await flush(60)

    expect(widget.frames.length).toBeGreaterThan(n)
  })

  test('resolved CSS vars push the hairline + band colors', async () => {
    makeWidget()
    mountResult = { canvas: null, widget, destroy: jest.fn() }

    const gcs = globalThis.getComputedStyle

    globalThis.getComputedStyle = () => ({
      getPropertyValue: () => 'rgb(10, 20, 30)',
      borderRadius: '0px',
    })

    mount()

    await flush()

    globalThis.getComputedStyle = gcs

    expect(widget.colors.length).toBe(1)
    expect(widget.colors[0].length).toBe(8)
  })

  test('an IO exit stops the loop — live raf and idle arms', async () => {
    makeWidget()
    mountResult = { canvas: null, widget, destroy: jest.fn() }

    const ios = []
    const PrevIO = globalThis.IntersectionObserver

    globalThis.IntersectionObserver = class {
      constructor(cb) {
        this.cb = cb
        ios.push(this)
      }
      observe() {}
      disconnect() {}
    }

    mount()

    // IO exit while the mount is still in flight — raf is 0.
    ios[0].cb([{ isIntersecting: false, target: hr }])
    ios[0].cb([{ isIntersecting: true, target: hr }])
    // A visible re-entry while the mount is pending — the `m.visible`
    // else-if arm runs pumpDivider, which early-returns on `!m.handle`.
    ios[0].cb([{ isIntersecting: true, target: hr }])

    await flush(60)

    expect(widget.frames.length).toBeGreaterThan(0)

    // A visible-page event while the loop ticks — pumpDivider's raf guard.
    document.dispatchEvent(new Event('visibilitychange'))

    // IO exit with the loop ticking — cancelAnimationFrame arm.
    ios[0].cb([{ isIntersecting: false, target: hr }])

    const n = widget.frames.length

    await flush(60)

    expect(widget.frames.length - n).toBeLessThanOrEqual(1)

    globalThis.IntersectionObserver = PrevIO
  })

  test('window resize re-mirrors the box once live', async () => {
    makeWidget()
    mountResult = { canvas: null, widget, destroy: jest.fn() }

    Object.defineProperty(hr, 'offsetWidth', { value: 200, configurable: true })

    mount()

    window.dispatchEvent(new Event('resize')) // handle still null → onResize's guard arm

    await flush()

    const before = widget.resizes.length

    window.dispatchEvent(new Event('resize'))

    expect(widget.resizes.length).toBe(before + 1)
  })
})
