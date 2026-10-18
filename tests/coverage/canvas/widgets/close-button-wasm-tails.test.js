/**
 * @file coverage/canvas/widgets/close-button-wasm-tails.test.js
 * @description Coverage tail for the WebGPU/wasm close button path —
 * init's wasm arm + the initRest classic fallback, the mount
 * callback's purged/failed arms, render's wasm arm (set_state +
 * frame), triggerClick's wasm click() forwarding,
 * applyBackingStore's wasm arm, and purge/restore/destroy's handle
 * lifecycle. The bridge module is mocked so a fake widget stands in
 * for the rust/close-button artifact (happy-dom has no WebGPU).
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
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
  (await import('@core/utils/canvas/widgets/close-button.js')).CloseButtonWebGL

/** Flushes the mount promise + a couple of frames. */
const flush = async () => {
  await Promise.resolve()
  await new Promise((r) => setTimeout(r, 40))
}

const makeCanvas = () => {
  const canvas = document.createElement(HTML_TAGS.CANVAS)
  const parent = document.createElement(HTML_TAGS.BUTTON)

  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 36, height: 36 })
  parent.getBoundingClientRect = () => ({ left: 0, top: 0, width: 55, height: 55 })

  parent.appendChild(canvas)

  return { canvas, parent }
}

beforeEach(() => {
  store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)

  mountResult = null
  mockGpu = true

  fakeWidget = {
    calls: { state: [], frame: [], size: [], dev: [], click: [] },
    set_state: (l, d, r) => fakeWidget.calls.state.push([l, d, r]),
    frame: (dt) => fakeWidget.calls.frame.push(dt),
    set_size: (w, h) => fakeWidget.calls.size.push([w, h]),
    resize: (w, h) => fakeWidget.calls.dev.push([w, h]),
    click: (t) => fakeWidget.calls.click.push(t),
  }

  mountResult = { canvas: null, widget: fakeWidget, destroy: jest.fn() }
})

describe('close-button wasm path', () => {
  test('mount success wires the fake widget — sizes, state, frames', async () => {
    const CloseButtonWebGL = await loadClass()
    const { canvas } = makeCanvas()

    const btn = new CloseButtonWebGL(canvas)

    await flush()

    expect(btn._wasm).not.toBeNull()
    expect(btn.useWebGL).toBe(true)
    expect(btn.gl).toBeNull()
    expect(fakeWidget.calls.size.length).toBeGreaterThan(0)
    expect(fakeWidget.calls.dev.length).toBeGreaterThan(0)
    expect(fakeWidget.calls.state.length).toBeGreaterThan(0)
    expect(fakeWidget.calls.frame.length).toBeGreaterThan(0)

    btn.destroy()

    expect(mountResult.destroy).toHaveBeenCalled()
    expect(btn._wasm).toBeNull()
  })

  test('mount failure falls back through initRest to WebGL', async () => {
    mountResult = null

    const CloseButtonWebGL = await loadClass()
    const { canvas } = makeCanvas()

    attachMockGL(canvas)

    const btn = new CloseButtonWebGL(canvas)

    await flush()

    expect(btn._wasm).toBeNull()
    expect(btn._wasmFailed).toBe(true)
    expect(btn.gl).not.toBeNull()

    btn.destroy()
  })

  test('no WebGPU takes the synchronous classic path', async () => {
    mockGpu = false

    const CloseButtonWebGL = await loadClass()
    const { canvas } = makeCanvas()

    attachMockGL(canvas)

    const btn = new CloseButtonWebGL(canvas)

    expect(btn._wasm).toBeNull()
    expect(btn.gl).not.toBeNull()

    btn.destroy()
  })

  test('purge during the in-flight mount releases the late handle', async () => {
    const CloseButtonWebGL = await loadClass()
    const { canvas } = makeCanvas()

    const btn = new CloseButtonWebGL(canvas)

    btn._purged = true

    await flush()

    expect(btn._wasm).toBeNull()
    expect(mountResult.destroy).toHaveBeenCalled()

    btn.destroy()
  })

  test('purge releases the widget and restore re-mounts it', async () => {
    const CloseButtonWebGL = await loadClass()
    const { canvas, parent } = makeCanvas()

    document.body.appendChild(parent)

    const btn = new CloseButtonWebGL(canvas)

    await flush()

    expect(btn._wasm).not.toBeNull()

    btn.purge()

    expect(mountResult.destroy).toHaveBeenCalled()
    expect(btn._wasm).toBeNull()

    btn.restore()

    await flush()

    expect(btn._wasm).not.toBeNull()

    btn.destroy()

    parent.remove()
  })

  test('triggerClick forwards the stamp to widget click()', async () => {
    const CloseButtonWebGL = await loadClass()
    const { canvas } = makeCanvas()

    const btn = new CloseButtonWebGL(canvas)

    await flush()

    btn.triggerClick()

    expect(fakeWidget.calls.click.length).toBe(1)
    expect(fakeWidget.calls.click[0]).toBeGreaterThan(0)

    btn.destroy()
  })

  test('bindEvents latches — a remount does not re-bind the target', async () => {
    const CloseButtonWebGL = await loadClass()
    const { canvas } = makeCanvas()

    const btn = new CloseButtonWebGL(canvas)

    await flush()

    const bound = btn.boundTarget

    btn.bindEvents()

    expect(btn.boundTarget).toBe(bound)

    btn.destroy()
  })

  test('reduced-motion static frame pushes one wasm state + draw', async () => {
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)

    const CloseButtonWebGL = await loadClass()
    const { canvas } = makeCanvas()

    const btn = new CloseButtonWebGL(canvas)

    await flush()

    expect(btn._wasm).not.toBeNull()
    expect(fakeWidget.calls.state.length).toBeGreaterThan(0)
    expect(fakeWidget.calls.frame.length).toBeGreaterThan(0)

    btn.destroy()
  })
})
