/**
 * @file coverage/canvas/widgets/theme-slider-wasm-tails.test.js
 * @description Coverage tail for the WebGPU/wasm theme slider path —
 * init's wasm arm + the initRest classic fallback, the mount
 * callback's purged/failed arms, render's wasm arm (set_state +
 * frame), _tapWasm's ripple forwarding, applyBackingStore's wasm arm,
 * and purge/restore/destroy's handle lifecycle. The bridge module is
 * mocked so a fake widget stands in for the rust/theme-slider
 * artifact (happy-dom has no WebGPU).
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { THEME } from '@core/tokens/theme/theme.js'
import { attachMockGL } from '@tests/fixtures/mock-webgl.js'
import store from '@core/store.js'
import { PREF_MUTATIONS } from '@core/tokens/events/mutations.js'

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
  (await import('@core/utils/canvas/widgets/theme-slider.js')).ThemeSliderWebGL

/** Flushes the mount promise + a couple of frames. */
const flush = async () => {
  await Promise.resolve()
  await new Promise((r) => setTimeout(r, 40))
}

const makeCanvas = () => {
  const canvas = document.createElement(HTML_TAGS.CANVAS)

  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 280, height: 64 })

  return canvas
}

beforeEach(() => {
  store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)

  mountResult = null
  mockGpu = true

  fakeWidget = {
    calls: { state: [], frame: [], size: [], dev: [], tap: [] },
    set_state: (p, k) => fakeWidget.calls.state.push([p, k]),
    frame: (dt) => fakeWidget.calls.frame.push(dt),
    set_size: (w, h) => fakeWidget.calls.size.push([w, h]),
    resize: (w, h) => fakeWidget.calls.dev.push([w, h]),
    tap: (t, x) => fakeWidget.calls.tap.push([t, x]),
  }

  mountResult = { canvas: null, widget: fakeWidget, destroy: jest.fn() }
})

describe('theme-slider wasm path', () => {
  test('mount success wires the fake widget — sizes, state, frames', async () => {
    const ThemeSliderWebGL = await loadClass()
    const canvas = makeCanvas()

    const slider = new ThemeSliderWebGL(canvas)

    await flush()

    expect(slider._wasm).not.toBeNull()
    expect(slider.useWebGL).toBe(true)
    expect(slider.gl).toBeNull()
    expect(fakeWidget.calls.size.length).toBeGreaterThan(0)
    expect(fakeWidget.calls.dev.length).toBeGreaterThan(0)
    expect(fakeWidget.calls.state.length).toBeGreaterThan(0)
    expect(fakeWidget.calls.frame.length).toBeGreaterThan(0)

    slider.destroy()

    expect(mountResult.destroy).toHaveBeenCalled()
    expect(slider._wasm).toBeNull()
  })

  test('mount failure falls back through initRest to WebGL', async () => {
    mountResult = null

    const ThemeSliderWebGL = await loadClass()
    const canvas = makeCanvas()

    attachMockGL(canvas)

    const slider = new ThemeSliderWebGL(canvas)

    await flush()

    expect(slider._wasm).toBeNull()
    expect(slider._wasmFailed).toBe(true)
    expect(slider.gl).not.toBeNull()
    expect(slider.useWebGL).toBe(true)

    slider.destroy()
  })

  test('no WebGPU takes the synchronous classic path', async () => {
    mockGpu = false

    const ThemeSliderWebGL = await loadClass()
    const canvas = makeCanvas()

    attachMockGL(canvas)

    const slider = new ThemeSliderWebGL(canvas)

    expect(slider._wasm).toBeNull()
    expect(slider.gl).not.toBeNull()

    slider.destroy()
  })

  test('purge during the in-flight mount releases the late handle', async () => {
    const ThemeSliderWebGL = await loadClass()
    const canvas = makeCanvas()

    const slider = new ThemeSliderWebGL(canvas)

    slider._purged = true

    await flush()

    expect(slider._wasm).toBeNull()
    expect(mountResult.destroy).toHaveBeenCalled()

    slider.destroy()
  })

  test('purge releases the widget and restore re-mounts it', async () => {
    const ThemeSliderWebGL = await loadClass()
    const canvas = makeCanvas()

    document.body.appendChild(canvas)

    const slider = new ThemeSliderWebGL(canvas)

    await flush()

    expect(slider._wasm).not.toBeNull()

    slider.purge()

    expect(mountResult.destroy).toHaveBeenCalled()
    expect(slider._wasm).toBeNull()

    slider.restore()

    await flush()

    expect(slider._wasm).not.toBeNull()

    slider.destroy()

    canvas.remove()
  })

  test('setTheme forwards the ripple stamp to widget tap()', async () => {
    const ThemeSliderWebGL = await loadClass()
    const canvas = makeCanvas()

    const slider = new ThemeSliderWebGL(canvas)

    await flush()

    slider.setTheme(THEME.DARK)

    expect(fakeWidget.calls.tap.length).toBe(1)
    expect(fakeWidget.calls.tap[0][1]).toBeGreaterThan(0)

    slider.destroy()
  })

  test('bindEvents latches — a remount does not re-bind handlers', async () => {
    const ThemeSliderWebGL = await loadClass()
    const canvas = makeCanvas()

    const slider = new ThemeSliderWebGL(canvas)

    await flush()

    const bound = slider.onPointerDown

    slider.bindEvents()

    // Same handler instance — bindThemeSliderEvents did not re-run.
    expect(slider.onPointerDown).toBe(bound)

    slider.destroy()
  })

  test('reduced-motion static frame pushes one wasm state + draw', async () => {
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)

    const ThemeSliderWebGL = await loadClass()
    const canvas = makeCanvas()

    const slider = new ThemeSliderWebGL(canvas)

    await flush()

    expect(slider._wasm).not.toBeNull()
    expect(fakeWidget.calls.state.length).toBeGreaterThan(0)
    expect(fakeWidget.calls.frame.length).toBeGreaterThan(0)

    slider.destroy()
  })
})
