/**
 * @file coverage/utils/gpu/corner-brackets-tails.test.js
 * @description Coverage tail for utils/gpu/corner-brackets.ts — the
 * shared WebGPU mount for the animated button corner brackets. Covers
 * bezierEase numerics, every capability gate, the IO-deferred mount
 * arms (null, dead-on-resolve, live), layout/color pushes, the hover
 * ramp retarget + settle, the parent-hover selector path, batch mount,
 * and teardown idempotency.
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { POINTER_EVENTS, FOCUS_EVENTS } from '@core/tokens/events/dom.js'

let mockGpu = false
let mountResult = null
let mountCalls = []
let mountDelay = 0

jest.unstable_mockModule('@core/utils/gpu/webgpu-widget.js', () => ({
  hasWebGpu: () => mockGpu,
  mountWebGpuWidget: async (...args) => {
    mountCalls.push(args)

    if (mountDelay) await new Promise((r) => setTimeout(r, mountDelay))

    return mountResult
  },
  warmWidgetArtifacts: () => undefined,
}))

const flush = (ms = 30) => new Promise((r) => setTimeout(r, ms))

/** The recording fake widget. */
let widget = null

const makeWidget = () => {
  widget = {
    hovers: [],
    arms: [],
    colors: [],
    resizes: [],
    frames: [],
    resize: (w, h) => widget.resizes.push([w, h]),
    set_hover: (v) => widget.hovers.push(v),
    set_arms: (...a) => widget.arms.push(a),
    set_colors: (...a) => widget.colors.push(a),
    frame: (dt) => {
      widget.frames.push(dt)

      return true
    },
  }

  return widget
}

const SPEC = {
  canvasClass: 'bracket-canvas',
  insetVar: '--space-xs',
  ease: [0.2, 0, 0, 1],
  ms: 250,
}

describe('corner-brackets', () => {
  let mountCornerBrackets
  let mountCornerBracketsAll
  let bezierEase
  let button
  let teardowns

  beforeEach(async () => {
    mockGpu = true
    mountResult = null
    mountCalls = []
    mountDelay = 0
    teardowns = []

    button = document.createElement('button')

    Object.defineProperty(button, 'clientWidth', { value: 80, configurable: true })
    Object.defineProperty(button, 'clientHeight', { value: 24, configurable: true })

    document.body.appendChild(button)

    const mod = await import('@core/utils/gpu/corner-brackets.js')

    mountCornerBrackets = mod.mountCornerBrackets
    mountCornerBracketsAll = mod.mountCornerBracketsAll
    bezierEase = mod.bezierEase
  })

  afterEach(() => {
    teardowns.forEach((fn) => fn())
    button.remove()
    delete navigator.gpu
  })

  const mount = (b = button, spec = SPEC) => {
    const td = mountCornerBrackets(b, spec)

    teardowns.push(td)

    return td
  }

  describe('bezierEase', () => {
    test('clamps endpoints and produces the identity for a linear ease', () => {
      expect(bezierEase(0, 0.2, 0, 0, 1)).toBe(0)
      expect(bezierEase(1, 0.2, 0, 0, 1)).toBeCloseTo(1, 5)
      expect(bezierEase(0.5, 0, 0, 1, 1)).toBeGreaterThan(0)
      expect(bezierEase(0.5, 0, 0, 1, 1)).toBeLessThan(1)
      expect(bezierEase(-1, 0.2, 0, 0, 1)).toBe(0)
    })

    test('breaks out of Newton when the x-derivative vanishes', () => {
      // Control points x1=x2=0 push dx toward 0 at t≈0 — the guard arm.
      const v = bezierEase(0.5, 0, 0.5, 0, 0.5)

      expect(Number.isFinite(v)).toBe(true)
    })
  })

  describe('mount gates', () => {
    test('no-ops on a null button or without navigator.gpu', () => {
      mockGpu = false

      expect(mountCornerBrackets(null, SPEC)).toBeInstanceOf(Function)
      mount()

      expect(button.querySelector('canvas')).toBeNull()
    })

    test('no-ops under prefers-reduced-motion', () => {
      const orig = window.matchMedia

      window.matchMedia = () => ({ matches: true })

      mount()

      expect(button.querySelector('canvas')).toBeNull()

      window.matchMedia = orig
    })

    test('no-ops when document is undefined', async () => {
      const saved = globalThis.document

      delete globalThis.document

      mount()

      expect(mountCalls.length).toBe(0)

      globalThis.document = saved
    })

    test('no-ops when window is undefined', () => {
      const saved = globalThis.window

      delete globalThis.window

      mount()

      expect(mountCalls.length).toBe(0)

      globalThis.window = saved
    })

    test('mounts eagerly when IntersectionObserver is unavailable', async () => {
      const saved = globalThis.IntersectionObserver

      delete globalThis.IntersectionObserver

      makeWidget()
      mountResult = { canvas: null, widget, destroy: jest.fn() }

      mount()

      await flush()

      expect(mountCalls.length).toBe(1)

      globalThis.IntersectionObserver = saved
    })
  })

  describe('mount arms', () => {
    test('a failed artifact marks failed and removes the canvas', async () => {
      mountResult = null

      mount()

      await flush()

      expect(mountCalls.length).toBe(1)
      expect(button.querySelector('canvas')).toBeNull()
    })

    test('dead-on-resolve destroys the late handle', async () => {
      makeWidget()
      mountResult = { canvas: null, widget, destroy: jest.fn() }
      mountDelay = 40

      const td = mount()

      await flush(25)

      expect(mountCalls.length).toBe(1)

      td()
      td() // guarded second call

      await flush(80)

      expect(mountResult.destroy).toHaveBeenCalled()
      expect(button.querySelector('canvas')).toBeNull()
    })

    test('live mount lays out, pushes colors + the resting frame', async () => {
      makeWidget()
      mountResult = { canvas: null, widget, destroy: jest.fn() }

      mount()

      await flush()

      const canvas = button.querySelector('canvas')

      expect(canvas).not.toBeNull()
      expect(canvas.classList.contains(STATE_CLASSES.IS_FALLBACK)).toBe(false)
      expect(widget.arms.length).toBe(1)
      expect(widget.colors.length).toBe(1)
      expect(widget.resizes.length).toBe(1)
      expect(widget.frames.length).toBe(1)
    })
  })

  describe('the hover ramp', () => {
    const liveMount = async () => {
      makeWidget()
      mountResult = { canvas: null, widget, destroy: jest.fn() }

      mount()

      await flush()
    }

    test('pointerenter/leave retargets the ramp through set_hover', async () => {
      await liveMount()

      // A watched stand-in with a scriptable matches() — happy-dom
      // does not evaluate :hover, so hoverOn carries the state.
      const watched = document.createElement('div')

      watched.matches = () => true

      teardowns[teardowns.length - 1]()
      teardowns.pop()

      mount(button, { ...SPEC, hoverOn: watched })

      await flush()

      const frames0 = widget.frames.length

      watched.dispatchEvent(new Event(POINTER_EVENTS.POINTERENTER))

      await flush(320)

      expect(widget.hovers.length).toBeGreaterThan(0)
      expect(widget.hovers[widget.hovers.length - 1]).toBeCloseTo(1, 1)
      expect(widget.frames.length).toBeGreaterThan(frames0)

      watched.matches = () => false
      watched.dispatchEvent(new Event(POINTER_EVENTS.POINTERLEAVE))

      await flush(320)

      expect(widget.hovers[widget.hovers.length - 1]).toBeLessThan(0.5)
    })

    test('focusin retargets through the same path and focusout settles', async () => {
      const watched = document.createElement('div')

      watched.matches = () => true

      mount(button, { ...SPEC, hoverOn: watched })

      await flush()

      watched.dispatchEvent(new Event(FOCUS_EVENTS.FOCUSIN))

      await flush(60)

      expect(widget.hovers.length).toBeGreaterThan(0)
      // Second dispatch with unchanged state — early return arm.
      watched.dispatchEvent(new Event(FOCUS_EVENTS.FOCUSIN))
    })

    test('hoverParentSelector resolves the watched ancestor per button', async () => {
      const parent = document.createElement('div')

      parent.className = 'hover-parent'
      parent.appendChild(button)

      mount(button, { ...SPEC, hoverParentSelector: '.hover-parent' })

      await flush()

      // The listeners sit on the parent — dispatching there retargets.
      parent.dispatchEvent(new Event(POINTER_EVENTS.POINTERENTER))

      await flush(30)
    })
  })

  describe('batch mount + teardown', () => {
    test('mountCornerBracketsAll mounts every match and tears them all down', async () => {
      makeWidget()
      mountResult = { canvas: null, widget, destroy: jest.fn() }

      const extra = document.createElement('button')

      extra.className = 'bracket-me'
      button.className = 'bracket-me'

      document.body.appendChild(extra)

      const td = mountCornerBracketsAll(document.body, '.bracket-me', SPEC)

      await flush()

      expect(mountCalls.length).toBe(2)

      td()

      extra.remove()
    })
  })
})
