/**
 * @file coverage/canvas/loaders/skeleton-wasm-tails.test.js
 * @description Coverage tail for the WebGPU/wasm skeleton path —
 * init's wasm mount arm + its abandoned/fallback arms, upload's
 * interleaved sheet write, render's wasm frame path, measure's
 * set_size/resize forwarding, and destroy's handle teardown. The
 * bridge module is mocked so a fake widget stands in for the
 * rust/skeleton artifact (happy-dom has no WebGPU).
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { SKELETON_CLASSES } from '@core/tokens/classes/skeleton.js'
import { WEBGL_STRINGS } from '@core/tokens/strings/webgl.js'
import { createMockGL, createMock2D } from '@tests/fixtures/mock-webgl.js'

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
const loadLayer = async () =>
  (await import('@core/utils/canvas/loaders/skeleton-webgl.js')).SkeletonWebGL

/** Flushes the mount promise + a frame. */
const flush = async () => {
  await Promise.resolve()
  await new Promise((r) => setTimeout(r, 30))
}

let mockGL
let mock2D
let origGetContext

beforeEach(() => {
  mountResult = null
  mockGpu = true

  fakeWidget = {
    calls: { sheet: 0, state: [], frame: [], size: [], dev: [] },
    write_sheet: () => fakeWidget.calls.sheet++,
    set_state: (r, a, c) => fakeWidget.calls.state.push([r, a, c]),
    frame: (dt) => fakeWidget.calls.frame.push(dt),
    set_size: (w, h) => fakeWidget.calls.size.push([w, h]),
    resize: (w, h) => fakeWidget.calls.dev.push([w, h]),
  }

  mountResult = { canvas: null, widget: fakeWidget, destroy: jest.fn() }

  mockGL = createMockGL()
  mock2D = createMock2D()

  const proto = window.HTMLCanvasElement?.prototype || HTMLCanvasElement.prototype

  origGetContext = proto.getContext

  proto.getContext = function patchedGetContext(type) {
    if (String(type) === WEBGL_STRINGS.CONTEXT_2D) return mock2D
    if (/webgl/i.test(String(type))) return mockGL

    return null
  }
})

afterEach(() => {
  const proto = window.HTMLCanvasElement?.prototype || HTMLCanvasElement.prototype

  proto.getContext = origGetContext
})

const makeHost = () => {
  const host = document.createElement(HTML_TAGS.DIV)
  const root = document.createElement(HTML_TAGS.DIV)
  const content = document.createElement(HTML_TAGS.DIV)

  host.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300 })

  root.appendChild(content)
  host.appendChild(root)
  document.body.appendChild(host)

  return { host, root, content }
}

const makeSkel = (cls, rect) => {
  const el = document.createElement(HTML_TAGS.DIV)

  el.className = cls
  el.getBoundingClientRect = () => rect

  return el
}

describe('skeleton wasm path', () => {
  test('mount success wires the fake widget — sheet, state, frames', async () => {
    const SkeletonWebGL = await loadLayer()
    const { host, root, content } = makeHost()

    content.appendChild(
      makeSkel(SKELETON_CLASSES.SKELETON_BLOCK, { left: 0, top: 0, width: 100, height: 40 })
    )

    const layer = new SkeletonWebGL(host, root, content)

    // Palette seeds — happy-dom's getComputedStyle returns empty
    // strings, so the per-rect palette falls back to layer.base/ink.
    layer.base = [0.1, 0.1, 0.1]
    layer.ink = [0.9, 0.9, 0.9]

    await flush()

    expect(layer._wasm).not.toBeNull()
    expect(layer.useWebGL).toBe(true)
    expect(layer.renderer).toBeNull()
    expect(fakeWidget.calls.size.length).toBeGreaterThan(0)
    expect(fakeWidget.calls.dev.length).toBeGreaterThan(0)
    expect(fakeWidget.calls.sheet).toBeGreaterThan(0)
    expect(fakeWidget.calls.state.length).toBeGreaterThan(0)
    expect(fakeWidget.calls.frame.length).toBeGreaterThan(0)

    layer.destroy()

    expect(mountResult.destroy).toHaveBeenCalled()
    expect(layer._wasm).toBeNull()
  })

  test('mount failure falls back to the 2D shared renderer', async () => {
    mountResult = null

    const SkeletonWebGL = await loadLayer()
    const { host, root, content } = makeHost()

    content.appendChild(
      makeSkel(SKELETON_CLASSES.SKELETON_BLOCK, { left: 0, top: 0, width: 100, height: 40 })
    )

    const layer = new SkeletonWebGL(host, root, content)

    layer.base = [0.1, 0.1, 0.1]
    layer.ink = [0.9, 0.9, 0.9]

    await flush()

    expect(layer._wasm).toBeNull()
    expect(layer.renderer).not.toBeNull()
    expect(layer.ctx).toBe(mock2D)
    expect(layer.useWebGL).toBe(true)

    layer.destroy()
  })

  test('no WebGPU at all takes the synchronous 2D path', async () => {
    mockGpu = false

    const SkeletonWebGL = await loadLayer()
    const { host, root, content } = makeHost()

    const layer = new SkeletonWebGL(host, root, content)

    // init2d ran synchronously — no flush needed.
    expect(layer._wasm).toBeNull()
    expect(layer.renderer).not.toBeNull()
    expect(layer.ctx).toBe(mock2D)

    layer.destroy()
  })

  test('resolve before the mount resolves latches the layer abandoned', async () => {
    const SkeletonWebGL = await loadLayer()
    const { host, root, content } = makeHost()

    content.appendChild(
      makeSkel(SKELETON_CLASSES.SKELETON_BLOCK, { left: 0, top: 0, width: 100, height: 40 })
    )

    const layer = new SkeletonWebGL(host, root, content)

    // Content resolves while the artifact is still in flight.
    layer.resolve()
    expect(layer._abandoned).toBe(true)

    await flush()

    // The late handle was discarded — no wasm activation, no 2D.
    expect(layer._wasm).toBeNull()
    expect(layer.useWebGL).toBe(false)

    layer.destroy()
  })

  test('destroy before the mount resolves keeps the layer dead', async () => {
    const SkeletonWebGL = await loadLayer()
    const { host, root, content } = makeHost()

    const layer = new SkeletonWebGL(host, root, content)

    layer.destroy()
    expect(layer._abandoned).toBe(true)

    await flush()

    expect(layer._wasm).toBeNull()
  })
})
