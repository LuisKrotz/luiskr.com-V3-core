/**
 * @file coverage/canvas/widgets/switch-slider-render-tails.test.js
 * @description Coverage tail for switch-slider/render.ts — the spring
 * render path driven with fake hosts: renderStatic's WebGL/wasm/2D
 * branches, animate's reduced-motion and spring arms, renderWasm's
 * no-handle/set_state/dt arms, renderWebGL's delegation + guard and
 * full-draw path, and renderCanvas2D's paint call including the
 * `canvas?.width ?? 0` fallbacks. Heavy deps (gl-program, paint-2d,
 * the store) are mocked.
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals'

let reducedMotion = false
let paintCalls = []
let bindQuadCalls = []

jest.unstable_mockModule('@core/utils/canvas/gl-program.js', () => ({
  bindQuad: (...a) => bindQuadCalls.push(a),
}))
jest.unstable_mockModule('@core/utils/canvas/widgets/switch-slider/paint-2d.js', () => ({
  paintSwitchSlider2D: (...a) => paintCalls.push(a),
}))
jest.unstable_mockModule('@core/store.js', () => ({
  default: {
    getters: {
      getReducedMotion: () => reducedMotion,
    },
  },
}))

const { renderStatic, animate, renderWasm, renderWebGL, renderCanvas2D } =
  await import('@core/utils/canvas/widgets/switch-slider/render.js')

const makeGl = () => {
  const calls = []

  return {
    calls,
    COLOR_BUFFER_BIT: 0x4000,
    TRIANGLES: 0x0004,
    viewport: (...a) => calls.push(['viewport', ...a]),
    clearColor: (...a) => calls.push(['clearColor', ...a]),
    clear: (...a) => calls.push(['clear', ...a]),
    useProgram: (...a) => calls.push(['useProgram', ...a]),
    uniform2f: (...a) => calls.push(['uniform2f', ...a]),
    uniform1f: (...a) => calls.push(['uniform1f', ...a]),
    drawArrays: (...a) => calls.push(['drawArrays', ...a]),
  }
}

const makeHost = (over = {}) => ({
  canvas: { width: 108, height: 56 },
  dpr: 2,
  width: 54,
  height: 28,
  useWebGL: false,
  gl: null,
  ctx: null,
  animId: null,
  program: null,
  quadBuffer: null,
  aPos: 0,
  uResolution: null,
  uTime: null,
  uProgress: null,
  uKnobX: null,
  uContext: null,
  currentP: 0,
  targetP: 1,
  velP: 0,
  _animT: 0,
  knobX: 0,
  contextType: 'stats',
  startTime: 0,
  _wasm: null,
  _wasmT: 0,
  _pToKnobX: (p) => p * 26,
  _contextCode: () => 2,
  animate: jest.fn(),
  ...over,
})

beforeEach(() => {
  reducedMotion = false
  paintCalls = []
  bindQuadCalls = []
})

describe('switch-slider render tail', () => {
  test('renderStatic snaps to target and takes the WebGL arm on a live GL host', () => {
    const gl = makeGl()
    const host = makeHost({ useWebGL: true, gl, program: 'p', quadBuffer: 'b' })

    renderStatic(host)

    expect(host.currentP).toBe(1)
    expect(host.knobX).toBe(26)
    expect(gl.calls.length).toBeGreaterThan(0)
  })

  test('renderStatic takes the wasm arm when GL is null but _wasm is live', () => {
    const frame = jest.fn()
    const host = makeHost({
      useWebGL: true,
      _wasm: { widget: { frame, set_state: jest.fn() } },
    })

    renderStatic(host)

    expect(frame).toHaveBeenCalled()
  })

  test('renderStatic paints 2D when there is no GL backend and skips a bare host', () => {
    const host = makeHost({ ctx: { marker: 'ctx' } })

    renderStatic(host)

    expect(paintCalls.length).toBe(1)

    paintCalls = []

    renderStatic(makeHost())

    expect(paintCalls.length).toBe(0)
  })

  test('animate under reduced motion cancels a pending raf and renders statically', () => {
    reducedMotion = true

    const host = makeHost({
      animId: 7,
      useWebGL: true,
      gl: makeGl(),
      program: 'p',
      quadBuffer: 'b',
    })

    animate(host)

    expect(host.animId).toBeNull()
    expect(host.currentP).toBe(1)

    animate(makeHost()) // animId null arm
  })

  test('animate springs forward and draws on the armed backends', () => {
    const gl = makeGl()
    const host = makeHost({ useWebGL: true, gl, program: 'p', quadBuffer: 'b' })

    animate(host)

    expect(host.currentP).toBeCloseTo(0.0472, 4)
    expect(host.knobX).toBeCloseTo(host.currentP * 26, 5)
    expect(gl.calls.length).toBeGreaterThan(0)

    const flat = makeHost({ ctx: { c: 1 } })

    animate(flat)

    expect(paintCalls.length).toBe(1)

    paintCalls = []

    // useWebGL armed but GL-less: the _wasm operand and the ctx fallback.
    animate(makeHost({ useWebGL: true, _wasm: { widget: { frame: jest.fn() } } }))
    animate(makeHost({ useWebGL: true, ctx: { c: 1 } }))

    expect(paintCalls.length).toBe(1)

    paintCalls = []

    animate(makeHost())

    expect(paintCalls.length).toBe(0)

    // A synchronous rAF runs the schedule arrow — the loop's next-frame hook.
    const prevRaf = globalThis.requestAnimationFrame

    globalThis.requestAnimationFrame = (cb) => {
      cb()

      return 1
    }

    const bare = makeHost()

    animate(bare)

    expect(bare.animate).toHaveBeenCalled()

    globalThis.requestAnimationFrame = prevRaf
  })

  test('animate overshoots the target then settles — the elastic snap', () => {
    const host = makeHost()
    let maxP = 0

    // Pump ~45 frames at 16.7ms each — enough for the ζ≈0.72 snap spring
    // to cross the target and settle (settle time ≈ 0.43s).
    for (let i = 0; i < 45; i++) {
      host._animT = performance.now() - 16.7

      animate(host)

      if (host.currentP > maxP) maxP = host.currentP
    }

    expect(maxP).toBeGreaterThan(1.01)
    expect(host.currentP).toBe(1)
    expect(host.velP).toBe(0)
  })

  test('a suspended frame clamps dt instead of exploding the spring', () => {
    const host = makeHost()

    host._animT = performance.now() - 10000

    animate(host)

    // dt clamped to 50ms: v = 170·0.05 = 8.5, p = 8.5·0.05 = 0.425.
    expect(host.currentP).toBeCloseTo(0.425, 4)
  })

  test('renderWasm no-ops without a handle and measures dt deltas', () => {
    const host = makeHost()

    renderWasm(host, 100)

    expect(host._wasmT).toBe(0)

    const frame = jest.fn()
    const set_state = jest.fn()

    host._wasm = { widget: { frame, set_state } }
    renderWasm(host, 1000)

    expect(set_state).toHaveBeenCalledWith(host.currentP, host.knobX, 2)
    expect(frame).toHaveBeenCalledWith(1)
    expect(host._wasmT).toBe(1)

    renderWasm(host, 1500)

    expect(frame).toHaveBeenLastCalledWith(0.5)

    // A widget without set_state takes the optional-call skip arm.
    const sparse = makeHost({ _wasm: { widget: { frame: jest.fn() } } })

    renderWasm(sparse, 10)
  })

  test('renderWebGL delegates to wasm and guards missing GL pieces', () => {
    const frame = jest.fn()

    renderWebGL(makeHost({ _wasm: { widget: { frame } } }), 50)

    expect(frame).toHaveBeenCalled()

    const guarded = makeHost()

    renderWebGL(guarded, 50)

    guarded.gl = makeGl()
    renderWebGL(guarded, 50)

    guarded.program = 'p'
    renderWebGL(guarded, 50)

    guarded.quadBuffer = 'b'
    renderWebGL(guarded, 50)

    expect(guarded.gl.calls.length).toBe(10)
  })

  test('renderWebGL pushes every uniform on the full draw path', () => {
    const gl = makeGl()
    const host = makeHost({
      useWebGL: true,
      gl,
      program: 'p',
      quadBuffer: 'b',
      uResolution: 'ur',
      uTime: 'ut',
      uProgress: 'up',
      uKnobX: 'uk',
      uContext: 'uc',
    })

    renderWebGL(host, 1000)

    expect(gl.calls.map((c) => c[0])).toEqual([
      'viewport',
      'clearColor',
      'clear',
      'useProgram',
      'uniform2f',
      'uniform1f',
      'uniform1f',
      'uniform1f',
      'uniform1f',
      'drawArrays',
    ])
    expect(bindQuadCalls.length).toBe(1)
  })

  test('renderCanvas2D forwards the paint config, tolerating a null canvas', () => {
    const host = makeHost({ ctx: { c: 1 }, currentP: 0.5, knobX: 13, startTime: 7 })

    renderCanvas2D(host, 20)

    expect(paintCalls.length).toBe(1)
    expect(paintCalls[0][1].canvasWidth).toBe(108)
    expect(paintCalls[0][1].contextType).toBe('stats')

    renderCanvas2D(makeHost({ ctx: { c: 1 }, canvas: null }), 20)

    expect(paintCalls[1][1].canvasWidth).toBe(0)
    expect(paintCalls[1][1].canvasHeight).toBe(0)
  })
})
