/**
 * @file carousel-controls.js
 * @description WebGL control button for the awards carousel: a circular
 * progress ring (WASM-driven ring offset) around an animated arrow icon,
 * with play/pause morphing when used as the autoplay control. Hovers
 * accent the ring. Pooled via webglPool (purge/restore offscreen);
 * Canvas2D fallback mirrors the shader.
 */

import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { MOUSE_EVENTS } from '@core/tokens/events/dom.js'
import { STATE_STRINGS } from '@core/tokens/strings/state.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { WEBGL_STRINGS } from '@core/tokens/strings/webgl.js'
import { ARROW_TYPES } from '@core/tokens/theme/arrows.js'
import store from '@core/store.js'
import { paintCarouselArrow2D } from './carousel-controls/paint-2d.js'
import { webglPool } from '../webgl-pool.js'
import { framePool } from '../../motion/frame.js'
import { webglAllowed } from '../webgl-mode.js'

/**
 * Sleep threshold for the hover channel — below the paint gate's own
 * `hoverAlpha > 0.01` cutoff (alpha = level × 1.2), so a sleeping loop
 * is pixel-identical to a running one.
 */
const HOVER_FLOOR = 0.008

/** Click shockwave window in seconds — matches the painter's `clickElapsed < 0.45` gate. */
const CLICK_WAVE_S = 0.45

/**
 * WebGL Carousel Arrow Controls with Circular Loading Progress & Gestural Microinteractions
 * - Prev button: Swipe-left gesture (tablet card outline + hand pointing left + arrow) with expanding kinetic ripples
 * - Next button: Swipe-right gesture (tablet card outline + hand pointing right + forward kinetic arrow burst)
 * - Circular WebGL loading ring with glowing leading particle head synchronized to autoplay timer
 * - Normalized coordinate space [-1.0 .. 1.0] scaling to all screen sizes without clipping
 * - Full Canvas 2D fallback
 */
export class CarouselArrowWebGL {
  canvas: HTMLCanvasElement
  type: string
  onAction: (() => void) | null
  width = 44
  height = 44
  dpr = 2
  progress = 0
  isHovered = false
  hoverLevel = 0.0
  isPlaying = true
  clickTime = -10.0
  animId: number | null = null
  /** Bound per-frame tick — allocated once so the pooled re-arm never allocs. */
  _frameTick = (): void => this.animate()
  startTime = performance.now()
  ctx: CanvasRenderingContext2D | null | undefined
  gl: WebGLRenderingContext | null = null
  program: WebGLProgram | null = null
  quadBuffer: WebGLBuffer | null = null
  _paused = false
  boundTarget: HTMLElement | undefined
  onMouseEnter: EventListener | undefined
  onMouseLeave: EventListener | undefined
  onClick: EventListener | undefined

  constructor(
    canvas: HTMLCanvasElement,
    type: string = ARROW_TYPES.NEXT,
    onAction: (() => void) | null = null
  ) {
    this.canvas = canvas

    this.type = type

    this.onAction = onAction

    this.init()
  }

  /** Boot sequence: GL init → event binding → render start; fully degrades to the fallback path. */

  init() {
    if (
      !this.canvas ||
      typeof this.canvas.getContext !== TYPE_STRINGS.FUNCTION ||
      !webglAllowed()
    ) {
      this._triggerFallback()

      return
    }

    const dpr = Math.min(
      (typeof window !== TYPE_STRINGS.UNDEFINED ? window.devicePixelRatio : 1) || 1,
      2
    )

    const rect = this.canvas.getBoundingClientRect?.()

    const size = rect && rect.width > 0 ? rect.width : 44

    this.width = size

    this.height = size

    this.dpr = dpr

    this.canvas.width = Math.round(this.width * dpr)

    this.canvas.height = Math.round(this.height * dpr)

    this.canvas.style.width = `${this.width}px`

    this.canvas.style.height = `${this.height}px`

    try {
      this.ctx = this.canvas.getContext(WEBGL_STRINGS.CONTEXT_2D)
    } catch {
      this._triggerFallback()

      return
    }

    if (!this.ctx) {
      this._triggerFallback()

      return
    }

    this.bindEvents()

    // Off-screen arrows stop their loop and draw a single frame when they return
    webglPool.register(this.canvas, this)

    this.animate()
  }

  /** webglPool hook — viewport left: pauses the loop; GL stays warm (the pool owns context lifecycle). */
  purge() {
    this._paused = true

    if (this.animId) {
      framePool.cancel(this.animId)

      this.animId = null
    }
  }

  /** webglPool hook — back in view: resumes the render loop; counterpart of purge(). */
  restore() {
    this._paused = false

    if (!this.animId && this.ctx) this.animate()
  }

  /** Switches to the non-WebGL path (CSS class on the host / Canvas2D) — used on context loss or init failure. */

  _triggerFallback() {
    if (this.animId) framePool.cancel(this.animId)

    this.canvas.style.display = STATE_STRINGS.NONE

    this.canvas.classList.add(STATE_CLASSES.IS_FALLBACK)
  }

  /** Creates the WebGL context, compiles the shader program and sets up uniforms/buffers; falls back on any failure. */

  /** Wires pointer/hover listeners that drive the widget's interactive state. */

  bindEvents() {
    this.onMouseEnter = () => {
      this.setHover(true)
    }

    this.onMouseLeave = () => {
      this.setHover(false)
    }

    this.onClick = () => {
      this.triggerClick()

      if (this.canvas === this.boundTarget) {
        this.onAction?.()
      }
    }

    const target: HTMLElement = this.canvas.parentElement || this.canvas

    this.boundTarget = target

    target.addEventListener(MOUSE_EVENTS.MOUSEENTER, this.onMouseEnter)

    target.addEventListener(MOUSE_EVENTS.MOUSELEAVE, this.onMouseLeave)
  }

  /** Updates hover state — the shader renders the hover accent when true. */

  setHover(hovered: boolean): void {
    this.isHovered = Boolean(hovered)

    // Hover-in wakes the settled loop — the touch ripples/glove need
    // live frames again. Hover-out needs no wake: the running loop
    // decays the fill to the sleep threshold on its own.
    if (hovered && !this.animId) this.animate()
  }

  /** Programmatic activation — runs the bound onAction. */

  triggerClick() {
    this.clickTime = (performance.now() - this.startTime) * 0.001

    // Keyboard/programmatic clicks land without hover — wake the settled
    // loop so the 0.45s shockwave ring actually animates.
    if (!this.animId) this.animate()
  }

  /** Morphs the icon between play and pause states. */

  setPlaying(playing: boolean): void {
    this.isPlaying = Boolean(playing)

    // The glyph swaps on the next painted frame — wake a settled loop.
    if (!this.animId) this.animate()
  }

  /** Updates the progress ring's fill fraction (and syncs play state). */

  setProgress(p: number, isPlaying?: boolean): void {
    if (isPlaying !== undefined) {
      this.isPlaying = Boolean(isPlaying)
    }

    this.progress = Math.max(0, Math.min(1, Number(p) || 0))

    // The arc only exists on the painted canvas — a settled loop must
    // wake for the new fraction to appear.
    if (!this.animId) this.animate()
  }

  /**
   * Called when the reduced-motion preference changes.
   * Restarts the animation loop if motion is now allowed,
   * or renders a final static frame when entering reduced mode.
   */
  /** Applies prefers-reduced-motion: swaps the animation loop for one static frame render. */
  setReducedMotion(isReduced: boolean): void {
    if (isReduced) {
      this._renderStatic()
    } else if (!this.animId) {
      this.animate()
    }
  }

  /**
   * Render a single static frame with the arrow visible.
   * Used when reduced-motion is active so controls remain visible.
   */
  /** Draws a single settled frame — used under reduced motion or when the loop is stopped. */
  _renderStatic() {
    this.hoverLevel = this.isHovered ? 1.0 : 0.0

    const now = performance.now()

    if (this.ctx) {
      this._renderCanvas2D(now)
    }
  }

  /** Starts the requestAnimationFrame render loop (skipped under reduced motion). */

  animate() {
    // The tick consumed its own pool id before running — clearing it
    // keeps `animId` honest and lets a wake call re-arm the loop if
    // this frame ever throws before the re-arm at the bottom.
    this.animId = null

    if (store.getters.getReducedMotion() || this._paused) {
      this._renderStatic()

      return
    }

    const now = performance.now()

    const targetH = this.isHovered ? 1.0 : 0.0

    this.hoverLevel += (targetH - this.hoverLevel) * 0.16

    // Once autoplay is stopped, smoothly regress the line backwards to zero and keep it at 0
    if (!this.isPlaying && this.progress > 0) {
      this.progress = Math.max(0, this.progress - 0.04)
    }

    // Settle-sleep — unhovered, decayed past the paint gate, shockwave
    // expired and not mid-regression: the frame is time-invariant (t
    // only feeds the hover-gated ripple/glove layers), so the frame
    // painted below is the terminal one. Hover, click, progress and
    // play state changes re-arm through their setters.
    const settled =
      !this.isHovered &&
      this.hoverLevel < HOVER_FLOOR &&
      (this.isPlaying || this.progress <= 0) &&
      (now - this.startTime) * 0.001 - this.clickTime >= CLICK_WAVE_S

    if (settled) this.hoverLevel = 0

    if (this.ctx) {
      this._renderCanvas2D(now)
    }

    if (settled) return

    this.animId = framePool.request(this._frameTick)
  }

  /** Per-frame Canvas2D fallback render — same visual language as the shader. */

  _renderCanvas2D(now: number): void {
    paintCarouselArrow2D(
      this.ctx,
      {
        dpr: this.dpr,
        width: this.width,
        height: this.height,
        canvasWidth: this.canvas.width,
        canvasHeight: this.canvas.height,
        type: this.type,
        startTime: this.startTime,
        isHovered: this.isHovered,
        hoverLevel: this.hoverLevel,
        isPlaying: this.isPlaying,
        progress: this.progress,
        clickTime: this.clickTime,
      },
      now
    )
  }

  /** Releases the context, buffers, listeners and rAF handle so the canvas can be GC'd. */

  destroy() {
    if (this.animId) framePool.cancel(this.animId)

    webglPool.unregister(this.canvas)

    if (this.boundTarget) {
      if (this.onMouseEnter)
        this.boundTarget.removeEventListener(MOUSE_EVENTS.MOUSEENTER, this.onMouseEnter)

      if (this.onMouseLeave)
        this.boundTarget.removeEventListener(MOUSE_EVENTS.MOUSELEAVE, this.onMouseLeave)

      if (this.onClick) this.boundTarget.removeEventListener(MOUSE_EVENTS.CLICK, this.onClick)
    }

    if (this.gl) {
      if (this.quadBuffer) this.gl.deleteBuffer(this.quadBuffer)

      if (this.program) this.gl.deleteProgram(this.program)

      this.gl.getExtension?.(WEBGL_STRINGS.WEBGL_LOSE_CONTEXT)?.loseContext()

      this.gl = null
    }
  }
}
