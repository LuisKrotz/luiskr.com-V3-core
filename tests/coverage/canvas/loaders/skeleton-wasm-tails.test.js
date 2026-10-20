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
import { WINDOW_EVENTS } from '@core/tokens/events/dom.js'
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

  test('host RO callback and window resize schedule a refresh', async () => {
    const ros = []
    const win = { cb: null }
    const realRO = globalThis.ResizeObserver
    const realRaf = globalThis.requestAnimationFrame

    globalThis.ResizeObserver = class {
      constructor(cb) {
        this.cb = cb

        ros.push(this)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    globalThis.requestAnimationFrame = (cb) => {
      win.cb = cb

      return 1
    }

    const SkeletonWebGL = await loadLayer()
    const { host, root, content } = makeHost()

    content.appendChild(
      makeSkel(SKELETON_CLASSES.SKELETON_BLOCK, { left: 0, top: 0, width: 100, height: 40 })
    )

    const layer = new SkeletonWebGL(host, root, content)

    layer.base = [0.1, 0.1, 0.1]
    layer.ink = [0.9, 0.9, 0.9]

    await flush()

    // RO callback → _scheduleRefresh → rAF-held refresh.
    ros[0].cb()

    expect(layer._refreshId).not.toBeNull()

    // A second fire while a refresh is pending is dropped.
    ros[0].cb()

    win.cb()

    expect(layer._refreshId).toBeNull()

    // _onResize arrow → refresh().
    const spy = jest.spyOn(layer, 'refresh')

    window.dispatchEvent(new Event(WINDOW_EVENTS.RESIZE))

    expect(spy).toHaveBeenCalled()

    // useWebGL false → _scheduleRefresh early-returns.
    layer.useWebGL = false
    layer._scheduleRefresh()

    expect(layer._refreshId).toBeNull()

    layer.useWebGL = true

    globalThis.ResizeObserver = realRO
    globalThis.requestAnimationFrame = realRaf

    layer.destroy()
    host.remove()
  })

  test('idle begin arms — live start, dead layer, and pending rAF', async () => {
    const realRic = globalThis.requestIdleCallback
    let idleCb = null

    globalThis.requestIdleCallback = (cb) => {
      idleCb = cb

      return 7
    }

    const SkeletonWebGL = await loadLayer()

    // Destroyed after activate but before idle fires → begin sees
    // useWebGL false and skips the loop start.
    {
      const { host, root, content } = makeHost()
      const layer = new SkeletonWebGL(host, root, content)

      await flush()
      layer.destroy()
      idleCb()

      expect(layer.animId).toBeNull()
      host.remove()
    }

    // animId already pending → begin does not restart the loop.
    {
      const { host, root, content } = makeHost()
      const layer = new SkeletonWebGL(host, root, content)

      await flush()

      layer.animId = 9
      idleCb()

      expect(layer.animId).toBe(9)
      layer.destroy()
      host.remove()
    }

    // Live layer → begin starts the loop (setTimeout arm needs rIC absent,
    // covered below).
    {
      const { host, root, content } = makeHost()
      const layer = new SkeletonWebGL(host, root, content)

      layer.base = [0.1, 0.1, 0.1]
      layer.ink = [0.9, 0.9, 0.9]

      await flush()

      idleCb()

      expect(layer._idleId).toBeNull()
      layer.destroy()
      host.remove()
    }

    globalThis.requestIdleCallback = realRic
  })

  test('no requestIdleCallback falls back to the setTimeout idle path', async () => {
    const realRic = globalThis.requestIdleCallback

    globalThis.requestIdleCallback = undefined

    const SkeletonWebGL = await loadLayer()
    const { host, root, content } = makeHost()
    const layer = new SkeletonWebGL(host, root, content)

    layer.base = [0.1, 0.1, 0.1]
    layer.ink = [0.9, 0.9, 0.9]

    await flush()

    await new Promise((r) => setTimeout(r, 650))

    expect(layer._idleId).toBeNull()

    globalThis.requestIdleCallback = realRic

    layer.destroy()
    host.remove()
  })

  test('init no-ops without a document', async () => {
    const { init } = await import('@core/utils/canvas/loaders/skeleton/init.js')
    const realDocument = globalThis.document

    globalThis.document = undefined

    const host = {}

    init(host)

    expect(host.canvas).toBeUndefined()

    globalThis.document = realDocument
  })

  test('a null renderer acquire skips the release arm', async () => {
    mockGpu = false

    const { skeletonRenderer } = await import('@core/utils/canvas/loaders/skeleton/renderer.js')
    const acquireSpy = jest.spyOn(skeletonRenderer, 'acquire').mockReturnValue(null)

    const SkeletonWebGL = await loadLayer()
    const { host, root, content } = makeHost()
    const layer = new SkeletonWebGL(host, root, content)

    expect(layer.renderer).toBeNull()
    expect(layer.canvas).toBeNull()

    acquireSpy.mockRestore()

    layer.destroy()
    host.remove()
  })

  test('reduced motion paints one static frame then stops the loop', async () => {
    const { default: store } = await import('@core/store.js')
    const motionSpy = jest.spyOn(store.getters, 'getReducedMotion').mockReturnValue(true)

    const SkeletonWebGL = await loadLayer()
    const { host, root, content } = makeHost()

    content.appendChild(
      makeSkel(SKELETON_CLASSES.SKELETON_BLOCK, { left: 0, top: 0, width: 100, height: 40 })
    )

    const layer = new SkeletonWebGL(host, root, content)

    layer.base = [0.1, 0.1, 0.1]
    layer.ink = [0.9, 0.9, 0.9]

    await flush()

    layer._frame = 1
    layer._loop()

    // Static frame painted, then the loop cancelled itself.
    expect(layer.animId).toBeNull()

    motionSpy.mockRestore()

    layer.destroy()
    host.remove()
  })

  test('a missing 2D context drops the canvas but keeps the renderer release', async () => {
    mockGpu = false

    const proto = window.HTMLCanvasElement?.prototype || HTMLCanvasElement.prototype

    // The shared renderer still acquires its GL context; only the layer's
    // 2D blit context fails → renderer release arm runs.
    proto.getContext = (type) => (/webgl/i.test(String(type)) ? mockGL : null)

    const SkeletonWebGL = await loadLayer()
    const { host, root, content } = makeHost()
    const layer = new SkeletonWebGL(host, root, content)

    expect(layer.canvas).toBeNull()
    expect(layer.renderer).toBeNull()
    expect(layer.useWebGL).toBe(false)

    layer.destroy()
    host.remove()
  })

  test('loop skips paused/skipped frames and tears down past resolve', async () => {
    const SkeletonWebGL = await loadLayer()
    const { host, root, content } = makeHost()

    content.appendChild(
      makeSkel(SKELETON_CLASSES.SKELETON_BLOCK, { left: 0, top: 0, width: 100, height: 40 })
    )

    const layer = new SkeletonWebGL(host, root, content)

    layer.base = [0.1, 0.1, 0.1]
    layer.ink = [0.9, 0.9, 0.9]

    await flush()

    // Not accelerated → early return.
    layer.useWebGL = false
    layer._loop()
    layer.useWebGL = true

    // _frame 1 % FRAME_SKIP → skip arm.
    layer._frame = 0
    layer._loop()

    // Paused + frame boundary → the paused guard.
    layer._frame = 1
    layer._paused = true
    layer._loop()
    layer._paused = false

    // Resolve past duration → destroy + return.
    layer._frame = 1
    layer.resolveStart = performance.now() - 10_000
    layer._loop()

    expect(layer._abandoned).toBe(true)

    host.remove()
  })

  test('render guards and the dead-renderer destroy arm', async () => {
    const SkeletonWebGL = await loadLayer()
    const { host, root, content } = makeHost()

    content.appendChild(
      makeSkel(SKELETON_CLASSES.SKELETON_BLOCK, { left: 0, top: 0, width: 100, height: 40 })
    )

    const layer = new SkeletonWebGL(host, root, content)

    layer.base = [0.1, 0.1, 0.1]
    layer.ink = [0.9, 0.9, 0.9]

    await flush()

    // Early guards: no canvas, zero size, no rects.
    const keepCanvas = layer.canvas

    layer.canvas = null
    layer._render(0, 0)
    layer.canvas = keepCanvas
    layer.canvas.width = 0
    layer._render(0, 0)
    layer.canvas.width = 8
    layer.canvas.height = 0
    layer._render(0, 0)
    layer.canvas.height = 8
    layer.rects = []
    layer._render(0, 0)

    // Two live wasm frames → the second takes the `_wasmT` delta arm.
    layer.rects = [
      { x: 0, y: 0, w: 1, h: 1, radius: 0, cell: 1, row: 0, base: [0, 0, 0], ink: [1, 1, 1] },
    ]
    layer._render(1, 0)
    layer._render(2, 0)

    // Dead shared renderer → destroy arm.
    layer._wasm = null
    layer.renderer = null
    layer._render(0, 0)

    expect(layer._abandoned).toBe(true)

    host.remove()
  })

  test('resolve re-entry and missing-canvas class arms', async () => {
    const SkeletonWebGL = await loadLayer()
    const { host, root, content } = makeHost()

    const layer = new SkeletonWebGL(host, root, content)

    layer.base = [0.1, 0.1, 0.1]
    layer.ink = [0.9, 0.9, 0.9]

    await flush()

    // animId null → resolve restarts the loop; canvas null → class skip.
    layer.animId = null
    layer.canvas = null
    layer.resolve()

    expect(layer.resolveStart).not.toBeNull()

    // Second resolve: resolveStart truthy → early return arm.
    layer.resolve()

    // Reset + animId set → the loop-restart guard's skip arm.
    layer.resolveStart = 0
    layer.animId = 7
    layer.resolve()

    layer.destroy()
    host.remove()
  })

  test('syncSkeletonLayer re-measures a live layer and skips a dead one', async () => {
    const { syncSkeletonLayer, destroySkeletonLayer } =
      await import('@core/utils/canvas/loaders/skeleton-webgl.js')
    const component = document.createElement(HTML_TAGS.DIV)
    const content = document.createElement(HTML_TAGS.DIV)

    component.attachShadow({ mode: 'open' })
    component._contentNode = content
    component._skeletonLayer = null

    document.body.appendChild(component)

    content.appendChild(
      makeSkel(SKELETON_CLASSES.SKELETON_BLOCK, { left: 0, top: 0, width: 100, height: 40 })
    )

    syncSkeletonLayer(component)

    expect(component._skeletonLayer).not.toBeNull()

    // Dead layer (useWebGL false) → refresh skipped.
    const deadSpy = jest.spyOn(component._skeletonLayer, 'refresh')

    syncSkeletonLayer(component)

    expect(deadSpy).not.toHaveBeenCalled()

    await flush()

    // Live layer (wasm mounted) → refresh called.
    const liveSpy = jest.spyOn(component._skeletonLayer, 'refresh')

    syncSkeletonLayer(component)

    expect(liveSpy).toHaveBeenCalled()

    // Placeholders gone → resolve path.
    content.replaceChildren()

    syncSkeletonLayer(component)

    expect(component._skeletonLayer).toBeNull()

    destroySkeletonLayer(component)
    component.remove()
  })
})
