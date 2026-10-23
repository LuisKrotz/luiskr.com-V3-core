/**
 * @file coverage/canvas/widgets/theme-slider-render-tails.test.js
 * @description Coverage tail for theme-slider/render.ts — the spring
 * render path driven with fake hosts: renderStatic's WebGL/wasm/2D
 * branches, animate's reduced-motion and spring arms, renderWasm's
 * no-handle/set_state/dt arms, renderWebGL's delegation + guard and
 * full-draw path, and renderCanvas2D's paint call. Heavy deps
 * (gl-program, paint-2d, the store) are mocked.
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals'

let reducedMotion = false
let paintCalls = []
let bindQuadCalls = []

jest.unstable_mockModule('@core/utils/canvas/gl-program.js', () => ({
  bindQuad: (...a) => bindQuadCalls.push(a),
}))
jest.unstable_mockModule('@core/utils/canvas/widgets/theme-slider/paint-2d.js', () => ({
  paintThemeSlider2D: (...a) => paintCalls.push(a),
}))
jest.unstable_mockModule('@core/store.js', () => ({
  default: {
    getters: {
      getReducedMotion: () => reducedMotion,
    },
  },
}))

const { renderStatic, animate, renderWasm, renderWebGL, renderCanvas2D } =
  await import('@core/utils/canvas/widgets/theme-slider/render.js')

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

const makeHost = (over = {}) => {
  const host = {
    canvas: { width: 280, height: 64 },
    width: 280,
    height: 64,
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
    uRippleTime: null,
    uRipplePos: null,
    currentP: 0,
    targetP: 1,
    velP: 0,
    _animT: 0,
    isDragging: false,
    knobX: 0,
    rippleTime: -10,
    ripplePos: 0,
    startTime: 0,
    _wasm: null,
    _wasmT: 0,
    _pToKnobX: (p) => p * 32,
    animate: jest.fn(),
    ...over,
  }

  // Same wiring the real widget installs — the pooled frame tick
  // delegates back to the loop's own animate method.
  host._frameTick = () => host.animate()

  return host
}

beforeEach(() => {
  reducedMotion = false
  paintCalls = []
  bindQuadCalls = []
})

describe('theme-slider render tail', () => {
  test('renderStatic snaps to target and takes the WebGL arm on a live GL host', () => {
    const gl = makeGl()
    const host = makeHost({ useWebGL: true, gl, program: 'p', quadBuffer: 'b' })

    renderStatic(host)

    expect(host.currentP).toBe(1)
    expect(host.knobX).toBe(32)
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
    const ctx = { marker: 'ctx' }
    const host = makeHost({ ctx })

    renderStatic(host)

    expect(paintCalls.length).toBe(1)

    paintCalls = []

    const bare = makeHost()

    renderStatic(bare)

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

    const noRaf = makeHost()

    animate(noRaf)

    expect(noRaf.animId).toBeNull()
  })

  test('animate springs forward and draws on the armed backends', () => {
    const gl = makeGl()
    const host = makeHost({ useWebGL: true, gl, program: 'p', quadBuffer: 'b' })

    animate(host)

    expect(host.currentP).toBeCloseTo(0.0472, 4)
    expect(host.knobX).toBeCloseTo(host.currentP * 32, 5)
    expect(gl.calls.length).toBeGreaterThan(0)

    const flat = makeHost({ ctx: { c: 1 } })

    animate(flat)

    expect(paintCalls.length).toBe(1)

    paintCalls = []

    // useWebGL armed but GL-less: the _wasm operand and the ctx fallback.
    const wasmHost = makeHost({ useWebGL: true, _wasm: { widget: { frame: jest.fn() } } })

    animate(wasmHost)

    const glLess = makeHost({ useWebGL: true, ctx: { c: 1 } })

    animate(glLess)

    expect(paintCalls.length).toBe(1)

    paintCalls = []

    const bare = makeHost()

    animate(bare)

    expect(paintCalls.length).toBe(0)

    // The shared pool arms the next frame — animId holds a live pool id,
    // and the queued _frameTick delegates back into the loop's animate.
    animate(bare)

    expect(bare.animId).not.toBeNull()

    bare._frameTick()

    expect(bare.animate).toHaveBeenCalled()
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

  test('drag picks the critically-damped regime — fluid follow, no overshoot', () => {
    const host = makeHost({ isDragging: true })
    let maxP = 0

    for (let i = 0; i < 45; i++) {
      host._animT = performance.now() - 16.7

      animate(host)

      if (host.currentP > maxP) maxP = host.currentP
    }

    // ζ=1 stays under the target (sub-0.5% integration noise only) —
    // contrast with the snap regime's ~4% elastic overshoot above.
    expect(maxP).toBeLessThan(1.005)
    expect(host.currentP).toBe(1)
  })

  test('a suspended frame clamps dt instead of exploding the spring', () => {
    const host = makeHost()

    host._animT = performance.now() - 10000

    animate(host)

    // dt clamped to 50ms: v = 170·0.05 = 8.5, p = 8.5·0.05 = 0.425.
    expect(host.currentP).toBeCloseTo(0.425, 4)
  })

  test('renderWasm no-ops without a handle and skips a missing set_state', () => {
    const host = makeHost()

    renderWasm(host, 100)

    expect(host._wasmT).toBe(0)

    const frame = jest.fn()

    host._wasm = { widget: { frame } }
    renderWasm(host, 1000)

    expect(frame).toHaveBeenCalledWith(1)
    expect(host._wasmT).toBe(1)

    renderWasm(host, 1500)

    expect(frame).toHaveBeenLastCalledWith(0.5)
  })

  test('renderWebGL delegates to wasm and guards missing GL pieces', () => {
    const frame = jest.fn()
    const host = makeHost({ _wasm: { widget: { frame } } })

    renderWebGL(host, 50)

    expect(frame).toHaveBeenCalled()

    const guarded = makeHost()

    renderWebGL(guarded, 50)

    guarded.gl = makeGl()
    renderWebGL(guarded, 50)

    guarded.program = 'p'
    renderWebGL(guarded, 50)

    guarded.quadBuffer = 'b'
    renderWebGL(guarded, 50)

    // Only the fully-armed call drew — one full 11-call sequence.
    expect(guarded.gl.calls.length).toBe(11)
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
      uRippleTime: 'urt',
      uRipplePos: 'urp',
    })

    renderWebGL(host, 1000)

    const names = gl.calls.map((c) => c[0])

    expect(names).toEqual([
      'viewport',
      'clearColor',
      'clear',
      'useProgram',
      'uniform2f',
      'uniform1f',
      'uniform1f',
      'uniform1f',
      'uniform1f',
      'uniform1f',
      'drawArrays',
    ])
    expect(bindQuadCalls.length).toBe(1)
  })

  test('renderCanvas2D forwards the paint config', () => {
    const host = makeHost({ ctx: { c: 1 }, currentP: 0.5, knobX: 16, startTime: 7 })

    renderCanvas2D(host)

    expect(paintCalls.length).toBe(1)
    expect(paintCalls[0][1].currentP).toBe(0.5)
    expect(paintCalls[0][1].knobX).toBe(16)
    expect(paintCalls[0][1].startTime).toBe(7)
  })
})
