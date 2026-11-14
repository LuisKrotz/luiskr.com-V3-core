/**
 * @file page-backdrop-init.ts — GL bootstrap + fallback for the page
 * backdrop: opaque context creation (the field paints the whole surface,
 * so `alpha:false` lets the compositor skip blending), program build via
 * the shared gl-program helper, uniform lookup, and the CSS-lobe fallback
 * trigger which always releases any partial GL state and drops the
 * document marker so the CSS glow layers paint again.
 */

import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { WEBGL_STRINGS } from '@core/tokens/strings/webgl.js'
import { QUAD_STRIP } from '@core/tokens/motion/gpu.js'
import { glContextOptions } from '@core/utils/gpu/gpu-info.js'
import { bindQuad, createQuadProgram, getUniforms } from '../../gl-program.js'
import { watchContextLoss } from '../../gl-lifecycle.js'
import { webglContext } from '../../webgl-mode.js'
import { framePool } from '../../../motion/frame.js'
import { PAGE_BACKDROP_FS, PAGE_BACKDROP_VS } from './shaders.js'
import type { PageBackdropWebGL } from '../page-backdrop-webgl.js'

/**
 * Creates the WebGL context + lobe-field program and resolves its
 * uniforms; any failure (no canvas, context refused, shader/link error,
 * throw) routes to `_triggerFallback` so the CSS lobes stay authoritative.
 * @param host - the backdrop instance to initialise
 */
export function initGL(host: PageBackdropWebGL): void {
  try {
    if (!host.canvas) {
      host._triggerFallback()

      return
    }

    const gl = webglContext(
      host.canvas,
      glContextOptions({ alpha: false, antialias: false, preserveDrawingBuffer: false })
    ) as WebGLRenderingContext | null

    if (!gl) {
      host._triggerFallback()

      return
    }

    host.gl = gl

    const built = createQuadProgram(gl, PAGE_BACKDROP_VS, PAGE_BACKDROP_FS, 'PageBackdrop', {
      verts: new Float32Array(QUAD_STRIP.VERTS),
      warn: () => host._triggerFallback(),
    })

    // The context may exist even when the program failed — the fallback
    // path releases it so a hidden canvas never keeps a live context slot.
    if (!built) {
      host._triggerFallback()

      return
    }

    host.program = built.program

    host.quadBuffer = built.quadBuffer

    gl.useProgram(host.program)

    const aPos = gl.getAttribLocation(host.program, WEBGL_STRINGS.A_POS)

    bindQuad(gl, host.quadBuffer, aPos)

    const u = getUniforms(gl, host.program, {
      u_time: WEBGL_STRINGS.U_TIME,
      u_res: 'u_res',
      u_base: 'u_base',
      u_col: 'u_col',
      u_gain: 'u_gain',
      u_key: 'u_key',
      u_shade: 'u_shade',
    })

    host.uTime = u.u_time

    host.uRes = u.u_res

    host.uBase = u.u_base

    host.uCol = u.u_col

    host.uGain = u.u_gain

    host.uKey = u.u_key

    host.uShade = u.u_shade

    host.useWebGL = true

    // Stored so releaseQuadGL can detach it before an intentional
    // loseContext() — otherwise the async loss event re-fires the
    // fallback and preventDefault would resurrect a zombie context.
    host._onContextLost = watchContextLoss(host.canvas, () => host._triggerFallback())
  } catch {
    host._triggerFallback()
  }
}

/**
 * Switches to the CSS lobe path — used on context loss, init failure, or
 * an unparseable palette. Cancels the pending frame, releases every GL
 * resource, and clears the document marker so `--bg-glow*` paint again.
 * @param host - the backdrop instance falling back
 */
export function triggerFallback(host: PageBackdropWebGL): void {
  host.useWebGL = false

  host.isActive = false

  if (host.animId) {
    framePool.cancel(host.animId)

    host.animId = null
  }

  // Whatever GL state exists is released — a failed or lost context must
  // never keep a slot alive on the hidden canvas.
  host._releaseGL()

  document.documentElement.classList.remove(STATE_CLASSES.HAS_GL_BACKDROP)
}
