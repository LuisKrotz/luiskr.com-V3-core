/**
 * @file burger-liquid-tails.test.js
 * @description Coverage tail for the liquid burger icon — the
 * hover/focus converge driver, the setOpen morph driver, the static
 * settle path (no running rAF), the WebGL init/fallback arms, and the
 * purge/restore/destroy lifecycle on the plain-GL path (the wasm mount
 * is gone — the artifact could never be driven by hover/open state).
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { attachMockGL } from '@tests/fixtures/mock-webgl.js'
import store from '@core/store.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { PREF_MUTATIONS } from '@core/tokens/events/mutations.js'
import { FOCUS_EVENTS, GL_EVENTS, POINTER_EVENTS } from '@core/tokens/events/dom.js'
import { BURGER_FS_BODY } from '@core/utils/canvas/widgets/burger-button/shaders.js'

/** Imports the class under test (module-level import is fine — no mocks). */
const loadClass = async () =>
  (await import('@core/utils/canvas/widgets/burger-button-webgl.js')).BurgerButtonWebGL

/** A 34px-box canvas — getBoundingClientRect drives _checkResize. */
const makeCanvas = () => {
  const canvas = document.createElement(HTML_TAGS.CANVAS)

  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 34, height: 34 })

  return canvas
}

beforeEach(() => {
  store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
})

afterEach(() => {
  document.documentElement.classList.remove(STATE_CLASSES.DARK_MODE)
})

describe('burger liquid icon', () => {
  test('the fragment shader anchors four distinct square centers — one per corner', () => {
    // Regression guard: c4 once duplicated c2's (cell, cell) corner so
    // only three squares ever painted. Each mix() must seed a unique
    // sign pair — the 2x2 grid the CSS fallback mirrors.
    const centers = [
      ...BURGER_FS_BODY.matchAll(
        /vec2 c[1-4] = mix\(vec2\(\s*(-?)cell,\s*(-?)cell\)/g
      ),
    ].map((m) => `${m[1]}|${m[2]}`)

    expect(centers).toHaveLength(4)
    expect(new Set(centers).size).toBe(4)
  })

  test('GL path eases hover convergence and the open morph toward their targets', async () => {
    const BurgerButtonWebGL = await loadClass()
    const canvas = makeCanvas()

    attachMockGL(canvas)
    document.body.appendChild(canvas)

    const burger = new BurgerButtonWebGL(canvas, jest.fn())

    expect(burger.useWebGL).toBe(true)
    expect(burger._hover).toBe(0)
    expect(burger._open).toBe(0)

    // Pointer hover + menu-open — the eased fields chase their targets.
    canvas.dispatchEvent(new Event(POINTER_EVENTS.POINTERENTER))
    burger.setOpen(true)

    burger._drawFrame(0.05) // seeds _prevT — first frame always dt=0
    burger._drawFrame(0.5)

    expect(burger._hover).toBeGreaterThan(0.9)
    expect(burger._open).toBeGreaterThan(0.9)

    canvas.dispatchEvent(new Event(POINTER_EVENTS.POINTERLEAVE))
    burger.setOpen(false)
    burger._drawFrame(1.0)

    expect(burger._hover).toBeLessThan(0.9)
    expect(burger._open).toBeLessThan(0.9)

    burger.destroy()
    canvas.remove()
  })

  test('focus/blur drive the same convergence target as the pointer', async () => {
    const BurgerButtonWebGL = await loadClass()
    const canvas = makeCanvas()

    const burger = new BurgerButtonWebGL(canvas)

    canvas.dispatchEvent(new Event(FOCUS_EVENTS.FOCUS))

    expect(burger._hoverTarget).toBe(1)

    canvas.dispatchEvent(new Event(FOCUS_EVENTS.BLUR))

    expect(burger._hoverTarget).toBe(0)

    burger.destroy()
  })

  test('static mode snaps interaction state and repaints once per change', async () => {
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)

    const BurgerButtonWebGL = await loadClass()
    const canvas = makeCanvas()

    attachMockGL(canvas)

    const burger = new BurgerButtonWebGL(canvas)

    // Reduced motion → no rAF loop, one static frame at construction.
    expect(burger.animId).toBeNull()

    burger.setOpen(true)

    expect(burger._open).toBe(1)

    canvas.dispatchEvent(new Event(POINTER_EVENTS.POINTERENTER))

    expect(burger._hover).toBe(1)

    burger.destroy()
  })

  test('no WebGL marks the fallback and keeps the state drivers inert', async () => {
    const BurgerButtonWebGL = await loadClass()
    const canvas = makeCanvas()

    const burger = new BurgerButtonWebGL(canvas)

    expect(burger.useWebGL).toBe(false)
    expect(canvas.classList.contains(STATE_CLASSES.IS_FALLBACK)).toBe(true)

    // _settleNow's useWebGL guard — snaps state, skips the dead repaint.
    burger.setOpen(true)

    expect(burger._open).toBe(1)

    canvas.dispatchEvent(new Event(POINTER_EVENTS.POINTERENTER))

    expect(burger._hover).toBe(1)

    burger.destroy()
  })

  test('_initGL falls back when the canvas reference is gone', async () => {
    const BurgerButtonWebGL = await loadClass()
    const burger = new BurgerButtonWebGL(makeCanvas())

    burger.canvas = null
    burger._initGL()

    expect(burger.useWebGL).toBe(false)

    burger.destroy()
  })

  test('purge releases GL; restore rebuilds it and re-arms the loss watch', async () => {
    const BurgerButtonWebGL = await loadClass()
    const canvas = makeCanvas()

    attachMockGL(canvas)
    document.body.appendChild(canvas)

    const burger = new BurgerButtonWebGL(canvas)

    burger.purge()

    expect(burger._onContextLost).toBeNull()

    burger.restore()

    expect(burger.useWebGL).toBe(true)
    expect(burger._onContextLost).not.toBeNull()

    // Fire the rebound watch — the lost-context arrow runs _triggerFallback.
    canvas.dispatchEvent(new Event(GL_EVENTS.WEBGL_CONTEXT_LOST))

    expect(burger.useWebGL).toBe(false)

    burger.destroy()
    canvas.remove()
  })

  test('restore early-returns while purged/detached; _loop guards a dead backend', async () => {
    const BurgerButtonWebGL = await loadClass()

    const bare = new BurgerButtonWebGL(makeCanvas())

    bare.restore() // not purged — guard arm

    bare.purge()
    bare.restore() // detached canvas — second guard arm

    bare.gl = {}
    bare.useWebGL = false
    bare._loop() // !useWebGL arm

    bare.gl = null
    bare.useWebGL = true
    bare._loop() // !gl arm

    bare._drawFrame(1) // !gl arm after the width/height guards

    bare.destroy()
  })

  test('resize without a GL backend is a no-op', async () => {
    const BurgerButtonWebGL = await loadClass()
    const burger = new BurgerButtonWebGL(makeCanvas())

    burger.gl = null
    burger._checkResize() // !gl guard arm

    burger.canvas = null
    burger._checkResize() // !canvas guard arm

    burger.destroy()
  })
})
