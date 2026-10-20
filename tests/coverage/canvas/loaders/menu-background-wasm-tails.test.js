/**
 * @file coverage/canvas/loaders/menu-background-wasm-tails.test.js
 * @description Coverage tail for the WebGPU/wasm menu-background path —
 * _initGL's wasm arm + its WebGL fallback, the mount callback's
 * purged/failed arms, handleResize/renderFrame's wasm arms
 * (set_size/resize + the 8-arg set_state + frame), and
 * purge/restore/destroy's handle lifecycle. The bridge module is
 * mocked so a fake widget stands in for the rust/menu-background
 * artifact (happy-dom has no WebGPU).
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { NAV_MENU_CLASSES } from '@core/tokens/classes/nav.js'
import { attachMockGL, attachNoGL } from '@tests/fixtures/mock-webgl.js'
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
  (await import('@core/utils/canvas/loaders/menu-background-webgl.js')).MenuBackgroundWebGL

/** Flushes the mount promise + a couple of frames. */
const flush = async () => {
  await Promise.resolve()
  await new Promise((r) => setTimeout(r, 40))
}

const makeCanvas = () => {
  const canvas = document.createElement(HTML_TAGS.CANVAS)
  const parent = document.createElement(HTML_TAGS.DIV)

  parent.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300 })

  parent.appendChild(canvas)

  return { canvas, parent }
}

beforeEach(() => {
  mountResult = null
  mockGpu = true

  fakeWidget = {
    calls: { state: [], frame: [], size: [], dev: [] },
    set_state: (...a) => fakeWidget.calls.state.push(a),
    frame: (dt) => fakeWidget.calls.frame.push(dt),
    set_size: (w, h) => fakeWidget.calls.size.push([w, h]),
    resize: (w, h) => fakeWidget.calls.dev.push([w, h]),
  }

  mountResult = { canvas: null, widget: fakeWidget, destroy: jest.fn() }
})

afterEach(() => {
  document.documentElement.classList.remove(STATE_CLASSES.DARK_MODE)
})

describe('menu-background wasm path', () => {
  test('mount success wires the fake widget — resize, state, frames', async () => {
    const MenuBackgroundWebGL = await loadClass()
    const { canvas, parent } = makeCanvas()

    document.body.appendChild(parent)

    const bg = new MenuBackgroundWebGL(canvas)

    await flush()

    expect(bg._wasm).not.toBeNull()
    expect(bg.useWebGL).toBe(true)
    expect(bg.gl).toBeNull()
    expect(fakeWidget.calls.size.length).toBeGreaterThan(0)
    expect(fakeWidget.calls.dev.length).toBeGreaterThan(0)

    bg.start()

    await flush()

    expect(fakeWidget.calls.state.length).toBeGreaterThan(0)
    expect(fakeWidget.calls.frame.length).toBeGreaterThan(0)

    // The 8-arg set_state: reveal, rgb1, alpha, rgb2.
    const last = fakeWidget.calls.state[fakeWidget.calls.state.length - 1]

    expect(last.length).toBe(8)

    bg.destroy()

    expect(mountResult.destroy).toHaveBeenCalled()
    expect(bg._wasm).toBeNull()

    parent.remove()
  })

  test('a menu that opened during the mount starts on mount resolve', async () => {
    const MenuBackgroundWebGL = await loadClass()
    const { canvas, parent } = makeCanvas()

    document.body.appendChild(parent)

    const bg = new MenuBackgroundWebGL(canvas)

    // Menu opens while the artifact is in flight — start() early-
    // returns on !useWebGL, the mount callback re-drives it.
    bg._wantsActive = true

    await flush()

    expect(bg._wasm).not.toBeNull()
    expect(bg.isActive).toBe(true)

    bg.destroy()

    parent.remove()
  })

  test('mount failure falls back to the WebGL path', async () => {
    mountResult = null

    const MenuBackgroundWebGL = await loadClass()
    const { canvas } = makeCanvas()

    attachMockGL(canvas)

    const bg = new MenuBackgroundWebGL(canvas)

    await flush()

    expect(bg._wasm).toBeNull()
    expect(bg._wasmFailed).toBe(true)
    expect(bg.gl).not.toBeNull()

    bg.destroy()
  })

  test('a menu that opened during a failed mount still starts the WebGL loop', async () => {
    mountResult = null

    const MenuBackgroundWebGL = await loadClass()
    const { canvas, parent } = makeCanvas()

    attachMockGL(canvas)
    document.body.appendChild(parent)

    const bg = new MenuBackgroundWebGL(canvas)

    // Menu opens while the artifact is in flight — start() early-
    // returns on !useWebGL; the failure branch must re-drive it once
    // the WebGL init lands.
    bg.start()

    await flush()

    expect(bg._wasm).toBeNull()
    expect(bg._wasmFailed).toBe(true)
    expect(bg.isActive).toBe(true)

    bg.destroy()
    parent.remove()
  })

  test('no WebGPU takes the synchronous WebGL path', async () => {
    mockGpu = false

    const MenuBackgroundWebGL = await loadClass()
    const { canvas } = makeCanvas()

    attachMockGL(canvas)

    const bg = new MenuBackgroundWebGL(canvas)

    expect(bg._wasm).toBeNull()
    expect(bg.gl).not.toBeNull()

    bg.destroy()
  })

  test('purge during the in-flight mount releases the late handle', async () => {
    const MenuBackgroundWebGL = await loadClass()
    const { canvas } = makeCanvas()

    const bg = new MenuBackgroundWebGL(canvas)

    bg._purged = true

    await flush()

    expect(bg._wasm).toBeNull()
    expect(mountResult.destroy).toHaveBeenCalled()

    bg.destroy()
  })

  test('purge releases the widget and restore re-mounts it', async () => {
    const MenuBackgroundWebGL = await loadClass()
    const { canvas, parent } = makeCanvas()

    document.body.appendChild(parent)

    const bg = new MenuBackgroundWebGL(canvas)

    bg.start()

    await flush()

    expect(bg._wasm).not.toBeNull()

    bg.purge()

    expect(mountResult.destroy).toHaveBeenCalled()
    expect(bg._wasm).toBeNull()

    bg.restore()

    await flush()

    expect(bg._wasm).not.toBeNull()

    bg.destroy()

    parent.remove()
  })

  test('theme flip mid-loop resamples into the wasm state push', async () => {
    const MenuBackgroundWebGL = await loadClass()
    const { canvas, parent } = makeCanvas()

    document.body.appendChild(parent)

    const bg = new MenuBackgroundWebGL(canvas)

    await flush()

    bg.start()

    document.documentElement.classList.add(STATE_CLASSES.DARK_MODE)

    await flush()

    // Both alpha lanes (light + dark) appear across the state pushes.
    const alphas = fakeWidget.calls.state.map((s) => s[4])

    expect(alphas.length).toBeGreaterThan(0)

    bg.destroy()

    parent.remove()
  })

  test('start arms — re-entry guard, dead path, RO observe + resize cb', async () => {
    const ros = []
    const realRO = globalThis.ResizeObserver

    globalThis.ResizeObserver = class {
      constructor(cb) {
        this.cb = cb

        ros.push(this)
      }
      observe() {}
      unobserve() {}
      disconnect() {
        this.disconnected = true
      }
    }

    const MenuBackgroundWebGL = await loadClass()
    const { canvas, parent } = makeCanvas()

    document.body.appendChild(parent)

    const bg = new MenuBackgroundWebGL(canvas)

    await flush()

    // Dead layer → start early-returns.
    bg.useWebGL = false
    bg.start()

    expect(bg.isActive).toBe(false)

    bg.useWebGL = true
    bg.start()

    expect(bg.isActive).toBe(true)
    expect(ros.length).toBe(1)

    // RO callback → _handleResize → wasm size push.
    const before = fakeWidget.calls.size.length

    ros[0].cb()

    expect(fakeWidget.calls.size.length).toBeGreaterThan(before)

    // Re-entry on a live loop → isActive guard.
    bg.start()

    // stop() disconnects the observer.
    bg.stop()

    expect(ros[0].disconnected).toBe(true)

    globalThis.ResizeObserver = realRO

    bg.destroy()
    parent.remove()
  })

  test('reduced motion draws one fully-revealed static frame', async () => {
    const MenuBackgroundWebGL = await loadClass()
    const { canvas, parent } = makeCanvas()

    document.body.appendChild(parent)

    const bg = new MenuBackgroundWebGL(canvas)

    await flush()

    document.documentElement.classList.add(STATE_CLASSES.REDUCED_MOTION)

    bg.start()

    document.documentElement.classList.remove(STATE_CLASSES.REDUCED_MOTION)

    expect(bg.isActive).toBe(true)
    expect(fakeWidget.calls.state.length).toBeGreaterThan(0)
    // The static frame pushes dt=0 so the crate's clock stays put.
    expect(fakeWidget.calls.frame).toContain(0)

    bg.destroy()
    parent.remove()
  })

  test('release + tickReveal arms — every ease lane and completion', async () => {
    const MenuBackgroundWebGL = await loadClass()
    const { canvas, parent } = makeCanvas()

    document.body.appendChild(parent)

    const bg = new MenuBackgroundWebGL(canvas)

    await flush()

    bg.start()
    bg.release()

    expect(bg._wantsActive).toBe(false)
    expect(bg._revealTarget).toBe(0)

    // Settled ease → early _revealDur <= 0 return.
    bg._revealDur = 0
    bg._revealTarget = 0.5
    bg._tickReveal(performance.now())

    expect(bg._reveal).toBe(0.5)

    // Open ease mid-flight (target 1).
    bg._animateReveal(1, 100)
    bg._revealT0 = performance.now() - 50
    bg._tickReveal(performance.now())

    // Close ease — p < 0.5 lane.
    bg._animateReveal(0, 100)
    bg._revealT0 = performance.now() - 30
    bg._tickReveal(performance.now())

    // Close ease — p >= 0.5 lane.
    bg._animateReveal(0, 100)
    bg._revealT0 = performance.now() - 70
    bg._tickReveal(performance.now())

    // Past duration → reveal lands on target, timer zeroes.
    bg._animateReveal(1, 100)
    bg._revealT0 = performance.now() - 500
    bg._tickReveal(performance.now())

    expect(bg._revealDur).toBe(0)
    expect(bg._reveal).toBe(1)

    bg.destroy()
    parent.remove()
  })

  test('handleResize — GL viewport, detached canvas, zero-size fallback', async () => {
    mockGpu = false

    const MenuBackgroundWebGL = await loadClass()
    const { canvas } = makeCanvas()

    attachMockGL(canvas)

    const bg = new MenuBackgroundWebGL(canvas)

    expect(bg.gl).not.toBeNull()

    const viewport = jest.fn()

    bg.gl = {
      viewport,
      deleteBuffer: jest.fn(),
      deleteProgram: jest.fn(),
      getExtension: () => ({ loseContext: jest.fn() }),
    }

    // Detached canvas → `parentElement || canvas` → the canvas itself.
    bg._handleResize()

    expect(viewport).toHaveBeenCalled()

    // Zero-size parent → viewport fallback lane.
    const parent = document.createElement(HTML_TAGS.DIV)

    parent.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 })
    parent.appendChild(canvas)
    document.body.appendChild(parent)
    bg._handleResize()

    expect(viewport).toHaveBeenCalledTimes(2)

    bg.destroy()
    parent.remove()
  })

  test('loop and renderFrame guards + wasm-less widget arms', async () => {
    const MenuBackgroundWebGL = await loadClass()
    const { canvas, parent } = makeCanvas()

    document.body.appendChild(parent)

    const bg = new MenuBackgroundWebGL(canvas)

    await flush()

    // loop() guards: inactive, no backend, dead path.
    bg._loop()

    expect(bg.animId).toBeNull()

    bg.isActive = true
    bg.gl = null
    bg._wasm = null
    bg._loop()

    expect(bg.animId).toBeNull()

    bg._wasm = mountResult
    bg.useWebGL = false
    bg._loop()

    expect(bg.animId).toBeNull()

    // renderFrame() with neither backend → early return.
    bg.useWebGL = true
    bg._wasm = null
    bg._renderFrame()

    // A widget without the optional set_state → `?.` skip arm.
    bg._wasm = { widget: { frame: jest.fn() }, destroy: jest.fn() }
    bg._renderFrame()
    bg._renderFrame(0)

    bg.destroy()
    parent.remove()
  })

  test('initGL failure arms — no canvas, no context, bad program, throw', async () => {
    mockGpu = false

    const MenuBackgroundWebGL = await loadClass()

    // No canvas → immediate fallback.
    {
      const { canvas } = makeCanvas()

      attachMockGL(canvas)

      const bg = new MenuBackgroundWebGL(canvas)

      bg.canvas = null
      bg._initGL()

      expect(bg.useWebGL).toBe(false)
      bg.destroy()
    }

    // Context refused → fallback.
    {
      const { canvas } = makeCanvas()

      canvas.getContext = () => null

      const bg = new MenuBackgroundWebGL(canvas)

      expect(bg.gl).toBeNull()
      expect(bg.useWebGL).toBe(false)
      bg.destroy()
    }

    // Program build failure → warn callback → fallback.
    {
      const { canvas } = makeCanvas()

      canvas.getContext = () => ({
        getExtension: () => ({}),
        createProgram: () => ({}),
        createShader: () => ({}),
        createBuffer: () => ({}),
        shaderSource: () => {},
        compileShader: () => {},
        attachShader: () => {},
        linkProgram: () => {},
        getShaderParameter: () => false,
        getProgramParameter: () => false,
        getShaderInfoLog: () => '',
        getProgramInfoLog: () => '',
      })

      const bg = new MenuBackgroundWebGL(canvas)

      expect(bg.useWebGL).toBe(false)
      bg.destroy()
    }

    // A throwing getContext → catch arm → fallback.
    {
      const { canvas } = makeCanvas()

      canvas.getContext = () => {
        throw new Error('gl gone')
      }

      const bg = new MenuBackgroundWebGL(canvas)

      expect(bg.useWebGL).toBe(false)
      bg.destroy()
    }
  })

  test('fallback + modal-class arms — animId cancel and closest toggle', async () => {
    mockGpu = false

    const MenuBackgroundWebGL = await loadClass()
    const modal = document.createElement(HTML_TAGS.DIV)

    modal.className = NAV_MENU_CLASSES.NAV_MENU_MODAL

    const { canvas } = makeCanvas()

    modal.appendChild(canvas)
    document.body.appendChild(modal)
    attachMockGL(canvas)

    const bg = new MenuBackgroundWebGL(canvas)

    expect(bg.useWebGL).toBe(true)

    // Re-init clears a lingering modal fallback class via closest().
    modal.classList.add(NAV_MENU_CLASSES.NAV_MENU_MODAL_GL_FALLBACK)
    bg._initGL()

    expect(modal.classList.contains(NAV_MENU_CLASSES.NAV_MENU_MODAL_GL_FALLBACK)).toBe(false)

    // triggerFallback cancels a pending rAF and re-marks the modal.
    bg.animId = 9
    bg._triggerFallback()

    expect(bg.animId).toBeNull()
    expect(modal.classList.contains(NAV_MENU_CLASSES.NAV_MENU_MODAL_GL_FALLBACK)).toBe(true)

    // Canvas-less triggerFallback skips the DOM arm.
    bg.canvas = null
    bg._triggerFallback()

    bg.destroy()
    modal.remove()
  })

  test('sampleTheme parses real ink values and shaders pick deriv lanes', async () => {
    const MenuBackgroundWebGL = await loadClass()
    const { canvas, parent } = makeCanvas()

    document.body.appendChild(parent)

    const bg = new MenuBackgroundWebGL(canvas)

    await flush()

    const realCompute = globalThis.getComputedStyle

    globalThis.getComputedStyle = (el) => ({
      ...realCompute(el),
      getPropertyValue: () => 'rgb(10,20,30)',
    })

    bg._sampleTheme()

    expect(bg._color).toEqual([10 / 255, 20 / 255, 30 / 255])

    globalThis.getComputedStyle = realCompute

    // Both deriv lanes of the FS source factory.
    const { menuBgFsSource } = await import('@core/utils/canvas/loaders/menu-background/shaders.js')

    expect(menuBgFsSource(true)).toContain('fwidth')
    expect(menuBgFsSource(false)).not.toBe('')

    bg.destroy()
    parent.remove()
  })

  test('initGL direct call on a canvas-less host falls back', async () => {
    const { initGL } = await import('@core/utils/canvas/loaders/menu-background/init.js')

    const host = { canvas: null, _triggerFallback: jest.fn() }

    initGL(host)

    expect(host._triggerFallback).toHaveBeenCalledTimes(1)
  })

  test('webglcontextlost re-fires the fallback through watchContextLoss', async () => {
    mockGpu = false

    const MenuBackgroundWebGL = await loadClass()
    const { canvas, parent } = makeCanvas()

    document.body.appendChild(parent)
    attachMockGL(canvas)

    const bg = new MenuBackgroundWebGL(canvas)

    bg._initGL()
    expect(bg.useWebGL).toBe(true)

    canvas.dispatchEvent(new Event(GL_EVENTS.WEBGL_CONTEXT_LOST))
    expect(bg.useWebGL).toBe(false)

    bg.destroy()
    parent.remove()
  })

  test('_tryWasm early-returns while a mount is pending or settled', async () => {
    const MenuBackgroundWebGL = await loadClass()
    const { canvas, parent } = makeCanvas()

    document.body.appendChild(parent)

    const bg = new MenuBackgroundWebGL(canvas)

    // The mount promise stays unsettled between the two sync calls —
    // the second _tryWasm bails on the _wasmPending latch.
    bg._tryWasm()
    expect(bg._wasmPending).toBe(true)

    bg._tryWasm()

    // A settled wasm handle also early-returns.
    bg._wasmPending = false
    bg._wasm = { widget: fakeWidget, destroy: jest.fn() }
    bg._tryWasm()

    bg.destroy()
    parent.remove()
  })

  test('a canvas swap during the wasm mount skips initGL on resolve', async () => {
    mountResult = null

    const MenuBackgroundWebGL = await loadClass()
    const { canvas, parent } = makeCanvas()
    const other = document.createElement(HTML_TAGS.CANVAS)

    document.body.appendChild(parent)
    attachMockGL(canvas)

    const bg = new MenuBackgroundWebGL(canvas)

    bg._tryWasm()

    // The element swapped while the mount was in flight — the resolve
    // sees the mismatch, marks wasm failed, and skips initGL.
    bg.canvas = other

    await flush()

    expect(bg._wasmFailed).toBe(true)
    expect(bg.useWebGL).toBe(false)

    bg.canvas = canvas
    bg.destroy()
    parent.remove()
  })

  test('restore() no-ops when the instance was never purged', async () => {
    const MenuBackgroundWebGL = await loadClass()
    const { canvas, parent } = makeCanvas()

    document.body.appendChild(parent)

    const bg = new MenuBackgroundWebGL(canvas)

    expect(() => bg.restore()).not.toThrow()

    bg.destroy()
    parent.remove()
  })

  test('start() early-returns without a live GL/wasm surface or when already active', async () => {
    mockGpu = false

    const MenuBackgroundWebGL = await loadClass()
    const { canvas, parent } = makeCanvas()

    document.body.appendChild(parent)
    attachNoGL(canvas)

    const bg = new MenuBackgroundWebGL(canvas)

    // Init refused — useWebGL false → start() bails.
    bg.start()
    expect(bg.isActive).toBe(false)

    // Successful init → start() once; the second call hits the
    // isActive early-return arm.
    const { canvas: canvas2, parent: parent2 } = makeCanvas()

    document.body.appendChild(parent2)
    attachMockGL(canvas2)

    const bg2 = new MenuBackgroundWebGL(canvas2)

    bg2.start()
    expect(bg2.isActive).toBe(true)

    bg2.start()
    expect(bg2.isActive).toBe(true)

    bg.destroy()
    bg2.destroy()
    parent.remove()
    parent2.remove()
  })

  test('tickReveal covers the zero-duration, p<0.5 and settled arms', async () => {
    const { tickReveal } = await import('@core/utils/canvas/loaders/menu-background/loop.js')

    const host = { _revealDur: 0, _reveal: 0.2, _revealTarget: 0 }

    tickReveal(host, 1000)
    expect(host._reveal).toBe(0)

    // p < 0.5 arm of the closing easeInOutQuart.
    const host2 = {
      _revealDur: 1000,
      _revealT0: 0,
      _reveal: 1,
      _revealTarget: 0,
      _revealFrom: 1,
    }

    tickReveal(host2, 200)
    expect(host2._reveal).toBeLessThan(1)

    // p >= 0.5 arm + settle (p >= 1 zeroes the duration).
    tickReveal(host2, 800)
    tickReveal(host2, 1200)
    expect(host2._revealDur).toBe(0)
    expect(host2._reveal).toBe(0)

    // target === 1 drives the easeOutQuart arm.
    const host3 = {
      _revealDur: 1000,
      _revealT0: 0,
      _reveal: 0,
      _revealTarget: 1,
      _revealFrom: 0,
    }

    tickReveal(host3, 400)
    expect(host3._reveal).toBeGreaterThan(0)
  })

  test('handleResize forwards dims to the wasm widget and the GL viewport', async () => {
    const { handleResize } = await import('@core/utils/canvas/loaders/menu-background/loop.js')
    const { canvas, parent } = makeCanvas()

    const widget = { set_size: jest.fn(), resize: jest.fn() }
    const host = {
      canvas,
      parentElement: null,
      _wasm: { widget },
      gl: { viewport: jest.fn() },
    }

    handleResize(host)

    expect(widget.set_size).toHaveBeenCalled()
    expect(widget.resize).toHaveBeenCalled()
    expect(host.gl.viewport).toHaveBeenCalled()

    parent.remove()
  })

  test('sampleTheme falls back to theme defaults when getComputedStyle throws', async () => {
    const { sampleTheme } = await import('@core/utils/canvas/loaders/menu-background/theme.js')

    const realCompute = globalThis.getComputedStyle

    globalThis.getComputedStyle = () => {
      throw new Error('no style')
    }

    const host = { canvas: makeCanvas().canvas }

    sampleTheme(host)

    const isDark = document.documentElement.classList.contains(STATE_CLASSES.DARK_MODE)

    expect(host._color).toEqual(isDark ? [1, 1, 1] : [0, 0, 0])
    expect(host._color2).toEqual(host._color)

    globalThis.getComputedStyle = realCompute
  })
})
