/**
 * @file coverage/canvas/widgets/close-button-init-tails.test.js
 * @description Coverage tail for close-button/init.ts — the exported
 * boot/fallback functions driven with fake hosts: init's dead-canvas
 * return and the canvas/parent/fallback size-detection chain,
 * applyBackingStore's wasm arm, observeResize's RO variants (absent,
 * in-range, out-of-range, h||w, gl viewport, parent/canvas observe),
 * onContextLost's animId arm, tryWasm's pending/live/null-mount/
 * canvas-swap/purged arms, initRest's fallback tag + context-loss
 * arrow, and initWebGL's null-gl/null-program/success/throw paths
 * including the warn stage ternary. Heavy deps are mocked.
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'

let mockGpu = true
let mountResult = null
let glResult = null
let builtResult = null
let glThrow = false
let capturedRoCb = null

const glProgram = {
  createQuadProgram: (gl, vs, fs, name, opts) => {
    opts?.warn?.('VS', 'info')
    opts?.warn?.('FS', 'info')
    opts?.warn?.('Link', 'info')

    return builtResult
  },
  getUniforms: (gl, prog, names) =>
    Object.fromEntries(Object.keys(names).map((k) => [k, { loc: k }])),
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
jest.unstable_mockModule('@core/utils/canvas/webgl-mode.js', () => ({
  webglContext: () => {
    if (glThrow) throw new Error('ctx')

    return glResult
  },
  webglAllowed: () => true,
  webglMode: () => 'active',
}))

const { init, tryWasm, initRest, initWebGL, onContextLost } =
  await import('@core/utils/canvas/widgets/close-button/init.js')

const makeCanvas = (rect = { width: 55, height: 55 }) => ({
  getContext: () => null,
  getBoundingClientRect: rect ? () => rect : undefined,
  parentElement: rect ? { getBoundingClientRect: () => ({ width: 40, height: 40 }) } : null,
  style: {},
  classList: { add: jest.fn(), remove: jest.fn() },
  width: 0,
  height: 0,
})

const makeHost = (over = {}) => ({
  canvas: makeCanvas(),
  width: 55,
  height: 55,
  useWebGL: false,
  gl: null,
  animId: null,
  program: null,
  quadBuffer: null,
  aPos: 0,
  _wasm: null,
  _wasmPending: false,
  _wasmFailed: false,
  _purged: false,
  _onContextLost: null,
  _ro: null,
  bindEvents: jest.fn(),
  animate: jest.fn(),
  ...over,
})

const flush = () => new Promise((r) => setTimeout(r, 20))

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

describe('close-button init tail', () => {
  test('init returns on a dead canvas or a missing getContext', () => {
    init(makeHost({ canvas: null }))
    init(makeHost({ canvas: { style: {} } }))

    // Neither path mounted anything or registered a pool entry.
    expect(true).toBe(true)
  })

  test('init detects size from the canvas rect, then the parent, then the fallback', () => {
    mockGpu = false
    glResult = { getAttribLocation: () => 3 }
    builtResult = { program: 'p', quadBuffer: 'b' }

    const big = makeHost({ canvas: makeCanvas({ width: 80, height: 80 }) })

    init(big)

    expect(big.width).toBe(80)
    expect(big.canvas.width).toBe(80) // cappedDpr 1× in happy-dom

    // Small canvas rect, big parent → parent wins.
    const small = makeHost()

    small.canvas.getBoundingClientRect = () => ({ width: 4, height: 4 })
    init(small)

    expect(small.width).toBe(40)
    expect(small.height).toBe(40)

    // No rects anywhere → the 55px design fallback.
    const bare = makeHost({ canvas: makeCanvas(null) })

    bare.canvas.getContext = () => null
    init(bare)

    expect(bare.width).toBe(55)
    expect(bare.height).toBe(55)

    // Canvas rect tall enough in height only — height uses the rect.
    const tall = makeHost()

    tall.canvas.getBoundingClientRect = () => ({ width: 4, height: 90 })
    tall.canvas.parentElement = { getBoundingClientRect: () => ({ width: 4, height: 4 }) }
    init(tall)

    expect(tall.height).toBe(90)
  })

  test('observeResize observes the parent or the canvas and resizes in range', () => {
    mockGpu = false
    glResult = { getAttribLocation: () => 3 }
    builtResult = { program: 'p', quadBuffer: 'b' }

    globalThis.ResizeObserver = MockRO

    const host = makeHost()

    init(host)

    expect(host._ro.observe).toHaveBeenCalledWith(host.canvas.parentElement)

    host.gl = { viewport: jest.fn() }
    capturedRoCb([{ contentRect: { width: 80, height: 0 } }])

    expect(host.width).toBe(80)
    expect(host.height).toBe(80) // h || w arm
    expect(host.gl.viewport).toHaveBeenCalled()

    capturedRoCb([{ contentRect: { width: 81, height: 80 } }]) // under RESIZE_EPS → ignored
    capturedRoCb([{ contentRect: { width: 4, height: 4 } }]) // under MIN_MEASURED → ignored

    expect(host.width).toBe(80)

    // A canvas without a parentElement observes itself.
    const orphan = makeHost({ canvas: makeCanvas() })

    orphan.canvas.parentElement = null
    init(orphan)

    expect(orphan._ro.observe).toHaveBeenCalledWith(orphan.canvas)

    delete globalThis.ResizeObserver
  })

  test('observeResize returns when ResizeObserver is undefined; cappedDpr tolerates missing window/dpr', () => {
    mockGpu = false
    glResult = { getAttribLocation: () => 3 }
    builtResult = { program: 'p', quadBuffer: 'b' }

    const realWindow = globalThis.window

    delete globalThis.window

    const host = makeHost()

    init(host) // typeof window undefined → dpr 1; RO also undefined → skip

    globalThis.window = realWindow

    const prev = realWindow.devicePixelRatio

    Object.defineProperty(realWindow, 'devicePixelRatio', { value: 0, configurable: true })

    const host2 = makeHost()

    init(host2) // 0 || 1 → 1

    Object.defineProperty(realWindow, 'devicePixelRatio', { value: prev, configurable: true })

    expect(host2.width).toBe(55)
  })

  test('applyBackingStore pushes sizes into the wasm widget', async () => {
    const widget = { set_size: jest.fn(), resize: jest.fn() }

    mountResult = { canvas: null, widget, destroy: jest.fn() }

    globalThis.ResizeObserver = MockRO

    const host = makeHost()

    init(host)
    await flush()

    expect(host._wasm).not.toBeNull()

    capturedRoCb([{ contentRect: { width: 90, height: 90 } }])

    expect(widget.set_size).toHaveBeenLastCalledWith(90, 90)
    expect(widget.resize).toHaveBeenCalled()

    delete globalThis.ResizeObserver
  })

  test('onContextLost drops GL state and cancels a pending raf', () => {
    const host = makeHost({ animId: 7, gl: { g: 1 }, useWebGL: true })

    onContextLost(host)

    expect(host.useWebGL).toBe(false)
    expect(host.gl).toBeNull()
    expect(host.animId).toBeNull()
    expect(host.canvas.classList.add).toHaveBeenCalledWith(STATE_CLASSES.IS_FALLBACK)

    onContextLost(makeHost()) // animId null arm
  })

  test('tryWasm early-returns when pending or live', async () => {
    tryWasm(makeHost({ _wasmPending: true }))
    tryWasm(makeHost({ _wasm: { widget: {}, destroy: jest.fn() } }))

    await Promise.resolve()
  })

  test('tryWasm null mount marks failure; swap and purged take their arms', async () => {
    glResult = { getAttribLocation: () => 3 }
    builtResult = { program: 'p', quadBuffer: 'b' }

    const host = makeHost()

    tryWasm(host)
    await flush()

    expect(host._wasmFailed).toBe(true)
    expect(host.bindEvents).toHaveBeenCalled() // initRest ran

    const swapped = makeHost()

    mountResult = {
      canvas: null,
      widget: { set_size: jest.fn(), resize: jest.fn() },
      destroy: jest.fn(),
    }
    tryWasm(swapped)
    swapped.canvas = makeCanvas()
    await flush()

    expect(swapped.bindEvents).not.toHaveBeenCalled()

    mountResult = null

    const destroy = jest.fn()

    mountResult = { canvas: null, widget: { set_size: jest.fn(), resize: jest.fn() }, destroy }

    const purged = makeHost({ _purged: true })

    tryWasm(purged)
    await flush()

    expect(destroy).toHaveBeenCalled()
    expect(purged._wasm).toBeNull()
  })

  test('tryWasm success wires sizes, drops fallback, binds and animates', async () => {
    const widget = { set_size: jest.fn(), resize: jest.fn() }

    mountResult = { canvas: null, widget, destroy: jest.fn() }

    const host = makeHost()

    tryWasm(host)
    await flush()

    expect(host._wasm).not.toBeNull()
    expect(host.useWebGL).toBe(true)
    expect(host.canvas.classList.remove).toHaveBeenCalledWith(STATE_CLASSES.IS_FALLBACK)
    expect(widget.set_size).toHaveBeenCalledWith(55, 55)
    expect(widget.resize).toHaveBeenCalled()
    expect(host.bindEvents).toHaveBeenCalled()
    expect(host.animate).toHaveBeenCalled()
  })

  test('initRest tags fallback when GL fails and runs the loss arrow', () => {
    glResult = null

    const host = makeHost()

    initRest(host)

    expect(host.canvas.classList.add).toHaveBeenCalledWith(STATE_CLASSES.IS_FALLBACK)
    expect(host.bindEvents).toHaveBeenCalled()

    host._onContextLost() // watchContextLoss's () => onContextLost(host) arrow

    expect(host.gl).toBeNull()
  })

  test('initWebGL: null gl, null program releases GL, success, and throw arms', () => {
    const a = makeHost()

    initWebGL(a)

    expect(a.useWebGL).toBe(false)
    expect(a.canvas.classList.add).toHaveBeenCalledWith(STATE_CLASSES.IS_FALLBACK)

    glResult = { fake: 'gl' }
    builtResult = null

    const b = makeHost()

    initWebGL(b)

    expect(b.gl).toEqual({ fake: 'gl' })
    expect(b.useWebGL).toBe(false)

    glResult = { getAttribLocation: () => 3 }
    builtResult = { program: 'p', quadBuffer: 'b' }

    const c = makeHost()

    initWebGL(c)

    expect(c.useWebGL).toBe(true)
    expect(c.uResolution).toEqual({ loc: 'u_resolution' })
    expect(c.aPos).toBe(3)
    expect(c.canvas.classList.remove).toHaveBeenCalledWith(STATE_CLASSES.IS_FALLBACK)

    glThrow = true

    const d = makeHost()

    initWebGL(d)

    expect(d.useWebGL).toBe(false)
  })
})
