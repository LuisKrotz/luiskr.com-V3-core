/**
 * @file close-button-render.ts — render loop for the close button:
 * three eased channels (liquid fill 1.6%/frame, X-spin 4%/frame to a
 * half-turn, one-time stroke draw-in 2%/frame) plus the static
 * single-frame path used under reduced motion.
 */

import store from '@core/store.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { bindQuad } from '../../gl-program.js'
import { framePool } from '../../../motion/frame.js'
import type { CloseButtonWebGL } from '../close-button.js'

/** Liquid fill rate — deliberately slowest so the wash pours. */
const LIQUID_RATE = 0.016

/** X-spin rate — faster so the half-turn lands near the end of the pour. */
const ROT_RATE = 0.04

/** One-time stroke draw-in rate (~50 frames ≈ 830ms on mount). */
const DRAW_RATE = 0.02

/**
 * Sleep threshold for the liquid channel — mirrors the shader's own
 * `u_liquid > 0.01` gate: below it the liquid region (and every
 * u_time-driven wave/bubble inside it) is already invisible, so the
 * loop may stop without changing a single pixel.
 */
const LIQUID_FLOOR = 0.01

/** Click shockwave window in seconds — matches the shader's `clickElapsed < 0.4` gate. */
const CLICK_WAVE_S = 0.4

/**
 * Draws one settled frame with the X fully drawn — used under reduced
 * motion or when the loop is stopped so the button stays visible and
 * hover-state still applies (without animating).
 */
export function renderStatic(host: CloseButtonWebGL): void {
  host.drawProgress = 1.0

  host.hoverLevel = host.isHovered ? 1.0 : 0.0

  host.rotation = host.hoverLevel * Math.PI

  const now = performance.now()

  // `gl || _wasm` — the wasm backend claims useWebGL without a GL context.
  if (host.useWebGL && (host.gl || host._wasm)) {
    renderWebGL(host, now)
  }
}

/** Starts the shared-pool render loop (skipped under reduced motion). */
export function animate(host: CloseButtonWebGL): void {
  // The tick consumed its own pool id before running — clearing it here
  // both keeps `animId` honest and lets a wake call re-arm the loop if
  // this frame ever throws before the re-arm at the bottom.
  host.animId = null

  if (!host.useWebGL) return

  if (store.getters.getReducedMotion()) {
    renderStatic(host)

    return
  }

  const now = performance.now()

  // Liquid fill: 1.6%/frame — deliberately the slowest channel so the
  // turquoise wash feels like it's pouring rather than toggling
  // (~1s to fill on hover-in, same on drain).
  const targetHover = host.isHovered ? 1.0 : 0.0

  host.hoverLevel += (targetHover - host.hoverLevel) * LIQUID_RATE

  // X spin follows the fill at a faster 4%/frame so the rotation
  // *finishes* near the end of the pour rather than tracking it 1:1 —
  // target is a half-turn (π) at full hover.
  const targetRot = host.hoverLevel * Math.PI

  host.rotation += (targetRot - host.rotation) * ROT_RATE

  // One-time stroke draw-in: +2%/frame → the X draws itself over the
  // first ~50 frames (~830ms) after mount, then stays at 1.
  if (host.drawProgress < 1.0) {
    host.drawProgress = Math.min(1.0, host.drawProgress + DRAW_RATE)
  }

  // Settle-sleep — with the X fully drawn, no hover and the shockwave
  // expired, the shader output is time-invariant (u_time only feeds the
  // liquid interior and the click ring, both gated off at this state).
  // Snap the asymptotic eases to their exact rest values so the frame
  // painted below is the terminal one: hover/click/restore re-arm
  // through setHover/triggerClick/restore.
  const settled =
    !host.isHovered &&
    host.hoverLevel < LIQUID_FLOOR &&
    host.drawProgress >= 1.0 &&
    (now - host.startTime) * 0.001 - host.clickTime >= CLICK_WAVE_S

  if (settled) {
    host.hoverLevel = 0

    host.rotation = 0
  }

  if (host.useWebGL && (host.gl || host._wasm)) {
    renderWebGL(host, now)
  }

  if (settled) return

  host.animId = framePool.request(host._frameTick)
}

/** Per-frame wasm render: pushes the three eased channels + one frame tick. */
export function renderWasm(host: CloseButtonWebGL, now: number): void {
  if (!host._wasm) return

  const w = host._wasm.widget as {
    set_state?: (liquid: number, draw: number, rot: number) => void
  }

  w.set_state?.(host.hoverLevel, host.drawProgress, host.rotation)

  const t = (now - host.startTime) * 0.001

  // dt = time since the last painted frame — the crate accumulates.
  const dt = host._wasmT ? t - host._wasmT : t

  host._wasmT = t

  host._wasm.widget.frame(dt)
}

/** Per-frame WebGL render: updates time/hover uniforms and draws the quad. */
export function renderWebGL(host: CloseButtonWebGL, now: number): void {
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

  gl.uniform2f(host.uResolution, host.canvas.width, host.canvas.height)

  gl.uniform1f(host.uTime, (now - host.startTime) * 0.001)

  gl.uniform1f(host.uLiquid, host.hoverLevel)

  gl.uniform1f(host.uDraw, host.drawProgress)

  gl.uniform1f(host.uRot, host.rotation)

  gl.uniform1f(host.uClickTime, host.clickTime)

  // HC channels — re-read per frame like the burger's u_dark so a live
  // toggle repaints instantly. u_dark is the DISC pole under HC: the chip
  // disc (--border-color) goes pitch black in light-HC (u_dark=1 → dark
  // disc + white ink) and pure white in dark-HC (u_dark=0 → inverse).
  const hc = document.documentElement.classList.contains(STATE_CLASSES.HIGH_CONTRAST)
  const dark = document.documentElement.classList.contains(STATE_CLASSES.DARK_MODE)

  gl.uniform1f(host.uHc, hc ? 1 : 0)

  gl.uniform1f(host.uDark, hc && !dark ? 1 : 0)

  gl.drawArrays(gl.TRIANGLES, 0, 6)
}
