/**
 * @file page-backdrop-loop.ts — render loop for the page backdrop: start
 * (palette sample + size + document marker), the pooled rAF loop, the
 * viewport-resize buffer sync, and the per-frame draw. The hot path is
 * allocation-free: dirty flags gate the palette/resolution uploads so a
 * steady frame is one `uniform1f` + one `drawArrays`.
 */

import { MEDIA_QUERIES } from '@core/tokens/primitives.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { QUAD_STRIP } from '@core/tokens/motion/gpu.js'
import { PAGE_BACKDROP } from '@core/tokens/motion/page-backdrop.js'
import { framePool } from '../../../motion/frame.js'
import type { PageBackdropWebGL } from '../page-backdrop-webgl.js'

/**
 * Begins rendering: samples the palette (an unparseable surface colour
 * falls back to CSS), sizes the buffer, stamps the document marker that
 * pins the CSS glow layers to `none`, and either starts the pooled loop
 * or — under reduced motion — draws one static dithered frame.
 * High contrast keeps the flat surface: nothing starts while it is on.
 * @param host - the backdrop instance to start
 */
export function start(host: PageBackdropWebGL): void {
  if (host.isActive || !host.useWebGL) return

  const root = document.documentElement

  if (root.classList.contains(STATE_CLASSES.HIGH_CONTRAST)) return

  if (!host._sampleTheme()) {
    host._triggerFallback()

    return
  }

  host.isActive = true

  host._lastFrame = performance.now()

  host._handleResize()

  root.classList.add(STATE_CLASSES.HAS_GL_BACKDROP)

  const reduced =
    root.classList.contains(STATE_CLASSES.REDUCED_MOTION) ||
    (window.matchMedia && window.matchMedia(MEDIA_QUERIES.PREFERS_REDUCED_MOTION).matches)

  if (reduced) {
    host._renderFrame(0)

    return
  }

  host._loop()
}

/**
 * Stops the pooled loop and clears the document marker so the CSS glow
 * layers paint again while the canvas is idle/hidden.
 * @param host - the backdrop instance to stop
 */
export function stop(host: PageBackdropWebGL): void {
  host.isActive = false

  if (host.animId) {
    framePool.cancel(host.animId)

    host.animId = null
  }

  document.documentElement.classList.remove(STATE_CLASSES.HAS_GL_BACKDROP)
}

/**
 * Syncs the backing store with the viewport. The canvas is fixed and
 * fullscreen, so the viewport IS its box — no layout read needed. DPR is
 * capped (the dither only needs device pixels, not supersampling) and
 * each axis is capped so a 4K×2 display never allocates a giant buffer.
 * @param host - the backdrop instance to resize
 */
export function handleResize(host: PageBackdropWebGL): void {
  const dpr = Math.min(window.devicePixelRatio || 1, PAGE_BACKDROP.DPR_MAX)

  host.width = Math.min(Math.round(window.innerWidth * dpr), PAGE_BACKDROP.MAX_DIM)

  host.height = Math.min(Math.round(window.innerHeight * dpr), PAGE_BACKDROP.MAX_DIM)

  host.canvas.width = host.width

  host.canvas.height = host.height

  host._resDirty = true

  if (host.gl) {
    host.gl.viewport(0, 0, host.width, host.height)
  }
}

/**
 * Pooled rAF callback — re-arms itself and draws one frame. Bails when
 * the loop was stopped, the context is gone, or the path fell back.
 * @param host - the backdrop instance ticking
 */
export function loop(host: PageBackdropWebGL): void {
  if (!host.isActive || !host.gl || !host.useWebGL) return

  host.animId = framePool.request(host._frameTick)

  host._renderFrame()
}

/**
 * Draws the lobe field. `staticTime` renders one settled pose (reduced
 * motion); otherwise the field clock advances by the clamped frame
 * delta so a backgrounded tab resumes without a jump. A theme flip
 * mid-loop resamples the palette; dirty flags gate the uploads.
 * @param host - the backdrop instance to draw
 * @param staticTime - fixed field time for a single static frame
 */
export function renderFrame(host: PageBackdropWebGL, staticTime?: number | null): void {
  const gl = host.gl

  if (!gl) return

  const now = performance.now()

  // Frame-time delta, clamped at 50ms — a backgrounded tab returns with
  // a huge dt that would snap the drift instead of continuing it.
  const dt = Math.min((now - host._lastFrame) / 1000, 0.05)

  host._lastFrame = now

  host._elapsed += dt

  const t = staticTime ?? host._elapsed

  const isDark = document.documentElement.classList.contains(STATE_CLASSES.DARK_MODE)

  if (isDark !== host._darkAtStart) {
    host._sampleTheme()
  }

  gl.useProgram(host.program)

  if (host._paletteDirty) {
    gl.uniform3fv(host.uCol, host._colors)

    gl.uniform3f(host.uBase, host._base[0], host._base[1], host._base[2])

    gl.uniform1f(host.uGain, host._gain)

    gl.uniform4fv(host.uKey, host._key)

    gl.uniform4fv(host.uShade, host._shade)

    host._paletteDirty = false
  }

  if (host._resDirty) {
    gl.uniform2f(host.uRes, host.width, host.height)

    host._resDirty = false
  }

  gl.uniform1f(host.uTime, t)

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, QUAD_STRIP.VERTEX_COUNT)
}
