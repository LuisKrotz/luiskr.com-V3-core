/**
 * @file coverage/utils/gpu/ring-sheen-tails.test.js
 * @description Coverage tail for utils/gpu/ring-sheen.ts — the
 * instanced tile border-sheen mount. Covers the capability gates,
 * the IO-deferred mount arms (null, dead-on-resolve, live), the
 * dirty/refresh + transition/resize resheet path, the rAF loop
 * early-outs, and teardown idempotency.
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { ANIMATION_EVENTS } from '@core/tokens/events/dom.js'

let mockGpu = false
let mountResult = null
let mountCalls = []
let mountDelay = 0

jest.unstable_mockModule('@core/utils/gpu/webgpu-widget.js', () => ({
  hasWebGpu: () => mockGpu,
  mountWebGpuWidget: async (...args) => {
    mountCalls.push(args)

    if (mountDelay) await new Promise((r) => setTimeout(r, mountDelay))

    return mountResult
  },
  warmWidgetArtifacts: () => undefined,
}))

const flush = (ms = 30) => new Promise((r) => setTimeout(r, ms))

/** The recording fake widget. */
let widget = null

const makeWidget = () => {
  widget = {
    frames: [],
    resizes: [],
    tiles: [],
    colors: [],
    resize: (w, h) => widget.resizes.push([w, h]),
    set_tiles: (v) => widget.tiles.push(v),
    set_colors: (...a) => widget.colors.push(a),
    frame: (dt) => {
      widget.frames.push(dt)

      return true
    },
  }

  return widget
}

describe('ring-sheen mount', () => {
  let mountRingSheen
  let container
  let tile
  let sessions

  beforeEach(async () => {
    mockGpu = true
    mountResult = null
    mountCalls = []
    mountDelay = 0
    sessions = []

    container = document.createElement('div')
    tile = document.createElement('div')

    tile.className = 'tile'

    container.appendChild(tile)
    document.body.appendChild(container)

    const mod = await import('@core/utils/gpu/ring-sheen.js')

    mountRingSheen = mod.mountRingSheen
  })

  afterEach(() => {
    sessions.forEach((s) => s?.destroy())
    container.remove()
    delete navigator.gpu
  })

  const mount = () => {
    const s = mountRingSheen(container, '.tile', 'ring-canvas')

    if (s) sessions.push(s)

    return s
  }

  test('returns null without navigator.gpu or a null container', () => {
    mockGpu = false

    expect(mount()).toBeNull()
    expect(mountRingSheen(null, '.tile', 'c')).toBeNull()
    expect(container.querySelector('canvas')).toBeNull()
  })

  test('a failed mount removes the canvas and never mounts again', async () => {
    mountResult = null

    const s = mount()

    expect(s).not.toBeNull()

    await flush()

    expect(container.querySelector('canvas')).toBeNull()
    expect(mountCalls.length).toBe(1)

    // refresh() after failure is a no-op — no second mount attempt.
    s.refresh()

    await flush()

    expect(mountCalls.length).toBe(1)
  })

  test('live mount pushes tiles + colors, drops fallback, ticks frames', async () => {
    makeWidget()
    mountResult = { canvas: null, widget, destroy: jest.fn() }

    mount()

    await flush()

    const canvas = container.querySelector('canvas')

    expect(canvas).not.toBeNull()
    expect(canvas.classList.contains('ring-canvas')).toBe(true)
    expect(canvas.classList.contains(STATE_CLASSES.IS_FALLBACK)).toBe(false)
    expect(widget.tiles.length).toBeGreaterThan(0)
    expect(widget.tiles[0].length).toBe(8)
    expect(widget.colors.length).toBeGreaterThan(0)
    expect(widget.resizes.length).toBeGreaterThan(0)

    await flush(60)

    expect(widget.frames.length).toBeGreaterThan(0)
  })

  test('transitionstart keeps the resheet flowing until transitionend', async () => {
    makeWidget()
    mountResult = { canvas: null, widget, destroy: jest.fn() }

    mount()

    await flush(60)

    const n = widget.tiles.length

    container.dispatchEvent(new Event(ANIMATION_EVENTS.TRANSITIONSTART))

    await flush(80)

    container.dispatchEvent(new Event(ANIMATION_EVENTS.TRANSITIONEND))

    expect(widget.tiles.length).toBeGreaterThan(n)
  })

  test('destroy while the mount is in flight releases the late handle', async () => {
    makeWidget()
    mountResult = { canvas: null, widget, destroy: jest.fn() }
    mountDelay = 40

    const s = mount()

    // Let the IO fire + the fetch start, then die before it resolves.
    await flush(25)

    expect(mountCalls.length).toBe(1)

    s.destroy()
    s.destroy() // guarded no-op

    await flush(80)

    expect(mountResult.destroy).toHaveBeenCalled()
    expect(container.querySelector('canvas')).toBeNull()
  })

  test('a frame() false stops the clock', async () => {
    makeWidget()

    let n = 0

    widget.frame = (dt) => {
      widget.frames.push(dt)

      return ++n < 2
    }

    mountResult = { canvas: null, widget, destroy: jest.fn() }

    mount()

    await flush(80)

    const count = widget.frames.length

    await flush(60)

    expect(widget.frames.length).toBe(count)
  })

  test('document.hidden pauses and visibilitychange resumes', async () => {
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
})
