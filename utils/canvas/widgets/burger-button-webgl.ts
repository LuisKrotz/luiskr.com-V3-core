/**
 * @file burger-button-webgl.js
 * @description WebGL menu icon for the nav burger button: four rounded
 * squares that drift with a liquid idle, pool toward the center on
 * hover/focus, and morph into the close X when the menu opens —
 * theme-aware ink color, and a CSS fallback button when WebGL is
 * unavailable or lost.
 */

import { MEDIA_QUERIES } from '@core/tokens/primitives.js'
import { NAV_CLASSES } from '@core/tokens/classes/nav.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import {
  FOCUS_EVENTS,
  KEYBOARD_EVENTS,
  MOUSE_EVENTS,
  POINTER_EVENTS,
  WINDOW_EVENTS,
} from '@core/tokens/events/dom.js'
import { KEYS } from '@core/tokens/primitives.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { INPUT_STRINGS } from '@core/tokens/strings/input.js'
import { STATE_STRINGS } from '@core/tokens/strings/state.js'
import { WEBGL_STRINGS } from '@core/tokens/strings/webgl.js'
import { QUAD_STRIP } from '@core/tokens/motion/gpu.js'
import { bindQuad, createQuadProgram, getUniforms } from '../gl-program.js'
import { releaseQuadGL, watchContextLoss } from '../gl-lifecycle.js'
import { webglPool } from '../webgl-pool.js'
import { framePool } from '../../motion/frame.js'
import { BURGER_VS, burgerFsSource } from './burger-button/shaders.js'
import { glContextOptions } from '@core/utils/gpu/gpu-info.js'
import { webglContext } from '../webgl-mode.js'

/**
 * Backing-store supersample factor on top of the capped DPR — a 34px
 * icon renders at ~136–272 buffer px so the CSS downsample adds a
 * second AA pass. The shader divides by it to recover the "close px"
 * basis the shared close-paint library is authored in.
 */
const SUPERSAMPLE = 4

/**
 * Liquid pour speed, per second — matches CloseButtonWebGL's 1.6%/frame
 * at 60fps so the open-state water fill pours at the same rate every
 * close button does (~1s to fill on hover, same on drain).
 */
const LIQUID_RATE_PER_S = 1.0

/**
 * X-spin speed, per second — matches CloseButtonWebGL's 4%/frame at
 * 60fps so the half-turn lands near the end of the pour.
 */
const ROT_RATE_PER_S = 2.4

/** Timestamp that disables the click shockwave (far past sentinel). */
const CLICK_TIME_OFF = -10

/**
 * WebGL liquid menu icon for the burger button.
 * Renders four rounded squares that drift with a liquid idle, pool toward
 * the center on hover/focus, and morph into the close X when the menu
 * opens (setOpen). Adapts to the current theme: dark icon in light mode,
 * bright icon in dark mode.
 */
export class BurgerButtonWebGL {
  /**
   * @param {HTMLCanvasElement} canvas - icon canvas inside the nav burger button
   * @param {Function} onClick - optional click handler (the canvas becomes
   *   interactive — cursor:pointer + click listener); pass null when the
   *   parent button already handles clicks
   */
  canvas: HTMLCanvasElement
  gl: WebGLRenderingContext | null = null
  program: WebGLProgram | null = null
  quadBuffer: WebGLBuffer | null = null
  animId: number | null = null
  /** Bound per-frame tick — allocated once so the pooled re-arm never allocs. */
  _frameTick = (): void => this._loop()
  startTime = performance.now()
  uTime: WebGLUniformLocation | null = null
  uResolution: WebGLUniformLocation | null = null
  uDark: WebGLUniformLocation | null = null
  uHover: WebGLUniformLocation | null = null
  uOpen: WebGLUniformLocation | null = null
  uLiquid: WebGLUniformLocation | null = null
  uRot: WebGLUniformLocation | null = null
  uClickTime: WebGLUniformLocation | null = null
  uSS: WebGLUniformLocation | null = null
  /** Smoothed hover convergence — pointer enter/leave + focus/blur drive the target. */
  _hover = 0
  _hoverTarget = 0
  /** Smoothed menu-open morph — setOpen drives the target. */
  _open = 0
  _openTarget = 0
  /**
   * Close-state liquid pour (u_liquid) — the turquoise water fill every
   * close button shows on hover. Target follows hover ONLY while the
   * menu is open, so the fill never pre-charges behind the closed icon.
   */
  _liquid = 0
  /**
   * Close-state X rotation (u_rot) — the half-turn the real close
   * button's X performs while its liquid fills on hover.
   */
  _rot = 0
  /** Seconds since startTime of the last press — drives the click shockwave. */
  _clickT = CLICK_TIME_OFF
  /** Previous frame's t — the approach easings consume dt, not absolutes. */
  _prevT = 0
  _onClick: EventListener | null
  _onKeyDown: ((e: Event) => void) | null = null
  _onHoverIn: EventListener
  _onHoverOut: EventListener
  _onContextLost: EventListener | null = null
  _onResize: () => void
  _purged = false
  _hasDeriv = false
  useWebGL = false

  constructor(canvas: HTMLCanvasElement, onClick?: EventListener | null) {
    this.canvas = canvas

    this._onClick = onClick || null

    this._initGL()

    if (onClick) {
      canvas.style.cursor = INPUT_STRINGS.POINTER

      // Record the press timestamp before delegating — the shader reads
      // u_click_time to expand the shockwave ring over its 0.4s window,
      // matching the real close button's triggerClick() semantics.
      this._onClick = (e: Event) => {
        this._clickT = (performance.now() - this.startTime) / 1000

        onClick(e)
      }

      canvas.addEventListener(MOUSE_EVENTS.CLICK, this._onClick)

      // The canvas is the focusable control when WebGL renders (the CSS
      // fallback <button> is display:none) — Enter/Space must activate it.
      this._onKeyDown = (e: Event) => {
        const key = (e as KeyboardEvent).key

        if (key === KEYS.ENTER || key === KEYS.SPACE) {
          e.preventDefault()

          this._onClick?.(e)
        }
      }

      canvas.addEventListener(KEYBOARD_EVENTS.KEYDOWN, this._onKeyDown)
    }

    // Hover convergence — pointer and keyboard focus both count, so the
    // squares pool for a hovered mouse the same way they do for a
    // tab-focused control.
    this._onHoverIn = () => this._setHover(1)

    this._onHoverOut = () => this._setHover(0)

    canvas.addEventListener(POINTER_EVENTS.POINTERENTER, this._onHoverIn, { passive: true })

    canvas.addEventListener(POINTER_EVENTS.POINTERLEAVE, this._onHoverOut, { passive: true })

    canvas.addEventListener(FOCUS_EVENTS.FOCUS, this._onHoverIn)

    canvas.addEventListener(FOCUS_EVENTS.BLUR, this._onHoverOut)

    // A lost context (GPU reset, driver crash) is recoverable UX-wise —
    // the CSS icon takes over. No preventDefault: a prevented loss asks
    // the browser to restore the context, and our deliberate
    // loseContext() in destroy() would resurrect a zombie.
    this._onContextLost = watchContextLoss(this.canvas, () => this._triggerFallback())

    this._onResize = () => this._checkResize()

    window.addEventListener(WINDOW_EVENTS.RESIZE, this._onResize, { passive: true })

    // Offscreen burger canvases release their GL entirely; restore()
    // recreates the context when the canvas comes back into view.
    webglPool.register(this.canvas, this)

    this._start()
  }

  /** Creates the WebGL context + shader program; falls back to the CSS/DOM path on failure. */

  _initGL() {
    if (!this.canvas) {
      this._triggerFallback()
      return
    }

    this._initGLReal()
  }

  /** The synchronous WebGL bootstrap — context, program, quad, uniform handles. */

  _initGLReal() {
    // Re-init after a purge/restore: clear the fallback marks a previous
    // failure left on this (persistent, reused) canvas element.
    this.canvas.style.display = CHAR_STRINGS.EMPTY

    this.canvas.classList.remove(STATE_CLASSES.IS_FALLBACK)

    const gl = webglContext(
      this.canvas,
      glContextOptions({ alpha: true, antialias: true, preserveDrawingBuffer: false })
    ) as WebGLRenderingContext | null

    if (!gl) {
      this._triggerFallback()
      return
    }

    this.gl = gl
    this.useWebGL = true

    // fwidth() needs OES_standard_derivatives in WebGL1 — it gives the bars
    // pixel-constant analytic AA on top of the supersampled buffer.
    this._hasDeriv = !!gl.getExtension(WEBGL_STRINGS.OES_STANDARD_DERIVATIVES)

    const built = createQuadProgram(gl, BURGER_VS, burgerFsSource(this._hasDeriv), 'BurgerButton', {
      verts: new Float32Array(QUAD_STRIP.VERTS),
      premultiplied: false,
    })

    if (!built) {
      this._triggerFallback()

      return
    }

    this.program = built.program

    this.quadBuffer = built.quadBuffer

    gl.useProgram(this.program)

    const aPos = gl.getAttribLocation(this.program, WEBGL_STRINGS.A_POS)

    bindQuad(gl, this.quadBuffer, aPos)

    const u = getUniforms(gl, this.program, {
      u_time: 'u_time',
      u_res: 'u_res',
      u_dark: 'u_dark',
      u_hover: 'u_hover',
      u_open: 'u_open',
      u_liquid: 'u_liquid',
      u_rot: 'u_rot',
      u_click_time: 'u_click_time',
      u_ss: 'u_ss',
    })

    this.uTime = u.u_time

    this.uResolution = u.u_res

    this.uDark = u.u_dark

    this.uHover = u.u_hover

    this.uOpen = u.u_open

    this.uLiquid = u.u_liquid

    this.uRot = u.u_rot

    this.uClickTime = u.u_click_time

    this.uSS = u.u_ss
  }

  /** Switches to the non-WebGL path (CSS class on the host / Canvas2D) — used on context loss or init failure. */

  _triggerFallback() {
    this.useWebGL = false

    if (this.animId) {
      framePool.cancel(this.animId)

      this.animId = null
    }

    releaseQuadGL(this.canvas, this, this._onContextLost)

    this._onContextLost = null

    if (this.canvas) {
      this.canvas.style.display = STATE_STRINGS.NONE

      this.canvas.classList.add(STATE_CLASSES.IS_FALLBACK)
    }
  }

  /**
   * Re-syncs the drawing buffer to the canvas's CSS box × devicePixelRatio
   * (capped at 2). Only reallocates when the rounded size actually changed,
   * and repaints one frame immediately when the RAF loop isn't running —
   * in reduced-motion static mode a resize would otherwise leave the
   * cleared buffer blank until the next state change.
   */
  _checkResize() {
    if (!this.canvas || !this.gl) return

    // Supersample ×4 past DPR: a 34px icon renders at ~136–272px and the
    // CSS downsample smooths the hairline edges on top of the shader's
    // analytic AA — a tiny canvas makes this essentially free.
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * SUPERSAMPLE

    const rect = this.canvas.getBoundingClientRect()

    const w = Math.round((rect.width || 34) * dpr)

    const h = Math.round((rect.height || 34) * dpr)

    if (w > 0 && h > 0 && (this.canvas.width !== w || this.canvas.height !== h)) {
      this.canvas.width = w

      this.canvas.height = h

      this.gl?.viewport(0, 0, w, h)

      // Static mode (reduced motion) has no loop to repaint the cleared buffer
      if (this.animId === null) {
        this._drawFrame(0)
      }
    }
  }

  /**
   * Menu-open driver — the nav calls this on toggle/close so the pooled
   * droplet morphs into the close X (and back). With no running loop
   * (reduced motion, pre-start) the state snaps and repaints once.
   * @param open Whether the menu overlay is open.
   */
  setOpen(open: boolean): void {
    this._openTarget = open ? 1 : 0

    if (this.animId === null) this._settleNow()
  }

  /** Hover-convergence driver — pointer enter/leave and focus/blur feed it. */

  _setHover(hovered: number): void {
    this._hoverTarget = hovered

    if (this.animId === null) this._settleNow()
  }

  /** Snaps the smoothed state to its targets and repaints — the static path. */

  _settleNow(): void {
    this._hover = this._hoverTarget

    this._open = this._openTarget

    this._liquid = this._hoverTarget * this._openTarget

    this._rot = this._liquid * Math.PI

    if (this.useWebGL) {
      this._drawFrame(this._prevT || (performance.now() - this.startTime) / 1000)
    }
  }

  /** Chooses reduced-motion static render vs the rAF loop. */

  _start() {
    if (!this.useWebGL) return

    this._checkResize()

    // Layout may not be settled on the very first frame (fonts, shadow DOM
    // adoption); re-measure once more before the loop settles.
    framePool.request(() => this._checkResize())

    const reduced =
      document.documentElement.classList.contains(STATE_CLASSES.REDUCED_MOTION) ||
      (window.matchMedia && window.matchMedia(MEDIA_QUERIES.PREFERS_REDUCED_MOTION).matches)

    if (reduced) {
      this._drawFrame(0)

      return
    }

    this._loop()
  }

  /**
   * Renders one frame at time t (seconds) — shared by the RAF loop and the
   * static reduced-motion path. u_dark is re-evaluated per frame from the
   * live DOM classes (dark theme OR nav-on-dark over the contact band) so
   * the icon recolors instantly on theme/scroll changes with no listener.
   * @param {number} t - seconds since construction
   */
  _drawFrame(t: number): void {
    if (this.canvas.width === 0 || this.canvas.height === 0) return

    const isDark =
      document.documentElement.classList.contains(STATE_CLASSES.DARK_MODE) ||
      this.canvas.classList.contains(NAV_CLASSES.NAV_ON_DARK)
        ? 1
        : 0

    const gl = this.gl

    if (!gl) return

    // Exponential approach toward the interaction targets — frame-rate
    // independent, so the converge/morph feels identical at 60 or 240Hz.
    const dt = this._prevT ? t - this._prevT : 0

    this._prevT = t

    this._hover += (this._hoverTarget - this._hover) * (1 - Math.exp(-dt * 10))

    this._open += (this._openTarget - this._open) * (1 - Math.exp(-dt * 7))

    // Close-state pour: the liquid target follows hover only while the
    // menu is open (a hover on the closed burger must not pre-charge the
    // fill). The X's half-turn tracks the pour — same choreography the
    // standalone close button runs in its own render loop.
    const liquidTarget = this._hoverTarget * this._openTarget

    this._liquid += (liquidTarget - this._liquid) * (1 - Math.exp(-dt * LIQUID_RATE_PER_S))

    this._rot += (this._liquid * Math.PI - this._rot) * (1 - Math.exp(-dt * ROT_RATE_PER_S))

    gl.clearColor(0, 0, 0, 0)

    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(this.program)

    gl.uniform1f(this.uTime, t)

    gl.uniform2f(this.uResolution, this.canvas.width, this.canvas.height)

    gl.uniform1f(this.uDark, isDark)

    gl.uniform1f(this.uHover, this._hover)

    gl.uniform1f(this.uOpen, this._open)

    gl.uniform1f(this.uLiquid, this._liquid)

    gl.uniform1f(this.uRot, this._rot)

    gl.uniform1f(this.uClickTime, this._clickT)

    gl.uniform1f(this.uSS, SUPERSAMPLE)

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, QUAD_STRIP.VERTEX_COUNT)
  }

  /** rAF callback — repaints each frame while running. */

  _loop() {
    if (!this.gl || !this.useWebGL) return

    this.animId = framePool.request(this._frameTick)

    this._drawFrame((performance.now() - this.startTime) / 1000)
  }

  /**
   * webglPool hook — offscreen: stops the loop and releases the GL
   * context entirely; restore() rebuilds it on re-entry so offscreen
   * widgets never hold context slots.
   */
  purge() {
    if (this._purged) return

    this._purged = true

    if (this.animId) {
      framePool.cancel(this.animId)

      this.animId = null
    }

    releaseQuadGL(this.canvas, this, this._onContextLost)

    this._onContextLost = null
  }

  /** Recreates the GL context and resumes the loop after an offscreen purge. */
  restore() {
    if (!this._purged) return

    // Keep _purged while detached — the pool retries restore() on the
    // next intersection, and only then is the context rebuilt.
    if (!this.canvas?.isConnected) return

    this._purged = false

    this._initGL()

    if (this.useWebGL) {
      this._onContextLost = watchContextLoss(this.canvas, () => this._triggerFallback())

      this._start()
    }
  }

  /** Releases the context, buffers, listeners and rAF handle so the canvas can be GC'd. */

  destroy() {
    webglPool.unregister(this.canvas)

    if (this.animId) {
      framePool.cancel(this.animId)

      this.animId = null
    }

    if (this._onClick && this.canvas) {
      this.canvas.removeEventListener(MOUSE_EVENTS.CLICK, this._onClick)
    }

    if (this._onKeyDown && this.canvas) {
      this.canvas.removeEventListener(KEYBOARD_EVENTS.KEYDOWN, this._onKeyDown)

      this._onKeyDown = null
    }

    window.removeEventListener(WINDOW_EVENTS.RESIZE, this._onResize)

    if (this.canvas) {
      this.canvas.removeEventListener(POINTER_EVENTS.POINTERENTER, this._onHoverIn)

      this.canvas.removeEventListener(POINTER_EVENTS.POINTERLEAVE, this._onHoverOut)

      this.canvas.removeEventListener(FOCUS_EVENTS.FOCUS, this._onHoverIn)

      this.canvas.removeEventListener(FOCUS_EVENTS.BLUR, this._onHoverOut)
    }

    releaseQuadGL(this.canvas, this, this._onContextLost)

    this._onContextLost = null
  }
}
