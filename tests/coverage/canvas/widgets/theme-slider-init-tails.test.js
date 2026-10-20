/**
 * @file coverage/canvas/widgets/theme-slider-init-tails.test.js
 * @description Coverage tail for theme-slider/init.ts — the exported
 * boot/fallback functions driven with fake hosts: init's dead-canvas
 * and rect arms, tryWasm's pending/live/null-mount/canvas-swap/purged
 * arms, initRest's no-GL and GL arms, observeResize's RO callback
 * variants (plus applyBackingStore's wasm arm through it),
 * triggerFallback's animId/wrapper arms, and initWebGL's
 * null-gl/null-program/success/throw paths. Heavy deps (gl-program,
 * gl-lifecycle, webgl-pool, the widget bridge) are mocked.
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'

let mockGpu = true
let mountResult = null
let glResult = null
let builtResult = null
let glThrow = false
let capturedRoCb = null

const glProgram = {
  getWebGLContext: (_canvas, _attrs) => {
    if (glThrow) throw new Error('ctx')

    return glResult
  },
  createQuadProgram: () => builtResult,
  getUniforms: (gl, prog, names) =>
    Object.fromEntries(Object.keys(names).map((k) => [k, { loc: k }])),
  bindQuad: () => undefined,
}

jest.unstable_mockModule('@core/utils/canvas/gl-program.js', () => glProgram)
jest.unstable_mockModule('@core/utils/canvas/gl-lifecycle.js', () => ({
  releaseQuadGL: jest.fn(),
  watchContextLoss: (canvas, cb) => cb,
}))
jest.unstable_mockModule('@core/utils/canvas/webgl-pool.js', () => ({
  webglPool: { register: jest.fn(), unregister: jest.fn() },
}))
jest.unstable_mockModule('@core/utils/gpu/webgpu-widget.js', () => ({
  hasWebGpu: () => mockGpu,
  mountWebGpuWidget: async () => mountResult,
  warmWidgetArtifacts: () => undefined,
}))

const { init, tryWasm, initRest, triggerFallback, initWebGL } =
  await import('@core/utils/canvas/widgets/theme-slider/init.js')

const makeCanvas = (rect = { left: 0, top: 0, width: 280, height: 64 }) => ({
  getContext: () => null,
  getBoundingClientRect: () => rect,
  style: {},
  classList: { add: jest.fn(), remove: jest.fn() },
  closest: jest.fn(() => null),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  width: 0,
  height: 0,
})

const makeHost = (over = {}) => ({
  canvas: makeCanvas(),
  width: 280,
  height: 64,
  useWebGL: false,
  gl: null,
  ctx: null,
  animId: null,
  program: null,
  quadBuffer: null,
  aPos: 0,
  currentP: 1,
  targetP: 1,
  knobX: 0,
  rippleTime: -10,
  ripplePos: 0,
  startTime: 0,
  _wasm: null,
  _wasmPending: false,
  _wasmFailed: false,
  _purged: false,
  _onContextLost: null,
  _resizeObserver: null,
  _pToKnobX: () => 32,
  bindEvents: jest.fn(),
  animate: jest.fn(),
  _triggerFallback: jest.fn(),
  ...over,
})

class MockRO {
  constructor(cb) {
    capturedRoCb = cb
    this.observe = jest.fn()
    this.disconnect = jest.fn()
  }
}

beforeEach(() => {
  mockGpu = true
  mountResult = null
  glResult = null
  builtResult = null
  glThrow = false
  capturedRoCb = null
})

afterEach(() => {
  delete globalThis.ResizeObserver
})

describe('theme-slider init tail', () => {
  test('init bails to fallback on dead canvas and missing getContext', () => {
    const dead = makeHost({ canvas: null })

    init(dead)

    expect(dead._triggerFallback).toHaveBeenCalled()

    const noCtx = makeHost({
      canvas: { style: {}, classList: { add: jest.fn() }, closest: () => null },
    })

    init(noCtx)

    expect(noCtx._triggerFallback).toHaveBeenCalled()
  })

  test('init classic path measures the rect and binds events via initRest', () => {
    mockGpu = false
    glResult = { getAttribLocation: () => 3 }
    builtResult = { program: 'p', quadBuffer: 'b' }

    const host = makeHost()

    init(host)

    expect(host.width).toBe(280)
    expect(host.bindEvents).toHaveBeenCalled()
    expect(host.animate).toHaveBeenCalled()
    expect(host.useWebGL).toBe(true)
  })

  test('init skips the rect write under 50px and takes the wasm arm', () => {
    const host = makeHost()
    const narrow = makeHost({ canvas: makeCanvas({ left: 0, top: 0, width: 10, height: 64 }) })

    init(host)
    init(narrow)

    expect(host._wasmPending).toBe(true)
    expect(narrow.width).toBe(280) // getBoundingClientRect().width 10 < 50 → keeps 280

    host._wasmFailed = true
    glResult = null

    init(host)

    expect(host._triggerFallback).toHaveBeenCalled() // initRest → initWebGL → null gl → fallback
  })

  test('tryWasm early-returns when pending or live', async () => {
    const pending = makeHost({ _wasmPending: true })
    const live = makeHost({ _wasm: { widget: {}, destroy: jest.fn() } })

    tryWasm(pending)
    tryWasm(live)

    await Promise.resolve()

    expect(pending._wasm).toBeNull()
    expect(live._wasmPending).toBe(false)
  })

  test('tryWasm null mount marks failure and runs initRest', async () => {
    mountResult = null

    const host = makeHost()

    tryWasm(host)
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 10))

    expect(host._wasmFailed).toBe(true)
    expect(host._onContextLost).not.toBeNull()

    host._onContextLost()

    expect(host._triggerFallback).toHaveBeenCalled()
  })

  test('tryWasm null mount with a swapped canvas skips initRest', async () => {
    mountResult = null

    const host = makeHost()

    tryWasm(host)
    host.canvas = makeCanvas()
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 10))

    expect(host._wasmFailed).toBe(true)
    expect(host._onContextLost).toBeNull()
  })

  test('tryWasm purged host destroys the late handle', async () => {
    const destroy = jest.fn()

    mountResult = { canvas: null, widget: { set_size: jest.fn(), resize: jest.fn() }, destroy }

    const host = makeHost({ _purged: true })

    tryWasm(host)
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 10))

    expect(destroy).toHaveBeenCalled()
    expect(host._wasm).toBeNull()
  })

  test('tryWasm success sets sizes, binds events and animates', async () => {
    const widget = { set_size: jest.fn(), resize: jest.fn() }

    mountResult = { canvas: null, widget, destroy: jest.fn() }

    globalThis.ResizeObserver = MockRO

    const host = makeHost()

    tryWasm(host)
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 10))

    expect(host._wasm).not.toBeNull()
    expect(host.useWebGL).toBe(true)
    expect(widget.set_size).toHaveBeenCalledWith(280, 64)
    expect(host.bindEvents).toHaveBeenCalled()
    expect(host.animate).toHaveBeenCalled()
  })

  test('observeResize callback: big change resizes, small/empty is ignored', async () => {
    const widget = { set_size: jest.fn(), resize: jest.fn() }

    mountResult = { canvas: null, widget, destroy: jest.fn() }

    globalThis.ResizeObserver = MockRO

    const host = makeHost()

    tryWasm(host)
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 10))

    capturedRoCb([{ contentRect: { width: 400 } }])

    expect(host.width).toBe(400)
    expect(widget.set_size).toHaveBeenCalledWith(400, 64)
    expect(widget.resize).toHaveBeenCalled()

    capturedRoCb([{ contentRect: { width: 401 } }])

    expect(host.width).toBe(400)

    capturedRoCb([{ contentRect: { width: 20 } }])

    expect(host.width).toBe(400)
  })

  test('initRest falls back when GL is unavailable and completes on GL', () => {
    glResult = null

    const bad = makeHost()

    initRest(bad)

    expect(bad._triggerFallback).toHaveBeenCalled()

    glResult = { getAttribLocation: () => 3 }
    builtResult = { program: 'p', quadBuffer: 'b' }

    const good = makeHost()

    initRest(good)

    expect(good.bindEvents).toHaveBeenCalled()
    expect(good.animate).toHaveBeenCalled()
  })

  test('triggerFallback cancels rAF, releases GL and tags the wrapper', () => {
    const wrapper = { classList: { add: jest.fn(), remove: jest.fn() } }
    const canvas = makeCanvas()

    canvas.closest = () => wrapper

    const host = makeHost({ canvas, animId: 7, _onContextLost: () => {} })

    triggerFallback(host)

    expect(host.animId).toBe(7) // cancelAnimationFrame does not clear the field itself
    expect(host._onContextLost).toBeNull()
    expect(canvas.style.display).toBe('none')
    expect(canvas.classList.add).toHaveBeenCalledWith(STATE_CLASSES.IS_FALLBACK)
    expect(wrapper.classList.add).toHaveBeenCalledWith(STATE_CLASSES.HAS_FALLBACK)

    const bare = makeHost() // animId null + closest() → null: both else arms

    triggerFallback(bare)

    expect(bare.canvas.style.display).toBe('none')
    expect(bare._onContextLost).toBeNull()
  })

  test('backingDpr tolerates a missing window and a zero devicePixelRatio', () => {
    const host = makeHost()

    mockGpu = false

    const realWindow = globalThis.window

    delete globalThis.window

    init(host) // applyBackingStore → typeof window === 'undefined' → dpr 1

    globalThis.window = realWindow
    Object.defineProperty(realWindow, 'devicePixelRatio', { value: 0, configurable: true })

    const host2 = makeHost()

    init(host2) // 0 || 1 → dpr 1

    expect(host2._wasmFailed).toBeFalsy()
  })

  test('initWebGL: null gl, null program, success, and throw arms', () => {
    const a = makeHost()

    initWebGL(a)

    expect(a.useWebGL).toBe(false)

    glResult = { fake: 'gl' }
    builtResult = null

    const b = makeHost()

    initWebGL(b)

    expect(b.useWebGL).toBe(false)

    builtResult = { program: 'p', quadBuffer: 'b' }
    glResult = {
      getAttribLocation: () => 3,
    }

    const c = makeHost()

    initWebGL(c)

    expect(c.useWebGL).toBe(true)
    expect(c.uResolution).toEqual({ loc: 'u_resolution' })
    expect(c.aPos).toBe(3)

    glThrow = true

    const d = makeHost()

    initWebGL(d)

    expect(d.useWebGL).toBe(false)
  })
})
