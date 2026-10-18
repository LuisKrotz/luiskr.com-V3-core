/**
 * @file coverage/canvas/widgets/flag-wasm-tails.test.js
 * @description Coverage tail for the WebGPU/wasm flag path — init's
 * wasm arm + the init2d fallback, the mount callback's paused/failed
 * arms, loadWasmImages' upload/decode-fail arms, loop's renderFlagWasm
 * (set_state + frame), anim.ts's wasmAnimType locale map +
 * resizeToNaturalAspect's wasm arm, and purge/restore/destroy's
 * handle lifecycle. The bridge + image-decoder modules are mocked so
 * a fake widget + fake bitmaps stand in for the rust/flag artifact
 * (happy-dom has no WebGPU).
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { LOCALES } from '@core/tokens/locales.js'
import { GPU_FLAG_ANIMS } from '@core/tokens/motion/gpu-widgets.js'
import { createMockGL, createMock2D } from '@tests/fixtures/mock-webgl.js'
import store from '@core/store.js'
import { PREF_MUTATIONS } from '@core/tokens/events/mutations.js'

/** Mutable mount result the mock returns — tests swap per case. */
let mountResult = null

/** Mutable WebGPU capability flag the mock's hasWebGpu reads. */
let mockGpu = true

/** Mutable decoder result — null simulates a decode failure. */
let decodeResult = null

/** The fake wasm widget — records every kind-specific setter call. */
let fakeWidget = null

jest.unstable_mockModule('@core/utils/gpu/webgpu-widget.js', () => ({
  hasWebGpu: () => mockGpu,
  mountWebGpuWidget: async () => mountResult,
  warmWidgetArtifacts: () => undefined,
}))

jest.unstable_mockModule('@core/utils/wasm/wasm-image-decoder.js', () => ({
  wasmImageDecoder: {
    decodeImageWASM: async () => decodeResult,
  },
}))

/** Imports the class + anim module AFTER the mocks are registered. */
const loadModules = async () => ({
  FlagWebGL: (await import('@core/utils/canvas/widgets/flag-webgl.js')).FlagWebGL,
  wasmAnimType: (await import('@core/utils/canvas/widgets/flag/anim.js')).wasmAnimType,
})

/** Flushes the mount + decode promises and a couple of frames. */
const flush = async () => {
  await Promise.resolve()
  await new Promise((r) => setTimeout(r, 50))
}

let mockGL
let mock2D
let origGetContext

beforeEach(() => {
  store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)

  mountResult = null
  mockGpu = true

  decodeResult = { width: 120, height: 80, close: () => undefined }

  fakeWidget = {
    calls: { state: [], frame: [], size: [], dev: [], tex: 0 },
    set_state: (h, a, s, x) => fakeWidget.calls.state.push([h, a, s, x]),
    frame: (dt) => fakeWidget.calls.frame.push(dt),
    set_size: (w, h) => fakeWidget.calls.size.push([w, h]),
    resize: (w, h) => fakeWidget.calls.dev.push([w, h]),
    upload_textures: () => fakeWidget.calls.tex++,
  }

  mountResult = { canvas: null, widget: fakeWidget, destroy: jest.fn() }

  mockGL = createMockGL()
  mock2D = createMock2D()

  const proto = window.HTMLCanvasElement?.prototype || HTMLCanvasElement.prototype

  origGetContext = proto.getContext

  proto.getContext = function patchedGetContext(type) {
    if (String(type) === '2d') return mock2D
    if (/webgl/i.test(String(type))) return mockGL

    return null
  }
})

afterEach(() => {
  const proto = window.HTMLCanvasElement?.prototype || HTMLCanvasElement.prototype

  proto.getContext = origGetContext
})

const makeCanvas = () => {
  const canvas = document.createElement(HTML_TAGS.CANVAS)

  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 48, height: 32 })

  return canvas
}

const lang = (code, cc, cc2 = null) => ({ code, cc, cc2 })

describe('flag wasm path', () => {
  test('mount success uploads bitmaps and drives frames + state', async () => {
    const { FlagWebGL } = await loadModules()
    const canvas = makeCanvas()
    const parent = document.createElement(HTML_TAGS.DIV)

    parent.appendChild(canvas)
    document.body.appendChild(parent)

    const flag = new FlagWebGL(canvas, lang(LOCALES.EN, 'us'))

    await flush()

    expect(flag._wasm).not.toBeNull()
    expect(flag.useWebGL).toBe(true)
    expect(flag.isLoaded).toBe(true)
    expect(fakeWidget.calls.tex).toBe(1)
    expect(fakeWidget.calls.size.length).toBeGreaterThan(0)
    expect(fakeWidget.calls.dev.length).toBeGreaterThan(0)
    expect(fakeWidget.calls.state.length).toBeGreaterThan(0)
    expect(fakeWidget.calls.frame.length).toBeGreaterThan(0)

    // The wasm discriminant for EN is its own slot.
    const last = fakeWidget.calls.state[fakeWidget.calls.state.length - 1]

    expect(last[1]).toBe(GPU_FLAG_ANIMS.EN)
    expect(last[2]).toBe(0.0)

    flag.destroy()

    expect(mountResult.destroy).toHaveBeenCalled()
    expect(flag._wasm).toBeNull()

    parent.remove()
  })

  test('split locales upload two bitmaps and push the split flag', async () => {
    const { FlagWebGL } = await loadModules()
    const canvas = makeCanvas()
    const parent = document.createElement(HTML_TAGS.DIV)

    parent.appendChild(canvas)

    const flag = new FlagWebGL(canvas, lang(LOCALES.HRK, 'de', 'br'))

    await flush()

    expect(flag.isLoaded).toBe(true)
    expect(fakeWidget.calls.tex).toBe(1)

    const last = fakeWidget.calls.state[fakeWidget.calls.state.length - 1]

    expect(last[1]).toBe(GPU_FLAG_ANIMS.HRK)
    expect(last[2]).toBe(1.0)
    expect(last[3]).toBeGreaterThan(0)

    flag.destroy()

    parent.remove()
  })

  test('mount failure falls back to the shared-renderer 2D path', async () => {
    mountResult = null

    const { FlagWebGL } = await loadModules()
    const canvas = makeCanvas()

    const flag = new FlagWebGL(canvas, lang(LOCALES.EN, 'us'))

    await flush()

    expect(flag._wasm).toBeNull()
    expect(flag._wasmFailed).toBe(true)
    expect(flag.renderer).not.toBeNull()
    expect(flag.ctx).toBe(mock2D)

    flag.destroy()
  })

  test('decode failure releases the widget and boots the 2D path', async () => {
    decodeResult = null

    const { FlagWebGL } = await loadModules()
    const canvas = makeCanvas()

    const flag = new FlagWebGL(canvas, lang(LOCALES.EN, 'us'))

    await flush()

    expect(flag._wasm).toBeNull()
    expect(flag._wasmFailed).toBe(true)
    expect(flag.renderer).not.toBeNull()
    expect(flag.useWebGL).toBe(true)

    flag.destroy()
  })

  test('no WebGPU takes the synchronous 2D path', async () => {
    mockGpu = false

    const { FlagWebGL } = await loadModules()
    const canvas = makeCanvas()

    const flag = new FlagWebGL(canvas, lang(LOCALES.EN, 'us'))

    expect(flag._wasm).toBeNull()
    expect(flag.renderer).not.toBeNull()

    flag.destroy()
  })

  test('purge during the in-flight mount releases the late handle', async () => {
    const { FlagWebGL } = await loadModules()
    const canvas = makeCanvas()

    const flag = new FlagWebGL(canvas, lang(LOCALES.EN, 'us'))

    flag._paused = true

    await flush()

    expect(flag._wasm).toBeNull()
    expect(mountResult.destroy).toHaveBeenCalled()

    flag.destroy()
  })

  test('purge releases the widget and restore re-mounts it', async () => {
    const { FlagWebGL } = await loadModules()
    const canvas = makeCanvas()
    const parent = document.createElement(HTML_TAGS.DIV)

    parent.appendChild(canvas)
    document.body.appendChild(parent)

    const flag = new FlagWebGL(canvas, lang(LOCALES.EN, 'us'))

    await flush()

    expect(flag._wasm).not.toBeNull()

    flag.purge()

    expect(mountResult.destroy).toHaveBeenCalled()
    expect(flag._wasm).toBeNull()

    flag.restore()

    await flush()

    expect(flag._wasm).not.toBeNull()

    flag.destroy()

    parent.remove()
  })

  test('bindEvents latches — a remount does not re-bind hover', async () => {
    const { FlagWebGL } = await loadModules()
    const canvas = makeCanvas()

    const flag = new FlagWebGL(canvas, lang(LOCALES.EN, 'us'))

    await flush()

    const bound = flag.boundTarget

    flag.bindEvents()

    expect(flag.boundTarget).toBe(bound)

    flag.destroy()
  })

  test('wasmAnimType maps every locale to its wasm discriminant', async () => {
    const { wasmAnimType } = await loadModules()
    const flag = (code) => ({ lang: { code } })

    expect(wasmAnimType(flag(LOCALES.EN))).toBe(GPU_FLAG_ANIMS.EN)
    expect(wasmAnimType(flag(LOCALES.BR))).toBe(GPU_FLAG_ANIMS.PT)
    expect(wasmAnimType(flag(LOCALES.ES))).toBe(GPU_FLAG_ANIMS.ES)
    expect(wasmAnimType(flag(LOCALES.DE))).toBe(GPU_FLAG_ANIMS.DE)
    expect(wasmAnimType(flag(LOCALES.HRK))).toBe(GPU_FLAG_ANIMS.HRK)
    expect(wasmAnimType(flag(LOCALES.CAS))).toBe(GPU_FLAG_ANIMS.CAS)
    expect(wasmAnimType(flag(LOCALES.RIV))).toBe(GPU_FLAG_ANIMS.RIV)
    expect(wasmAnimType(flag(LOCALES.GN))).toBe(GPU_FLAG_ANIMS.GN)
    expect(wasmAnimType(flag(LOCALES.IT))).toBe(GPU_FLAG_ANIMS.IT)
    expect(wasmAnimType(flag(LOCALES.RU))).toBe(GPU_FLAG_ANIMS.RU)
    expect(wasmAnimType(flag(LOCALES.FR))).toBe(GPU_FLAG_ANIMS.FR)
    expect(wasmAnimType(flag(LOCALES.TLN))).toBe(GPU_FLAG_ANIMS.TLN)
    expect(wasmAnimType(flag(LOCALES.NL))).toBe(GPU_FLAG_ANIMS.DE)
    // GL/CA/GA + unknown codes → the Spanish silk personality.
    expect(wasmAnimType(flag(LOCALES.GL))).toBe(GPU_FLAG_ANIMS.ES)
    expect(wasmAnimType(flag(LOCALES.CA))).toBe(GPU_FLAG_ANIMS.ES)
    expect(wasmAnimType(flag(LOCALES.GA))).toBe(GPU_FLAG_ANIMS.ES)
    expect(wasmAnimType(flag('zz-unknown'))).toBe(GPU_FLAG_ANIMS.ES)
  })

  test('reduced-motion static frame pushes one wasm draw when loaded', async () => {
    store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, true)

    const { FlagWebGL } = await loadModules()
    const canvas = makeCanvas()
    const parent = document.createElement(HTML_TAGS.DIV)

    parent.appendChild(canvas)

    const flag = new FlagWebGL(canvas, lang(LOCALES.EN, 'us'))

    await flush()

    expect(flag._wasm).not.toBeNull()
    expect(flag.isLoaded).toBe(true)
    expect(fakeWidget.calls.frame.length).toBeGreaterThan(0)

    flag.destroy()

    parent.remove()
  })
})
