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
import { MOUSE_EVENTS } from '@core/tokens/events/dom.js'
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

/** Mutable decoder throw flag — simulates a rejecting decode. */
let decodeThrow = false

jest.unstable_mockModule('@core/utils/wasm/wasm-image-decoder.js', () => ({
  wasmImageDecoder: {
    decodeImageWASM: async () => {
      if (decodeThrow) throw new Error('decode')

      return decodeResult
    },
  },
}))

/** Imports the class + anim/loop modules AFTER the mocks are registered. */
const loadModules = async () => ({
  FlagWebGL: (await import('@core/utils/canvas/widgets/flag-webgl.js')).FlagWebGL,
  wasmAnimType: (await import('@core/utils/canvas/widgets/flag/anim.js')).wasmAnimType,
  getAnimType: (await import('@core/utils/canvas/widgets/flag/anim.js')).getAnimType,
  resizeToNaturalAspect: (await import('@core/utils/canvas/widgets/flag/anim.js'))
    .resizeToNaturalAspect,
  renderFlagWasm: (await import('@core/utils/canvas/widgets/flag/loop.js')).renderFlagWasm,
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
  decodeThrow = false

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

  test('_tryWasm early-returns when a mount is pending or already live', async () => {
    const { FlagWebGL } = await loadModules()

    const pending = new FlagWebGL(makeCanvas(), lang(LOCALES.EN, 'us'))

    pending._wasmPending = true
    pending._tryWasm() // pending operand

    const live = new FlagWebGL(makeCanvas(), lang(LOCALES.EN, 'us'))

    await flush()

    live._tryWasm() // live _wasm operand
    live.destroy()
    pending.destroy()
  })

  test('loadWasmImages guards missing wasm and drops post-decode when paused', async () => {
    const { FlagWebGL } = await loadModules()

    const flag = new FlagWebGL(makeCanvas(), lang(LOCALES.EN, 'us'))

    flag.loadWasmImages() // !this._wasm arm

    await flush()

    const tex0 = fakeWidget.calls.tex

    flag._paused = true
    flag.loadWasmImages() // decode resolves → the !this._wasm || this._paused arm

    await flush()

    expect(fakeWidget.calls.tex).toBe(tex0)

    flag.destroy()
  })

  test('a rejecting decode resolves null through the catch arm', async () => {
    decodeThrow = true

    const { FlagWebGL } = await loadModules()

    const flag = new FlagWebGL(makeCanvas(), lang(LOCALES.EN, 'us'))

    await flush()

    expect(flag._wasmFailed).toBe(true)
    expect(flag.renderer).not.toBeNull()

    flag.destroy()
  })

  test('init2d falls back when the canvas reference is gone', async () => {
    const { FlagWebGL } = await loadModules()

    const flag = new FlagWebGL(makeCanvas(), lang(LOCALES.EN, 'us'))

    flag.canvas = null
    flag.init2d()

    expect(flag.useWebGL).toBe(false)

    flag.destroy()
  })

  test('hover events on the bound target drive setHover', async () => {
    const { FlagWebGL } = await loadModules()
    const canvas = makeCanvas()
    const parent = document.createElement(HTML_TAGS.DIV)

    parent.appendChild(canvas)
    document.body.appendChild(parent)

    const flag = new FlagWebGL(canvas, lang(LOCALES.EN, 'us'))

    await flush()

    flag.boundTarget.dispatchEvent(new Event(MOUSE_EVENTS.MOUSEENTER))

    expect(flag.isHovered).toBe(true)

    flag.boundTarget.dispatchEvent(new Event(MOUSE_EVENTS.MOUSELEAVE))

    expect(flag.isHovered).toBe(false)

    flag.destroy()
    parent.remove()
  })

  test('getAnimType maps every locale code and defaults unknown to EN', async () => {
    const { getAnimType } = await loadModules()
    const flag = (code) => ({ lang: { code } })

    expect(getAnimType(flag(LOCALES.EN))).toBe(0)
    expect(getAnimType(flag(LOCALES.BR))).toBe(1)
    expect(getAnimType(flag(LOCALES.ES))).toBe(2)
    expect(getAnimType(flag(LOCALES.DE))).toBe(3)
    expect(getAnimType(flag(LOCALES.HRK))).toBe(4)
    expect(getAnimType(flag(LOCALES.CAS))).toBe(5)
    expect(getAnimType(flag(LOCALES.RIV))).toBe(6)
    expect(getAnimType(flag(LOCALES.GN))).toBe(7)
    expect(getAnimType(flag(LOCALES.IT))).toBe(8)
    expect(getAnimType(flag(LOCALES.RU))).toBe(9)
    expect(getAnimType(flag(LOCALES.FR))).toBe(10)
    expect(getAnimType(flag(LOCALES.TLN))).toBe(11)
    expect(getAnimType(flag(LOCALES.GL))).toBe(12)
    expect(getAnimType(flag(LOCALES.CA))).toBe(13)
    expect(getAnimType(flag(LOCALES.NL))).toBe(14)
    expect(getAnimType(flag(LOCALES.GA))).toBe(15)
    expect(getAnimType(flag('zz-unknown'))).toBe(0)
  })

  test('renderFlagWasm no-ops without a handle; resizeToNaturalAspect tolerates missing window/dpr', async () => {
    const { renderFlagWasm, resizeToNaturalAspect } = await loadModules()

    renderFlagWasm({ _wasm: null }, 0)

    const flag = {
      height: 32,
      width: 0,
      canvas: { width: 0, height: 0 },
      _displayAspect: () => 1.5,
      _wasm: null,
    }
    const realWindow = globalThis.window

    delete globalThis.window
    resizeToNaturalAspect(flag) // typeof window undefined → dpr 1

    globalThis.window = realWindow

    const prev = realWindow.devicePixelRatio

    Object.defineProperty(realWindow, 'devicePixelRatio', { value: 0, configurable: true })
    resizeToNaturalAspect(flag) // 0 || 1 → 1
    Object.defineProperty(realWindow, 'devicePixelRatio', { value: prev, configurable: true })
  })
})
