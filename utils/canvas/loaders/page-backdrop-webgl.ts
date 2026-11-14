/**
 * @file page-backdrop-webgl.ts
 * @description Fullscreen WebGL lobe-field backdrop behind every route — a
 * twelve-lobe colour field composited in 32-bit float and dithered
 * before 8-bit quantization, so the pale light-theme washes never band
 * (CSS gradients rasterize straight to 8-bit and show one-level
 * staircases across soft ramps). Owns its canvas: mounts it as the
 * document body's first child, stamps `html.has-gl-backdrop` so the CSS
 * `--bg-glow*` layers pin to `none` while it paints, and drops the marker
 * on fallback/stop so the CSS lobes remain the no-WebGL path.
 *
 * Facade — behaviour lives in ./page-backdrop/* modules:
 *   shaders  dithered lobe-field GLSL
 *   theme    --field-* / --bg-primary / specular+ink sampling into uniform buffers
 *   init     GL bootstrap + fallback trigger
 *   loop     start/stop, resize sync, pooled rAF loop, per-frame draw
 */

import { APP_IDS } from '@core/tokens/ids/app.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { WINDOW_EVENTS } from '@core/tokens/events/dom.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { releaseQuadGL } from '../gl-lifecycle.js'
import { webglPool } from '../webgl-pool.js'
import { initGL, triggerFallback } from './page-backdrop/init.js'
import { sampleTheme } from './page-backdrop/theme.js'
import { handleResize, loop, renderFrame, start, stop } from './page-backdrop/loop.js'
import { PAGE_BACKDROP_COLOR_SLOTS } from './page-backdrop/shaders.js'

/**
 * WebGL page backdrop. Construct once at app boot with the element the
 * canvas should mount into (the document body); `destroy()` on shell
 * teardown. Registers with the shared webglPool so GPU pressure can
 * purge/restore it and user actions retry a fallen-back instance.
 */
export class PageBackdropWebGL {
  /** Fullscreen canvas — created by the constructor, parked as the container's first child. */
  canvas: HTMLCanvasElement
  /** Element the canvas mounts into (document.body in production). */
  container: HTMLElement
  gl: WebGLRenderingContext | null = null
  program: WebGLProgram | null = null
  quadBuffer: WebGLBuffer | null = null
  animId: number | null = null
  /** Bound per-frame tick — allocated once so the pooled re-arm never allocs. */
  _frameTick = (): void => this._loop()
  uTime: WebGLUniformLocation | null = null
  uRes: WebGLUniformLocation | null = null
  uBase: WebGLUniformLocation | null = null
  uCol: WebGLUniformLocation | null = null
  uGain: WebGLUniformLocation | null = null
  uKey: WebGLUniformLocation | null = null
  uShade: WebGLUniformLocation | null = null
  /** Backing-store size in device pixels. */
  width = 0
  height = 0
  isActive = false
  useWebGL = false
  _lastFrame = 0
  /** Field clock in seconds — accumulates clamped frame deltas. */
  _elapsed = 0
  /** Surface colour (`--bg-primary`) as an RGB float triple. */
  _base = new Float32Array(3)
  /** Seven field hues, flat RGB — the `u_col` uniform array payload. */
  _colors = new Float32Array(PAGE_BACKDROP_COLOR_SLOTS * 3)
  /** Key light — specular RGB + theme gain packed for one `uniform4fv`. */
  _key = new Float32Array(4)
  /** Counter-shade — ink RGB + theme gain packed for one `uniform4fv`. */
  _shade = new Float32Array(4)
  /** Lobe strength multiplier — light 1, dark ember gain. */
  _gain = 1
  _darkAtStart = false
  /** Upload gates — set by sampleTheme/handleResize, cleared by the draw. */
  _paletteDirty = true
  _resDirty = true
  _onContextLost: EventListener | null = null
  _purged = false
  /** Watches the root class list for high-contrast flips. */
  _rootObserver: MutationObserver | null = null
  /** Bound passive resize handler — allocated once. */
  _onResize = (): void => this._handleResize()

  /**
   * @param container - element that receives the canvas as its first child
   */
  constructor(container: HTMLElement) {
    this.container = container

    this.canvas = document.createElement(HTML_TAGS.CANVAS)

    this.canvas.id = APP_IDS.PAGE_BACKDROP

    this.canvas.setAttribute(ARIA_ATTRS.ARIA_HIDDEN, ATTR_VALUES.TRUE)

    container.insertBefore(this.canvas, container.firstChild)

    this._initGL()

    webglPool.register(this.canvas, this)

    window.addEventListener(WINDOW_EVENTS.RESIZE, this._onResize, { passive: true })

    if (typeof MutationObserver !== TYPE_STRINGS.UNDEFINED) {
      this._rootObserver = new MutationObserver(() => this._onRootClass())

      this._rootObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: [COMMON_ATTRS.CLASS],
      })
    }

    this.start()
  }

  /** Creates the WebGL context + lobe program; falls back to the CSS lobes on failure. */
  _initGL(): void {
    initGL(this)
  }

  /** Switches to the CSS lobe path — context loss, init failure, bad palette. */
  _triggerFallback(): void {
    triggerFallback(this)
  }

  /** Frees the quad program/buffer and force-loses the context (listener detached first). */
  _releaseGL(): void {
    releaseQuadGL(this.canvas, this, this._onContextLost)

    this._onContextLost = null
  }

  /**
   * Samples `--field-*` + `--bg-primary` + specular/ink into the uniform buffers.
   * @returns true when the surface colour parsed
   */
  _sampleTheme(): boolean {
    return sampleTheme(this)
  }

  /**
   * Root class flip — high contrast pauses the field (the HC surface is
   * flat by contract); leaving it resumes. Dark/light flips are caught
   * per frame by renderFrame, so only the HC edge needs the observer.
   */
  _onRootClass(): void {
    const hc = document.documentElement.classList.contains(STATE_CLASSES.HIGH_CONTRAST)

    if (hc && this.isActive) {
      this.stop()

      return
    }

    if (!hc && !this.isActive && this.useWebGL) this.start()
  }

  /** Starts the field (see page-backdrop/loop.ts). */
  start(): void {
    start(this)
  }

  /** Stops the loop and clears the document marker. */
  stop(): void {
    stop(this)
  }

  /** Syncs the backing store with the viewport. */
  _handleResize(): void {
    handleResize(this)
  }

  /** Pooled rAF callback — draws the field each frame. */
  _loop(): void {
    loop(this)
  }

  /**
   * Draws one frame; a fixed `staticTime` renders one settled pose.
   * @param staticTime - field time for a static frame
   */
  _renderFrame(staticTime?: number | null): void {
    renderFrame(this, staticTime)
  }

  /**
   * webglPool hook — GPU pressure or an offscreen canvas: tears the GL
   * resources down and clears the marker so the CSS lobes cover the gap.
   */
  purge(): void {
    if (this._purged) return

    this._purged = true

    this.useWebGL = false

    this.stop()

    this._releaseGL()
  }

  /** webglPool hook — recreates the context + restarts after a purge. */
  restore(): void {
    if (!this._purged) return

    if (!this.canvas.isConnected) return

    this._purged = false

    this._initGL()

    if (this.useWebGL) this.start()
  }

  /** Releases everything — context, listeners, observer, the canvas itself. */
  destroy(): void {
    this._purged = false

    webglPool.unregister(this.canvas)

    window.removeEventListener(WINDOW_EVENTS.RESIZE, this._onResize)

    this._rootObserver?.disconnect()

    this._rootObserver = null

    this.stop()

    this._releaseGL()

    this.canvas.remove()
  }
}
