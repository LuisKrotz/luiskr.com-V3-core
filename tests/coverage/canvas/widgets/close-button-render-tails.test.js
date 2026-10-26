/**
 * @file coverage/canvas/widgets/close-button-render-tails.test.js
 * @description Coverage tail for close-button/render.ts — the
 * three-channel render path driven with fake hosts: renderStatic's
 * hover/GL arms, animate's useWebGL guard, reduced-motion path,
 * liquid/rotation/draw-in springs and armed backends, renderWasm's
 * no-handle/set_state/dt arms, and renderWebGL's delegation + guard
 * and full-draw path. Heavy deps (gl-program, the store) are mocked.
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'

let reducedMotion = false
let bindQuadCalls = []

jest.unstable_mockModule('@core/utils/canvas/gl-program.js', () => ({
  bindQuad: (...a) => bindQuadCalls.push(a),
}))
jest.unstable_mockModule('@core/store.js', () => ({
  default: {
    getters: {
      getReducedMotion: () => reducedMotion,
    },
  },
}))

const { renderStatic, animate, renderWasm, renderWebGL } =
  await import('@core/utils/canvas/widgets/close-button/render.js')

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
    canvas: { width: 110, height: 110 },
    isHovered: false,
    hoverLevel: 0,
    rotation: 0,
    drawProgress: 0,
    clickTime: -10,
    useWebGL: true,
    gl: null,
    program: null,
    quadBuffer: null,
    aPos: 0,
    uResolution: null,
    uTime: null,
    uLiquid: null,
    uDraw: null,
    uRot: null,
    uClickTime: null,
    uHc: null,
    uDark: null,
    animId: null,
    startTime: 0,
    _wasm: null,
    _wasmT: 0,
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
  bindQuadCalls = []
})

describe('close-button render tail', () => {
  test('renderStatic draws a settled frame for both hover states', () => {
    const gl = makeGl()
    const host = makeHost({ gl, program: 'p', quadBuffer: 'b' })

    renderStatic(host)

    expect(host.drawProgress).toBe(1)
    expect(host.hoverLevel).toBe(0)
    expect(gl.calls.length).toBeGreaterThan(0)

    host.isHovered = true
    renderStatic(host)

    expect(host.hoverLevel).toBe(1)
    expect(host.rotation).toBe(Math.PI)

    // No GL backend at all — the draw call is skipped.
    renderStatic(makeHost({ useWebGL: false }))
  })

  test('animate returns early without WebGL and snaps under reduced motion', () => {
    const off = makeHost({ useWebGL: false })

    animate(off)

    expect(off.animId).toBeNull()

    reducedMotion = true

    const host = makeHost({ animId: 7, gl: makeGl(), program: 'p', quadBuffer: 'b' })

    animate(host)

    expect(host.animId).toBeNull()
    expect(host.drawProgress).toBe(1)

    animate(makeHost()) // animId null arm
  })

  test('animate springs the three channels and draws when armed', () => {
    const gl = makeGl()
    const host = makeHost({ gl, program: 'p', quadBuffer: 'b', isHovered: true, drawProgress: 0.5 })

    animate(host)

    expect(host.hoverLevel).toBeCloseTo(0.016, 5)
    expect(host.rotation).toBeCloseTo(0.016 * Math.PI * 0.04, 5)
    expect(host.drawProgress).toBeCloseTo(0.52, 5)
    expect(gl.calls.length).toBeGreaterThan(0)

    // drawProgress at 1 skips the draw-in increment; the wasm operand arm.
    const done = makeHost({ _wasm: { widget: { frame: jest.fn() } }, drawProgress: 1 })

    animate(done)

    expect(done.drawProgress).toBe(1)

    // useWebGL true but no backend — neither arm fires.
    animate(makeHost({ gl: null, _wasm: null }))

    // The shared pool arms the next frame — the queued _frameTick
    // delegates back into the loop's animate.
    const bare = makeHost({ isHovered: true })

    animate(bare)

    expect(bare.animId).not.toBeNull()

    bare._frameTick()

    expect(bare.animate).toHaveBeenCalled()
  })

  test('renderWasm no-ops without a handle and measures dt deltas', () => {
    const host = makeHost()

    renderWasm(host, 100)

    expect(host._wasmT).toBe(0)

    const frame = jest.fn()
    const set_state = jest.fn()

    host._wasm = { widget: { frame, set_state } }
    renderWasm(host, 1000)

    expect(set_state).toHaveBeenCalledWith(0, 0, 0)
    expect(frame).toHaveBeenCalledWith(1)
    expect(host._wasmT).toBe(1)

    renderWasm(host, 1500)

    expect(frame).toHaveBeenLastCalledWith(0.5)

    // A widget without set_state takes the optional-call skip arm.
    renderWasm(makeHost({ _wasm: { widget: { frame: jest.fn() } } }), 10)

    // _wasmT falsy → first frame takes the raw `t` arm of the dt ternary;
    // a second frame takes the `t - _wasmT` delta arm.
    const first = makeHost({ _wasm: { widget: { frame, set_state } }, _wasmT: 0 })

    renderWasm(first, 500)
    renderWasm(first, 1500)

    expect(first._wasmT).toBe(1.5)
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

    expect(guarded.gl.calls.length).toBe(13)
  })

  test('renderWebGL pushes every uniform on the full draw path', () => {
    const gl = makeGl()
    const host = makeHost({
      gl,
      program: 'p',
      quadBuffer: 'b',
      uResolution: 'ur',
      uTime: 'ut',
      uLiquid: 'ul',
      uDraw: 'ud',
      uRot: 'urot',
      uClickTime: 'uc',
      uHc: 'uhc',
      uDark: 'udark',
    })

    renderWebGL(host, 1000)

    // HC on → the `hc ?` and `hc && !dark` truthy arms of the uHc/uDark
    // ternaries; HC + dark → the `!dark` false arm.
    document.documentElement.classList.add(STATE_CLASSES.HIGH_CONTRAST)
    renderWebGL(host, 2000)

    document.documentElement.classList.add(STATE_CLASSES.DARK_MODE)
    renderWebGL(host, 3000)

    document.documentElement.classList.remove(STATE_CLASSES.HIGH_CONTRAST, STATE_CLASSES.DARK_MODE)

    expect(gl.calls.slice(0, 13).map((c) => c[0])).toEqual([
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
      'uniform1f',
      'uniform1f',
      'drawArrays',
    ])
    expect(bindQuadCalls.length).toBe(3)

    // HC/light → uHc=1, uDark=1; HC/dark → uHc=1, uDark=0.
    const hcFrame = gl.calls.slice(13, 26).filter((c) => c[0] === 'uniform1f' && c[1] === 'uhc')
    const darkFrame = gl.calls.slice(26).filter((c) => c[0] === 'uniform1f' && c[1] === 'udark')

    expect(hcFrame[0][2]).toBe(1)
    expect(darkFrame[0][2]).toBe(0)
  })
})
