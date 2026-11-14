/**
 * @file coverage/canvas/loaders/page-backdrop-tails.test.js
 * @description Coverage tail for the WebGL page backdrop — the facade's
 * canvas mount + pool/observer wiring, initGL's four failure arms, the
 * loop's start/stop/resize/draw gates (reduced motion, high contrast,
 * theme flip, dirty-flag uploads), the palette sampler's parse arms,
 * and the purge/restore/destroy lifecycle. happy-dom has no WebGL, so
 * the shared Proxy mock stands in via the canvas prototype (the facade
 * creates its own canvas).
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { APP_IDS } from '@core/tokens/ids/app.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { FIELD_CSS_PROP_LIST, FIELD_CSS_PROPS } from '@core/tokens/css/field.js'
import { THEME_CSS_PROPS } from '@core/tokens/css/theme.js'
import { PAGE_BACKDROP } from '@core/tokens/motion/page-backdrop.js'
import { GL_EVENTS } from '@core/tokens/events/dom.js'
import { createMockGL } from '@tests/fixtures/mock-webgl.js'
import { PageBackdropWebGL } from '@core/utils/canvas/loaders/page-backdrop-webgl.js'
import { initGL, triggerFallback } from '@core/utils/canvas/loaders/page-backdrop/init.js'
import { renderFrame, start, stop } from '@core/utils/canvas/loaders/page-backdrop/loop.js'
import { sampleTheme } from '@core/utils/canvas/loaders/page-backdrop/theme.js'
import {
  PAGE_BACKDROP_COLOR_SLOTS,
  PAGE_BACKDROP_FS,
} from '@core/utils/canvas/loaders/page-backdrop/shaders.js'

/** happy-dom exposes the canvas constructor on window, not as a bare global. */
const CanvasProto = window.HTMLCanvasElement.prototype

const realGetContext = CanvasProto.getContext
const realCompute = globalThis.getComputedStyle
const realMatchMedia = globalThis.matchMedia

/** Fixture palette the computed-style mock serves — rgb() so parseCssColor resolves. */
const PALETTE = {
  [THEME_CSS_PROPS.BG_PRIMARY]: 'rgb(221,229,241)',
  [FIELD_CSS_PROPS.CREAM]: 'rgb(0,200,120)',
  [FIELD_CSS_PROPS.PARCHMENT]: 'rgb(120,80,220)',
  [FIELD_CSS_PROPS.SPECULAR]: 'rgb(255,255,255)',
  [FIELD_CSS_PROPS.INK]: 'rgb(30,25,15)',
}

/** Routes every canvas's webgl getContext to the shared mock (null for other types). */
const useMockGL = (gl = createMockGL()) => {
  CanvasProto.getContext = function (type) {
    return /webgl/i.test(String(type)) ? gl : null
  }

  return gl
}

/** Computed-style mock — serves the fixture palette (or a custom map) for custom props. */
const usePalette = (map = PALETTE) => {
  globalThis.getComputedStyle = (el) => ({
    ...realCompute(el),
    getPropertyValue: (name) => map[name] ?? '',
  })
}

/** Flushes a couple of pooled frames. */
const flush = () => new Promise((r) => setTimeout(r, 40))

const root = document.documentElement

beforeEach(() => {
  useMockGL()
  usePalette()
})

afterEach(() => {
  CanvasProto.getContext = realGetContext
  globalThis.getComputedStyle = realCompute
  globalThis.matchMedia = realMatchMedia
  window.matchMedia = realMatchMedia
  root.classList.remove(
    STATE_CLASSES.DARK_MODE,
    STATE_CLASSES.HIGH_CONTRAST,
    STATE_CLASSES.REDUCED_MOTION,
    STATE_CLASSES.HAS_GL_BACKDROP
  )
})

describe('page-backdrop tails', () => {
  test('mounts its canvas first in the container, stamps the marker and loops', async () => {
    const bg = new PageBackdropWebGL(document.body)

    expect(document.body.firstChild).toBe(bg.canvas)
    expect(bg.canvas.id).toBe(APP_IDS.PAGE_BACKDROP)
    expect(bg.canvas.getAttribute(ARIA_ATTRS.ARIA_HIDDEN)).toBe(ATTR_VALUES.TRUE)
    expect(bg.useWebGL).toBe(true)
    expect(bg.isActive).toBe(true)
    expect(root.classList.contains(STATE_CLASSES.HAS_GL_BACKDROP)).toBe(true)
    expect(bg._colors.length).toBe(PAGE_BACKDROP_COLOR_SLOTS * 3)

    await flush()

    // Loop advanced the field clock and the first draw cleared the dirty gates.
    expect(bg._elapsed).toBeGreaterThan(0)
    expect(bg._paletteDirty).toBe(false)
    expect(bg._resDirty).toBe(false)

    // Resize re-arms the resolution upload; the next draw clears it.
    window.dispatchEvent(new Event('resize'))

    expect(bg._resDirty).toBe(true)

    bg._renderFrame()

    expect(bg._resDirty).toBe(false)

    bg.destroy()

    expect(bg.canvas.isConnected).toBe(false)
    expect(root.classList.contains(STATE_CLASSES.HAS_GL_BACKDROP)).toBe(false)
  })

  test('palette: light/dark gain, unparseable hue copies base, unparseable base fails', () => {
    const bg = new PageBackdropWebGL(document.body)

    expect(bg._gain).toBe(PAGE_BACKDROP.LIGHT_GAIN)
    expect(bg._base[0]).toBeCloseTo(221 / 255)

    // Green slot parsed; teal (unset) copied the base.
    const green = FIELD_CSS_PROP_LIST.indexOf(FIELD_CSS_PROPS.CREAM)
    const teal = FIELD_CSS_PROP_LIST.indexOf(FIELD_CSS_PROPS.SAND)

    expect(bg._colors[green * 3 + 1]).toBeCloseTo(200 / 255)
    expect(bg._colors[teal * 3]).toBeCloseTo(221 / 255)

    root.classList.add(STATE_CLASSES.DARK_MODE)

    expect(sampleTheme(bg)).toBe(true)
    expect(bg._gain).toBe(PAGE_BACKDROP.DARK_GAIN)
    expect(bg._darkAtStart).toBe(true)

    // Unparseable base → false.
    usePalette({})

    expect(sampleTheme(bg)).toBe(false)

    // Throwing getComputedStyle → null style → false.
    globalThis.getComputedStyle = () => {
      throw new Error('no style')
    }

    expect(sampleTheme(bg)).toBe(false)

    bg.destroy()
  })

  test('palette: unparseable specular/ink poles copy the base colour', () => {
    const bg = new PageBackdropWebGL(document.body)

    // Only the surface base parses — both light poles fall back to it.
    usePalette({ [THEME_CSS_PROPS.BG_PRIMARY]: PALETTE[THEME_CSS_PROPS.BG_PRIMARY] })

    expect(sampleTheme(bg)).toBe(true)
    expect(bg._key[0]).toBeCloseTo(221 / 255)
    expect(bg._key[1]).toBeCloseTo(229 / 255)
    expect(bg._key[2]).toBeCloseTo(241 / 255)
    expect(bg._shade[0]).toBeCloseTo(221 / 255)
    expect(bg._shade[2]).toBeCloseTo(241 / 255)
    expect(bg._key[3]).toBeCloseTo(PAGE_BACKDROP.KEY_GAIN_LIGHT)
    expect(bg._shade[3]).toBeCloseTo(PAGE_BACKDROP.SHADE_GAIN_LIGHT)

    bg.destroy()
  })

  test('renderFrame resamples on a theme flip and honours staticTime', () => {
    const bg = new PageBackdropWebGL(document.body)

    bg._renderFrame()

    expect(bg._darkAtStart).toBe(false)

    root.classList.add(STATE_CLASSES.DARK_MODE)

    bg._renderFrame(0)

    expect(bg._darkAtStart).toBe(true)
    expect(bg._gain).toBe(PAGE_BACKDROP.DARK_GAIN)

    // No context → early return without touching state.
    const gl = bg.gl

    bg.gl = null

    const before = bg._elapsed

    renderFrame(bg)

    expect(bg._elapsed).toBe(before)

    bg.gl = gl

    bg.destroy()
  })

  test('start gates: unparseable palette falls back, HC refuses, re-entry no-ops', () => {
    usePalette({})

    const bg = new PageBackdropWebGL(document.body)

    expect(bg.useWebGL).toBe(false)
    expect(bg.isActive).toBe(false)
    expect(root.classList.contains(STATE_CLASSES.HAS_GL_BACKDROP)).toBe(false)

    // Dead path → start bails.
    start(bg)

    expect(bg.isActive).toBe(false)

    bg.destroy()

    usePalette()
    root.classList.add(STATE_CLASSES.HIGH_CONTRAST)

    const bg2 = new PageBackdropWebGL(document.body)

    expect(bg2.useWebGL).toBe(true)
    expect(bg2.isActive).toBe(false)

    root.classList.remove(STATE_CLASSES.HIGH_CONTRAST)

    bg2.start()

    expect(bg2.isActive).toBe(true)

    // Already active → early return keeps state.
    bg2.start()

    expect(bg2.isActive).toBe(true)

    bg2.destroy()
  })

  test('reduced motion draws one static frame — class arm and matchMedia arm', () => {
    root.classList.add(STATE_CLASSES.REDUCED_MOTION)

    const bg = new PageBackdropWebGL(document.body)

    // webglAllowed() refuses under reduced motion → CSS fallback.
    expect(bg.useWebGL).toBe(false)

    bg.destroy()
    root.classList.remove(STATE_CLASSES.REDUCED_MOTION)

    // Context acquired first, then the class flips on before start().
    const bg2 = new PageBackdropWebGL(document.body)

    bg2.stop()
    root.classList.add(STATE_CLASSES.REDUCED_MOTION)
    bg2.start()

    expect(bg2.isActive).toBe(true)
    expect(bg2.animId).toBeNull()
    expect(bg2._paletteDirty).toBe(false)

    root.classList.remove(STATE_CLASSES.REDUCED_MOTION)
    bg2.stop()

    // matchMedia arm.
    const reducedMM = () => ({ matches: true })

    globalThis.matchMedia = reducedMM
    window.matchMedia = reducedMM
    bg2.start()

    expect(bg2.isActive).toBe(true)
    expect(bg2.animId).toBeNull()

    bg2.stop()

    // No matchMedia at all → the `window.matchMedia &&` short-circuit → loop.
    globalThis.matchMedia = undefined
    window.matchMedia = undefined
    bg2.start()

    expect(bg2.animId).not.toBeNull()

    bg2.destroy()
  })

  test('root class observer: HC pauses, leaving HC resumes, other flips no-op', async () => {
    const bg = new PageBackdropWebGL(document.body)

    expect(bg.isActive).toBe(true)

    root.classList.add(STATE_CLASSES.HIGH_CONTRAST)
    bg._onRootClass()

    expect(bg.isActive).toBe(false)

    // HC still on, already stopped → nothing.
    bg._onRootClass()

    expect(bg.isActive).toBe(false)

    root.classList.remove(STATE_CLASSES.HIGH_CONTRAST)
    bg._onRootClass()

    expect(bg.isActive).toBe(true)

    // No HC, already active → nothing.
    bg._onRootClass()

    expect(bg.isActive).toBe(true)

    // No HC, inactive, but dead path → stays stopped.
    bg.stop()
    bg.useWebGL = false
    bg._onRootClass()

    expect(bg.isActive).toBe(false)

    bg.useWebGL = true

    // The real observer fires on a class mutation.
    root.classList.add(STATE_CLASSES.HIGH_CONTRAST)

    await flush()

    bg.destroy()
  })

  test('constructs without MutationObserver; the observer callback routes to _onRootClass', () => {
    const realMO = globalThis.MutationObserver

    globalThis.MutationObserver = undefined

    const bg = new PageBackdropWebGL(document.body)

    expect(bg._rootObserver).toBeNull()

    bg.destroy()

    // A recording observer — fire its callback by hand to drive the
    // constructor's arrow (happy-dom delivers mutations asynchronously).
    const observers = []

    globalThis.MutationObserver = class {
      constructor(cb) {
        this.cb = cb

        observers.push(this)
      }
      observe() {}
      disconnect() {
        this.disconnected = true
      }
    }

    const bg2 = new PageBackdropWebGL(document.body)

    expect(observers.length).toBe(1)

    root.classList.add(STATE_CLASSES.HIGH_CONTRAST)
    observers[0].cb()

    expect(bg2.isActive).toBe(false)

    bg2.destroy()

    expect(observers[0].disconnected).toBe(true)

    globalThis.MutationObserver = realMO
  })

  test('handleResize caps DPR, defaults a zero DPR to 1, skips viewport without gl', () => {
    const bg = new PageBackdropWebGL(document.body)

    const realDpr = window.devicePixelRatio

    Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true })
    bg._handleResize()

    expect(bg.width).toBe(
      Math.min(Math.round(window.innerWidth * PAGE_BACKDROP.DPR_MAX), PAGE_BACKDROP.MAX_DIM)
    )

    Object.defineProperty(window, 'devicePixelRatio', { value: 0, configurable: true })
    bg._handleResize()

    expect(bg.width).toBe(Math.min(window.innerWidth, PAGE_BACKDROP.MAX_DIM))

    const gl = bg.gl

    bg.gl = null
    bg._handleResize()

    expect(bg._resDirty).toBe(true)

    bg.gl = gl

    Object.defineProperty(window, 'devicePixelRatio', { value: realDpr, configurable: true })

    bg.destroy()
  })

  test('loop guards: inactive, no gl, dead path all bail without arming', () => {
    const bg = new PageBackdropWebGL(document.body)

    bg.stop()
    bg._loop()

    expect(bg.animId).toBeNull()

    bg.isActive = true

    const gl = bg.gl

    bg.gl = null
    bg._loop()

    expect(bg.animId).toBeNull()

    bg.gl = gl
    bg.useWebGL = false
    bg._loop()

    expect(bg.animId).toBeNull()

    bg.useWebGL = true
    bg.isActive = false

    bg.destroy()
  })

  test('initGL failure arms — no canvas, refused context, bad program, throw', () => {
    const bg = new PageBackdropWebGL(document.body)

    bg.stop()
    bg._releaseGL()

    // No canvas → immediate fallback.
    const canvas = bg.canvas

    bg.canvas = null
    initGL(bg)

    expect(bg.useWebGL).toBe(false)

    bg.canvas = canvas

    // Context refused.
    CanvasProto.getContext = () => null
    initGL(bg)

    expect(bg.gl).toBeNull()
    expect(bg.useWebGL).toBe(false)

    // Program build failure → warn callback → fallback (context released).
    CanvasProto.getContext = () => ({
      getExtension: () => ({}),
      createProgram: () => ({}),
      createShader: () => ({}),
      createBuffer: () => ({}),
      shaderSource: () => {},
      compileShader: () => {},
      attachShader: () => {},
      linkProgram: () => {},
      getShaderParameter: () => false,
      getProgramParameter: () => false,
      getShaderInfoLog: () => '',
      getProgramInfoLog: () => '',
      deleteBuffer: () => {},
      deleteProgram: () => {},
    })
    initGL(bg)

    expect(bg.useWebGL).toBe(false)
    expect(bg.gl).toBeNull()

    // Throwing getContext → catch arm.
    CanvasProto.getContext = () => {
      throw new Error('gl gone')
    }
    initGL(bg)

    expect(bg.useWebGL).toBe(false)

    // triggerFallback with a pending frame cancels it.
    bg.animId = 7
    triggerFallback(bg)

    expect(bg.animId).toBeNull()

    bg.destroy()
  })

  test('webglcontextlost routes to the fallback and clears the marker', () => {
    const bg = new PageBackdropWebGL(document.body)

    expect(root.classList.contains(STATE_CLASSES.HAS_GL_BACKDROP)).toBe(true)

    bg.canvas.dispatchEvent(new Event(GL_EVENTS.WEBGL_CONTEXT_LOST))

    expect(bg.useWebGL).toBe(false)
    expect(bg.isActive).toBe(false)
    expect(root.classList.contains(STATE_CLASSES.HAS_GL_BACKDROP)).toBe(false)

    bg.destroy()
  })

  test('purge/restore lifecycle — double purge, detached restore, dead re-init', () => {
    const bg = new PageBackdropWebGL(document.body)

    bg.purge()

    expect(bg._purged).toBe(true)
    expect(bg.useWebGL).toBe(false)
    expect(bg.gl).toBeNull()

    // Second purge no-ops.
    bg.purge()

    // Restore with the canvas detached stays purged.
    const parent = bg.canvas.parentNode

    bg.canvas.remove()
    bg.restore()

    expect(bg._purged).toBe(true)

    parent.insertBefore(bg.canvas, parent.firstChild)
    bg.restore()

    expect(bg._purged).toBe(false)
    expect(bg.useWebGL).toBe(true)
    expect(bg.isActive).toBe(true)

    // Restore when never purged → no-op.
    bg.restore()

    // Purge then a refused context on restore → stays on the CSS path.
    bg.purge()
    CanvasProto.getContext = () => null
    bg.restore()

    expect(bg.useWebGL).toBe(false)
    expect(bg.isActive).toBe(false)

    bg.destroy()
  })

  test('stop without a pending frame and direct stop() clear the marker', () => {
    const bg = new PageBackdropWebGL(document.body)

    bg.animId = null
    bg.isActive = true
    stop(bg)

    expect(root.classList.contains(STATE_CLASSES.HAS_GL_BACKDROP)).toBe(false)

    bg.destroy()
  })

  test('shader source declares the colour slots, the dither and the three periods', () => {
    expect(PAGE_BACKDROP_FS).toContain(`u_col[${PAGE_BACKDROP_COLOR_SLOTS}]`)
    expect(PAGE_BACKDROP_FS).toContain('hash13')
    expect(PAGE_BACKDROP_FS).toContain(((2 * Math.PI) / PAGE_BACKDROP.PERIOD_1).toFixed(6))
    expect(PAGE_BACKDROP_FS).toContain(((2 * Math.PI) / PAGE_BACKDROP.PERIOD_3).toFixed(6))
    expect(FIELD_CSS_PROP_LIST.length).toBe(PAGE_BACKDROP_COLOR_SLOTS)
  })
})
