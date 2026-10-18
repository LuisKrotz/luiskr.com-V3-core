/**
 * @file coverage/canvas/widgets/switch-slider-wasm-tails.test.js
 * @description Coverage tail for the WebGPU/wasm switch slider path —
 * init's wasm arm + the initRest classic fallback, the mount
 * callback's purged/failed arms, render's wasm arm (set_state +
 * frame), the bindEvents latch, and purge/restore/destroy's handle
 * lifecycle. The bridge module is mocked so a fake widget stands in
 * for the rust/switch-slider artifact (happy-dom has no WebGPU).
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { MOUSE_EVENTS } from '@core/tokens/events/dom.js'
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
  (await import('@core/utils/canvas/widgets/switch-slider.js')).SwitchWebGL

/** Flushes the mount promise + a couple of frames. */
const flush = async () => {
  await Promise.resolve()
  await new Promise((r) => setTimeout(r, 40))
}

const makeCanvas = () => document.createElement(HTML_TAGS.CANVAS)

beforeEach(() => {
  store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)

  mountResult = null
  mockGpu = true

  fakeWidget = {
    calls: { state: [], frame: [], size: [], dev: [] },
    set_state: (p, k, c) => fakeWidget.calls.state.push([p, k, c]),
    frame: (dt) => fakeWidget.calls.frame.push(dt),
    set_size: (w, h) => fakeWidget.calls.size.push([w, h]),
    resize: (w, h) => fakeWidget.calls.dev.push([w, h]),
  }

  mountResult = { canvas: null, widget: fakeWidget, destroy: jest.fn() }
})

describe('switch-slider wasm path', () => {
  test('mount success wires the fake widget — sizes, state, frames', async () => {
    const SwitchWebGL = await loadClass()
    const canvas = makeCanvas()

    const sw = new SwitchWebGL(canvas)

    await flush()

    expect(sw._wasm).not.toBeNull()
    expect(sw.useWebGL).toBe(true)
    expect(sw.gl).toBeNull()
    expect(fakeWidget.calls.size.length).toBeGreaterThan(0)
    expect(fakeWidget.calls.dev.length).toBeGreaterThan(0)
    expect(fakeWidget.calls.state.length).toBeGreaterThan(0)
    expect(fakeWidget.calls.frame.length).toBeGreaterThan(0)

    sw.destroy()

    expect(mountResult.destroy).toHaveBeenCalled()
    expect(sw._wasm).toBeNull()
  })

  test('mount failure falls back through initRest to WebGL', async () => {
    mountResult = null

    const SwitchWebGL = await loadClass()
    const canvas = makeCanvas()

    attachMockGL(canvas)

    const sw = new SwitchWebGL(canvas)

    await flush()

    expect(sw._wasm).toBeNull()
    expect(sw._wasmFailed).toBe(true)
    expect(sw.gl).not.toBeNull()
    expect(sw.useWebGL).toBe(true)

    sw.destroy()
  })

  test('no WebGPU takes the synchronous classic path', async () => {
    mockGpu = false

    const SwitchWebGL = await loadClass()
    const canvas = makeCanvas()

    attachMockGL(canvas)

    const sw = new SwitchWebGL(canvas)

    expect(sw._wasm).toBeNull()
    expect(sw.gl).not.toBeNull()

    sw.destroy()
  })

  test('purge during the in-flight mount releases the late handle', async () => {
    const SwitchWebGL = await loadClass()
    const canvas = makeCanvas()

    const sw = new SwitchWebGL(canvas)

    sw._purged = true

    await flush()

    expect(sw._wasm).toBeNull()
    expect(mountResult.destroy).toHaveBeenCalled()

    sw.destroy()
  })

  test('purge releases the widget and restore re-mounts it', async () => {
    const SwitchWebGL = await loadClass()
    const canvas = makeCanvas()

    document.body.appendChild(canvas)

    const sw = new SwitchWebGL(canvas)

    await flush()

    expect(sw._wasm).not.toBeNull()

    sw.purge()

    expect(mountResult.destroy).toHaveBeenCalled()
    expect(sw._wasm).toBeNull()

    sw.restore()

    await flush()

    expect(sw._wasm).not.toBeNull()

    sw.destroy()

    canvas.remove()
  })

  test('toggle springs push per-frame state into the widget', async () => {
    const SwitchWebGL = await loadClass()
    const canvas = makeCanvas()

    const sw = new SwitchWebGL(canvas)

    await flush()

    sw.toggle()

    await flush()

    // The last set_state carries the eased progress toward 1.
    const last = fakeWidget.calls.state[fakeWidget.calls.state.length - 1]

    expect(last[0]).toBeGreaterThan(0)

    sw.destroy()
  })

  test('bindEvents latches — a remount does not double-bind click', async () => {
    const SwitchWebGL = await loadClass()
    const canvas = makeCanvas()

    const sw = new SwitchWebGL(canvas)

    await flush()

    sw.bindEvents()

    const toggles = []

    sw.onToggle = () => toggles.push(1)

    canvas.dispatchEvent(new window.MouseEvent(MOUSE_EVENTS.CLICK))

    expect(toggles).toHaveLength(1)

    sw.destroy()
  })

  test('reduced-motion static frame pushes one wasm state + draw', async () => {
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)

    const SwitchWebGL = await loadClass()
    const canvas = makeCanvas()

    const sw = new SwitchWebGL(canvas)

    await flush()

    expect(sw._wasm).not.toBeNull()
    expect(fakeWidget.calls.state.length).toBeGreaterThan(0)
    expect(fakeWidget.calls.frame.length).toBeGreaterThan(0)

    sw.destroy()
  })
})
