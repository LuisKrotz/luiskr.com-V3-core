/**
 * @file switch-slider-render.ts — render loop for the switch slider:
 * the RAF damped-spring animation (SLIDER_SPRING chase, ~4% elastic
 * overshoot), the static single-frame path used under reduced motion,
 * and the per-frame WebGL/Canvas2D draws.
 */

import store from '@core/store.js'
import { bindQuad } from '../../gl-program.js'
import { paintSwitchSlider2D } from './paint-2d.js'
import { framePool } from '../../../motion/frame.js'
import { springStep } from '../../../motion/spring.js'
import { SLIDER_SPRING } from '@core/tokens/motion/slider.js'
import type { SwitchWebGL } from '../switch-slider.js'

/**
 * Snap state to target and draw a single settled frame — used under
 * reduced motion or when the loop is stopped, so toggles still visibly
 * update without animating.
 */
export function renderStatic(host: SwitchWebGL): void {
  host.currentP = host.targetP

  host.velP = 0

  host._animT = 0

  host.knobX = host._pToKnobX(host.currentP)

  const now = performance.now()

  // `gl || _wasm` — the wasm backend claims useWebGL without a GL context.
  if (host.useWebGL && (host.gl || host._wasm)) {
    renderWebGL(host, now)
  } else if (host.ctx) {
    renderCanvas2D(host, now)
  }
}

/** Starts the requestAnimationFrame render loop (skipped under reduced motion). */
export function animate(host: SwitchWebGL): void {
  if (store.getters.getReducedMotion()) {
    if (host.animId) {
      framePool.cancel(host.animId)

      host.animId = null
    }

    renderStatic(host)

    return
  }

  host.animId = framePool.request(host._frameTick)

  const now = performance.now()

  // Damped-spring chase — the shared integrator (utils/motion/spring.ts)
  // in the underdamped snap regime (ζ≈0.72: ~4% overshoot — the elastic
  // settle). Switches have no drag surface, so the snap constants apply
  // unconditionally. dt is wall-clock — 120/240Hz displays get identical
  // motion, and a suspended tab clamps to DT_MAX_S instead of exploding
  // the spring.
  const dt = host._animT
    ? Math.min((now - host._animT) * 0.001, SLIDER_SPRING.DT_MAX_S)
    : SLIDER_SPRING.DT_INIT_S

  host._animT = now

  springStep(host, SLIDER_SPRING.SNAP_K, SLIDER_SPRING.SNAP_C, dt)

  host.knobX = host._pToKnobX(host.currentP)

  if (host.useWebGL && (host.gl || host._wasm)) {
    renderWebGL(host, now)
  } else if (host.ctx) {
    renderCanvas2D(host, now)
  }
}

/** Per-frame wasm render: pushes spring/context state + one frame tick. */
export function renderWasm(host: SwitchWebGL, now: number): void {
  if (!host._wasm) return

  const w = host._wasm.widget as {
    set_state?: (progress: number, knobX: number, ctxCode: number) => void
  }

  w.set_state?.(host.currentP, host.knobX, host._contextCode())

  const t = (now - host.startTime) * 0.001

  // dt = time since the last painted frame — the crate accumulates.
  const dt = host._wasmT ? t - host._wasmT : t

  host._wasmT = t

  host._wasm.widget.frame(dt)
}

/** Per-frame WebGL render: updates time/knob uniforms and draws the quad. */
export function renderWebGL(host: SwitchWebGL, now: number): void {
  if (host._wasm) {
    renderWasm(host, now)

    return
  }

  const gl = host.gl

  if (!gl || !host.program || !host.quadBuffer) return

  gl.viewport(0, 0, host.canvas.width, host.canvas.height)

  gl.clearColor(0.0, 0.0, 0.0, 0.0)

  gl.clear(gl.COLOR_BUFFER_BIT)

  gl.useProgram(host.program)

  bindQuad(gl, host.quadBuffer, host.aPos)

  gl.uniform2f(host.uResolution, host.width, host.height)

  gl.uniform1f(host.uTime, (now - host.startTime) * 0.001)

  gl.uniform1f(host.uProgress, host.currentP)

  gl.uniform1f(host.uKnobX, host.knobX)

  gl.uniform1f(host.uContext, host._contextCode())

  gl.drawArrays(gl.TRIANGLES, 0, 6)
}

/** Per-frame Canvas2D fallback render — same visual language as the shader. */
export function renderCanvas2D(host: SwitchWebGL, now: number): void {
  paintSwitchSlider2D(
    host.ctx,
    {
      dpr: host.dpr,
      width: host.width,
      height: host.height,
      currentP: host.currentP,
      startTime: host.startTime,
      knobX: host.knobX,
      contextType: host.contextType,
      canvasWidth: host.canvas?.width ?? 0,
      canvasHeight: host.canvas?.height ?? 0,
    },
    now
  )
}
