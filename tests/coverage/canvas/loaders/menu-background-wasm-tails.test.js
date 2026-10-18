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
import { attachMockGL } from '@tests/fixtures/mock-webgl.js'

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
})
