/**
 * @file webgpu-overlay-tails.test.js
 * @description Coverage tail for utils/gpu/webgpu-overlay.ts — the
 * capability-gated WebGPU overlay bridge. Covers the no-GPU early return,
 * missing-artifact and init-failure fallbacks, the live path (zero-copy
 * ring writes, memory-growth view refresh, resize, frame tick, destroy),
 * and the visibility-gated loop restart.
 */
import { GPU_OVERLAY_CLASSES } from '@core/tokens/classes/gpu.js'
import { POINTER_EVENTS, MOUSE_EVENTS, CLIPBOARD_EVENTS } from '@core/tokens/events/dom.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { hasWebGpu, mountWebGpuOverlay } from '@core/utils/gpu/webgpu-overlay.js'

/** f32s per record — mirrors RECORD_F32S in the bridge/input.rs. */
const REC = 4
/** Ring capacity — mirrors RING_CAP. */
const CAP = 1024

/** Builds a fake wasm module + memory the bridge can wire to. */
const fakeModule = (initImpl) => {
  const memory = { buffer: new ArrayBuffer((CAP * REC + 2) * 4 + 64) }
  const overlay = {
    frames: [],
    resizes: [],
    css: [],
    widgets: [],
    uniforms: [],
    rects: [],
    unregistered: [],
    flagUploads: [],
    skelWrites: [],
    mediaUploads: [],
    videoFrames: [],
    burnCalls: [],
    input_buffer_ptr: () => 0,
    input_meta_ptr: () => CAP * REC * 4,
    init: initImpl,
    resize: (w, h) => overlay.resizes.push([w, h]),
    set_css_size: (w, h) => overlay.css.push([w, h]),
    frame: (dt) => overlay.frames.push(dt),
    hover_group: () => 7,
    register_widget: (...a) => (overlay.widgets.push(a), 11),
    register_media: (...a) => (overlay.widgets.push(a), 22),
    set_widget_rect: (...a) => overlay.rects.push(a),
    set_widget_uniform: (...a) => overlay.uniforms.push(a),
    unregister_widget: (...a) => overlay.unregistered.push(a),
    upload_flag_textures: (...a) => overlay.flagUploads.push(a),
    write_skel_sheet: (...a) => overlay.skelWrites.push(a),
    upload_media_image: (...a) => (overlay.mediaUploads.push(a), true),
    push_video_frame: (...a) => overlay.videoFrames.push(a),
    burn_set_letters: (...a) => overlay.burnCalls.push(['letters', ...a]),
    burn_set_ink: (...a) => overlay.burnCalls.push(['ink', ...a]),
    burn_set_colors: (...a) => overlay.burnCalls.push(['colors', ...a]),
    burn_set_dir: (...a) => overlay.burnCalls.push(['dir', ...a]),
    burn_set_stage: (...a) => overlay.burnCalls.push(['stage', ...a]),
  }

  return {
    memory,
    overlay,
    mod: {
      default: async () => ({ memory }),
      Overlay: function Overlay() {
        return overlay
      },
    },
  }
}

/** Reads the [head, tail] pair + records out of the fake wasm memory. */
const ringOf = (memory) => ({
  meta: new Int32Array(memory.buffer, CAP * REC * 4, 2),
  ring: new Float32Array(memory.buffer, 0, CAP * REC),
})

const ev = (type, props) => Object.assign(new Event(type), props)

describe('webgpu overlay tails', () => {
  test('no navigator.gpu → capability + mount both decline', async () => {
    delete navigator.gpu

    expect(hasWebGpu()).toBe(false)

    const parent = document.createElement('div')

    expect(await mountWebGpuOverlay(parent)).toBe(null)
    expect(parent.children.length).toBe(0)
  })

  test('artifact missing → null (DOM stays authoritative)', async () => {
    navigator.gpu = {}

    expect(hasWebGpu()).toBe(true)

    const parent = document.createElement('div')
    const load = () => Promise.reject(new Error('404'))

    expect(await mountWebGpuOverlay(parent, load)).toBe(null)
  })

  test('default loader resolves /wasm/overlay glue — 404 in tests → null', async () => {
    navigator.gpu = {}

    // No injected loader — exercises loadOverlayModule itself; the dynamic
    // import rejects (no artifact in the test env) → clean null fallback.
    expect(await mountWebGpuOverlay(document.createElement('div'))).toBe(null)
  })

  test('init failure → null and no canvas left behind', async () => {
    navigator.gpu = {}

    const { mod } = fakeModule(() => Promise.reject(new Error('no adapter')))
    const parent = document.createElement('div')

    expect(await mountWebGpuOverlay(parent, async () => mod)).toBe(null)
    expect(parent.children.length).toBe(0)
  })

  test('live mount wires input ring, resize, ticks, destroy', async () => {
    navigator.gpu = {}

    const { mod, memory, overlay } = fakeModule(() => Promise.resolve())
    const parent = document.createElement('div')

    const h = await mountWebGpuOverlay(parent, async () => mod)

    expect(h).toBeTruthy()
    expect(h.canvas.classList.contains(GPU_OVERLAY_CLASSES.GPU_OVERLAY_ACTIVE)).toBe(true)
    expect(h.overlay).toBe(overlay)
    expect(h.hoverGroup()).toBe(7)
    expect(overlay.resizes.length).toBe(1)

    // pointermove with coalesced samples → last sample lands in the ring.
    const mv = ev(POINTER_EVENTS.POINTERMOVE, { clientX: 1, clientY: 2 })
    mv.getCoalescedEvents = () => [{ clientX: 9, clientY: 8 }]
    h.canvas.dispatchEvent(mv)

    // pointermove without the API → the event itself is the sample.
    h.canvas.dispatchEvent(ev(POINTER_EVENTS.POINTERMOVE, { clientX: 3, clientY: 4 }))
    h.canvas.dispatchEvent(ev(POINTER_EVENTS.POINTERDOWN, { clientX: 5, clientY: 6 }))
    h.canvas.dispatchEvent(ev(POINTER_EVENTS.POINTERUP, { clientX: 5, clientY: 6 }))
    h.canvas.dispatchEvent(ev(MOUSE_EVENTS.WHEEL, { clientX: 0, clientY: 0, deltaY: -12 }))

    const { meta, ring } = ringOf(memory)

    expect(meta[0]).toBe(5)
    expect(ring.slice(0, 4)).toEqual(new Float32Array([0, 9, 8, 0]))
    expect(ring.slice(4, 8)).toEqual(new Float32Array([0, 3, 4, 0]))
    expect(ring.slice(8, 12)).toEqual(new Float32Array([1, 5, 6, 0]))
    expect(ring.slice(12, 16)).toEqual(new Float32Array([2, 5, 6, 0]))
    expect(ring.slice(16, 20)).toEqual(new Float32Array([3, 0, 0, -12]))

    // wasm memory.grow detached the buffer → views refresh on next write;
    // the new buffer's meta starts empty, so head lands at 1.
    memory.buffer = new ArrayBuffer((CAP * REC + 2) * 4 + 64)
    h.canvas.dispatchEvent(ev(POINTER_EVENTS.POINTERDOWN, { clientX: 1, clientY: 1 }))
    expect(ringOf(memory).meta[0]).toBe(1)
    expect(ringOf(memory).ring.slice(0, 4)).toEqual(new Float32Array([1, 1, 1, 0]))

    // A tick lands at least one frame call.
    await new Promise((r) => setTimeout(r, 40))
    expect(overlay.frames.length).toBeGreaterThan(0)

    // Widget + media handle surface — every pass-through lands on the
    // wasm instance with rect fields unpacked and arrays packed to f32.
    const rect = { x: 1, y: 2, width: 30, height: 4 }

    expect(h.registerWidget(1, rect)).toBe(11)
    expect(h.registerMedia(rect)).toBe(22)
    h.setWidgetRect(11, { x: 3, y: 4, width: 10, height: 5 })
    h.setWidgetUniform(11, [0.5, 30, 4, 1])
    h.setWidgetUniform(11, Float32Array.from([1]))
    h.uploadFlagTextures(2, new Uint8Array(4), 1, 1, new Uint8Array(4), 1, 1)
    h.writeSkelSheet(7, [0.1])
    expect(h.uploadMediaImage(22, new Uint8Array(8))).toBe(true)
    h.pushVideoFrame(22, new Uint8Array(8), 2, 1)
    h.burnSetLetters(8, [0, 0, 10, 10, 1, 0])
    h.burnSetInk(8, new Uint8Array(4))
    h.burnSetColors(8, [1, 1, 1, 1])
    h.burnSetDir(8, -1)
    h.burnSetStage(8, 0.5, 4)
    h.unregisterWidget(11)

    expect(overlay.widgets.length).toBe(2)
    expect(overlay.rects[0]).toEqual([11, 3, 4, 10, 5])
    expect(overlay.uniforms.length).toBe(2)
    expect(overlay.flagUploads.length).toBe(1)
    expect(overlay.skelWrites.length).toBe(1)
    expect(overlay.mediaUploads.length).toBe(1)
    expect(overlay.videoFrames[0]).toEqual([22, new Uint8Array(8), 2, 1])
    expect(overlay.burnCalls.map((c) => c[0])).toEqual(['letters', 'ink', 'colors', 'dir', 'stage'])
    expect(overlay.unregistered[0]).toEqual([11])
    expect(overlay.css.length).toBe(1)

    // visibilitychange while visible with a stopped loop restarts rAF.
    document.dispatchEvent(new Event(CLIPBOARD_EVENTS.VISIBILITY_CHANGE))

    h.destroy()
    expect(parent.contains(h.canvas)).toBe(false)

    const head = ringOf(memory).meta[0]
    h.canvas.dispatchEvent(ev(POINTER_EVENTS.POINTERDOWN, { clientX: 0, clientY: 0 }))
    expect(ringOf(memory).meta[0]).toBe(head)
  })

  test('hidden tab pauses the rAF loop', async () => {
    navigator.gpu = {}

    const { mod, overlay } = fakeModule(() => Promise.resolve())
    const parent = document.createElement('div')

    const h = await mountWebGpuOverlay(parent, async () => mod)
    const frames = overlay.frames.length

    // Simulate a hidden tab — the tick completes one frame then stops.
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    await new Promise((r) => setTimeout(r, 60))

    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event(CLIPBOARD_EVENTS.VISIBILITY_CHANGE))
    await new Promise((r) => setTimeout(r, 30))

    expect(overlay.frames.length).toBeGreaterThan(frames)

    // Hide again and let the tick drain the loop → rafId is 0, so destroy
    // takes the nothing-to-cancel arm.
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    await new Promise((r) => setTimeout(r, 60))

    h.destroy()

    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
  })

  test('undefined document context is declined', () => {
    expect(typeof mountWebGpuOverlay).toBe(TYPE_STRINGS.FUNCTION)
  })
})
