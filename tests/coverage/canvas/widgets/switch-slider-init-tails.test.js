/**
 * @file coverage/canvas/widgets/switch-slider-init-tails.test.js
 * @description Coverage tail for switch-slider/init.ts — the exported
 * boot/fallback functions driven with fake hosts: init's dead-canvas
 * and wasm/classic arms, tryWasm's pending/live/null-mount/canvas-swap/
 * purged arms, initRest's 2D-fallback chain (throwing + null ctx) and
 * context-loss callback, triggerFallback's animId arm, backingDpr's
 * window/dpr arms, and initWebGL's null-gl/null-program/success/throw
 * paths. Heavy deps (gl-program, gl-lifecycle, webgl-pool, the widget
 * bridge) are mocked.
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'

let mockGpu = true
let mountResult = null
let glResult = null
let builtResult = null
let glThrow = false

const glProgram = {
  getWebGLContext: () => {
    if (glThrow) throw new Error('ctx')

    return glResult
  },
  createQuadProgram: (gl, vs, fs, name, opts) => {
    opts?.warn?.('vertex', 'info')
    opts?.warn?.('Link', 'info')

    return builtResult
  },
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
  await import('@core/utils/canvas/widgets/switch-slider/init.js')

const makeCanvas = () => ({
  getContext: () => null,
  style: {},
  classList: { add: jest.fn(), remove: jest.fn() },
  width: 0,
  height: 0,
})

const makeHost = (over = {}) => ({
  canvas: makeCanvas(),
  dpr: 0,
  width: 54,
  height: 28,
  useWebGL: false,
  gl: null,
  ctx: null,
  animId: null,
  program: null,
  quadBuffer: null,
  aPos: 0,
  _wasm: null,
  _wasmPending: false,
  _wasmFailed: false,
  _purged: false,
  _onContextLost: null,
  bindEvents: jest.fn(),
  animate: jest.fn(),
  ...over,
})

const flush = () => new Promise((r) => setTimeout(r, 20))

beforeEach(() => {
  mockGpu = true
  mountResult = null
  glResult = null
  builtResult = null
  glThrow = false
})

describe('switch-slider init tail', () => {
  test('init falls back on a dead canvas and on a missing getContext', () => {
    const dead = makeHost({ canvas: null })

    // !host.canvas → triggerFallback, which then dereferences the dead canvas.
    expect(() => init(dead)).toThrow()

    const noCtx = makeHost({ canvas: { style: {}, classList: { add: jest.fn() } } })

    init(noCtx)

    expect(noCtx.canvas.classList.add).toHaveBeenCalledWith(STATE_CLASSES.IS_FALLBACK)
  })

  test('init classic path sizes the backing store and runs initRest', () => {
    mockGpu = false
    glResult = { getAttribLocation: () => 3 }
    builtResult = { program: 'p', quadBuffer: 'b' }

    const host = makeHost()

    init(host)

    expect(host.dpr).toBe(2) // clamp(dpr, 2, 3) floor
    expect(host.canvas.width).toBe(108)
    expect(host.canvas.style.width).toBe('54px')
    expect(host.bindEvents).toHaveBeenCalled()
    expect(host.animate).toHaveBeenCalled()
    expect(host.useWebGL).toBe(true)
  })

  test('init takes the wasm arm and initRest runs again after a failure', () => {
    const host = makeHost()

    init(host)

    expect(host._wasmPending).toBe(true)

    host._wasmFailed = true
    glResult = null

    init(host) // _wasmFailed skips the wasm arm → initRest → 2D fallback probe

    expect(host.canvas.classList.add).toHaveBeenCalledWith(STATE_CLASSES.IS_FALLBACK)
  })

  test('backingDpr tolerates a missing window and a zero devicePixelRatio', () => {
    const host = makeHost()
    const realWindow = globalThis.window

    delete globalThis.window
    init(host) // typeof window undefined → dpr 1 → clamped to 2

    globalThis.window = realWindow

    const prev = realWindow.devicePixelRatio

    Object.defineProperty(realWindow, 'devicePixelRatio', { value: 0, configurable: true })

    const host2 = makeHost()

    init(host2) // 0 || 1 → 1 → clamped to 2
    Object.defineProperty(realWindow, 'devicePixelRatio', { value: prev, configurable: true })
  })

  test('tryWasm early-returns when pending or live', async () => {
    tryWasm(makeHost({ _wasmPending: true }))
    tryWasm(makeHost({ _wasm: { widget: {}, destroy: jest.fn() } }))

    await Promise.resolve()
  })

  test('tryWasm null mount marks failure and reruns initRest; swap skips it', async () => {
    glResult = { getAttribLocation: () => 3 }
    builtResult = { program: 'p', quadBuffer: 'b' }

    const host = makeHost()

    tryWasm(host)
    await flush()

    expect(host._wasmFailed).toBe(true)
    expect(host.bindEvents).toHaveBeenCalled()

    const swapped = makeHost()

    tryWasm(swapped)
    swapped.canvas = makeCanvas()
    await flush()

    expect(swapped._wasmFailed).toBe(true)
    expect(swapped.bindEvents).not.toHaveBeenCalled()
  })

  test('tryWasm purged host destroys the late handle; success wires sizes + loop', async () => {
    const destroy = jest.fn()

    mountResult = { canvas: null, widget: { set_size: jest.fn(), resize: jest.fn() }, destroy }

    const purged = makeHost({ _purged: true })

    tryWasm(purged)
    await flush()

    expect(destroy).toHaveBeenCalled()
    expect(purged._wasm).toBeNull()

    const widget = { set_size: jest.fn(), resize: jest.fn() }

    mountResult = { canvas: null, widget, destroy: jest.fn() }

    const host = makeHost()

    tryWasm(host)
    await flush()

    expect(host._wasm).not.toBeNull()
    expect(host.useWebGL).toBe(true)
    expect(widget.set_size).toHaveBeenCalledWith(54, 28)
    expect(widget.resize).toHaveBeenCalled()
    expect(host.bindEvents).toHaveBeenCalled()
    expect(host.animate).toHaveBeenCalled()
  })

  test('initRest falls back when 2D context acquisition throws or returns null', () => {
    glResult = null

    const throwing = makeHost()

    throwing.canvas.getContext = () => {
      throw new Error('2d')
    }
    initRest(throwing)

    expect(throwing.canvas.classList.add).toHaveBeenCalledWith(STATE_CLASSES.IS_FALLBACK)

    const nullCtx = makeHost()

    initRest(nullCtx) // getContext returns null → second fallback arm

    expect(nullCtx.canvas.classList.add).toHaveBeenCalledWith(STATE_CLASSES.IS_FALLBACK)

    const live = makeHost({ canvas: makeCanvas() })

    live.canvas.getContext = () => ({ c: 1 })
    initRest(live)

    expect(live.ctx).not.toBeNull()
    expect(live.bindEvents).toHaveBeenCalled()

    live._onContextLost() // watchContextLoss's () => triggerFallback(host) arrow

    expect(live.canvas.classList.add).toHaveBeenCalledWith(STATE_CLASSES.IS_FALLBACK)
  })

  test('triggerFallback cancels a pending raf and tags the canvas', () => {
    const host = makeHost({ animId: 7 })

    triggerFallback(host)

    expect(host.useWebGL).toBe(false)
    expect(host._onContextLost).toBeNull()
    expect(host.canvas.style.display).toBe('none')
  })

  test('initWebGL: null gl, null program, success, and throw arms', () => {
    const a = makeHost()

    initWebGL(a)

    expect(a.useWebGL).toBe(false)

    glResult = { fake: 'gl' }
    builtResult = null
    initWebGL(a)

    expect(a.useWebGL).toBe(false)

    builtResult = { program: 'p', quadBuffer: 'b' }
    glResult = { getAttribLocation: () => 3 }
    initWebGL(a)

    expect(a.useWebGL).toBe(true)
    expect(a.uResolution).toEqual({ loc: 'u_resolution' })
    expect(a.aPos).toBe(3)

    glThrow = true

    const d = makeHost()

    initWebGL(d)

    expect(d.useWebGL).toBe(false)
  })
})
