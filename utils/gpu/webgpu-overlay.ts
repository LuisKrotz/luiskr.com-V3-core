/**
 * @file utils/gpu/webgpu-overlay.ts
 * @description JS→wasm bridge for the `rust/overlay` WebGPU surface — the
 * painted layer of the dual-layer architecture. Capability-gated: no
 * `navigator.gpu`, no wasm artifact, or an init failure all return null
 * and the DOM stays the render path, so mounting this can never regress
 * the site. When live, the canvas owns pointer traffic; every event is
 * packed straight into wasm linear memory (zero-copy ring — see
 * `rust/overlay/src/input.rs`) and consumed by `Overlay::frame` once per
 * rAF tick owned here, keeping the frame-budget single-clock rule.
 */
import { GPU_OVERLAY_CLASSES } from '@core/tokens/classes/gpu.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import {
  POINTER_EVENTS,
  MOUSE_EVENTS,
  WINDOW_EVENTS,
  CLIPBOARD_EVENTS,
} from '@core/tokens/events/dom.js'
import { ASSET_PATHS } from '@core/tokens/routes/paths.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { devWarn } from '@core/devlog.js'

/**
 * Input discriminants written into the ring — mirrors `kinds` in
 * `rust/overlay/src/input.rs`; bump both together.
 */
const INPUT_TYPES = Object.freeze({
  POINTER_MOVE: 0,
  POINTER_DOWN: 1,
  POINTER_UP: 2,
  WHEEL: 3,
})

/** Ring capacity in records — mirrors RING_CAP in input.rs. */
const RING_CAP = 1024
/** f32s per record — [type, x, y, payload]. */
const RECORD_F32S = 4
/** Total f32 slots in the ring. */
const RING_F32S = RING_CAP * RECORD_F32S

/** wasm-pack `--target web` glue module path under public/. */
const OVERLAY_GLUE_URL = `${ASSET_PATHS.WASM_OVERLAY_PREFIX}luiskr_overlay.js`

/** What the generated glue exposes (loose — the crate may not exist yet). */
interface OverlayModule {
  /** Async initializer returning the wasm exports (includes `.memory`). */
  default: (input?: RequestInfo) => Promise<{ memory: WebAssembly.Memory }>
  /** The exported wasm class. */
  Overlay: new () => OverlayInstance
}

/** Public surface of the wasm `Overlay` — keep in sync with lib.rs. */
interface OverlayInstance {
  /** f32 ring base pointer inside wasm memory. */
  input_buffer_ptr(): number
  /** [head, tail] i32 pair pointer inside wasm memory. */
  input_meta_ptr(): number
  /** Async wgpu init on the canvas. */
  init(canvas: HTMLCanvasElement): Promise<unknown>
  /** Surface resize in device px. */
  resize(w: number, h: number): void
  /** Canvas CSS size — scissor math needs CSS↔device scale. */
  set_css_size(w: number, h: number): void
  /** One rAF tick; `dt` in seconds. */
  frame(dt: number): void
  /** Group id under the pointer after the latest drain (0 = none). */
  hover_group(): number
  /** Registers a shader widget region; 0 = unavailable/unknown kind. */
  register_widget(kind: number, x: number, y: number, w: number, h: number): number
  /** Registers a media (textured-quad) widget region. */
  register_media(x: number, y: number, w: number, h: number): number
  /** Moves/resizes a widget region (canvas CSS px). */
  set_widget_rect(id: number, x: number, y: number, w: number, h: number): void
  /** Writes a widget's uniform block (f32 layout per its .rs doc). */
  set_widget_uniform(id: number, values: Float32Array): void
  /** Removes a widget + its GPU resources. */
  unregister_widget(id: number): void
  /** Stages both flag textures and completes the flag bind group. */
  upload_flag_textures(
    id: number,
    rgbaA: Uint8Array,
    wA: number,
    hA: number,
    rgbaB: Uint8Array,
    wB: number,
    hB: number
  ): void
  /** Writes the skeleton per-rect sheet (vec4 fields × rects). */
  write_skel_sheet(id: number, values: Float32Array): void
  /** Rust-decodes an image onto a media widget; false = keep DOM img. */
  upload_media_image(id: number, bytes: Uint8Array): boolean
  /** Streams a WebCodecs-decoded RGBA frame into a media widget. */
  push_video_frame(id: number, rgba: Uint8Array, w: number, h: number): void
  /** Burn sim: letter table (f32×6 per letter). */
  burn_set_letters(id: number, flat: Float32Array): void
  /** Burn sim: per-column ink occupancy bytes. */
  burn_set_ink(id: number, ink: Uint8Array): void
  /** Burn sim: four ink tints [core, mid, edge, scorch] × rgba. */
  burn_set_colors(id: number, flat: Float32Array): void
  /** Burn sim: +1 burn, −1 rebuild. */
  burn_set_dir(id: number, dir: number): void
  /** Burn sim: per-frame stage + jagged amplitude. */
  burn_set_stage(id: number, stage: number, jagAmp: number): void
}

/** Canvas-space CSS px rect — the unit every widget registration uses. */
export interface WidgetRect {
  /** Left edge, CSS px. */
  x: number
  /** Top edge, CSS px. */
  y: number
  /** Width, CSS px. */
  width: number
  /** Height, CSS px. */
  height: number
}

/** Live overlay handle returned by `mountWebGpuOverlay`. */
export interface OverlayHandle {
  /** The mounted canvas element. */
  canvas: HTMLCanvasElement
  /** The wasm Overlay instance (text staging + font installs go here). */
  overlay: OverlayInstance
  /** Group under the pointer from the most recent frame (0 = none). */
  hoverGroup(): number
  /**
   * Registers a shader widget (GPU_WIDGET_KINDS) on a canvas-space rect;
   * returns the widget id or 0 — callers keep their DOM/WebGL paint on 0.
   */
  registerWidget(kind: number, rect: WidgetRect): number
  /** Registers a media rect — pairs with uploadMediaImage/pushVideoFrame. */
  registerMedia(rect: WidgetRect): number
  /** Moves a widget's rect — call on layout shifts/resize. */
  setWidgetRect(id: number, rect: WidgetRect): void
  /** Pushes a widget's uniform block (f32 layout per widget doc). */
  setWidgetUniform(id: number, values: Float32Array | number[]): void
  /** Removes a widget. */
  unregisterWidget(id: number): void
  /** Stages the flag widget's two textures (RGBA8 + sizes). */
  uploadFlagTextures(
    id: number,
    rgbaA: Uint8Array,
    wA: number,
    hA: number,
    rgbaB: Uint8Array,
    wB: number,
    hB: number
  ): void
  /** Writes the skeleton widget's per-rect sheet. */
  writeSkelSheet(id: number, values: Float32Array | number[]): void
  /** Decodes an image onto a media widget; false = keep the DOM img. */
  uploadMediaImage(id: number, bytes: Uint8Array): boolean
  /** Streams a WebCodecs RGBA frame into a media widget. */
  pushVideoFrame(id: number, rgba: Uint8Array, w: number, h: number): void
  /** Burn: letter table (f32×6 per letter). */
  burnSetLetters(id: number, flat: Float32Array | number[]): void
  /** Burn: per-column ink occupancy. */
  burnSetInk(id: number, ink: Uint8Array): void
  /** Burn: [core, mid, edge, scorch] tints × rgba. */
  burnSetColors(id: number, flat: Float32Array | number[]): void
  /** Burn: +1 burn, −1 rebuild. */
  burnSetDir(id: number, dir: number): void
  /** Burn: per-frame stage + jagged amplitude. */
  burnSetStage(id: number, stage: number, jagAmp: number): void
  /** Tears down listeners, the rAF loop, and the canvas. */
  destroy(): void
}

/**
 * Capability gate — `navigator.gpu` is the WebGPU entry point. Separate
 * from mount so callers can decide without touching the DOM.
 */
export function hasWebGpu(): boolean {
  return typeof navigator !== TYPE_STRINGS.UNDEFINED && 'gpu' in navigator
}

/**
 * Default module loader — dynamic-imports the wasm-pack glue from
 * `/wasm/overlay/`. `/* @vite-ignore *` keeps vite from trying to resolve
 * the (build-optional) artifact at bundle time; a 404/missing artifact
 * rejects and the caller falls back. Injectable for tests.
 */
async function loadOverlayModule(): Promise<OverlayModule> {
  return (await import(/* @vite-ignore */ OVERLAY_GLUE_URL)) as OverlayModule
}

/**
 * Mounts the overlay canvas + wasm surface on `parent`, wires the
 * zero-copy input ring, and starts the rAF frame loop. Resolves to a
 * handle, or null when WebGPU/the artifact is unavailable — the DOM
 * remains the authoritative render and interaction layer either way.
 * @param parent Element the canvas is appended to (usually document.body).
 * @param loadModule Injectable module loader (tests substitute a stub).
 */
export async function mountWebGpuOverlay(
  parent: HTMLElement,
  loadModule: () => Promise<OverlayModule> = loadOverlayModule
): Promise<OverlayHandle | null> {
  if (!hasWebGpu() || typeof document === TYPE_STRINGS.UNDEFINED) {
    return null
  }

  let mod: OverlayModule

  try {
    mod = await loadModule()
  } catch {
    devWarn('webgpu-overlay: wasm artifact unavailable — DOM fallback')
    return null
  }

  const canvas = document.createElement(HTML_TAGS.CANVAS)
  canvas.className = GPU_OVERLAY_CLASSES.GPU_OVERLAY

  let wasm: { memory: WebAssembly.Memory }

  try {
    wasm = await mod.default()
    const overlay = new mod.Overlay()

    await overlay.init(canvas)
    parent.appendChild(canvas)
    canvas.classList.add(GPU_OVERLAY_CLASSES.GPU_OVERLAY_ACTIVE)

    return wire(overlay, canvas, wasm.memory)
  } catch {
    devWarn('webgpu-overlay: init failed — DOM fallback')
    return null
  }
}

/**
 * Attaches the input pump + frame loop to a live wasm surface. Separate
 * from mount so the ring plumbing stays unit-testable without a real GPU.
 * @param overlay Live wasm Overlay instance.
 * @param canvas Mounted canvas the surface draws into.
 * @param memory The module's WebAssembly.Memory (ring + meta live inside).
 */
function wire(
  overlay: OverlayInstance,
  canvas: HTMLCanvasElement,
  memory: WebAssembly.Memory
): OverlayHandle {
  // Typed views over wasm linear memory. Recreated on demand because a
  // wasm memory.grow() detaches the old ArrayBuffer — the buffer identity
  // check costs one comparison per event.
  let ring = new Float32Array(memory.buffer, overlay.input_buffer_ptr(), RING_F32S)
  let meta = new Int32Array(memory.buffer, overlay.input_meta_ptr(), 2)
  let lastBuffer = memory.buffer

  const refreshViews = () => {
    if (memory.buffer !== lastBuffer) {
      lastBuffer = memory.buffer
      ring = new Float32Array(lastBuffer, overlay.input_buffer_ptr(), RING_F32S)
      meta = new Int32Array(lastBuffer, overlay.input_meta_ptr(), 2)
    }
  }

  // Writes one 16-byte record; head wraps via the power-of-two mask. When
  // the writer outruns the drain, Rust's reader clamps (oldest dropped).
  const push = (kind: number, x: number, y: number, payload: number) => {
    refreshViews()

    const head = meta[0]
    const off = (head & (RING_CAP - 1)) * RECORD_F32S

    ring[off] = kind
    ring[off + 1] = x
    ring[off + 2] = y
    ring[off + 3] = payload
    meta[0] = head + 1
  }

  const onPointerMove = (e: PointerEvent) => {
    // Coalesced samples: keep the last — freshest position wins (per the
    // frame-budget rule; trails need the whole array, hover doesn't).
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : []
    const last = events.length ? events[events.length - 1] : e

    push(INPUT_TYPES.POINTER_MOVE, last.clientX, last.clientY, 0)
  }

  const onPointerDown = (e: PointerEvent) => push(INPUT_TYPES.POINTER_DOWN, e.clientX, e.clientY, 0)

  const onPointerUp = (e: PointerEvent) => push(INPUT_TYPES.POINTER_UP, e.clientX, e.clientY, 0)

  const onWheel = (e: WheelEvent) => push(INPUT_TYPES.WHEEL, e.clientX, e.clientY, e.deltaY)

  // All scroll-blocking listeners passive — the compositor must never
  // wait on this pump (frame-budget rule 1).
  canvas.addEventListener(POINTER_EVENTS.POINTERMOVE, onPointerMove, { passive: true })
  canvas.addEventListener(POINTER_EVENTS.POINTERDOWN, onPointerDown, { passive: true })
  canvas.addEventListener(POINTER_EVENTS.POINTERUP, onPointerUp, { passive: true })
  canvas.addEventListener(MOUSE_EVENTS.WHEEL, onWheel, { passive: true })

  const onResize = () => {
    const w = Math.max(1, canvas.clientWidth)
    const h = Math.max(1, canvas.clientHeight)

    overlay.set_css_size(w, h)
    overlay.resize(
      Math.max(1, Math.round(w * window.devicePixelRatio)),
      Math.max(1, Math.round(h * window.devicePixelRatio))
    )
  }

  window.addEventListener(WINDOW_EVENTS.RESIZE, onResize, { passive: true })
  onResize()

  // rAF is owned here — one clock for the frame loop. dt in seconds;
  // the loop self-stops via destroy() and skips while the tab is hidden.
  let rafId = 0
  let last = performance.now()

  const tick = (now: number) => {
    overlay.frame((now - last) / 1000)
    last = now

    if (!document.hidden) {
      rafId = requestAnimationFrame(tick)
    } else {
      rafId = 0
    }
  }

  rafId = requestAnimationFrame(tick)

  const onVisible = () => {
    if (!document.hidden && !rafId) {
      last = performance.now()
      rafId = requestAnimationFrame(tick)
    }
  }

  document.addEventListener(CLIPBOARD_EVENTS.VISIBILITY_CHANGE, onVisible)

  // f32 packing for uniform writes — callers pass number[] or Float32Array.
  const f32 = (v: Float32Array | number[]) => (v instanceof Float32Array ? v : Float32Array.from(v))

  return {
    canvas,
    overlay,
    hoverGroup: () => overlay.hover_group(),
    registerWidget: (kind, rect) =>
      overlay.register_widget(kind, rect.x, rect.y, rect.width, rect.height),
    registerMedia: (rect) => overlay.register_media(rect.x, rect.y, rect.width, rect.height),
    setWidgetRect: (id, rect) =>
      overlay.set_widget_rect(id, rect.x, rect.y, rect.width, rect.height),
    setWidgetUniform: (id, values) => overlay.set_widget_uniform(id, f32(values)),
    unregisterWidget: (id) => overlay.unregister_widget(id),
    uploadFlagTextures: (id, rgbaA, wA, hA, rgbaB, wB, hB) =>
      overlay.upload_flag_textures(id, rgbaA, wA, hA, rgbaB, wB, hB),
    writeSkelSheet: (id, values) => overlay.write_skel_sheet(id, f32(values)),
    uploadMediaImage: (id, bytes) => overlay.upload_media_image(id, bytes),
    pushVideoFrame: (id, rgba, w, h) => overlay.push_video_frame(id, rgba, w, h),
    burnSetLetters: (id, flat) => overlay.burn_set_letters(id, f32(flat)),
    burnSetInk: (id, ink) => overlay.burn_set_ink(id, ink),
    burnSetColors: (id, flat) => overlay.burn_set_colors(id, f32(flat)),
    burnSetDir: (id, dir) => overlay.burn_set_dir(id, dir),
    burnSetStage: (id, stage, jagAmp) => overlay.burn_set_stage(id, stage, jagAmp),
    destroy: () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = 0

      document.removeEventListener(CLIPBOARD_EVENTS.VISIBILITY_CHANGE, onVisible)
      window.removeEventListener(WINDOW_EVENTS.RESIZE, onResize)
      canvas.removeEventListener(POINTER_EVENTS.POINTERMOVE, onPointerMove)
      canvas.removeEventListener(POINTER_EVENTS.POINTERDOWN, onPointerDown)
      canvas.removeEventListener(POINTER_EVENTS.POINTERUP, onPointerUp)
      canvas.removeEventListener(MOUSE_EVENTS.WHEEL, onWheel)
      canvas.remove()
    },
  }
}
