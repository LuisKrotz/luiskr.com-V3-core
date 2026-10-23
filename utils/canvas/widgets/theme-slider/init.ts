/**
 * @file theme-slider-init.ts — boot + fallback for the theme slider:
 * context/program setup via the shared gl-program helper, the
 * context-loss listener, the oversampled backing store, and the
 * ResizeObserver that re-measures track width.
 */

import { PREF_CLASSES } from '@core/tokens/classes/preferences.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { STATE_STRINGS } from '@core/tokens/strings/state.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { WEBGL_STRINGS } from '@core/tokens/strings/webgl.js'
import { glContextOptions } from '@core/utils/gpu/gpu-info.js'
import { createQuadProgram, getUniforms, getWebGLContext } from '../../gl-program.js'
import { releaseQuadGL, watchContextLoss } from '../../gl-lifecycle.js'
import { webglPool } from '../../webgl-pool.js'
import { THEME_SLIDER_FS, THEME_SLIDER_VS } from './shaders.js'
import { GPU_WIDGET_DRIVE, GPU_WIDGET_KINDS } from '@core/tokens/motion/gpu-widgets.js'
import { hasWebGpu, mountWebGpuWidget } from '../../../gpu/webgpu-widget.js'
import { framePool } from '../../../motion/frame.js'
import type { ThemeSliderWebGL } from '../theme-slider.js'
import { devWarn } from '@core/devlog.js'

/**
 * Backing-store oversampling: max(devicePixelRatio, 2) × 2 — deliberately
 * ≥4× CSS px because the shader's smoothstep AA bands are ~0.02
 * normalized units wide and need sub-pixel coverage to look glassy
 * rather than stair-stepped on the tiny 64px track.
 */
function backingDpr(): number {
  return (
    Math.max((typeof window !== TYPE_STRINGS.UNDEFINED ? window.devicePixelRatio : 1) || 1, 2) * 2
  )
}

/** Applies the oversampled backing-store size for the current track width. */
function applyBackingStore(host: ThemeSliderWebGL): void {
  const dpr = backingDpr()

  host.canvas.width = Math.round(host.width * dpr)

  host.canvas.height = Math.round(host.height * dpr)

  if (host._wasm) {
    // The wasm widget tracks the same pair: `res` = CSS px, `rect` =
    // canvas bitmap px — both follow the backing store.
    host._wasm.widget.set_size(host.width, host.height)

    host._wasm.widget.resize(host.canvas.width, host.canvas.height)
  }
}

/** Observes track width changes; re-sizes the backing store and re-maps the knob. */
function observeResize(host: ThemeSliderWebGL): void {
  if (typeof ResizeObserver === TYPE_STRINGS.UNDEFINED) return

  host._resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const w = entry.contentRect.width

      if (w > 50 && Math.abs(w - host.width) > 2) {
        host.width = w

        applyBackingStore(host)

        host.knobX = host._pToKnobX(host.currentP)
      }
    }
  })

  host._resizeObserver.observe(host.canvas)
}

/** Boot sequence: GL init → event binding → render start; fully degrades to the fallback path. */
export function init(host: ThemeSliderWebGL): void {
  if (!host.canvas || typeof host.canvas.getContext !== TYPE_STRINGS.FUNCTION) {
    host._triggerFallback()

    return
  }

  // Register before probing so an initial fallback remains eligible for the
  // centralized next-action recovery pass.
  webglPool.register(host.canvas, host)

  const rect = host.canvas.getBoundingClientRect?.()

  if (rect && rect.width > 50) {
    host.width = rect.width
  }

  applyBackingStore(host)

  // WebGPU available → try the wasm artifact first. The canvas must
  // not get a webgl context while the mount is in flight (canvas
  // contexts are mutually exclusive), so the rest of init is deferred
  // into the mount result.
  if (hasWebGpu() && !host._wasmFailed) {
    tryWasm(host)

    return
  }

  initRest(host)
}

/**
 * Attempts the WebGPU wasm theme slider (~52KB artifact, own
 * GPUDevice). MANUAL drive: this class keeps its own spring loop and
 * pointer events, so the bridge only initializes the surface. On any
 * failure initRest() runs the exact previous path (WebGL → CSS).
 * @param host The slider whose canvas the wasm widget should claim.
 */
export function tryWasm(host: ThemeSliderWebGL): void {
  if (host._wasmPending || host._wasm) return

  host._wasmPending = true

  const canvas = host.canvas

  void mountWebGpuWidget(GPU_WIDGET_KINDS.THEME_SLIDER, canvas, undefined, {
    drive: GPU_WIDGET_DRIVE.MANUAL,
  }).then((handle) => {
    host._wasmPending = false

    if (!handle || host.canvas !== canvas) {
      host._wasmFailed = true

      if (host.canvas === canvas) initRest(host)

      return
    }

    if (host._purged) {
      handle.destroy()

      return
    }

    host._wasm = handle

    host.useWebGL = true

    // `res` = CSS px (the shader's aspect-corrected scene domain),
    // `rect` = canvas bitmap px (the frag→uv divisor — oversampled).
    host._wasm.widget.set_size(host.width, host.height)

    host._wasm.widget.resize(host.canvas.width, host.canvas.height)

    observeResize(host)

    host.bindEvents()

    host.animate()
  })
}

/**
 * The classic boot tail — context-loss watch → WebGL attempt →
 * events + loop. Runs directly on no-WebGPU browsers and after a
 * wasm mount failure.
 * @param host The slider to bring up on the classic path.
 */
export function initRest(host: ThemeSliderWebGL): void {
  // No preventDefault: preventing loss asks the browser to restore the
  // context, which would resurrect the one deliberately lost in purge().
  host._onContextLost = watchContextLoss(host.canvas, () => host._triggerFallback())

  initWebGL(host)

  if (!host.useWebGL) {
    host._triggerFallback()

    return
  }

  observeResize(host)

  host.bindEvents()

  host.animate()
}

/** Switches to the non-WebGL path (CSS class on the host / Canvas2D) — used on context loss or init failure; releases any live GL first. */
export function triggerFallback(host: ThemeSliderWebGL): void {
  host.useWebGL = false

  if (host.animId) framePool.cancel(host.animId)

  releaseQuadGL(host.canvas, host, host._onContextLost)

  host._onContextLost = null

  host.canvas.style.display = STATE_STRINGS.NONE

  host.canvas.classList.add(STATE_CLASSES.IS_FALLBACK)

  const wrapper = host.canvas.closest(`.${PREF_CLASSES.PREF_THEME_WRAPPER}`)

  if (wrapper) wrapper.classList.add(STATE_CLASSES.HAS_FALLBACK)
}

/** Creates the WebGL context, compiles the shader program and sets up uniforms/buffers; falls back on any failure. */
export function initWebGL(host: ThemeSliderWebGL): void {
  try {
    const attrs = glContextOptions({ alpha: true, antialias: true })

    const gl = getWebGLContext(host.canvas, attrs)

    if (!gl) return

    const built = createQuadProgram(gl, THEME_SLIDER_VS, THEME_SLIDER_FS, 'ThemeSlider')

    if (!built) return

    host.gl = gl

    host.program = built.program

    host.quadBuffer = built.quadBuffer

    const u = getUniforms(gl, built.program, {
      u_resolution: 'u_resolution',
      u_time: 'u_time',
      u_progress: 'u_progress',
      u_knob_x: 'u_knob_x',
      u_ripple_time: 'u_ripple_time',
      u_ripple_pos: 'u_ripple_pos',
    })

    host.uResolution = u.u_resolution

    host.uTime = u.u_time

    host.uProgress = u.u_progress

    host.uKnobX = u.u_knob_x

    host.uRippleTime = u.u_ripple_time

    host.uRipplePos = u.u_ripple_pos

    host.aPos = gl.getAttribLocation(built.program, WEBGL_STRINGS.A_POS)

    host.useWebGL = true
  } catch (e) {
    devWarn('ThemeSlider WebGL fallback:', e)

    host.useWebGL = false
  }
}
