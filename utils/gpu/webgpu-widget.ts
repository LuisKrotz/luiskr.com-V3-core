/**
 * @file utils/gpu/webgpu-widget.ts
 * @description Per-widget WebGPU/Rust bridge — the loader for the
 * one-artifact-per-animation architecture (`rust/` workspace). Each
 * animation is its own ~50KB wasm module drawing through the page's
 * single shared GPUDevice (`getSharedGpuDevice`) on the widget's
 * dedicated canvas — no shared monolith, so every surface pays only
 * for the animation it actually mounts. Capability-gated: no
 * `navigator.gpu`, a missing artifact, or an init failure all return
 * null and the existing WebGL/CSS widget keeps rendering — mounting can
 * never regress the site. The bridge owns the rAF clock (single-clock
 * frame-budget rule) and pauses while the tab is hidden.
 */
import { GPU_WIDGET_ARTIFACTS, GPU_WIDGET_DRIVE } from '@core/tokens/motion/gpu-widgets.js'
import { WINDOW_EVENTS, CLIPBOARD_EVENTS } from '@core/tokens/events/dom.js'
import { QUERY_STRINGS } from '@core/tokens/strings/queries.js'
import { STATE_STRINGS } from '@core/tokens/strings/state.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { WASM_POOL } from '@core/tokens/data/wasm.js'
import { DEBUG_PARAMS, WEBGL_MODES } from '@core/tokens/strings/debug.js'
import { devWarn } from '@core/devlog.js'
import { framePool } from '../motion/frame.js'

/**
 * The generated wasm-pack glue module shape. Each crate exports a
 * differently-named widget class, so the registry carries the class
 * name and the module is indexed dynamically.
 */
export interface WidgetModule {
  /** Async initializer returning the wasm exports (includes memory). */
  default: (input?: RequestInfo) => Promise<unknown>
  /** The crate's widget class — indexed by `GPU_WIDGET_ARTIFACTS[kind].cls`. */
  [cls: string]: unknown
}

/**
 * Public surface every widget crate shares (`init`/`resize`/`frame`
 * are the contract; `set_size`/`set_state`/`tap`/`click`/
 * `upload_textures`/`write_sheet`/`begin`/`set_letters`/`upload_bitmap`
 * etc. are kind-specific and reached through `handle.widget`).
 */
export interface WasmWidget {
  /** Async init on the widget's canvas, bound to the shared device. */
  init(canvas: HTMLCanvasElement, device: GPUDevice): Promise<unknown>
  /** Surface re-configure after a bitmap resize (device px). */
  resize(w: number, h: number): void
  /** Canvas CSS size — feeds the shader's res/rect uniforms. */
  set_size(w: number, h: number): void
  /**
   * One rAF tick; `dt` in seconds. Returns false when the surface is
   * stale/lost (the caller disarms its loop); the wasm-pack signature
   * declares `boolean | undefined`, so callers must tolerate undefined.
   */
  frame(dt: number): boolean
  /**
   * wasm-bindgen `free()` — drops the boxed struct AND unregisters the
   * FinalizationRegistry entry, so the object never re-enters
   * `__wbg_*_free` at GC time (the registry path is where a stale
   * glue/wasm pair traps `memory access out of bounds` — the glue's
   * free shim walks the struct layout compiled into ITS wasm, and a
   * hot-swapped artifact pair makes that read land off the heap).
   * Destroy calls it so the free happens deterministically while the
   * artifact pair that built the object is still the live one.
   */
  free?(): void
  /** Kind-specific setters — see each crate's lib.rs exports. */
  [key: string]: unknown
}

/** Live widget handle returned by `mountWebGpuWidget`. */
export interface WidgetHandle {
  /** The canvas the widget draws into (the caller's element). */
  canvas: HTMLCanvasElement
  /**
   * The wasm widget instance — kind-specific methods
   * (`set_state`, `tap`, `click`, `upload_textures`, `write_sheet`,
   * `begin`, `set_letters`, `set_ink`, `set_colors`, `set_dir`,
   * `set_stage`, `set_origin`, `upload_bitmap`, `push_frame`,
   * `set_uv_rect`, `set_dark`) are called directly on it.
   */
  widget: WasmWidget
  /** Tears down the rAF loop + listeners (the canvas is caller-owned). */
  destroy(): void
  /**
   * Worker-routed probes — renders an end-state frame and reports the
   * painted-pixel coverage ratio of the live canvas. Present only on
   * worker-backed handles (main-thread mounts keep the readback in the
   * caller); returns null on failure.
   */
  probe?: (ms: number) => Promise<number | null>
}

/**
 * Capability gate — `navigator.gpu` is the WebGPU entry point.
 * Separate from mount so callers can decide without touching the DOM.
 */
export function hasWebGpu(): boolean {
  return typeof navigator !== TYPE_STRINGS.UNDEFINED && 'gpu' in navigator
}

/**
 * `webgpuWidgetsEnabled` — the layer kill-switch. The WebGPU widget
 * mounts (worker `OffscreenCanvas` route OR in-page) only run under
 * `?debug=webgpuWidgets:active`; every other state keeps the proven
 * WebGL/CSS renderers authoritative. Re-parsed per call so tests and
 * debug toggles flip without a reload.
 * @returns True when the WebGPU widget layer may mount.
 */
export function webgpuWidgetsEnabled(): boolean {
  if (typeof window === TYPE_STRINGS.UNDEFINED) return false

  const params = new URLSearchParams(window.location.search)
  let on = false

  for (const raw of params.getAll(DEBUG_PARAMS.KEY)) {
    const [key, value] = raw.split(':')

    if (key === DEBUG_PARAMS.WEBGPU_WIDGETS) on = value === WEBGL_MODES.ACTIVE
  }

  return on
}

/**
 * The page's single GPUDevice. Every widget artifact takes the SAME
 * device object — WebGPU is designed for one device serving many
 * canvases — because per-widget devices exhaust the driver: on
 * Windows/D3D12 a busy page hit `create command queue failed with
 * E_OUTOFMEMORY` after ~100 device creations, every subsequent
 * requestDevice resolved a broken/undefined handle, and widget init
 * trapped in the wasm future. One shared request keeps a full page of
 * widgets inside any driver's device budget.
 */
let sharedDevice: Promise<GPUDevice | null> | null = null
/** The `navigator.gpu` object the cached request was issued against — a
 *  different handle (test double, re-exposed API) re-requests. */
let sharedFor: unknown = null

/**
 * `getSharedGpuDevice` — request the adapter+device once and cache
 * the promise so concurrent mounts share one acquisition. Keyed on
 * the `navigator.gpu` object itself: swapping the handle re-requests.
 * Resolves null on any failure (no adapter, rejected device request,
 * undefined device) — every caller falls back to its WebGL/CSS path.
 * A device that later goes lost clears the cache so the next mount
 * re-requests cleanly.
 * @returns The shared GPUDevice, or null when WebGPU is unusable.
 */
export function getSharedGpuDevice(): Promise<GPUDevice | null> {
  if (!hasWebGpu()) return Promise.resolve(null)

  const gpu = navigator.gpu

  if (gpu !== sharedFor) {
    sharedFor = gpu
    sharedDevice = (async () => {
      try {
        // Bounded — a wedged GPU process leaves requestAdapter pending
        // forever; an unbounded await would latch every caller's
        // "mount in flight" flag and starve the WebGL/CSS fallback.
        const adapter = await withTimeout(gpu.requestAdapter(), GPU_DEVICE_TIMEOUT_MS)

        if (!adapter) return null

        const device = await withTimeout(adapter.requestDevice(), GPU_DEVICE_TIMEOUT_MS)

        if (!device) return null

        // A lost device can never serve another widget — drop the
        // cached promise so the next mount re-requests instead of
        // feeding every artifact a dead handle.
        device.lost.then(() => {
          sharedDevice = null
          sharedFor = null
        })

        return device
      } catch {
        return null
      }
    })()
  }

  return sharedDevice as Promise<GPUDevice | null>
}

/**
 * Mount options — `drive` selects the clock owner; see
 * `GPU_WIDGET_DRIVE` for the semantics of each mode.
 */
export interface MountOptions {
  /** `GPU_WIDGET_DRIVE` member; defaults to RAF. */
  drive?: string
}

/**
 * Default module loader — dynamic-imports the wasm-pack glue at
 * `/wasm/<slug>/<pkg>.js` (see `GPU_WIDGET_ARTIFACTS`). `@vite-ignore`
 * keeps vite from resolving build-optional artifacts; a 404 rejects
 * and the caller falls back. Injectable for tests.
 * @param url Artifact glue URL.
 */
async function loadModuleDefault(url: string): Promise<WidgetModule> {
  return (await import(/* @vite-ignore */ url)) as WidgetModule
}

/**
 * wasm-pack `init` is NOT reentrant-safe — `__wbg_init` checks the
 * module-level `wasm` binding, then awaits instantiate: a second
 * concurrent call before that lands re-instantiates and REPLACES the
 * heap — widgets built through the older instance then run methods on
 * the newer one's memory (RefCell flags read as garbage →
 * `try_borrow_mut` fails → 'gpu slot poisoned', or state reads as
 * zeros → a valid draw that paints nothing). Memoize the promise per
 * module object so concurrent mounts share ONE instantiation.
 */
const moduleInitOnce = new WeakMap<WidgetModule, Promise<unknown>>()

/**
 * `initModule` — the concurrency-safe wrapper around wasm-pack's
 * `mod.default()`: the first caller's promise is the single
 * instantiation; later callers join it.
 * @param mod The loaded artifact glue module.
 * @returns The shared instantiation promise.
 */
function initModule(mod: WidgetModule): Promise<unknown> {
  let p = moduleInitOnce.get(mod)

  if (!p) {
    p = mod.default()
    moduleInitOnce.set(mod, p)
  }

  return p
}

/**
 * Fire-and-forget fetch+compile for every `eager` artifact in the
 * registry — currently just the skeleton, the loading placeholder
 * itself. Calling this at the first skeleton mount starts the
 * artifact fetch before `init` would, so the widget is ready the
 * moment its canvas needs it; failures are swallowed because mount
 * re-attempts and falls back anyway.
 * @param loadModule Injectable module loader (tests substitute a stub).
 */
export function warmWidgetArtifacts(
  loadModule: (url: string) => Promise<WidgetModule> = loadModuleDefault
): void {
  if (!hasWebGpu() || !webgpuWidgetsEnabled()) return

  for (const spec of Object.values(GPU_WIDGET_ARTIFACTS)) {
    if (spec.eager) {
      loadModule(spec.url).catch(() => undefined)
    }
  }
}

/**
 * Mounts a widget artifact on `canvas`: loads its wasm module, calls
 * `init`, wires resize + visibility-paused rAF, and returns the live
 * handle. Resolves null on any capability/artifact/init failure — the
 * caller's WebGL/CSS renderer stays the render path.
 * @param kind `GPU_WIDGET_KINDS` discriminant.
 * @param canvas The widget's dedicated canvas element.
 * @param loadModule Injectable module loader (tests substitute a stub).
 * @param options Mount options — `GPU_WIDGET_DRIVE.MANUAL` leaves the
 *   clock + resize to the caller's own loop.
 */
export async function mountWebGpuWidget(
  kind: number,
  canvas: HTMLCanvasElement,
  loadModule: (url: string) => Promise<WidgetModule> = loadModuleDefault,
  options: MountOptions = {}
): Promise<WidgetHandle | null> {
  const spec = GPU_WIDGET_ARTIFACTS[kind]

  if (
    !spec ||
    !hasWebGpu() ||
    !webgpuWidgetsEnabled() ||
    typeof document === TYPE_STRINGS.UNDEFINED
  ) {
    return null
  }

  // Off-main-thread route — when the browser supports module workers +
  // OffscreenCanvas + worker-side WebGPU, the render worker owns the
  // artifact, the device, and every draw call; the main thread only
  // forwards mount/resize/input messages. Any routing failure falls
  // through to the in-page mount below.
  let routed: { handle?: WidgetHandle; canvas?: HTMLCanvasElement } | null

  try {
    routed = await mountViaWorker(spec, canvas, options.drive === GPU_WIDGET_DRIVE.MANUAL)
  } catch {
    routed = null
  }

  if (routed?.handle) return routed.handle

  // A transferred-but-unmounted canvas is dead placeholder-mode markup —
  // mountViaWorker already stamped it is-fallback + hidden, and no
  // context could attach for the in-page path anyway. Stop here so the
  // caller's own fallback path resolves on its original element.
  if (routed?.canvas) return null

  const fail = (): null => null

  let mod: WidgetModule

  try {
    mod = await withTimeout(loadModule(spec.url), WIDGET_INIT_TIMEOUT_MS)
  } catch {
    devWarn('webgpu-widget: artifact unavailable — WebGL fallback')
    return fail()
  }

  try {
    const device = await getSharedGpuDevice()

    // No usable device — every artifact would init-trap on the dead
    // handle; the WebGL/CSS widgets keep rendering instead.
    if (!device) return fail()

    await initModule(mod)

    const WidgetClass = mod[spec.cls] as new () => WasmWidget
    const widget = new WidgetClass()

    // Serialize widget inits through the mount queue — a load burst of
    // concurrent mounts compiles pipelines + configures surfaces back
    // to back inside one task (the multi-second boot-storm long task
    // that starved the burger/menu mounts). Each init gets its own
    // task slot so input and rAF interleave between mounts.
    const prev = initQueue
    let release!: () => void

    initQueue = new Promise<void>((r) => {
      release = r
    })

    await prev
    await taskYield()

    try {
      // Bounded — a broken/undefined device traps the wasm future
      // forever (the documented E_OUTOFMEMORY case); without a limit
      // the caller's pending flag latches and the fallback never arms.
      await withTimeout(widget.init(canvas, device), WIDGET_INIT_TIMEOUT_MS)
    } finally {
      release()
    }

    return wire(widget, canvas, options.drive === GPU_WIDGET_DRIVE.MANUAL)
  } catch (e) {
    devWarn('webgpu-widget: init failed — WebGL fallback', e)
    return fail()
  }
}

/**
 * Widget-init serialization chain — each mount awaits the previous
 * init's release, so the load-time mount burst pipelines instead of
 * stacking inside one task.
 */
let initQueue: Promise<void> = Promise.resolve()

/**
 * One macrotask boundary — `setTimeout(0)` via Promise; yields to
 * input/rAF between consecutive widget inits. Kept as a named helper
 * so the queue line stays a single expression and tests can stub the
 * boundary if needed.
 * @returns A promise resolving on the next task.
 */
function taskYield(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0))
}

/**
 * `withTimeout` — bounds a promise: resolves its value when it lands in
 * time, rejects otherwise. Used on the two unbounded GPU awaits —
 * adapter/device requests and widget init — where a wedged driver or a
 * dead device leaves the promise pending forever, which would latch
 * the caller's mount-in-flight flag and starve its WebGL/CSS fallback.
 * @param p The promise to bound.
 * @param ms Deadline in milliseconds.
 * @returns The bounded promise.
 */
function withTimeout<T>(p: Promise<T> | T, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('webgpu-widget: timeout')), ms)

    Promise.resolve(p).then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e instanceof Error ? e : new Error(String(e)))
      }
    )
  })
}

/**
 * Attaches the rAF clock + resize/visibility plumbing to a live wasm
 * widget. Separate from mount so the loop stays unit-testable without
 * a real GPU. `dt` is seconds; the loop self-stops on destroy and
 * skips frames while the tab is hidden (frame-budget rule). In
 * `manual` mode none of that attaches — the caller's own loop calls
 * `widget.frame`, `widget.set_size`, and `widget.resize`, so there is
 * exactly one clock and one resize observer per widget.
 * @param widget Live wasm widget instance.
 * @param canvas The widget's canvas element.
 * @param manual True to skip the rAF clock + listeners entirely.
 */
function wire(widget: WasmWidget, canvas: HTMLCanvasElement, manual: boolean): WidgetHandle {
  if (manual) {
    return { canvas, widget, destroy: () => freeWidget(widget) }
  }

  const onResize = () => {
    const w = Math.max(1, canvas.clientWidth)
    const h = Math.max(1, canvas.clientHeight)

    // Same wasm-boundary containment as `tick` — a throw here must
    // not escape into the resize listener.
    try {
      if (typeof widget.set_size === TYPE_STRINGS.FUNCTION) {
        widget.set_size(w, h)
      }

      widget.resize(
        Math.max(1, Math.round(w * window.devicePixelRatio)),
        Math.max(1, Math.round(h * window.devicePixelRatio))
      )
    } catch (e) {
      devWarn('webgpu-widget: resize threw', e)
    }
  }

  window.addEventListener(WINDOW_EVENTS.RESIZE, onResize, { passive: true })
  onResize()

  // rAF is owned here — one clock per widget, paused while the tab is
  // hidden AND while the canvas is offscreen. A full page of widgets
  // (mosaic tiles, dividers, draws) each submitting a draw every frame
  // is the sustained-GPU-burn source: offscreen canvases must not draw.
  let rafId = 0
  let last = performance.now()
  let onScreen = true

  const kick = () => {
    if (!rafId && onScreen && !document.hidden) {
      last = performance.now()
      rafId = framePool.request(tick)
    }
  }

  const tick = (now: number) => {
    // Never paint an invisible frame — a hidden tab or an offscreen
    // canvas gets zero draw submissions (the in-flight tick disarms
    // immediately instead of drawing once then stopping).
    if (document.hidden || !onScreen) {
      rafId = 0
      return
    }

    // A wasm-boundary throw (non-Result web_sys call raising — e.g.
    // device loss mid-draw) would otherwise escape the rAF callback
    // uncaught every frame. One throw means the widget is dead —
    // disarm the loop; the caller's WebGL/CSS fallback keeps painting.
    try {
      widget.frame((now - last) / 1000)
    } catch (e) {
      devWarn('webgpu-widget: frame threw — loop disarmed', e)
      rafId = 0
      return
    }
    last = now

    if (!document.hidden && onScreen) {
      rafId = framePool.request(tick)
    } else {
      rafId = 0
    }
  }

  // A detached/hidden canvas never intersects — `isIntersecting` on a
  // zero-area element stays false, but init-time mounts on detached
  // canvases (draw-text prepares before attaching) would freeze the
  // loop at birth; the observer fires once on observe() and detached
  // elements report non-intersecting, so they get one frame and stop
  // — correct: an offscreen widget draws nothing.
  const io =
    typeof IntersectionObserver !== TYPE_STRINGS.UNDEFINED
      ? new IntersectionObserver(
          ([entry]) => {
            onScreen = !entry || entry.isIntersecting
            kick()
          },
          { rootMargin: QUERY_STRINGS.ROOT_MARGIN_100 }
        )
      : null

  // Observe only AFTER the initial tick is scheduled — a synchronous
  // observer callback (happy-dom, polyfills) would kick while rafId is
  // still 0 and orphan a second loop destroy can never cancel.
  rafId = framePool.request(tick)
  io?.observe(canvas)

  const onVisible = () => {
    kick()
  }

  document.addEventListener(CLIPBOARD_EVENTS.VISIBILITY_CHANGE, onVisible)

  return {
    canvas,
    widget,
    destroy: () => {
      if (rafId) framePool.cancel(rafId)
      rafId = 0

      io?.disconnect()
      document.removeEventListener(CLIPBOARD_EVENTS.VISIBILITY_CHANGE, onVisible)
      window.removeEventListener(WINDOW_EVENTS.RESIZE, onResize)

      freeWidget(widget)
    },
  }
}

/**
 * `freeWidget` — the deterministic counterpart of the
 * FinalizationRegistry: calls the wasm-bindgen `free()` so the boxed
 * struct is dropped now, under the artifact pair that created it,
 * instead of at an arbitrary GC point (possibly after vite hot-swapped
 * the glue — the `__wbg_*_free` shim then walks a stale layout and
 * traps `memory access out of bounds` as an unhandled rejection from
 * inside the registry callback, which no caller can catch). A corrupt
 * free is contained here — the widget is already dead either way.
 * @param widget The live (or init-failed) wasm widget to release.
 */
function freeWidget(widget: WasmWidget): void {
  try {
    // `free()` is NOT idempotent: `__destroy_into_raw` zeroes
    // `__wbg_ptr`, and a second call hands `__wbg_*_free(0)` to wasm —
    // dropping a null box is UB that traps `memory access out of
    // bounds`. Multiple destroy paths (bridge destroy + component
    // teardown + finish) reach here, so skip only the zeroed pointer —
    // undefined (non-wasm doubles) still gets its free().
    if ((widget as { __wbg_ptr?: number }).__wbg_ptr !== 0) widget.free?.()
  } catch (e) {
    devWarn('webgpu-widget: free threw — wasm box abandoned', e)
  }
}

// ── Render-worker route ─────────────────────────────────────────────
// The widget architecture renders off the main thread: the render
// worker (core/public/scripts/workers/gpu-render-worker.js) owns each
// widget's OffscreenCanvas, its wasm artifact instance, the shared
// GPUDevice, and every per-frame draw submission. The bridge here is
// pure plumbing: transfer the canvas, forward mount/resize/input
// messages, and hand callers a WidgetHandle whose widget is a Proxy
// posting method calls. A worker that can't run WebGPU (no
// navigator.gpu in the worker realm) fails the probe once and every
// mount takes the in-page path forever after.

/** The worker's artifact spec — the registry entry's wire shape. */
interface WorkerSpec {
  /** Glue module URL — `/wasm/<slug>/<pkg>.js`. */
  url: string
  /** Exported widget class name inside that module. */
  cls: string
}

/** Capability handshake timeout — a dead worker script never acks. */
const WORKER_PROBE_TIMEOUT_MS = 2000

/**
 * Bound on `requestAdapter`/`requestDevice` — a wedged GPU process
 * leaves these pending forever; normal adapters answer in tens of ms,
 * so two seconds only trips on a genuinely broken stack.
 */
const GPU_DEVICE_TIMEOUT_MS = 2000

/**
 * Bound on a widget's `init(canvas, device)` — pipeline compile on a
 * healthy device finishes in well under a second; a dead/broken device
 * traps the wasm future permanently (the E_OUTOFMEMORY case).
 */
const WIDGET_INIT_TIMEOUT_MS = 4000

/** The live render worker — set once the probe acks. */
let renderWorker: Worker | null = null

/** One-shot capability probe latch. */
let workerProbe: Promise<boolean> | null = null

/** Probe ack resolver while the handshake is in flight. */
let pendingProbeAck: ((ok: boolean) => void) | null = null

/** Mount ack resolvers — widget id → resolve(success). */
const pendingMounts = new Map<number, (ok: boolean) => void>()

/** Async call/probe reply resolvers — replyId → resolve(result). */
const pendingCalls = new Map<number, (v: unknown) => void>()

/** Widget death watchers — id → callback when the worker reports dead. */
const deadWatchers = new Map<number, () => void>()

/** Monotonic widget id — correlates worker records to proxies. */
let workerWidgetSeq = 0

/** Monotonic reply id for call/probe round trips. */
let workerCallSeq = 0

/**
 * `dispatchWorkerMessage` — the single onmessage router for the
 * render worker: mount acks, call/probe replies, and death notices.
 * @param e The worker message event.
 */
function dispatchWorkerMessage(e: MessageEvent): void {
  const d = (e.data || {}) as {
    type?: string
    id?: number
    ok?: boolean
    alive?: boolean
    replyId?: number
    result?: unknown
    coverage?: number
  }

  if (d.type === 'probe-ack') {
    pendingProbeAck?.(!!d.ok)
    pendingProbeAck = null

    return
  }

  if (d.type === 'mounted' || d.type === 'mount-fail') {
    const resolve = pendingMounts.get(d.id ?? -1)

    pendingMounts.delete(d.id ?? -1)
    resolve?.(d.type === 'mounted')

    return
  }

  if (d.type === 'call-result' || d.type === 'probe-result') {
    const resolve = pendingCalls.get(d.replyId ?? -1)

    pendingCalls.delete(d.replyId ?? -1)
    resolve?.(d.type === 'probe-result' ? d.coverage : (d.result ?? null))

    return
  }

  if (d.type === 'dead' || (d.type === 'frame-result' && d.alive === false)) {
    deadWatchers.get(d.id ?? -1)?.()
  }
}

/**
 * `spawnRenderWorker` — create the worker and handshake it. The probe
 * decides once whether this browser can render widgets in a worker —
 * module workers + OffscreenCanvas + worker `navigator.gpu`; anything
 * less routes every mount in-page permanently.
 * @returns True when the worker answered the probe as capable.
 */
async function spawnRenderWorker(): Promise<boolean> {
  try {
    if (
      typeof Worker === TYPE_STRINGS.UNDEFINED ||
      typeof OffscreenCanvas === TYPE_STRINGS.UNDEFINED
    ) {
      return false
    }

    const worker = new Worker(WASM_POOL.GPU_WORKER_URL, { type: 'module' })

    worker.onmessage = dispatchWorkerMessage

    const ok = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        pendingProbeAck = null
        resolve(false)
      }, WORKER_PROBE_TIMEOUT_MS)

      pendingProbeAck = (v) => {
        clearTimeout(timer)
        resolve(v)
      }

      try {
        worker.postMessage({ type: 'probe' })
      } catch {
        pendingProbeAck = null
        clearTimeout(timer)
        resolve(false)
      }
    })

    if (!ok) {
      worker.terminate()

      return false
    }

    // A dying worker must not orphan in-flight work: flush every
    // pending mount/call so awaits resolve into the fallback paths,
    // fire the death watchers so proxies report dead, and drop the
    // cached capability so later mounts go in-page — a crashed render
    // worker never respawns.
    worker.onerror = () => {
      renderWorker = null
      workerProbe = Promise.resolve(false)

      for (const resolve of pendingMounts.values()) resolve(false)
      for (const resolve of pendingCalls.values()) resolve(null)
      for (const watch of deadWatchers.values()) watch()

      pendingMounts.clear()
      pendingCalls.clear()
      deadWatchers.clear()
    }

    renderWorker = worker

    return true
  } catch {
    return false
  }
}

/**
 * `getRenderWorker` — the capability gate for the worker route:
 * resolves the live worker, or null when the browser can't run it.
 * @returns The render worker or null.
 */
function getRenderWorker(): Promise<Worker | null> {
  if (!workerProbe) workerProbe = spawnRenderWorker()

  return workerProbe.then((ok) => (ok ? renderWorker : null))
}

/**
 * `destroyRenderWorker` — tears the render worker down for page unload
 * and vite HMR dispose: terminates the thread, flushes every pending
 * mount/call resolver (the map wrappers clear their own timers), fires
 * death watchers so proxies report dead, and latches the capability off
 * so nothing respawns inside a dying realm. Without this hook an HMR
 * module re-eval orphans the worker — its per-widget pump timers keep
 * the thread (and its browser process slot) alive forever.
 */
function destroyRenderWorker(): void {
  const worker = renderWorker

  renderWorker = null
  workerProbe = Promise.resolve(false)
  pendingProbeAck?.(false)
  pendingProbeAck = null

  for (const resolve of pendingMounts.values()) resolve(false)
  for (const resolve of pendingCalls.values()) resolve(null)
  for (const watch of deadWatchers.values()) watch()

  pendingMounts.clear()
  pendingCalls.clear()
  deadWatchers.clear()

  try {
    worker?.terminate()
  } catch {
    /* terminate() is idempotent — a wedged worker may throw */
  }
}

/**
 * `mountViaWorker` — attempt the off-main-thread mount: transfer the
 * canvas to the render worker, wait for the artifact to init there,
 * and wire a message-forwarding handle. Returns:
 *   - `{handle}` on success;
 *   - `{canvas}` when the transfer happened but the worker mount
 *     failed — the element is dead (placeholder mode, no context can
 *     ever attach), so it is marked in place and the caller's own
 *     fallback path takes over;
 *   - `null` when the worker can't run at all (probe failed or the
 *     canvas was already transferred).
 * @param spec The artifact registry entry.
 * @param canvas The widget's canvas element.
 * @param manual Drive mode — manual widgets pace `frame` messages from
 *   their own caller loop; the worker skips its internal pump.
 */
async function mountViaWorker(
  spec: WorkerSpec,
  canvas: HTMLCanvasElement,
  manual: boolean
): Promise<{ handle?: WidgetHandle; canvas?: HTMLCanvasElement } | null> {
  const worker = await getRenderWorker()

  if (!worker) return null

  let offscreen: OffscreenCanvas

  try {
    // DOM lib predates transferToOffscreen in this TS version.
    offscreen = (
      canvas as HTMLCanvasElement & { transferToOffscreen: () => OffscreenCanvas }
    ).transferToOffscreen()
  } catch {
    // A transferred or context-claimed canvas can't move — stay in-page.
    return null
  }

  const id = ++workerWidgetSeq
  const state = { alive: true }

  // Element width/height setters are inert once the bitmap is
  // transferred — shadow them so callers' canvas.width=/height= writes
  // forward to the worker's OffscreenCanvas instead of throwing or
  // silently dropping. The attributes' last written value is kept as
  // the getter's answer.
  let dimW = offscreen.width
  let dimH = offscreen.height

  const postDims = () => {
    try {
      worker.postMessage({ type: 'resize-dims', id, w: dimW, h: dimH })
    } catch {
      /* worker gone — the mount/fallback path reports separately */
    }
  }

  Object.defineProperty(canvas, 'width', {
    configurable: true,
    get: () => dimW,
    set: (v: number) => {
      dimW = Number(v) || 0
      postDims()
    },
  })

  Object.defineProperty(canvas, 'height', {
    configurable: true,
    get: () => dimH,
    set: (v: number) => {
      dimH = Number(v) || 0
      postDims()
    },
  })

  const mounted = await new Promise<boolean>((resolve) => {
    // A worker that never acks (module error, dead realm) must not
    // hang the mount — timeout resolves into the in-page fallback.
    const timer = setTimeout(() => {
      pendingMounts.delete(id)
      resolve(false)
    }, WASM_POOL.REPLY_TIMEOUT_MS)

    pendingMounts.set(id, (ok) => {
      clearTimeout(timer)
      resolve(ok)
    })

    try {
      worker.postMessage(
        { type: 'mount', id, url: spec.url, cls: spec.cls, manual, canvas: offscreen },
        [offscreen]
      )
    } catch {
      pendingMounts.delete(id)
      clearTimeout(timer)
      resolve(false)
    }
  })

  if (!mounted) {
    // The element is transferred (placeholder mode): no context — WebGL,
    // WebGPU, or 2D — can ever attach to it again, so a live-canvas
    // transplant is the only way the widget could still render in-page.
    // But every caller keeps long-lived references to THIS element
    // (canvas fields, bound listeners, pool registrations) — a swapped
    // clone would paint while clicks and resizes silently dead-ended on
    // the detached original. The dead element therefore stays in place
    // and carries the fallback marks itself; the caller's
    // `:has(canvas.is-fallback)` CSS fallback takes over, and its own
    // init path resolves to the same state when getContext returns null.
    canvas.classList.add(STATE_CLASSES.IS_FALLBACK)

    canvas.style.display = STATE_STRINGS.NONE

    return { canvas }
  }

  // Method forwarding — transferables (ImageBitmap/TypedArray) move
  // zero-copy; every call resolves via the reply map so awaited
  // callers (draw-text's atlas/sheet arms) get the worker's result.
  const postCall = (method: string, args: unknown[]): Promise<unknown> => {
    const replyId = ++workerCallSeq
    const transfer: Transferable[] = []

    for (const arg of args) {
      if (
        arg instanceof ArrayBuffer ||
        (typeof ImageBitmap !== TYPE_STRINGS.UNDEFINED && arg instanceof ImageBitmap)
      ) {
        transfer.push(arg as Transferable)
      } else if (arg && (arg as { buffer?: ArrayBuffer }).buffer instanceof ArrayBuffer) {
        transfer.push((arg as { buffer: ArrayBuffer }).buffer)
      }
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pendingCalls.delete(replyId)
        resolve(null)
      }, WASM_POOL.REPLY_TIMEOUT_MS)

      pendingCalls.set(replyId, (v) => {
        clearTimeout(timer)
        resolve(v)
      })

      try {
        worker.postMessage({ type: 'call', id, m: method, args, replyId }, transfer)
      } catch {
        pendingCalls.delete(replyId)
        clearTimeout(timer)
        resolve(null)
      }
    })
  }

  const probe = (ms: number): Promise<number | null> =>
    new Promise((resolve) => {
      const replyId = ++workerCallSeq
      const timer = setTimeout(() => {
        pendingCalls.delete(replyId)
        resolve(null)
      }, WASM_POOL.REPLY_TIMEOUT_MS)

      pendingCalls.set(replyId, (v) => {
        clearTimeout(timer)
        resolve(typeof v === 'number' ? v : null)
      })

      try {
        worker.postMessage({ type: 'probe-frame', id, ms, replyId })
      } catch {
        pendingCalls.delete(replyId)
        clearTimeout(timer)
        resolve(null)
      }
    })

  const destroy = () => {
    deadWatchers.delete(id)

    try {
      worker.postMessage({ type: 'destroy', id })
    } catch {
      /* worker gone — its records die with it */
    }
  }

  // The proxy widget — `frame`/`resize` keep their synchronous
  // contract (alive flag + fire-and-forget); every other method
  // forwards through postCall and resolves its worker result.
  const proxy = new Proxy({} as WasmWidget, {
    get(_t, prop) {
      if (prop === 'frame') {
        return (dt: number) => {
          if (!state.alive) return false

          try {
            worker.postMessage({ type: 'frame', id, dt })
          } catch {
            state.alive = false

            return false
          }

          return true
        }
      }

      if (prop === 'resize') {
        return (w: number, h: number) => {
          try {
            worker.postMessage({ type: 'resize', id, w, h })
          } catch {
            /* dead worker — the next frame reports the widget dead */
          }
        }
      }

      if (prop === 'init') return async () => undefined

      // __wbg_ptr stays falsy — freeWidget never touches a proxy box;
      // the worker frees the real struct on 'destroy'.
      if (prop === '__wbg_ptr') return 0

      return (...args: unknown[]) => postCall(String(prop), args)
    },
  })

  deadWatchers.set(id, () => {
    state.alive = false
  })

  // Non-manual handles keep the bridge's resize/visibility plumbing —
  // but as message posts, never draws. The worker's own pump owns the
  // frame clock for RAF-driven kinds.
  if (!manual) {
    const onResize = () => {
      const w = Math.max(1, canvas.clientWidth)
      const h = Math.max(1, canvas.clientHeight)

      void postCall('set_size', [w, h])

      try {
        worker.postMessage({
          type: 'resize',
          id,
          w: Math.max(1, Math.round(w * window.devicePixelRatio)),
          h: Math.max(1, Math.round(h * window.devicePixelRatio)),
        })
      } catch {
        /* dead worker */
      }
    }

    window.addEventListener(WINDOW_EVENTS.RESIZE, onResize, { passive: true })
    onResize()

    const postActive = (on: boolean) => {
      try {
        worker.postMessage({ type: 'set-active', id, on: on && !document.hidden })
      } catch {
        /* dead worker */
      }
    }

    const io =
      typeof IntersectionObserver !== TYPE_STRINGS.UNDEFINED
        ? new IntersectionObserver(([entry]) => postActive(!entry || entry.isIntersecting), {
            rootMargin: QUERY_STRINGS.ROOT_MARGIN_100,
          })
        : null

    io?.observe(canvas)

    const onVisible = () => postActive(true)

    document.addEventListener(CLIPBOARD_EVENTS.VISIBILITY_CHANGE, onVisible)

    return {
      handle: {
        canvas,
        widget: proxy,
        probe,
        destroy: () => {
          io?.disconnect()
          document.removeEventListener(CLIPBOARD_EVENTS.VISIBILITY_CHANGE, onVisible)
          window.removeEventListener(WINDOW_EVENTS.RESIZE, onResize)
          destroy()
        },
      },
    }
  }

  return { handle: { canvas, widget: proxy, probe, destroy } }
}

// Lifecycle teardown — terminate the render worker on unload (the
// bfcache-safe 'pagehide' fires even where 'unload' is suppressed) and
// on vite HMR dispose, so a module re-eval never orphans the thread.
if (typeof window !== TYPE_STRINGS.UNDEFINED) {
  window.addEventListener(WINDOW_EVENTS.PAGEHIDE, destroyRenderWorker, { once: true })
}

/* istanbul ignore next -- vite HMR teardown: import.meta.hot only exists on the dev
   server; under jest the instrumented module evaluates before a test realm can
   populate __VITE_HOT__, so the arm is structurally unreachable in coverage. */
if (import.meta.hot) import.meta.hot.dispose(destroyRenderWorker)
