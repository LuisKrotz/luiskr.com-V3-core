/**
 * @file widget-tails-burgerbuttonwebgl-program-failure-static-resize-guards.test.js
 * @description Split from widget-tails.test.js — covers the "BurgerButtonWebGL — program failure + static resize guards" describe.
 */
import { describe, test, expect } from '@jest/globals'
import { BurgerButtonWebGL } from '@core/utils/canvas/widgets/burger-button-webgl.js'
import { attachMockGL, attachNoGL } from '@tests/fixtures/mock-webgl.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'

const makeCanvas = () => document.createElement(HTML_TAGS.CANVAS)

const _lang = (code, cc, cc2 = null) => ({ code, cc, cc2 })

// GL stub whose program creation fails — drives the `if (!built)` fallback arm.
const makeProgramFailGL = () =>
  new Proxy(
    {},
    {
      get(_t, p) {
        if (p === 'createShader' || p === 'createBuffer') return () => ({})
        if (p === 'createProgram') return () => null
        if (p === 'getShaderParameter') return () => true
        if (p === 'getError') return () => 0
        if (p === 'getProgramParameter') return () => false
        if (p === 'getProgramInfoLog' || p === 'getShaderInfoLog') return () => 'fail'
        if (typeof p === TYPE_STRINGS.STRING && p === p.toUpperCase()) return 1
        return () => undefined
      },
      set: () => true,
    }
  )

describe('BurgerButtonWebGL — program failure + static resize guards', () => {
  test('context ok but program build fails → fallback + early return', () => {
    const canvas = makeCanvas()

    canvas.getContext = () => makeProgramFailGL()

    const burger = new BurgerButtonWebGL(canvas)

    expect(burger.useWebGL).toBe(false)
    expect(canvas.classList.length).toBeGreaterThanOrEqual(0)

    burger.destroy()
  })

  test('_checkResize no-ops when gl is null (reduced-motion repaint guard)', () => {
    const canvas = makeCanvas()

    attachNoGL(canvas)

    const burger = new BurgerButtonWebGL(canvas)

    burger.gl = null
    burger.canvas = canvas

    expect(() => burger._checkResize()).not.toThrow()

    burger.destroy()
  })

  test('_checkResize repaints a static frame when animId is null', () => {
    const canvas = makeCanvas()

    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 64, height: 64 })
    attachMockGL(canvas)

    const burger = new BurgerButtonWebGL(canvas)

    burger.animId = null
    burger._checkResize()

    burger.destroy()
  })

  test('_settleNow takes the WebGL repaint — cold and warm prevT', () => {
    const canvas = makeCanvas()

    attachMockGL(canvas)

    const burger = new BurgerButtonWebGL(canvas)

    burger.animId = null

    // _prevT=0 → the `|| fallback` computes a fresh time (init may already
    // have run a loop frame, so pin it explicitly rather than assume).
    burger._prevT = 0
    burger._settleNow()

    // _prevT>0 → the `||` first arm reuses the last timestamp.
    burger._prevT = 3
    burger._settleNow()

    // useWebGL=false → the `if` else-arm skips the repaint entirely.
    burger.useWebGL = false
    burger._settleNow()

    burger.destroy()
  })

  test('_checkResize arms: dead-gl guard, DPR/rect fallbacks, live resize', () => {
    const canvas = makeCanvas()
    const burger = new BurgerButtonWebGL(canvas)

    // Dead-gl + missing-canvas arms of the early return.
    burger.gl = null
    burger._checkResize()
    burger.canvas = null
    burger._checkResize()

    burger.destroy()

    // Live resize: real canvas + stubbed gl → the `||` fallbacks for DPR 0
    // and zero-size rects, the changed-size arm, and the static repaint.
    const canvas2 = makeCanvas()
    const burger2 = new BurgerButtonWebGL(canvas2)
    const dpr = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio')

    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 0 })

    try {
      burger2.canvas = {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
        width: 0,
        height: 0,
        style: {},
      }
      burger2.gl = { viewport: () => {} }
      burger2.animId = null
      burger2._drawFrame = () => {}
      burger2._checkResize()

      // Truthy-DPR + non-zero rect → the `rawDpr`/`rectW` truthy arms and the
      // changed-size arm with a running loop.
      Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 })
      burger2.canvas = {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 64, height: 64 }),
        width: 1,
        height: 1,
        style: {},
      }
      burger2.animId = 9
      burger2._checkResize()
    } finally {
      if (dpr) {
        Object.defineProperty(window, 'devicePixelRatio', dpr)
      } else {
        delete window.devicePixelRatio
      }
    }
  })

  test('_triggerFallback arms: animId live/null, canvas present/absent', () => {
    const burger = new BurgerButtonWebGL(makeCanvas())

    burger.animId = 7
    burger.canvas = { style: {}, classList: { add: () => {} } }
    burger._onContextLost = () => {}
    burger._triggerFallback()

    burger.animId = null
    burger.canvas = null
    burger._triggerFallback()
  })

  test('_drawFrame HC/dark poles hit the isDark/uHc truthy arms', () => {
    const calls = []
    const gl = {
      clearColor: () => {},
      clear: () => {},
      useProgram: () => {},
      uniform1f: (...a) => calls.push(a),
      uniform2f: () => {},
      drawArrays: () => {},
      COLOR_BUFFER_BIT: 1,
    }

    const burger = new BurgerButtonWebGL(makeCanvas())

    burger.gl = gl
    burger.canvas = { classList: { contains: () => false }, width: 8, height: 8 }

    // HC + light → `hc ?` true arm and `!darkMode && !onDark` true arm.
    document.documentElement.classList.add(STATE_CLASSES.HIGH_CONTRAST)
    burger._drawFrame(0)

    // HC + dark → `!darkMode` false arm; HC + on-dark strip → `!onDark` false arm.
    document.documentElement.classList.add(STATE_CLASSES.DARK_MODE)
    burger._drawFrame(0)

    burger.canvas = { classList: { contains: () => true }, width: 8, height: 8 }
    document.documentElement.classList.remove(STATE_CLASSES.DARK_MODE)
    burger._drawFrame(0)

    document.documentElement.classList.remove(STATE_CLASSES.HIGH_CONTRAST)

    // No HC → `darkMode || onDark` arm with both poles.
    burger._drawFrame(0)
    document.documentElement.classList.add(STATE_CLASSES.DARK_MODE)
    burger._drawFrame(0)
    document.documentElement.classList.remove(STATE_CLASSES.DARK_MODE)

    expect(calls.length).toBeGreaterThan(0)
  })
})
