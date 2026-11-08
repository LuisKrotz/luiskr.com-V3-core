/**
 * @file coverage/utils/gpu/ring-fill-tails.test.js
 * @description Coverage tail for utils/gpu/ring-fill.ts — the
 * route-search go-button conic ring-fill mount. Covers the capability
 * gates, the IO-deferred mount arms (null, dead-on-resolve, live),
 * the setProgress easing loop (fill + reverse-fill + settle), the
 * dirty/refresh resheet path, tile-count regrowth, and teardown.
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { framePool } from '@core/utils/motion/frame.js'

/** Mutable GPU-mock state — the webgpu-widget mock below reads these per-call,
 *  so tests steer capability/mount-result/call-count/latency branches. */
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

/** Short flush — widget mount/event steps settle within ~30ms. */
const flush = (ms = 30) => new Promise((r) => setTimeout(r, ms))

/** The recording fake widget. */
let widget = null

/** Widget harness — records the calls the binding layer forwards. */
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

describe('ring-fill mount', () => {
  let mountRingFill
  let container
  let sessions

  const makeTile = () => {
    const t = document.createElement('span')

    t.className = 'go'
    t.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 40,
      height: 40,
      right: 40,
      bottom: 40,
    })

    container.appendChild(t)

    return t
  }

  beforeEach(async () => {
    mockGpu = true
    mountResult = null
    mountCalls = []
    mountDelay = 0
    sessions = []

    container = document.createElement('div')
    document.body.appendChild(container)

    makeTile()
    makeTile()

    const mod = await import('@core/utils/gpu/ring-fill.js')

    mountRingFill = mod.mountRingFill
  })

  afterEach(() => {
    sessions.forEach((s) => s?.destroy())
    container.remove()
    delete navigator.gpu
  })

  const mount = () => {
    const s = mountRingFill(container, '.go', 'ring-canvas')

    if (s) sessions.push(s)

    return s
  }

  test('returns null without navigator.gpu or a null container', () => {
    mockGpu = false

    expect(mount()).toBeNull()
    expect(mountRingFill(null, '.go', 'c')).toBeNull()
    expect(container.querySelector('canvas')).toBeNull()
  })

  test('a failed mount removes the canvas and never mounts again', async () => {
    mountResult = null

    const s = mount()

    expect(s).not.toBeNull()

    await flush()

    expect(container.querySelector('canvas')).toBeNull()
    expect(mountCalls.length).toBe(1)
  })

  test('live mount pushes the per-button sheet + colors, drops fallback', async () => {
    makeWidget()
    mountResult = { canvas: null, widget, destroy: jest.fn() }

    mount()

    await flush()

    const canvas = container.querySelector('canvas')

    expect(canvas).not.toBeNull()
    expect(canvas.classList.contains('ring-canvas')).toBe(true)
    expect(canvas.classList.contains(STATE_CLASSES.IS_FALLBACK)).toBe(false)
    expect(widget.tiles.length).toBeGreaterThan(0)
    expect(widget.tiles[0].length).toBe(16) // 2 tiles × 8 f32s
    expect(widget.colors.length).toBeGreaterThan(0)
    expect(widget.resizes.length).toBeGreaterThan(0)
    expect(widget.frames.length).toBeGreaterThan(0)
  })

  test('setProgress eases a tile to filled over frames then stops the clock', async () => {
    makeWidget()
    mountResult = { canvas: null, widget, destroy: jest.fn() }

    const s = mount()

    await flush(50)

    const before = widget.tiles.length

    s.setProgress(1, 1)

    await flush(900)

    const sheets = widget.tiles.length

    expect(sheets).toBeGreaterThan(before)

    // Progress column (rec 1, offset 5 — [cx,cy,halfW,halfH,cornerR,…]).
    const last = widget.tiles[sheets - 1]

    expect(last[8 + 5]).toBe(1)

    // And once settled the clock idles — no further sheet uploads.
    await flush(60)
    expect(widget.tiles.length).toBe(sheets)
  })

  test('setProgress back to 0 sweeps the arc closed; out-of-range indices no-op', async () => {
    makeWidget()
    mountResult = { canvas: null, widget, destroy: jest.fn() }

    const s = mount()

    await flush(50)

    s.setProgress(99, 1) // beyond the tile sheet — guarded no-op
    s.setProgress(-1, 1)

    s.setProgress(0, 1)

    await flush(900)

    const afterUp = widget.tiles.length

    s.setProgress(0, 0)

    await flush(900)

    expect(widget.tiles.length).toBeGreaterThan(afterUp)

    const last = widget.tiles[widget.tiles.length - 1]

    expect(last[5]).toBe(0)
  })

  test('refresh before the mount resolves is a no-op', () => {
    mountDelay = 60

    const s = mount()

    s.refresh()

    expect(s).not.toBeNull()
  })

  test('destroy while the mount is in flight releases the late handle', async () => {
    makeWidget()
    mountResult = { canvas: null, widget, destroy: jest.fn() }
    mountDelay = 40

    const s = mount()

    await flush(25)

    expect(mountCalls.length).toBe(1)

    s.destroy()
    s.destroy() // guarded no-op

    await flush(80)

    expect(mountResult.destroy).toHaveBeenCalled()
    expect(container.querySelector('canvas')).toBeNull()
  })

  test('growing the tile list regrows the sheet on the next resheet', async () => {
    makeWidget()
    mountResult = { canvas: null, widget, destroy: jest.fn() }

    const s = mount()

    await flush(50)

    makeTile()

    s.refresh()

    await flush(50)

    const last = widget.tiles[widget.tiles.length - 1]

    expect(last.length).toBe(24) // 3 tiles × 8 f32s
  })

  test('document.hidden pauses progress animation; visibilitychange resumes', async () => {
    makeWidget()
    mountResult = { canvas: null, widget, destroy: jest.fn() }

    const s = mount()

    await flush(50)

    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    const n = widget.tiles.length

    s.setProgress(1, 1) // hidden → poke's !document.hidden arm parks the clock

    await flush(60)
    expect(widget.tiles.length).toBe(n)

    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    await flush(80)
    expect(widget.tiles.length).toBeGreaterThan(n)
  })

  test('no IntersectionObserver mounts directly', async () => {
    makeWidget()
    mountResult = { canvas: null, widget, destroy: jest.fn() }

    const io = globalThis.IntersectionObserver

    delete globalThis.IntersectionObserver

    mount()

    await flush()

    expect(widget.tiles.length).toBeGreaterThan(0)

    globalThis.IntersectionObserver = io
  })

  test('a frame() false stops the clock', async () => {
    makeWidget()

    let n = 0

    widget.frame = (dt) => {
      widget.frames.push(dt)

      return ++n < 2
    }

    mountResult = { canvas: null, widget, destroy: jest.fn() }

    const s = mount()

    await flush()

    s.setProgress(0, 1)

    await flush(80)

    const count = widget.frames.length

    await flush(60)
    expect(widget.frames.length).toBe(count)
  })

  test('a non-intersecting IO entry skips mount; a second intersect while pending dedupes', async () => {
    makeWidget()
    mountResult = { canvas: null, widget, destroy: jest.fn() }
    mountDelay = 40

    const ios = []
    const PrevIO = globalThis.IntersectionObserver

    globalThis.IntersectionObserver = class {
      constructor(cb) {
        this.cb = cb
        ios.push(this)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    mount()

    ios[0].cb([{ isIntersecting: false, target: container }])
    expect(mountCalls.length).toBe(0)

    ios[0].cb([{ isIntersecting: true, target: container }])
    ios[0].cb([{ isIntersecting: true, target: container }]) // pending arm

    await flush(80)
    expect(mountCalls.length).toBe(1)

    globalThis.IntersectionObserver = PrevIO
  })

  test('an empty tile selector sheets zero instances', async () => {
    makeWidget()
    mountResult = { canvas: null, widget, destroy: jest.fn() }

    const s = mountRingFill(container, '.not-a-go', 'ring-canvas')

    if (s) sessions.push(s)

    await flush()

    expect(widget.tiles.length).toBeGreaterThan(0)
    expect(widget.tiles[0].length).toBe(0)
  })

  test('prefers-reduced-motion leaves the SVG rings untouched', () => {
    const mm = window.matchMedia
    const q = { matches: true, media: '', addEventListener() {}, removeEventListener() {} }

    window.matchMedia = () => q

    expect(mount()).toBeNull()
    expect(container.querySelector('canvas')).toBeNull()

    window.matchMedia = mm
  })

  test('a stale tick after destroy early-returns and ResizeObserver + dpr=0 arms', async () => {
    makeWidget()
    mountResult = { canvas: null, widget, destroy: jest.fn() }

    const prevRO = globalThis.ResizeObserver

    globalThis.ResizeObserver = class {
      observe() {}
      disconnect() {}
    }

    window.devicePixelRatio = 0

    const tickCbs = []
    const reqSpy = jest.spyOn(framePool, 'request').mockImplementation((cb) => {
      tickCbs.push(cb)

      return tickCbs.length
    })
    const nowSpy = jest.spyOn(performance, 'now').mockReturnValue(0)

    const s = mount()

    await flush()

    s.setProgress(0, 1)

    expect(tickCbs.length).toBeGreaterThan(0)

    // First tick with last === 0 hits the `: 0` dt fallback arm.
    tickCbs[0](16)

    s.destroy()
    // Second tick after destroy hits the `!handle || dead` early-return arm.
    tickCbs[0](32)

    reqSpy.mockRestore()
    nowSpy.mockRestore()
    window.devicePixelRatio = 1
    globalThis.ResizeObserver = prevRO
  })
})
