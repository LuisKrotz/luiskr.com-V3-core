/**
 * @file coverage/utils/gpu/scene3d-tails.test.js
 * @description Coverage tail for utils/gpu/scene3d.ts — the JS facade
 * over the rust/scene3d Surface3d handle. Covers the capability/spec
 * gates, the artifact/mount failure arms, the live-mount resize wiring
 * (initial + ResizeObserver + DPR rounding), the teardown path, the
 * texture upload helper's three arms, and the SCENE3D_NONE sentinel.
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { GPU_WIDGET_ARTIFACTS, GPU_WIDGET_KINDS } from '@core/tokens/motion/gpu-widgets.js'

let mockGpu = true
let decodeResult = null

jest.unstable_mockModule('@core/utils/gpu/webgpu-widget.js', () => ({
  hasWebGpu: () => mockGpu,
  mountWebGpuWidget: async () => null,
  warmWidgetArtifacts: () => undefined,
}))

jest.unstable_mockModule('@core/utils/wasm/wasm-image-decoder.js', () => ({
  wasmImageDecoder: {
    decodeImageWASM: async () => decodeResult,
  },
}))

let mod

/** Records surface calls on a fake Surface3d. */
const makeSurface = () => ({
  resizes: [],
  uploads: [],
  destroyed: false,
  resize(w, h) {
    this.resizes.push([w, h])
  },
  upload_texture(bmp, w, h) {
    this.uploads.push([bmp, w, h])

    return 7
  },
  destroy() {
    this.destroyed = true
  },
})

describe('scene3d facade', () => {
  let canvas

  beforeEach(async () => {
    mockGpu = true
    decodeResult = null
    mod = await import('@core/utils/gpu/scene3d.js')
    canvas = document.createElement('canvas')

    document.body.appendChild(canvas)
    Object.defineProperty(canvas, 'clientWidth', { value: 320, configurable: true })
    Object.defineProperty(canvas, 'clientHeight', { value: 240, configurable: true })
  })

  afterEach(() => {
    canvas.remove()
    delete globalThis.ResizeObserver
  })

  const loader =
    (surface, { failInit = false, failMount = false } = {}) =>
    async () => ({
      default: async () => {
        if (failInit) throw new Error('init')
      },
      mount: async () => {
        if (failMount) throw new Error('mount')

        return surface
      },
    })

  test('exposes the u32::MAX sentinel for root-parent/no-texture slots', () => {
    expect(mod.SCENE3D_NONE).toBe(4294967295)
  })

  test('resolves null without navigator.gpu', async () => {
    mockGpu = false

    const load = jest.fn(loader(makeSurface()))

    expect(await mod.mountScene3d(canvas, load)).toBeNull()
    expect(load).not.toHaveBeenCalled()
  })

  test('resolves null when the artifact load rejects', async () => {
    const load = async () => {
      throw new Error('404')
    }

    expect(await mod.mountScene3d(canvas, load)).toBeNull()
  })

  test('resolves null when the wasm init throws', async () => {
    expect(await mod.mountScene3d(canvas, loader(null, { failInit: true }))).toBeNull()
  })

  test('resolves null when mount throws after init', async () => {
    expect(await mod.mountScene3d(canvas, loader(null, { failMount: true }))).toBeNull()
  })

  test('live mount resizes once at device px and observes the canvas', async () => {
    const surface = makeSurface()
    const observed = []
    const RO = class {
      observe(el) {
        observed.push(el)
      }
      disconnect() {
        this.disconnected = true
      }
    }

    globalThis.ResizeObserver = RO
    window.devicePixelRatio = 2

    const handle = await mod.mountScene3d(canvas, loader(surface))

    expect(handle).not.toBeNull()
    expect(handle.surface).toBe(surface)
    expect(surface.resizes).toEqual([[640, 480]])
    expect(observed).toEqual([canvas])

    window.devicePixelRatio = 1
  })

  test('the RO arm re-pushes the device size and destroy tears down', async () => {
    const surface = makeSurface()
    let captured = null

    globalThis.ResizeObserver = class {
      constructor(cb) {
        this.cbs = [cb]
        captured = this
      }
      observe() {}
      disconnect() {
        this.disconnected = true
      }
      fire() {
        for (const cb of this.cbs) cb()
      }
    }

    const handle = await mod.mountScene3d(canvas, loader(surface))

    expect(handle).not.toBeNull()

    Object.defineProperty(canvas, 'clientWidth', { value: 100, configurable: true })
    captured.fire()

    expect(surface.resizes.length).toBe(2)
    expect(surface.resizes[1]).toEqual([100, 240])

    handle.destroy()

    expect(captured.disconnected).toBe(true)
    expect(surface.destroyed).toBe(true)
  })

  test('no ResizeObserver still mounts (typeof guard arm)', async () => {
    const surface = makeSurface()

    const handle = await mod.mountScene3d(canvas, loader(surface))

    expect(handle).not.toBeNull()
    expect(surface.resizes.length).toBe(1)

    handle.destroy()

    expect(surface.destroyed).toBe(true)
  })

  test('resizeScene3d clamps to 1px minimums', () => {
    const surface = makeSurface()

    Object.defineProperty(canvas, 'clientWidth', { value: 0, configurable: true })
    Object.defineProperty(canvas, 'clientHeight', { value: 0, configurable: true })

    mod.resizeScene3d(surface, canvas)

    expect(surface.resizes).toEqual([[1, 1]])
  })

  test('loadScene3dTexture returns null when decode fails', async () => {
    decodeResult = null

    expect(await mod.loadScene3dTexture(makeSurface(), '/tex.png', 64, 64)).toBeNull()
  })

  test('loadScene3dTexture uploads the bitmap and returns the tex id', async () => {
    const bmp = { width: 128, height: 64 }

    decodeResult = bmp

    const surface = makeSurface()

    expect(await mod.loadScene3dTexture(surface, '/tex.png', 128, 64)).toBe(7)
    expect(surface.uploads).toEqual([[bmp, 128, 64]])
  })

  test('loadScene3dTexture returns null when upload_texture throws', async () => {
    decodeResult = { width: 8, height: 8 }

    const surface = makeSurface()

    surface.upload_texture = () => {
      throw new Error('lost')
    }

    expect(await mod.loadScene3dTexture(surface, '/tex.png', 8, 8)).toBeNull()
  })

  test('the SCENE3D registry entry points at the scene3d artifact', () => {
    const spec = GPU_WIDGET_ARTIFACTS[GPU_WIDGET_KINDS.SCENE3D]

    expect(spec.url).toContain('/wasm/scene3d/')
    expect(spec.cls).toBe('Surface3d')
    expect(spec.eager).toBe(false)
  })
})
