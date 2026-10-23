/**
 * @file carousel-controls-tails.test.js
 * @description Coverage tail for utils/canvas/widgets/carousel-controls.ts
 * — the Canvas2D progress-ring arrow widget. `attachMockGL` alone leaves
 * `getContext('2d')` null so every init takes the `!this.ctx` fallback;
 * this file attaches a mock 2D context to drive the success path:
 * bindEvents + hover/click handlers, purge/restore pool hooks, the
 * wake-setters (hover/click/playing/progress), reduced-motion and
 * settle-sleep animate() arms, the pooled _frameTick, and destroy's
 * listener/GL teardown.
 */
import { describe, test, expect, jest, afterEach } from '@jest/globals'
import { CarouselArrowWebGL } from '@core/utils/canvas/widgets/carousel-controls.js'
import { attachMock2D, createMockGL } from '@tests/fixtures/mock-webgl.js'
import { ARROW_TYPES } from '@core/tokens/theme/arrows.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { MOUSE_EVENTS } from '@core/tokens/events/dom.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { STATE_STRINGS } from '@core/tokens/strings/state.js'
import { framePool } from '@core/utils/motion/frame.js'
import store from '@core/store.js'

/** Fresh canvas each test — getContext is monkey-patched per instance. */
const makeCanvas = () => document.createElement(HTML_TAGS.CANVAS)

/** Live (unsettled) widget: hovered, so animate() keeps re-arming. */
const liveArrow = (canvas, opts = {}) => {
  attachMock2D(canvas)

  const arrow = new CarouselArrowWebGL(canvas, opts.type, opts.onAction ?? null)

  arrow.setHover(true)

  return arrow
}

/** Pumps one shared-scheduler frame so _frameTick re-enters animate(). */
const pumpFrame = () => framePool.flush(performance.now())

afterEach(() => {
  jest.restoreAllMocks()
})

describe('CarouselArrowWebGL — init guards', () => {
  test('a canvas without getContext takes the fallback arm', () => {
    const fake = { style: {}, classList: { add: jest.fn() } }

    const arrow = new CarouselArrowWebGL(fake)

    expect(fake.classList.add).toHaveBeenCalledWith(STATE_CLASSES.IS_FALLBACK)
    expect(fake.style.display).not.toBeUndefined()

    // boundTarget is unset — destroy's `if (boundTarget)` else arm.
    arrow.destroy()
  })

  test('a throwing getContext lands in the catch arm', () => {
    const canvas = makeCanvas()

    canvas.getContext = () => {
      throw new Error('ctx lost')
    }

    new CarouselArrowWebGL(canvas, ARROW_TYPES.PREV)

    expect(canvas.classList.contains(STATE_CLASSES.IS_FALLBACK)).toBe(true)
  })

  test('a zero devicePixelRatio resolves through the || 1 fallback', () => {
    const canvas = makeCanvas()
    const prev = window.devicePixelRatio

    Object.defineProperty(window, 'devicePixelRatio', { value: 0, configurable: true })
    attachMock2D(canvas)

    const arrow = new CarouselArrowWebGL(canvas, ARROW_TYPES.PREV)

    expect(arrow.dpr).toBe(1)

    Object.defineProperty(window, 'devicePixelRatio', { value: prev, configurable: true })

    arrow.destroy()
  })

  test('a missing window resolves the ternary else arm', () => {
    const canvas = makeCanvas()
    const realWindow = globalThis.window

    attachMock2D(canvas)
    delete globalThis.window

    const arrow = new CarouselArrowWebGL(canvas, ARROW_TYPES.PREV)

    expect(arrow.dpr).toBeGreaterThanOrEqual(1)

    globalThis.window = realWindow

    arrow.destroy()
  })

  test('a measurable rect adopts its width as the widget size', () => {
    const canvas = makeCanvas()

    canvas.getBoundingClientRect = () => ({ width: 30, height: 30, left: 0, top: 0 })
    attachMock2D(canvas)

    const arrow = new CarouselArrowWebGL(canvas, ARROW_TYPES.PREV)

    expect(arrow.width).toBe(30)
    expect(arrow.height).toBe(30)

    arrow.destroy()
  })
})

describe('CarouselArrowWebGL — events + pool hooks', () => {
  test('bindEvents targets the canvas itself when it has no parent', () => {
    const canvas = makeCanvas()
    const onAction = jest.fn()
    const arrow = liveArrow(canvas, { onAction })

    expect(arrow.boundTarget).toBe(canvas)

    // onClick on the canvas-as-target runs the bound action.
    arrow.onClick()

    expect(onAction).toHaveBeenCalledTimes(1)

    // The real dispatched events hit the bound handlers too.
    canvas.dispatchEvent(new Event(MOUSE_EVENTS.MOUSEENTER))
    canvas.dispatchEvent(new Event(MOUSE_EVENTS.MOUSELEAVE))

    arrow.destroy()
  })

  test('bindEvents climbs to the parent element — clicks there skip onAction', () => {
    const wrap = document.createElement(HTML_TAGS.DIV)
    const canvas = makeCanvas()

    wrap.appendChild(canvas)
    attachMock2D(canvas)

    const onAction = jest.fn()
    const arrow = new CarouselArrowWebGL(canvas, ARROW_TYPES.NEXT, onAction)

    expect(arrow.boundTarget).toBe(wrap)

    arrow.onClick()

    expect(onAction).not.toHaveBeenCalled()

    wrap.dispatchEvent(new Event(MOUSE_EVENTS.MOUSEENTER))
    wrap.dispatchEvent(new Event(MOUSE_EVENTS.MOUSELEAVE))

    arrow.destroy()
    wrap.remove()
  })

  test('onClick without an action safely skips the optional call', () => {
    const canvas = makeCanvas()
    const arrow = liveArrow(canvas)

    expect(() => arrow.onClick()).not.toThrow()

    arrow.destroy()
  })

  test('purge cancels the live frame; restore re-arms it', () => {
    const canvas = makeCanvas()
    const arrow = liveArrow(canvas)

    expect(arrow.animId).not.toBeNull()

    arrow.purge()

    expect(arrow._paused).toBe(true)
    expect(arrow.animId).toBeNull()

    // A second purge with no live frame — the `if (animId)` else arm.
    arrow.purge()

    arrow.restore()

    expect(arrow._paused).toBe(false)

    // A second restore while armed — the `if (!animId && ctx)` else arm.
    arrow.restore()

    arrow.destroy()
  })

  test('restore skips re-arming when the context is gone', () => {
    const canvas = makeCanvas()
    const arrow = liveArrow(canvas)

    arrow.purge()
    arrow.ctx = null
    arrow.restore()

    expect(arrow.animId).toBeNull()

    arrow.destroy()
  })
})

describe('CarouselArrowWebGL — wake setters + animate arms', () => {
  test('the pooled _frameTick re-enters animate()', () => {
    const canvas = makeCanvas()
    const arrow = liveArrow(canvas)

    const spy = jest.spyOn(arrow, 'animate')

    pumpFrame()

    expect(spy).toHaveBeenCalled()

    arrow.destroy()
  })

  test('setHover wakes only when the loop is asleep', () => {
    const canvas = makeCanvas()
    const arrow = liveArrow(canvas)

    // Hovered + armed — the `hovered && !animId` second arm.
    arrow.setHover(true)

    expect(arrow.animId).not.toBeNull()

    // Unhovered — the `hovered` false arm lets the loop decay.
    arrow.setHover(false)
    arrow.setHover(true)

    arrow.destroy()
  })

  test('triggerClick + setPlaying + setProgress wake arms', () => {
    const canvas = makeCanvas()
    const arrow = liveArrow(canvas)

    // Live loop — the `!animId` else arms on every setter.
    arrow.triggerClick()
    arrow.setPlaying(false)
    arrow.setProgress(0.5)
    arrow.setProgress(0.75, true)

    expect(arrow.isPlaying).toBe(true)

    arrow.destroy()
  })

  test('setProgress clamps, defaults NaN, and syncs play state', () => {
    const canvas = makeCanvas()
    const arrow = liveArrow(canvas)

    arrow.setProgress(2)
    expect(arrow.progress).toBe(1)

    arrow.setProgress(-1)
    expect(arrow.progress).toBe(0)

    arrow.setProgress(NaN)
    expect(arrow.progress).toBe(0)

    arrow.setProgress(0.5, false)
    expect(arrow.isPlaying).toBe(false)

    arrow.destroy()
  })

  test('setReducedMotion swaps the loop for one static frame and back', () => {
    const canvas = makeCanvas()
    const arrow = liveArrow(canvas)

    arrow.setReducedMotion(true)
    arrow.setReducedMotion(false)

    // Still armed — the `!animId` else arm.
    arrow.setReducedMotion(false)

    arrow.destroy()
  })

  test('every setter re-arms a settled loop', () => {
    const canvas = makeCanvas()

    attachMock2D(canvas)

    // Fresh construct settles on the first frame — animId stays null.
    const arrow = new CarouselArrowWebGL(canvas, ARROW_TYPES.PREV)

    expect(arrow.animId).toBeNull()

    // Unhovered static render — _renderStatic's isHovered else arm —
    // then the reduced-motion-off `!animId` arm re-enters animate().
    arrow.setReducedMotion(true)
    arrow.setReducedMotion(false)

    // Each wake-setter's `!animId` arm re-enters animate(); the last
    // one leaves the loop mid-regression, which re-arms the frame.
    arrow.setPlaying(false)
    arrow.setProgress(0.4)

    expect(arrow.animId).not.toBeNull()

    arrow.destroy()
  })

  test('animate() renders one static frame under reduced motion', () => {
    const canvas = makeCanvas()
    const arrow = liveArrow(canvas)

    jest.spyOn(store.getters, 'getReducedMotion').mockReturnValue(true)
    arrow.animId = null

    arrow.animate()

    expect(arrow.animId).toBeNull()

    arrow.destroy()
  })

  test('_renderStatic and animate() skip the paint when ctx is gone', () => {
    const canvas = makeCanvas()
    const arrow = liveArrow(canvas)

    arrow.ctx = null
    arrow._renderStatic()
    arrow.animate()

    arrow.destroy()
  })

  test('the settle-sleep chain: hovered, undecayed, regressing and fresh-click arms', () => {
    const canvas = makeCanvas()
    const arrow = liveArrow(canvas)

    // Fresh click — the last && operand stays false.
    arrow.triggerClick()
    pumpFrame()

    // Undecayed hover level — the hoverLevel < HOVER_FLOOR arm stays false.
    arrow.setHover(false)
    arrow.hoverLevel = 0.5
    pumpFrame()

    // Mid-regression — the `isPlaying || progress <= 0` arm stays false.
    arrow.isPlaying = false
    arrow.progress = 0.5
    arrow.hoverLevel = 0
    pumpFrame()

    expect(arrow.animId).not.toBeNull()

    // Fully settled — the terminal frame returns without re-arming.
    arrow.isHovered = false
    arrow.isPlaying = true
    arrow.progress = 0
    arrow.clickTime = -10
    pumpFrame()

    expect(arrow.animId).toBeNull()

    arrow.destroy()
  })
})

describe('CarouselArrowWebGL — destroy teardown', () => {
  test('destroy cancels the frame, unbinds the parent, and releases GL resources', () => {
    const wrap = document.createElement(HTML_TAGS.DIV)
    const canvas = makeCanvas()

    wrap.appendChild(canvas)
    attachMock2D(canvas)

    const arrow = new CarouselArrowWebGL(canvas, ARROW_TYPES.NEXT, () => {})

    arrow.setHover(true)

    const gl = createMockGL()

    arrow.gl = gl
    arrow.quadBuffer = {}
    arrow.program = {}

    arrow.destroy()

    // destroy null-marks the pool slot — the field keeps its inert id.
    expect(arrow.gl).toBeNull()

    wrap.remove()
  })

  test('destroy tolerates null buffers and a missing lose-context extension', () => {
    const canvas = makeCanvas()
    const arrow = liveArrow(canvas)

    arrow.gl = {
      deleteBuffer: jest.fn(),
      deleteProgram: jest.fn(),
      getExtension: () => undefined,
    }

    arrow.destroy()

    expect(arrow.gl).toBeNull()
  })

  test('destroy tolerates a context without getExtension', () => {
    const canvas = makeCanvas()
    const arrow = liveArrow(canvas)

    arrow.gl = { deleteBuffer: jest.fn(), deleteProgram: jest.fn() }

    arrow.destroy()

    expect(arrow.gl).toBeNull()
  })

  test('_triggerFallback cancels a live frame', () => {
    const canvas = makeCanvas()
    const arrow = liveArrow(canvas)

    expect(arrow.animId).not.toBeNull()

    arrow._triggerFallback()

    expect(canvas.classList.contains(STATE_CLASSES.IS_FALLBACK)).toBe(true)
    expect(canvas.style.display).toBe(STATE_STRINGS.NONE)
  })
})
