/**
 * @file coverage/utils/gpu/webgpu-widget-tails.test.js
 * @description Coverage tail for utils/gpu/webgpu-widget.ts — the
 * per-artifact WebGPU widget bridge. Covers the capability gate, the
 * unknown-kind and missing-artifact early returns, init-failure
 * fallback, the live path (frame ticks, resize forwarding, set_size
 * guard, destroy), and the visibility-gated loop restart.
 */
import { GPU_WIDGET_DRIVE, GPU_WIDGET_KINDS } from '@core/tokens/motion/gpu-widgets.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { hasWebGpu, mountWebGpuWidget, warmWidgetArtifacts } from '@core/utils/gpu/webgpu-widget.js'

/** Captures the widget instance the fake class returns. */
let lastWidget = null

/** Builds a fake wasm module whose widget records every call. */
const recordingModule = (initImpl, cls) => ({
  default: async () => ({}),
  [cls]: function () {
    lastWidget = {
      frames: [],
      resizes: [],
      sizes: [],
      init: initImpl,
      resize: (w, h) => lastWidget.resizes.push([w, h]),
      set_size: (w, h) => lastWidget.sizes.push([w, h]),
      frame: (dt) => lastWidget.frames.push(dt),
    }

    return lastWidget
  },
})

/** Waits one rAF-equivalent tick via a microtask+timer flush. */
const flushTick = async () => {
  await Promise.resolve()
  await new Promise((r) => setTimeout(r, 30))
}

describe('webgpu-widget bridge', () => {
  afterEach(() => {
    delete navigator.gpu
  })

  it('hasWebGpu gates on navigator.gpu', () => {
    expect(hasWebGpu()).toBe(false)

    navigator.gpu = {}
    expect(hasWebGpu()).toBe(true)
  })

  it('returns null without navigator.gpu', async () => {
    delete navigator.gpu
    const canvas = document.createElement('canvas')

    expect(await mountWebGpuWidget(GPU_WIDGET_KINDS.BURGER, canvas)).toBeNull()
  })

  it('returns null for an unknown kind', async () => {
    navigator.gpu = {}
    const canvas = document.createElement('canvas')

    expect(await mountWebGpuWidget(999, canvas)).toBeNull()
  })

  it('returns null when the artifact import rejects', async () => {
    navigator.gpu = {}
    const canvas = document.createElement('canvas')

    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas, async () => {
      throw new Error('404')
    })

    expect(h).toBeNull()
  })

  it('returns null when init fails', async () => {
    navigator.gpu = {}
    const canvas = document.createElement('canvas')

    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.BURGER, canvas, async () =>
      recordingModule(async () => {
        throw new Error('no device')
      }, 'Burger')
    )

    expect(h).toBeNull()
  })

  it('wires frame ticks, resize forwarding, and destroy', async () => {
    navigator.gpu = {}
    const canvas = document.createElement('canvas')

    Object.defineProperty(canvas, 'clientWidth', { value: 40 })
    Object.defineProperty(canvas, 'clientHeight', { value: 16 })
    window.devicePixelRatio = 2

    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.BURGER, canvas, async () =>
      recordingModule(async () => lastWidget, 'Burger')
    )

    expect(h).not.toBeNull()
    expect(lastWidget.sizes[0]).toEqual([40, 16])
    expect(lastWidget.resizes[0]).toEqual([80, 32])

    await flushTick()
    expect(lastWidget.frames.length).toBeGreaterThan(0)
    expect(typeof lastWidget.frames[0]).toBe(TYPE_STRINGS.NUMBER)

    h.destroy()
    const before = lastWidget.frames.length

    await flushTick()
    expect(lastWidget.frames.length).toBe(before)
  })

  it('tolerates a widget without set_size', async () => {
    navigator.gpu = {}
    const canvas = document.createElement('canvas')

    const mod = {
      default: async () => ({}),
      Flag: function () {
        lastWidget = {
          frames: [],
          resizes: [],
          init: async () => lastWidget,
          resize: (w, h) => lastWidget.resizes.push([w, h]),
          frame: (dt) => lastWidget.frames.push(dt),
        }

        return lastWidget
      },
    }

    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.FLAG, canvas, async () => mod)

    expect(h).not.toBeNull()
    expect(lastWidget.resizes.length).toBe(1)
    h.destroy()
  })

  it('pauses the loop while the tab is hidden and resumes on visible', async () => {
    navigator.gpu = {}
    const canvas = document.createElement('canvas')

    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SWITCH_SLIDER, canvas, async () =>
      recordingModule(async () => lastWidget, 'SwitchSlider')
    )

    await flushTick()
    const visible = lastWidget.frames.length

    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    await flushTick()

    const hidden = lastWidget.frames.length

    // The rAF gate stops scheduling while hidden — at most the
    // in-flight tick ran.
    expect(hidden - visible).toBeLessThanOrEqual(1)

    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await flushTick()

    expect(lastWidget.frames.length).toBeGreaterThan(hidden)
    h.destroy()
  })

  it('manual drive wires no clock and no listeners — the caller owns both', async () => {
    navigator.gpu = {}
    const canvas = document.createElement('canvas')

    const h = await mountWebGpuWidget(
      GPU_WIDGET_KINDS.SKELETON,
      canvas,
      async () => recordingModule(async () => lastWidget, 'Skeleton'),
      { drive: GPU_WIDGET_DRIVE.MANUAL }
    )

    expect(h).not.toBeNull()
    expect(lastWidget.resizes.length).toBe(0)
    expect(lastWidget.sizes.length).toBe(0)

    await flushTick()

    // No bridge rAF — zero unsolicited frames.
    expect(lastWidget.frames.length).toBe(0)

    h.destroy()
  })

  it('warmWidgetArtifacts fetches only eager specs', async () => {
    navigator.gpu = {}
    const loaded = []

    warmWidgetArtifacts(async (url) => {
      loaded.push(url)

      return { default: async () => ({}) }
    })

    expect(loaded.length).toBe(1)
    expect(loaded[0]).toContain('skeleton')
  })

  it('warmWidgetArtifacts no-ops without navigator.gpu and swallows rejections', async () => {
    delete navigator.gpu
    const loaded = []

    warmWidgetArtifacts(async (url) => {
      loaded.push(url)

      return { default: async () => ({}) }
    })

    expect(loaded.length).toBe(0)

    navigator.gpu = {}
    // A 404 artifact must not reject the warm call itself.
    warmWidgetArtifacts(async () => {
      throw new Error('404')
    })

    await Promise.resolve()
  })
})
