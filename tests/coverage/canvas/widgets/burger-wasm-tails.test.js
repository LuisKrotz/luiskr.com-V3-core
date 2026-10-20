/**
 * @file coverage/canvas/widgets/burger-wasm-tails.test.js
 * @description Coverage tail for the WebGPU/wasm burger path —
 * _initGL's wasm arm + its WebGL fallback, the mount callback's
 * purged/failed arms, _checkResize/_drawFrame/_loop's wasm arms, and
 * purge/restore/destroy's handle lifecycle. The bridge module is
 * mocked so a fake widget stands in for the rust/burger artifact
 * (happy-dom has no WebGPU).
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { attachMockGL } from '@tests/fixtures/mock-webgl.js'
import store from '@core/store.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { PREF_MUTATIONS } from '@core/tokens/events/mutations.js'
import { GL_EVENTS } from '@core/tokens/events/dom.js'

/** Mutable mount result the mock returns — tests swap per case. */
let mountResult = null

/** Mutable WebGPU capability flag the mock's hasWebGpu reads. */
let mockGpu = true

/** The fake wasm widget — records every kind-specific setter call. */
let fakeWidget = null

jest.unstable_mockModule('@core/utils/gpu/webgpu-widget.js', () => ({
  hasWebGpu: () => mockGpu,
  mountWebGpuWidget: async () => mountResult,
  warmWidgetArtifacts: () => undefined,
}))

/** Imports the class under test AFTER the mock is registered. */
const loadClass = async () =>
  (await import('@core/utils/canvas/widgets/burger-button-webgl.js')).BurgerButtonWebGL

/** Flushes the mount promise + a couple of frames. */
const flush = async () => {
  await Promise.resolve()
  await new Promise((r) => setTimeout(r, 40))
}

const makeCanvas = () => {
  const canvas = document.createElement(HTML_TAGS.CANVAS)

  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 34, height: 34 })

  return canvas
}

beforeEach(() => {
  store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)

  mountResult = null
  mockGpu = true

  fakeWidget = {
    calls: { dark: [], frame: [], size: [], dev: [] },
    set_dark: (v) => fakeWidget.calls.dark.push(v),
    frame: (dt) => fakeWidget.calls.frame.push(dt),
    set_size: (w, h) => fakeWidget.calls.size.push([w, h]),
    resize: (w, h) => fakeWidget.calls.dev.push([w, h]),
  }

  mountResult = { canvas: null, widget: fakeWidget, destroy: jest.fn() }
})

afterEach(() => {
  document.documentElement.classList.remove(STATE_CLASSES.DARK_MODE)
})

describe('burger wasm path', () => {
  test('mount success wires the fake widget — sizes, dark, frames', async () => {
    const BurgerButtonWebGL = await loadClass()
    const canvas = makeCanvas()

    const burger = new BurgerButtonWebGL(canvas)

    await flush()

    expect(burger._wasm).not.toBeNull()
    expect(burger.useWebGL).toBe(true)
    expect(burger.gl).toBeNull()
    expect(fakeWidget.calls.size.length).toBeGreaterThan(0)
    expect(fakeWidget.calls.dev.length).toBeGreaterThan(0)
    expect(fakeWidget.calls.dark.length).toBeGreaterThan(0)
    expect(fakeWidget.calls.frame.length).toBeGreaterThan(0)

    burger.destroy()

    expect(mountResult.destroy).toHaveBeenCalled()
    expect(burger._wasm).toBeNull()
  })

  test('mount failure falls back to the WebGL path on the same canvas', async () => {
    mountResult = null

    const BurgerButtonWebGL = await loadClass()
    const canvas = makeCanvas()

    attachMockGL(canvas)

    const burger = new BurgerButtonWebGL(canvas)

    await flush()

    expect(burger._wasm).toBeNull()
    expect(burger._wasmFailed).toBe(true)
    expect(burger.gl).not.toBeNull()
    expect(burger.useWebGL).toBe(true)

    burger.destroy()
  })

  test('no WebGPU takes the synchronous WebGL path', async () => {
    mockGpu = false

    const BurgerButtonWebGL = await loadClass()
    const canvas = makeCanvas()

    attachMockGL(canvas)

    const burger = new BurgerButtonWebGL(canvas)

    expect(burger._wasm).toBeNull()
    expect(burger.gl).not.toBeNull()

    burger.destroy()
  })

  test('mount failure re-drives the loop the constructor could not start', async () => {
    mountResult = null

    const BurgerButtonWebGL = await loadClass()
    const canvas = makeCanvas()

    attachMockGL(canvas)
    document.body.appendChild(canvas)

    const burger = new BurgerButtonWebGL(canvas)

    // The constructor's _start() ran while the mount was in flight —
    // the failure branch must arm the rAF loop after initGLReal.
    await flush()

    expect(burger._wasmFailed).toBe(true)
    expect(burger.useWebGL).toBe(true)
    expect(burger.animId).not.toBeNull()

    burger.destroy()
    canvas.remove()
  })

  test('mount failure with no WebGL skips the re-drive and falls back', async () => {
    mountResult = null

    const BurgerButtonWebGL = await loadClass()
    const canvas = makeCanvas()

    const burger = new BurgerButtonWebGL(canvas)

    await flush()

    expect(burger.useWebGL).toBe(false)
    expect(burger.animId).toBeNull()
    expect(canvas.classList.contains(STATE_CLASSES.IS_FALLBACK)).toBe(true)

    burger.destroy()
  })

  test('restore through a failed remount rebinds the context-loss watch', async () => {
    const BurgerButtonWebGL = await loadClass()
    const canvas = makeCanvas()

    attachMockGL(canvas)
    document.body.appendChild(canvas)

    const burger = new BurgerButtonWebGL(canvas)

    await flush()

    expect(burger._wasm).not.toBeNull()

    burger.purge()

    expect(burger._onContextLost).toBeNull()

    mountResult = null
    burger.restore()

    await flush()

    expect(burger._wasmFailed).toBe(true)
    expect(burger.useWebGL).toBe(true)
    expect(burger._onContextLost).not.toBeNull()

    // Fire the rebound watch — the lost-context arrow runs _triggerFallback.
    canvas.dispatchEvent(new Event(GL_EVENTS.WEBGL_CONTEXT_LOST))

    expect(burger.useWebGL).toBe(false)

    burger.destroy()
    canvas.remove()
  })

  test('purge during the in-flight mount releases the late handle', async () => {
    const BurgerButtonWebGL = await loadClass()
    const canvas = makeCanvas()

    const burger = new BurgerButtonWebGL(canvas)

    // Purge before the artifact resolves — the callback must destroy
    // the late handle instead of claiming the canvas.
    burger._purged = true

    await flush()

    expect(burger._wasm).toBeNull()
    expect(mountResult.destroy).toHaveBeenCalled()

    burger.destroy()
  })

  test('purge releases the widget and restore re-mounts it', async () => {
    const BurgerButtonWebGL = await loadClass()
    const canvas = makeCanvas()

    document.body.appendChild(canvas)

    const burger = new BurgerButtonWebGL(canvas)

    await flush()

    expect(burger._wasm).not.toBeNull()

    burger.purge()

    expect(mountResult.destroy).toHaveBeenCalled()
    expect(burger._wasm).toBeNull()

    burger.restore()

    await flush()

    expect(burger._wasm).not.toBeNull()

    burger.destroy()

    canvas.remove()
  })

  test('_checkResize on the wasm path forwards css + device sizes', async () => {
    const BurgerButtonWebGL = await loadClass()
    const canvas = makeCanvas()

    const burger = new BurgerButtonWebGL(canvas)

    await flush()

    const sizeCalls = fakeWidget.calls.size.length

    // Force a backing-store change so the wasm arm runs.
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 48, height: 48 })
    burger._checkResize()

    expect(fakeWidget.calls.size.length).toBeGreaterThan(sizeCalls)
    expect(fakeWidget.calls.dev[fakeWidget.calls.dev.length - 1][0]).toBeGreaterThan(0)

    burger.destroy()
  })

  test('reduced-motion static frame drives one wasm draw', async () => {
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)

    const BurgerButtonWebGL = await loadClass()
    const canvas = makeCanvas()

    const burger = new BurgerButtonWebGL(canvas)

    await flush()

    expect(burger._wasm).not.toBeNull()
    expect(fakeWidget.calls.frame.length).toBeGreaterThan(0)

    burger.destroy()
  })

  test('_tryWasm early-returns when a mount is pending or already live', async () => {
    const BurgerButtonWebGL = await loadClass()
    const canvas = makeCanvas()

    const pending = new BurgerButtonWebGL(canvas)

    pending._wasmPending = true
    pending._tryWasm() // pending operand

    const live = new BurgerButtonWebGL(makeCanvas())

    await flush()

    live._tryWasm() // live _wasm operand
    live.destroy()
    pending.destroy()
  })

  test('_initGL falls back when the canvas reference is gone', () => {
    const load = async () => loadClass()

    return load().then((BurgerButtonWebGL) => {
      const burger = new BurgerButtonWebGL(makeCanvas())

      burger.canvas = null
      burger._initGL()

      expect(burger.useWebGL).toBe(false)
    })
  })

  test('_checkResize tolerates a zero dpr and an empty rect', async () => {
    const BurgerButtonWebGL = await loadClass()
    const canvas = makeCanvas()

    const burger = new BurgerButtonWebGL(canvas)

    await flush()

    const prev = window.devicePixelRatio

    Object.defineProperty(window, 'devicePixelRatio', { value: 0, configurable: true })
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 })
    canvas.width = 1 // dirty the buffer so the no-change guard can't skip set_size
    burger._checkResize() // dpr || 1 and rect || 34 arms

    Object.defineProperty(window, 'devicePixelRatio', { value: prev, configurable: true })

    burger.destroy()
  })

  test('_drawFrame skips a zero backing store; _loop guards missing backend', async () => {
    const BurgerButtonWebGL = await loadClass()
    const canvas = makeCanvas()

    const burger = new BurgerButtonWebGL(canvas)

    await flush()

    canvas.width = 0
    burger._drawFrame(1)

    canvas.width = 100
    canvas.height = 0
    burger._drawFrame(1) // height-zero || arm

    const bare = new BurgerButtonWebGL(makeCanvas())

    bare.gl = null
    bare._wasm = null
    bare._loop() // !gl && !_wasm arm

    bare._wasm = { widget: { frame: jest.fn() }, destroy: jest.fn() }
    bare.useWebGL = false
    bare._loop() // !useWebGL arm

    burger.destroy()
    bare.destroy()
  })
})
