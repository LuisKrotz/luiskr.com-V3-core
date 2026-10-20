/**
 * @file coverage/utils/gpu/webgpu-widget-env-tails.test.js
 * @description Coverage tail for utils/gpu/webgpu-widget.ts arms that
 * need a fresh module instance: worker-probe failure variants (ack
 * not-ok, constructor throw, postMessage throw, handshake timeout),
 * destroyRenderWorker via pagehide with a pending probe, a mid-mount
 * worker death flushing pendingMounts, and the vite HMR dispose hook.
 * Each test re-imports the module inside a reset registry because the
 * probe latch and teardown listeners are module-level.
 */
import { describe, test, expect, jest, afterEach } from '@jest/globals'
import { GPU_WIDGET_KINDS } from '@core/tokens/motion/gpu-widgets.js'
import { WINDOW_EVENTS } from '@core/tokens/events/dom.js'
import { WASM_POOL } from '@core/tokens/data/wasm.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'

/**
 * Scripted worker double — `responder` maps a posted message to its
 * reply; null means silence (dead-realm path).
 */
class FakeWorker {
  constructor() {
    FakeWorker.instances.push(this)
    FakeWorker.last = this
    this.onmessage = null
    this.onerror = null
    this.posted = []
    this.terminated = false
  }

  postMessage(data) {
    this.posted.push(data)

    const reply = FakeWorker.responder?.(data)

    if (reply) {
      const self = this

      setTimeout(() => self.onmessage?.({ data: reply }), 0).unref?.()
    }
  }

  terminate() {
    this.terminated = true
  }
}

FakeWorker.instances = []
FakeWorker.last = null
FakeWorker.responder = null

/** Waits for worker-ack microtasks + the 0ms reply timers. */
const flush = async () => {
  await Promise.resolve()
  await new Promise((r) => setTimeout(r, 40))
}

/** Canvas double whose transferToOffscreen yields a stub offscreen. */
const transferableCanvas = () => {
  const canvas = document.createElement('canvas')

  canvas.transferToOffscreen = () => ({ width: 300, height: 150 })

  return canvas
}

/** Artifact loader that always rejects — drives every in-page fallback. */
const deadLoader = async () => {
  throw new Error('artifact 404')
}

const WorkerSaved = globalThis.Worker
const OffscreenSaved = globalThis.OffscreenCanvas
const winDesc = Object.getOwnPropertyDescriptor(globalThis, 'window')

afterEach(() => {
  globalThis.Worker = WorkerSaved

  if (OffscreenSaved === undefined) {
    delete globalThis.OffscreenCanvas
  } else {
    globalThis.OffscreenCanvas = OffscreenSaved
  }

  delete navigator.gpu

  if (winDesc) Object.defineProperty(globalThis, 'window', winDesc)
  if (typeof window !== 'undefined') window.history.replaceState(null, '', '/')

  jest.useRealTimers()
  jest.resetModules()
})

describe('webgpu-widget module-eval tails', () => {
  test('importing without window registers no pagehide listener', async () => {
    Object.defineProperty(globalThis, 'window', { value: undefined, configurable: true })

    jest.resetModules()

    const mod = await import('@core/utils/gpu/webgpu-widget.js')

    // SSR import is inert — capability gate answers false.
    expect(mod.hasWebGpu()).toBe(false)
  })
})

describe('webgpu-widget env tails', () => {
  test('a probe-ack of not-ok terminates the worker and mounts in-page', async () => {
    window.history.replaceState(null, '', '/?debug=webgpuWidgets:active')
    navigator.gpu = {}
    FakeWorker.responder = (d) => (d.type === 'probe' ? { type: 'probe-ack', ok: false } : null)
    globalThis.Worker = FakeWorker
    globalThis.OffscreenCanvas = class {}

    const { mountWebGpuWidget } = await import('@core/utils/gpu/webgpu-widget.js')
    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, transferableCanvas(), deadLoader)

    expect(h).toBeNull()
    expect(FakeWorker.last.terminated).toBe(true)
  })

  test('a throwing Worker constructor takes the spawn outer catch', async () => {
    window.history.replaceState(null, '', '/?debug=webgpuWidgets:active')
    navigator.gpu = {}
    globalThis.Worker = class {
      constructor() {
        throw new Error('no workers')
      }
    }
    globalThis.OffscreenCanvas = class {}

    const { mountWebGpuWidget } = await import('@core/utils/gpu/webgpu-widget.js')
    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, transferableCanvas(), deadLoader)

    expect(h).toBeNull()
  })

  test('a throwing probe postMessage resolves the handshake false', async () => {
    window.history.replaceState(null, '', '/?debug=webgpuWidgets:active')
    navigator.gpu = {}
    globalThis.Worker = class extends FakeWorker {
      postMessage() {
        throw new Error('dead realm')
      }
    }
    globalThis.OffscreenCanvas = class {}

    const { mountWebGpuWidget } = await import('@core/utils/gpu/webgpu-widget.js')
    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, transferableCanvas(), deadLoader)

    expect(h).toBeNull()
    expect(FakeWorker.last.terminated).toBe(true)
  })

  test('a probe that never acks times the handshake out', async () => {
    window.history.replaceState(null, '', '/?debug=webgpuWidgets:active')
    navigator.gpu = {}
    FakeWorker.responder = () => null
    globalThis.Worker = FakeWorker
    globalThis.OffscreenCanvas = class {}

    const { mountWebGpuWidget } = await import('@core/utils/gpu/webgpu-widget.js')

    jest.useFakeTimers()

    const p = mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, transferableCanvas(), deadLoader)

    await jest.advanceTimersByTimeAsync(WASM_POOL.REPLY_TIMEOUT_MS + 1)

    expect(await p).toBeNull()
    expect(FakeWorker.last.terminated).toBe(true)
  })

  test('pagehide during a pending probe resolves it false via destroyRenderWorker', async () => {
    window.history.replaceState(null, '', '/?debug=webgpuWidgets:active')
    navigator.gpu = {}
    FakeWorker.responder = () => null
    globalThis.Worker = FakeWorker
    globalThis.OffscreenCanvas = class {}

    const { mountWebGpuWidget } = await import('@core/utils/gpu/webgpu-widget.js')
    const p = mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, transferableCanvas(), deadLoader)

    await flush()
    window.dispatchEvent(new Event(WINDOW_EVENTS.PAGEHIDE))

    expect(await p).toBeNull()
    expect(FakeWorker.last.terminated).toBe(true)
  })

  test('a mid-mount worker death flushes the pending mount into fallback', async () => {
    window.history.replaceState(null, '', '/?debug=webgpuWidgets:active')
    navigator.gpu = {}
    FakeWorker.responder = (d) => (d.type === 'probe' ? { type: 'probe-ack', ok: true } : null)
    globalThis.Worker = FakeWorker
    globalThis.OffscreenCanvas = class {}

    const { mountWebGpuWidget } = await import('@core/utils/gpu/webgpu-widget.js')
    const canvas = transferableCanvas()
    const parent = document.createElement('div')

    parent.appendChild(canvas)
    document.body.appendChild(parent)

    const p = mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas, deadLoader)

    await flush()

    const worker = FakeWorker.last

    worker.onerror()

    expect(await p).toBeNull()
    expect(canvas.classList.contains(STATE_CLASSES.IS_FALLBACK)).toBe(true)

    parent.remove()
  })

  test('pagehide with a mount in flight resolves it into the fallback marks', async () => {
    window.history.replaceState(null, '', '/?debug=webgpuWidgets:active')
    navigator.gpu = {}
    FakeWorker.responder = (d) => (d.type === 'probe' ? { type: 'probe-ack', ok: true } : null)
    globalThis.Worker = FakeWorker
    globalThis.OffscreenCanvas = class {
      constructor() {
        this.width = 300
        this.height = 150
      }
    }

    const { mountWebGpuWidget } = await import('@core/utils/gpu/webgpu-widget.js')
    const canvas = transferableCanvas()
    const parent = document.createElement('div')

    parent.appendChild(canvas)
    document.body.appendChild(parent)

    // Mount message posts but the worker never acks — the pendingMounts
    // flush inside destroyRenderWorker resolves it false.
    const p = mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas, deadLoader)

    await flush()
    window.dispatchEvent(new Event(WINDOW_EVENTS.PAGEHIDE))

    expect(await p).toBeNull()
    expect(canvas.classList.contains(STATE_CLASSES.IS_FALLBACK)).toBe(true)

    parent.remove()
  })

  test('pagehide teardown terminates the live worker and fires watchers', async () => {
    window.history.replaceState(null, '', '/?debug=webgpuWidgets:active')
    navigator.gpu = {}

    FakeWorker.responder = (d) => {
      if (d.type === 'probe') return { type: 'probe-ack', ok: true }
      if (d.type === 'mount') return { type: 'mounted', id: d.id }

      // 'call' is deliberately unanswered so the pendingCalls flush in
      // destroyRenderWorker resolves it.
      return null
    }
    globalThis.Worker = FakeWorker
    globalThis.OffscreenCanvas = class {
      constructor() {
        this.width = 300
        this.height = 150
      }
    }

    const { mountWebGpuWidget } = await import('@core/utils/gpu/webgpu-widget.js')
    const canvas = transferableCanvas()
    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas)

    expect(h).not.toBeNull()

    // In-flight call + a live death watcher, both flushed by pagehide.
    const callP = h.widget.tap()

    const worker = FakeWorker.last

    worker.terminate = jest.fn()

    window.dispatchEvent(new Event(WINDOW_EVENTS.PAGEHIDE))

    expect(await callP).toBeNull()
    expect(worker.terminate).toHaveBeenCalled()
    expect(h.widget.frame(0.016)).toBe(false)
  })
})
