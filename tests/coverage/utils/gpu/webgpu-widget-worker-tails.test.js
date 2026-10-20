/**
 * @file coverage/utils/gpu/webgpu-widget-worker-tails.test.js
 * @description Coverage tail for the render-worker route in
 * utils/gpu/webgpu-widget.ts — the OffscreenCanvas transfer, proxy
 * widget, message dispatch, probe, and destroy paths. A scripted
 * FakeWorker plays the real gpu-render-worker.js so every wire is
 * exercised without a real GPU.
 */
import { jest } from '@jest/globals'
import { GPU_WIDGET_DRIVE, GPU_WIDGET_KINDS } from '@core/tokens/motion/gpu-widgets.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { STATE_STRINGS } from '@core/tokens/strings/state.js'
import { WASM_POOL } from '@core/tokens/data/wasm.js'
import { mountWebGpuWidget } from '@core/utils/gpu/webgpu-widget.js'

/**
 * Scripted worker double — `responder` maps a posted message to the
 * reply the real worker would emit (posted asynchronously, like the
 * real thread).
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

  postMessage(data, transfer) {
    this.posted.push({ data, transfer })

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

/** Waits for pending worker-ack microtasks + the 0ms reply timers. */
const flush = async (ms = 40) => {
  await Promise.resolve()
  await new Promise((r) => setTimeout(r, ms))
}

describe('webgpu-widget render-worker route', () => {
  let offscreenLast
  let origWorker
  let origOffscreen

  beforeEach(() => {
    origWorker = globalThis.Worker
    origOffscreen = globalThis.OffscreenCanvas
    // The widget layer is opt-in — mounts need the active flag.
    window.history.replaceState(null, '', '/?debug=webgpuWidgets:active')
    // instances/last are NOT reset — the module's spawned worker
    // persists across the whole file (the capability probe latches).
    FakeWorker.responder = (d) => {
      if (d.type === 'probe') return { type: 'probe-ack', ok: true }

      if (d.type === 'mount') return { type: 'mounted', id: d.id }

      if (d.type === 'call') return { type: 'call-result', replyId: d.replyId, result: 7 }

      if (d.type === 'probe-frame')
        return { type: 'probe-result', replyId: d.replyId, coverage: 0.4 }

      return null
    }
    globalThis.Worker = FakeWorker
    globalThis.OffscreenCanvas = class OffscreenCanvas {
      constructor() {
        this.width = 300
        this.height = 150
      }
    }
    navigator.gpu = {}
    offscreenLast = null
  })

  afterEach(() => {
    globalThis.Worker = origWorker
    globalThis.OffscreenCanvas = origOffscreen
    delete navigator.gpu
    window.history.replaceState(null, '', '/')
  })

  const transferableCanvas = () => {
    const canvas = document.createElement('canvas')

    canvas.transferToOffscreen = () => (offscreenLast = new OffscreenCanvas())

    return canvas
  }

  it('routes a mount through the worker — proxy forwards frame/resize/calls, dims, probe, destroy', async () => {
    const canvas = transferableCanvas()
    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas)

    expect(h).not.toBeNull()
    expect(h.canvas).toBe(canvas)
    expect(offscreenLast).not.toBeNull()

    const worker = FakeWorker.last

    // The transferred canvas went to the worker as a transferable.
    const mountMsg = worker.posted.find((m) => m.data.type === 'mount')

    expect(mountMsg.data.canvas).toBe(offscreenLast)
    expect(mountMsg.transfer).toContain(offscreenLast)
    expect(mountMsg.data.cls).toBe('Skeleton')

    // Element dim writes forward as resize-dims posts.
    canvas.width = 640
    canvas.height = 480
    expect(canvas.width).toBe(640)
    expect(canvas.height).toBe(480)

    // Each setter posts — the second write carries both new dims.
    expect(
      worker.posted.some(
        (m) => m.data.type === 'resize-dims' && m.data.w === 640 && m.data.h === 480
      )
    ).toBe(true)

    // proxy.frame keeps the synchronous alive contract.
    expect(h.widget.frame(0.016)).toBe(true)
    expect(worker.posted.some((m) => m.data.type === 'frame')).toBe(true)

    // proxy.resize posts the dims it was handed.
    h.widget.resize(80, 40)
    expect(worker.posted.some((m) => m.data.type === 'resize' && m.data.w === 80)).toBe(true)

    // Generic method forwarding resolves the worker's call result —
    // ArrayBuffer args move zero-copy (they are transferables).
    const buf = new ArrayBuffer(8)

    expect(await h.widget.set_chars(buf)).toBe(7)

    const callMsg = worker.posted.find((m) => m.data.m === 'set_chars')

    expect(callMsg.transfer).toContain(buf)

    // The probe round-trips the worker's coverage ratio.
    expect(await h.probe(1000)).toBe(0.4)

    // init is a resolved no-op on the proxy (worker already inited).
    expect(await h.widget.init()).toBeUndefined()

    // __wbg_ptr stays falsy so freeWidget never double-frees.
    expect(h.widget.__wbg_ptr).toBe(0)

    h.destroy()
    expect(worker.posted.some((m) => m.data.type === 'destroy')).toBe(true)
  })

  it('manual drive mounts skip the worker pump and still proxy', async () => {
    const canvas = transferableCanvas()
    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas, undefined, {
      drive: GPU_WIDGET_DRIVE.MANUAL,
    })

    expect(h).not.toBeNull()

    const mounts = FakeWorker.last.posted.filter((m) => m.data.type === 'mount')

    expect(mounts.pop().data.manual).toBe(true)

    h.widget.frame(0.016)
    h.destroy()
  })

  it('a dead report flips the proxy frame contract', async () => {
    const canvas = transferableCanvas()
    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas)
    const worker = FakeWorker.last
    const wid = worker.posted.filter((m) => m.data.type === 'mount').pop().data.id

    worker.onmessage({ data: { type: 'dead', id: wid } })

    expect(h.widget.frame(0.016)).toBe(false)
    h.destroy()
  })

  it('frame-result alive:false also flips the contract', async () => {
    const canvas = transferableCanvas()
    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas)
    const worker = FakeWorker.last
    const wid = worker.posted.filter((m) => m.data.type === 'mount').pop().data.id

    worker.onmessage({ data: { type: 'frame-result', id: wid, alive: false } })

    expect(h.widget.frame(0.016)).toBe(false)
    h.destroy()
  })

  it('worker mount failure marks the dead transferred element in place', async () => {
    FakeWorker.responder = (d) => {
      if (d.type === 'probe') return { type: 'probe-ack', ok: true }
      if (d.type === 'mount') return { type: 'mount-fail', id: d.id }
      return null
    }

    const canvas = transferableCanvas()
    const parent = document.createElement('div')

    parent.appendChild(canvas)
    document.body.appendChild(parent)

    let loadCalls = 0

    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas, async () => {
      loadCalls++
      throw new Error('artifact 404')
    })

    // No clone transplant — callers keep this exact element wired, so it
    // stays in the DOM carrying the fallback marks for their
    // `:has(canvas.is-fallback)` CSS fallbacks. The in-page mount is
    // never attempted on a placeholder-mode canvas (no context can
    // attach), so the artifact loader stays untouched.
    expect(h).toBeNull()
    expect(loadCalls).toBe(0)
    expect(parent.firstChild).toBe(canvas)
    expect(canvas.classList.contains(STATE_CLASSES.IS_FALLBACK)).toBe(true)
    expect(canvas.style.display).toBe(STATE_STRINGS.NONE)
    canvas.remove()
    parent.remove()
  })

  it('a postMessage throw at mount marks the transferred canvas dead', async () => {
    const canvas = transferableCanvas()
    document.body.appendChild(canvas)
    const broken = FakeWorker.prototype.postMessage

    FakeWorker.prototype.postMessage = function () {
      throw new Error('worker dead')
    }

    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas, async () => {
      throw new Error('artifact 404')
    })

    FakeWorker.prototype.postMessage = broken
    expect(h).toBeNull()
    expect(canvas.classList.contains(STATE_CLASSES.IS_FALLBACK)).toBe(true)
    expect(canvas.style.display).toBe(STATE_STRINGS.NONE)
    canvas.remove()
  })

  it('call postMessage failure resolves null instead of rejecting', async () => {
    const canvas = transferableCanvas()
    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas)
    const worker = FakeWorker.last
    const orig = worker.postMessage

    worker.postMessage = () => {
      throw new Error('gone')
    }

    expect(await h.widget.tap()).toBeNull()

    worker.postMessage = orig
    h.destroy()
  })

  it('call replies with errors resolve null', async () => {
    const canvas = transferableCanvas()
    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas)

    FakeWorker.responder = (d) =>
      d.type === 'call' ? { type: 'call-result', replyId: d.replyId, error: 'x' } : null

    expect(await h.widget.tap()).toBeNull()
    h.destroy()
  })

  it('a mount that never acks times out into the in-page fallback', async () => {
    // The mount waits on the reply map — a worker that swallows the
    // message (dead realm mid-mount) must resolve, not hang.
    FakeWorker.responder = (d) => (d.type === 'probe' ? { type: 'probe-ack', ok: true } : null)

    const canvas = transferableCanvas()
    const parent = document.createElement('div')

    parent.appendChild(canvas)
    document.body.appendChild(parent)

    jest.useFakeTimers()

    try {
      const pending = mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas, async () => {
        throw new Error('artifact 404')
      })

      await jest.advanceTimersByTimeAsync(WASM_POOL.REPLY_TIMEOUT_MS + 1)

      expect(await pending).toBeNull()
      // The dead transferred element is marked in place — callers keep
      // their references, so the CSS fallback resolves on the original.
      expect(parent.firstChild).toBe(canvas)
      expect(canvas.classList.contains(STATE_CLASSES.IS_FALLBACK)).toBe(true)
      expect(canvas.style.display).toBe(STATE_STRINGS.NONE)
    } finally {
      jest.useRealTimers()
      parent.remove()
    }
  })

  it('non-manual wire posts set_size/resize/set-active and destroy cleans listeners', async () => {
    const canvas = transferableCanvas()

    Object.defineProperty(canvas, 'clientWidth', { value: 40 })
    Object.defineProperty(canvas, 'clientHeight', { value: 16 })
    window.devicePixelRatio = 2

    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.BURGER, canvas)
    const worker = FakeWorker.last

    await flush(20)

    // Initial onResize forwarded set_size + device-px resize.
    expect(worker.posted.some((m) => m.data.type === 'call' && m.data.m === 'set_size')).toBe(true)
    expect(worker.posted.some((m) => m.data.type === 'resize' && m.data.w === 80)).toBe(true)

    // The mock IO reports onscreen synchronously → set-active posts.
    expect(worker.posted.some((m) => m.data.type === 'set-active' && m.data.on === true)).toBe(true)

    window.dispatchEvent(new Event('resize'))
    await flush(20)

    // visibilitychange re-posts activity.
    document.dispatchEvent(new Event('visibilitychange'))
    await flush(10)

    h.destroy()
    expect(worker.posted.some((m) => m.data.type === 'destroy')).toBe(true)
  })

  it('malformed worker messages take the empty-data and missing-id arms', async () => {
    const canvas = transferableCanvas()
    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas)

    expect(h).not.toBeNull()

    const worker = FakeWorker.last

    worker.onmessage({})
    worker.onmessage({ data: {} })
    worker.onmessage({ data: { type: 'mounted' } })
    worker.onmessage({ data: { type: 'mount-fail' } })
    worker.onmessage({ data: { type: 'call-result' } })
    worker.onmessage({ data: { type: 'probe-result' } })
    worker.onmessage({ data: { type: 'dead' } })
    worker.onmessage({ data: { type: 'frame-result', alive: false } })
    worker.onmessage({ data: { type: 'unrelated' } })

    h.destroy()
  })

  it('call args transfer .buffer payloads and evaluate the ImageBitmap arm', async () => {
    const PrevIB = globalThis.ImageBitmap

    globalThis.ImageBitmap = class ImageBitmap {}

    const canvas = transferableCanvas()
    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas)
    const worker = FakeWorker.last
    const buf = new ArrayBuffer(4)

    // An arg carrying a .buffer (typed-array shape) transfers the buffer.
    await h.widget.upload({ buffer: buf })

    const callMsg = worker.posted.find((m) => m.data.m === 'upload')

    expect(callMsg.transfer).toContain(buf)

    // A plain-object arg evaluates every operand and transfers nothing.
    await h.widget.configure({})

    const plainMsg = worker.posted.find((m) => m.data.m === 'configure')

    expect(plainMsg.transfer).toEqual([])

    globalThis.ImageBitmap = PrevIB
    h.destroy()
  })

  it('call and probe deadlines resolve null', async () => {
    const canvas = transferableCanvas()
    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas)

    // No call/probe-frame replies — the reply timers must expire.
    FakeWorker.responder = () => null

    jest.useFakeTimers()

    try {
      const callP = h.widget.tap()
      const probeP = h.probe(10)

      await jest.advanceTimersByTimeAsync(WASM_POOL.REPLY_TIMEOUT_MS + 1)

      expect(await callP).toBeNull()
      expect(await probeP).toBeNull()
    } finally {
      jest.useRealTimers()
      h.destroy()
    }
  })

  it('a probe-result without numeric coverage resolves null', async () => {
    const canvas = transferableCanvas()
    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas)

    FakeWorker.responder = (d) =>
      d.type === 'probe-frame' ? { type: 'probe-result', replyId: d.replyId } : null

    expect(await h.probe(10)).toBeNull()
    h.destroy()
  })

  it('a throwing postMessage inside probe resolves null', async () => {
    const canvas = transferableCanvas()
    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas)
    const worker = FakeWorker.last
    const orig = worker.postMessage

    worker.postMessage = () => {
      throw new Error('gone')
    }

    expect(await h.probe(10)).toBeNull()

    worker.postMessage = orig
    h.destroy()
  })

  it('a frame post throw flips the alive flag', async () => {
    const canvas = transferableCanvas()
    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas)
    const worker = FakeWorker.last
    const orig = worker.postMessage

    worker.postMessage = () => {
      throw new Error('gone')
    }

    expect(h.widget.frame(0.016)).toBe(false)
    // Second call takes the !state.alive arm directly.
    expect(h.widget.frame(0.016)).toBe(false)

    worker.postMessage = orig
    h.destroy()
  })

  it('dim setters coerce NaN to 0 and swallow dead-worker posts', async () => {
    const canvas = transferableCanvas()
    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas)

    canvas.width = 'nope'
    canvas.height = 'nope'

    expect(canvas.width).toBe(0)
    expect(canvas.height).toBe(0)

    const worker = FakeWorker.last
    const orig = worker.postMessage

    worker.postMessage = () => {
      throw new Error('gone')
    }

    canvas.width = 320
    canvas.height = 240

    expect(canvas.width).toBe(320)
    expect(canvas.height).toBe(240)

    worker.postMessage = orig
    h.destroy()
  })

  it('a frozen canvas throws inside mountViaWorker — mount falls through to in-page', async () => {
    const canvas = transferableCanvas()

    // transferToOffscreen succeeds but defineProperty on the frozen
    // element throws — the mount-level catch must catch it as a plain
    // routing failure and continue to the in-page loader.
    Object.freeze(canvas)

    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas, async () => {
      throw new Error('artifact 404')
    })

    expect(h).toBeNull()
  })

  it('a transferred canvas that cannot transfer stays in-page', async () => {
    const canvas = document.createElement('canvas')

    canvas.transferToOffscreen = () => {
      throw new Error('already transferred')
    }

    // Falls through to the in-page mount — the throwing loader resolves null.
    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas, async () => {
      throw new Error('artifact 404')
    })

    expect(h).toBeNull()
  })

  it('a worker mount without IntersectionObserver takes the observer-null arm', async () => {
    const saved = globalThis.IntersectionObserver

    delete globalThis.IntersectionObserver

    const canvas = transferableCanvas()
    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas)

    expect(h).not.toBeNull()

    h.destroy()
    globalThis.IntersectionObserver = saved
  })

  // LAST — the onerror flush latches the worker route off for the
  // rest of the file (module-level workerProbe reset).
  it('a worker error flushes pending work and latches the route off', async () => {
    const canvas = transferableCanvas()
    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas)

    expect(h).not.toBeNull()

    const worker = FakeWorker.last

    // An in-flight call must resolve rather than hang on a dead worker.
    const callP = h.widget.tap()

    worker.onerror()

    expect(await callP).toBeNull()
    expect(h.widget.frame(0.016)).toBe(false)

    // The route latches off — the next mount stays in-page (the stub
    // artifact throws → null handle) and no new worker is spawned.
    const spawned = FakeWorker.instances.length

    expect(
      await mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, transferableCanvas(), async () => {
        throw new Error('artifact 404')
      })
    ).toBeNull()
    expect(FakeWorker.instances.length).toBe(spawned)
  })
})
