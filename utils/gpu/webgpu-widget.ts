/**
 * @file utils/gpu/webgpu-widget.ts
 * @description Per-widget WebGPU/Rust bridge — the loader for the
 * one-artifact-per-animation architecture (`rust/` workspace). Each
 * animation is its own ~50KB wasm module with its own GPUDevice on the
 * widget's dedicated canvas — no shared monolith, so every surface pays
 * only for the animation it actually mounts. Capability-gated: no
 * `navigator.gpu`, a missing artifact, or an init failure all return
 * null and the existing WebGL/CSS widget keeps rendering — mounting can
 * never regress the site. The bridge owns the rAF clock (single-clock
 * frame-budget rule) and pauses while the tab is hidden.
 */
import { GPU_WIDGET_ARTIFACTS, GPU_WIDGET_DRIVE } from '@core/tokens/motion/gpu-widgets.js'
import { WINDOW_EVENTS, CLIPBOARD_EVENTS } from '@core/tokens/events/dom.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { devWarn } from '@core/devlog.js'

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
  /** Async wgpu init on the widget's dedicated canvas. */
  init(canvas: HTMLCanvasElement): Promise<unknown>
  /** Surface re-configure after a bitmap resize (device px). */
  resize(w: number, h: number): void
  /** Canvas CSS size — feeds the shader's res/rect uniforms. */
  set_size(w: number, h: number): void
  /** One rAF tick; `dt` in seconds. */
  frame(dt: number): void
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
}

/**
 * Capability gate — `navigator.gpu` is the WebGPU entry point.
 * Separate from mount so callers can decide without touching the DOM.
 */
export function hasWebGpu(): boolean {
  return typeof navigator !== TYPE_STRINGS.UNDEFINED && 'gpu' in navigator
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
  if (!hasWebGpu()) return

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

  if (!spec || !hasWebGpu() || typeof document === TYPE_STRINGS.UNDEFINED) {
    return null
  }

  let mod: WidgetModule

  try {
    mod = await loadModule(spec.url)
  } catch {
    devWarn('webgpu-widget: artifact unavailable — WebGL fallback')
    return null
  }

  try {
    await mod.default()

    const WidgetClass = mod[spec.cls] as new () => WasmWidget
    const widget = new WidgetClass()

    await widget.init(canvas)

    return wire(widget, canvas, options.drive === GPU_WIDGET_DRIVE.MANUAL)
  } catch {
    devWarn('webgpu-widget: init failed — WebGL fallback')
    return null
  }
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
    return { canvas, widget, destroy: () => undefined }
  }

  const onResize = () => {
    const w = Math.max(1, canvas.clientWidth)
    const h = Math.max(1, canvas.clientHeight)

    if (typeof widget.set_size === 'function') {
      widget.set_size(w, h)
    }

    widget.resize(
      Math.max(1, Math.round(w * window.devicePixelRatio)),
      Math.max(1, Math.round(h * window.devicePixelRatio))
    )
  }

  window.addEventListener(WINDOW_EVENTS.RESIZE, onResize, { passive: true })
  onResize()

  // rAF is owned here — one clock per widget, paused while hidden.
  let rafId = 0
  let last = performance.now()

  const tick = (now: number) => {
    widget.frame((now - last) / 1000)
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

  return {
    canvas,
    widget,
    destroy: () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = 0

      document.removeEventListener(CLIPBOARD_EVENTS.VISIBILITY_CHANGE, onVisible)
      window.removeEventListener(WINDOW_EVENTS.RESIZE, onResize)
    },
  }
}
