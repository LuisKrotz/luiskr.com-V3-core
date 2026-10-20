/**
 * @file coverage/utils/gpu/webgpu-widget-tails.test.js
 * @description Coverage tail for utils/gpu/webgpu-widget.ts — the
 * per-artifact WebGPU widget bridge. Covers the capability gate, the
 * unknown-kind and missing-artifact early returns, init-failure
 * fallback, the live path (frame ticks, resize forwarding, set_size
 * guard, destroy), and the visibility-gated loop restart.
 */
import { jest } from '@jest/globals'
import { GPU_WIDGET_DRIVE, GPU_WIDGET_KINDS } from '@core/tokens/motion/gpu-widgets.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { WASM_POOL } from '@core/tokens/data/wasm.js'
import {
  getSharedGpuDevice,
  hasWebGpu,
  mountWebGpuWidget,
  warmWidgetArtifacts,
  webgpuWidgetsEnabled,
} from '@core/utils/gpu/webgpu-widget.js'

/** Captures the widget instance the fake class returns. */
let lastWidget = null

/**
 * Builds a navigator.gpu double — requestAdapter → requestDevice → a
 * fake GPUDevice whose `lost` promise the test controls. `calls`
 * records requestDevice invocations so the shared-device cache is
 * assertable (one device for the whole page, never one per widget).
 */
const fakeGpu = () => {
  const calls = []
  let lostResolve = null
  const device = { lost: new Promise((resolve) => (lostResolve = resolve)) }

  return {
    device,
    calls,
    loseDevice: (reason = 'unknown') => lostResolve({ reason }),
    requestAdapter: async () => ({ requestDevice: async () => (calls.push(1), device) }),
  }
}

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
  beforeEach(() => {
    // The widget layer is opt-in — mounts need the active flag.
    window.history.replaceState(null, '', '/?debug=webgpuWidgets:active')
  })

  afterEach(() => {
    delete navigator.gpu
    window.history.replaceState(null, '', '/')
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

  it('the default loader arm resolves null when the glue import 404s', async () => {
    navigator.gpu = {}
    const canvas = document.createElement('canvas')

    expect(await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas)).toBeNull()
  })

  it('returns null when init fails', async () => {
    navigator.gpu = fakeGpu()
    const canvas = document.createElement('canvas')

    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.BURGER, canvas, async () =>
      recordingModule(async () => {
        throw new Error('no device')
      }, 'Burger')
    )

    expect(h).toBeNull()
  })

  it('wires frame ticks, resize forwarding, and destroy', async () => {
    navigator.gpu = fakeGpu()
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
    navigator.gpu = fakeGpu()
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
    navigator.gpu = fakeGpu()
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

  it('a hidden-tab visibilitychange is a no-op and destroy skips a dead clock', async () => {
    navigator.gpu = fakeGpu()
    const canvas = document.createElement('canvas')

    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas, async () =>
      recordingModule(async () => lastWidget, 'Skeleton')
    )

    await flushTick()

    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange')) // hidden → onVisible else arm

    await flushTick() // the in-flight tick disarms the loop (rafId 0)

    h.destroy() // rafId already 0 → cancelAnimationFrame skipped

    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
  })

  it('manual drive wires no clock and no listeners — the caller owns both', async () => {
    navigator.gpu = fakeGpu()
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

  it('a frame throw disarms the loop instead of escaping the rAF', async () => {
    navigator.gpu = fakeGpu()
    const canvas = document.createElement('canvas')

    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas, async () =>
      recordingModule(async () => lastWidget, 'Skeleton')
    )

    expect(h).not.toBeNull()

    await flushTick()
    expect(lastWidget.frames.length).toBeGreaterThan(0)

    // A wasm-boundary throw — the loop must disarm, not spam per frame.
    lastWidget.frame = () => {
      throw new Error('unreachable')
    }

    await flushTick()
    const count = lastWidget.frames.length

    await flushTick()
    expect(lastWidget.frames.length).toBe(count)

    h.destroy()
  })

  it('destroy calls the wasm free() — the registry never re-enters free', async () => {
    navigator.gpu = fakeGpu()
    const canvas = document.createElement('canvas')
    let freed = 0

    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas, async () => ({
      default: async () => ({}),
      Skeleton: function () {
        lastWidget = {
          frames: [],
          resizes: [],
          sizes: [],
          init: async () => lastWidget,
          resize: (w, hh) => lastWidget.resizes.push([w, hh]),
          set_size: (w, hh) => lastWidget.sizes.push([w, hh]),
          frame: (dt) => lastWidget.frames.push(dt),
          free: () => {
            freed++
          },
        }

        return lastWidget
      },
    }))

    expect(h).not.toBeNull()

    h.destroy()
    expect(freed).toBe(1)
  })

  it('manual drive destroy also frees the widget', async () => {
    navigator.gpu = fakeGpu()
    const canvas = document.createElement('canvas')
    let freed = 0

    const h = await mountWebGpuWidget(
      GPU_WIDGET_KINDS.SKELETON,
      canvas,
      async () => ({
        default: async () => ({}),
        Skeleton: function () {
          return {
            init: async () => ({}),
            resize: () => undefined,
            set_size: () => undefined,
            frame: () => undefined,
            free: () => {
              freed++
            },
          }
        },
      }),
      { drive: GPU_WIDGET_DRIVE.MANUAL }
    )

    h.destroy()
    expect(freed).toBe(1)
  })

  it('a free() throw at destroy is contained — never an uncaught error', async () => {
    navigator.gpu = fakeGpu()
    const canvas = document.createElement('canvas')

    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas, async () => ({
      default: async () => ({}),
      Skeleton: function () {
        return {
          init: async () => ({}),
          resize: () => undefined,
          set_size: () => undefined,
          frame: () => undefined,
          free: () => {
            throw new Error('memory access out of bounds')
          },
        }
      },
    }))

    expect(() => h.destroy()).not.toThrow()
  })

  it('a resize/set_size throw stays inside the listener', async () => {
    navigator.gpu = fakeGpu()
    const canvas = document.createElement('canvas')

    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.BURGER, canvas, async () =>
      recordingModule(async () => lastWidget, 'Burger')
    )

    expect(h).not.toBeNull()

    // A poisoned widget throws on the next resize — the listener swallows.
    lastWidget.set_size = () => {
      throw new Error('borrow poisoned')
    }
    lastWidget.resize = () => {
      throw new Error('borrow poisoned')
    }

    window.dispatchEvent(new Event('resize'))
    h.destroy()
  })

  it('webgpuWidgetsEnabled is false without window, for foreign keys, and off-values', () => {
    const winDesc = Object.getOwnPropertyDescriptor(globalThis, 'window')

    Object.defineProperty(globalThis, 'window', { value: undefined, configurable: true })
    expect(webgpuWidgetsEnabled()).toBe(false)
    if (winDesc) Object.defineProperty(globalThis, 'window', winDesc)

    // A debug param for another feature — the key-mismatch arm.
    window.history.replaceState(null, '', '/?debug=webGLMode:active')
    expect(webgpuWidgetsEnabled()).toBe(false)

    // The widget key carrying a non-active value.
    window.history.replaceState(null, '', '/?debug=webgpuWidgets:fallback')
    expect(webgpuWidgetsEnabled()).toBe(false)
  })

  it('mount returns null when document is absent — SSR guard arm', async () => {
    navigator.gpu = {}

    const docDesc = Object.getOwnPropertyDescriptor(globalThis, 'document')

    Object.defineProperty(globalThis, 'document', { value: undefined, configurable: true })
    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, {})

    if (docDesc) Object.defineProperty(globalThis, 'document', docDesc)

    expect(h).toBeNull()
  })

  it('a tab hidden mid-tick disarms at the loop tail', async () => {
    navigator.gpu = fakeGpu()
    const canvas = document.createElement('canvas')

    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas, async () =>
      recordingModule(async () => lastWidget, 'Skeleton')
    )

    expect(h).not.toBeNull()

    // Flip hidden INSIDE frame() — the tick entered while visible, so the
    // tail re-arm check sees the hidden state and takes the else arm.
    lastWidget.frame = (dt) => {
      lastWidget.frames.push(dt)
      Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    }

    await flushTick()
    const parked = lastWidget.frames.length

    await flushTick()
    expect(lastWidget.frames.length).toBe(parked)

    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    h.destroy()
  })

  it('mounts with no IntersectionObserver — the observer-null arm', async () => {
    navigator.gpu = fakeGpu()
    const saved = globalThis.IntersectionObserver

    delete globalThis.IntersectionObserver

    const canvas = document.createElement('canvas')
    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.BURGER, canvas, async () =>
      recordingModule(async () => lastWidget, 'Burger')
    )

    expect(h).not.toBeNull()

    h.destroy()
    globalThis.IntersectionObserver = saved
  })

  it('the intersection callback covers missing-entry, offscreen, and re-arm arms', async () => {
    navigator.gpu = fakeGpu()

    let ioCb = null
    const PrevIO = globalThis.IntersectionObserver

    globalThis.IntersectionObserver = class {
      constructor(cb) {
        ioCb = cb
      }
      observe() {}
      disconnect() {}
    }

    const canvas = document.createElement('canvas')
    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas, async () =>
      recordingModule(async () => lastWidget, 'Skeleton')
    )

    expect(h).not.toBeNull()
    expect(ioCb).not.toBeNull()

    await flushTick()
    expect(lastWidget.frames.length).toBeGreaterThan(0)

    // Missing entry → !entry → onScreen stays true.
    ioCb([])

    // Offscreen → onScreen false → the next tick disarms at the gate.
    ioCb([{ isIntersecting: false }])
    const beforeOff = lastWidget.frames.length

    await flushTick()
    await flushTick()
    expect(lastWidget.frames.length).toBeLessThanOrEqual(beforeOff + 1)

    // Back onscreen → kick() re-arms the loop.
    ioCb([{ isIntersecting: true }])
    await flushTick()
    expect(lastWidget.frames.length).toBeGreaterThan(beforeOff)

    h.destroy()
    globalThis.IntersectionObserver = PrevIO
  })

  it('an artifact load that never resolves hits the init deadline', async () => {
    navigator.gpu = {}
    const canvas = document.createElement('canvas')

    jest.useFakeTimers()

    try {
      const p = mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas, () => new Promise(() => {}))

      await jest.advanceTimersByTimeAsync(WASM_POOL.REPLY_TIMEOUT_MS + 1)

      expect(await p).toBeNull()
    } finally {
      jest.useRealTimers()
    }
  })

  it('concurrent mounts on one module share the single wasm instantiation', async () => {
    navigator.gpu = fakeGpu()

    const mod = recordingModule(async () => lastWidget, 'Burger')

    mod.default = jest.fn(async () => ({}))

    const a = await mountWebGpuWidget(
      GPU_WIDGET_KINDS.BURGER,
      document.createElement('canvas'),
      async () => mod
    )
    const b = await mountWebGpuWidget(
      GPU_WIDGET_KINDS.BURGER,
      document.createElement('canvas'),
      async () => mod
    )

    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    // initModule memoizes on the module object — one instantiation.
    expect(mod.default).toHaveBeenCalledTimes(1)

    a.destroy()
    b.destroy()
  })

  it('a zeroed wasm pointer skips free() on destroy', async () => {
    navigator.gpu = fakeGpu()
    const canvas = document.createElement('canvas')
    let freed = 0

    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas, async () => ({
      default: async () => ({}),
      Skeleton: function () {
        return {
          __wbg_ptr: 0,
          init: async () => ({}),
          resize: () => undefined,
          frame: () => true,
          free: () => {
            freed++
          },
        }
      },
    }))

    h.destroy()

    expect(freed).toBe(0)
  })

  it('visibilitychange while the loop is armed takes the kick else arm', async () => {
    navigator.gpu = fakeGpu()
    const canvas = document.createElement('canvas')

    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas, async () =>
      recordingModule(async () => lastWidget, 'Skeleton')
    )

    await flushTick()
    const armed = lastWidget.frames.length

    // rafId is live — kick() must not double-arm the loop.
    document.dispatchEvent(new Event('visibilitychange'))

    await flushTick()

    expect(lastWidget.frames.length).toBeGreaterThan(armed)
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

    // The default-loader arm — the real import rejects and is swallowed.
    warmWidgetArtifacts()

    await Promise.resolve()
  })
})

describe('shared GPUDevice', () => {
  beforeEach(() => {
    // The widget layer is opt-in — mounts need the active flag.
    window.history.replaceState(null, '', '/?debug=webgpuWidgets:active')
  })

  afterEach(() => {
    delete navigator.gpu
    window.history.replaceState(null, '', '/')
  })

  it('resolves null without navigator.gpu', async () => {
    delete navigator.gpu

    expect(await getSharedGpuDevice()).toBeNull()
  })

  it('resolves null when the adapter request returns nothing', async () => {
    navigator.gpu = { requestAdapter: async () => null }

    expect(await getSharedGpuDevice()).toBeNull()
  })

  it('resolves null when the device request rejects (driver OOM arm)', async () => {
    navigator.gpu = {
      requestAdapter: async () => ({
        requestDevice: async () => {
          throw new Error('D3D12 create command queue failed with E_OUTOFMEMORY')
        },
      }),
    }

    expect(await getSharedGpuDevice()).toBeNull()
  })

  it('resolves null when the device request resolves undefined', async () => {
    navigator.gpu = { requestAdapter: async () => ({ requestDevice: async () => undefined }) }

    expect(await getSharedGpuDevice()).toBeNull()
  })

  it('resolves null when requestAdapter throws (gpu handle without methods)', async () => {
    navigator.gpu = {}

    expect(await getSharedGpuDevice()).toBeNull()
  })

  it('issues ONE device request across many widget mounts', async () => {
    const gpu = fakeGpu()

    navigator.gpu = gpu

    const canvas = () => document.createElement('canvas')

    const [a, b] = await Promise.all([
      mountWebGpuWidget(GPU_WIDGET_KINDS.BURGER, canvas(), async () =>
        recordingModule(async () => lastWidget, 'Burger')
      ),
      mountWebGpuWidget(GPU_WIDGET_KINDS.CLOSE_BUTTON, canvas(), async () =>
        recordingModule(async () => lastWidget, 'CloseButton')
      ),
    ])

    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    expect(gpu.calls.length).toBe(1)

    a.destroy()
    b.destroy()
  })

  it('passes the shared device object into every widget init', async () => {
    const gpu = fakeGpu()

    navigator.gpu = gpu

    const canvas = document.createElement('canvas')
    const initArgs = []

    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.BURGER, canvas, async () => ({
      default: async () => ({}),
      Burger: function () {
        lastWidget = {
          init: (c, device) => initArgs.push([c, device]),
          resize: () => {},
          frame: () => true,
        }

        return lastWidget
      },
    }))

    expect(h).not.toBeNull()
    expect(initArgs.length).toBe(1)
    expect(initArgs[0][0]).toBe(canvas)
    expect(initArgs[0][1]).toBe(gpu.device)

    h.destroy()
  })

  it('mount returns null without instantiating the widget when no device exists', async () => {
    // requestAdapter resolves null — mount must bail before touching
    // the artifact class (a dead device would init-trap in wasm).
    navigator.gpu = { requestAdapter: async () => null }

    let constructed = 0
    const canvas = document.createElement('canvas')

    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.BURGER, canvas, async () => ({
      default: async () => ({}),
      Burger: function () {
        constructed += 1

        return { init: async () => {}, resize: () => {}, frame: () => true }
      },
    }))

    expect(h).toBeNull()
    expect(constructed).toBe(0)
  })

  it('a lost device clears the cache — the next mount re-requests', async () => {
    const gpu = fakeGpu()

    navigator.gpu = gpu

    expect(await getSharedGpuDevice()).toBe(gpu.device)
    expect(gpu.calls.length).toBe(1)

    gpu.loseDevice('destroyed')
    await Promise.resolve()
    await Promise.resolve()

    expect(await getSharedGpuDevice()).toBe(gpu.device)
    expect(gpu.calls.length).toBe(2)
  })

  it('a changed navigator.gpu handle re-requests instead of reusing the cache', async () => {
    const first = fakeGpu()
    const second = fakeGpu()

    navigator.gpu = first
    expect(await getSharedGpuDevice()).toBe(first.device)

    navigator.gpu = second
    expect(await getSharedGpuDevice()).toBe(second.device)
    expect(second.calls.length).toBe(1)
  })
})
