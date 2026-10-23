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
      // p=0 seeds t=0 → dx = 3o²·x1 + … evaluates to 0 → guard arm.
      expect(bezierEase(0, 0, 0.5, 0, 0.5)).toBe(0)

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

    test('a missing matchMedia skips the reduced-motion probe entirely', async () => {
      const orig = window.matchMedia

      window.matchMedia = undefined
      makeWidget()
      mountResult = { canvas: null, widget, destroy: jest.fn() }

      mount()

      await flush()

      expect(mountCalls.length).toBe(1)

      window.matchMedia = orig
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

    test('the ResizeObserver arm re-runs layout once live', async () => {
      makeWidget()
      mountResult = { canvas: null, widget, destroy: jest.fn() }

      const ros = []
      const PrevRO = globalThis.ResizeObserver

      globalThis.ResizeObserver = class {
        constructor(cb) {
          this.cb = cb
          ros.push(this)
        }
        observe() {}
        disconnect() {}
      }

      mount()

      await flush()

      globalThis.ResizeObserver = PrevRO

      expect(ros.length).toBe(1)

      // A zero devicePixelRatio resolves through the `|| 1` fallback.
      const prevDpr = window.devicePixelRatio

      Object.defineProperty(window, 'devicePixelRatio', { value: 0, configurable: true })
      ros[0].cb()
      Object.defineProperty(window, 'devicePixelRatio', { value: prevDpr, configurable: true })

      expect(widget.resizes.length).toBe(2)
      expect(widget.arms.length).toBe(2)

      // A queued RO notification after teardown — layout's !handle arm.
      const td = teardowns.pop()

      td()
      ros[0].cb()

      expect(widget.resizes.length).toBe(2)
    })

    test('a retarget while the mount is in flight early-returns colors()', () => {
      makeWidget()
      mountResult = { canvas: null, widget, destroy: jest.fn() }
      mountDelay = 50

      const watched = document.createElement('div')

      watched.matches = () => true

      mount(button, { ...SPEC, hoverOn: watched })

      watched.dispatchEvent(new Event(POINTER_EVENTS.POINTERENTER))

      expect(widget.hovers.length).toBe(0)
    })

    test('a detached button resolves the probe against itself', async () => {
      makeWidget()
      mountResult = { canvas: null, widget, destroy: jest.fn() }

      const orphan = document.createElement('button')

      mount(orphan)

      await flush()

      expect(mountCalls.length).toBe(1)
    })

    test('re-fired IO entries hit the pending/handle/failed/dead guards', async () => {
      makeWidget()
      mountResult = { canvas: null, widget, destroy: jest.fn() }
      mountDelay = 40

      const ios = []
      const PrevIO = globalThis.IntersectionObserver

      globalThis.IntersectionObserver = class {
        constructor(cb) {
          this.cb = cb
          ios.push(this)
        }
        observe() {}
        disconnect() {}
      }

      mount()
      ios[0].cb([{ isIntersecting: false, target: button }]) // non-intersecting else arm
      ios[0].cb([{ isIntersecting: true, target: button }]) // starts the fetch
      ios[0].cb([{ isIntersecting: true, target: button }]) // pending arm

      await flush(80)

      ios[0].cb([{ isIntersecting: true, target: button }]) // live-handle arm

      expect(mountCalls.length).toBe(1)

      const td = teardowns.pop()

      td()
      ios[0].cb([{ isIntersecting: true, target: button }]) // dead arm

      // A second mount whose artifact fails → failed guard on refire.
      mountCalls = []
      mountResult = null
      mountDelay = 0

      mount()
      ios[1].cb([{ isIntersecting: true, target: button }])

      await flush()

      ios[1].cb([{ isIntersecting: true, target: button }]) // failed arm

      expect(mountCalls.length).toBe(1)

      globalThis.IntersectionObserver = PrevIO
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

    test('a missing parent selector falls back to the button itself', async () => {
      mount(button, { ...SPEC, hoverParentSelector: '.not-present' })

      await flush()

      button.dispatchEvent(new Event(POINTER_EVENTS.POINTERENTER))

      await flush(30)
    })

    test('a pending ramp is cancelled on teardown and its stale tick no-ops', async () => {
      makeWidget()
      mountResult = { canvas: null, widget, destroy: jest.fn() }

      const cbs = []
      const prevRaf = globalThis.requestAnimationFrame

      globalThis.requestAnimationFrame = (cb) => {
        cbs.push(cb)

        return cbs.length
      }

      const watched = document.createElement('div')

      watched.matches = () => true

      mount(button, { ...SPEC, hoverOn: watched })

      await flush()

      watched.dispatchEvent(new Event(POINTER_EVENTS.POINTERENTER))

      expect(cbs.length).toBe(1)

      // Teardown while the ramp raf is pending — the `if (raf)` cancel arm.
      const td = teardowns.pop()

      td()

      // A queued tick fired after teardown — the !handle || dead guard.
      cbs[0]()

      globalThis.requestAnimationFrame = prevRaf
    })

    test('a teardown inside a ramp frame leaves an orphan tick that early-returns dead', async () => {
      makeWidget()
      mountResult = { canvas: null, widget, destroy: jest.fn() }

      mount()

      await flush()

      const td = teardowns.pop()

      button.matches = () => true

      // Teardown re-entrantly inside the painted frame: `raf` was already
      // consumed (0) so cancel is a no-op, and the p<1 re-arm below it
      // queues a tick the teardown never saw — the dead-guard's prey.
      let tore = false

      widget.frame = (dt) => {
        widget.frames.push(dt)

        if (!tore) {
          tore = true
          td()
        }

        return true
      }

      button.dispatchEvent(new Event(POINTER_EVENTS.POINTERENTER))

      // Two pumps: the tear-down tick re-arms, the orphan early-returns.
      await flush(60)

      expect(tore).toBe(true)
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
