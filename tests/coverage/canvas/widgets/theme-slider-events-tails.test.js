/**
 * @file coverage/canvas/widgets/theme-slider-events-tails.test.js
 * @description Coverage tail for theme-slider/events.ts — the bound
 * pointer/click/keyboard handlers fired on a real mounted slider.
 * Covers the capture try/optional arms, the coalesced-move contract
 * (present/empty/absent + touches fallback), the pointerup snap +
 * theme-change/no-change arms, the click thirds with the rect.width
 * fallback, and every keydown direction + clamp + no-op key.
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { KEYS } from '@core/tokens/primitives.js'
import { THEME } from '@core/tokens/theme/theme.js'
import store from '@core/store.js'
import { PREF_MUTATIONS } from '@core/tokens/events/mutations.js'

let mountResult = null
let mockGpu = true
let fakeWidget = null

jest.unstable_mockModule('@core/utils/gpu/webgpu-widget.js', () => ({
  hasWebGpu: () => mockGpu,
  mountWebGpuWidget: async () => mountResult,
  warmWidgetArtifacts: () => undefined,
}))

const loadClass = async () =>
  (await import('@core/utils/canvas/widgets/theme-slider.js')).ThemeSliderWebGL

const flush = async () => {
  await Promise.resolve()
  await new Promise((r) => setTimeout(r, 40))
}

const makeCanvas = () => {
  const canvas = document.createElement(HTML_TAGS.CANVAS)

  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 280, height: 64 })

  return canvas
}

beforeEach(() => {
  store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)

  mountResult = null
  mockGpu = true

  fakeWidget = {
    calls: { state: [], frame: [], size: [], dev: [], tap: [] },
    set_state: (p, k) => fakeWidget.calls.state.push([p, k]),
    frame: (dt) => fakeWidget.calls.frame.push(dt),
    set_size: (w, h) => fakeWidget.calls.size.push([w, h]),
    resize: (w, h) => fakeWidget.calls.dev.push([w, h]),
    tap: (t, x) => fakeWidget.calls.tap.push([t, x]),
  }

  mountResult = { canvas: null, widget: fakeWidget, destroy: jest.fn() }
})

const mount = async (theme = THEME.SYSTEM, onThemeChange = null) => {
  const ThemeSliderWebGL = await loadClass()
  const canvas = makeCanvas()
  const slider = new ThemeSliderWebGL(canvas, theme, onThemeChange)

  await flush()

  return { slider, canvas }
}

describe('theme-slider events tail', () => {
  test('pointerdown drags, caches the rect, taps the wasm widget', async () => {
    const { slider, canvas } = await mount()

    canvas.setPointerCapture = jest.fn()

    slider.onPointerDown({ pointerId: 1, clientX: 140 })

    expect(slider.isDragging).toBe(true)
    expect(canvas.setPointerCapture).toHaveBeenCalledWith(1)
    expect(slider.dragRectLeft).toBe(0)
    expect(slider.dragRectWidth).toBe(280)
    expect(fakeWidget.calls.tap.length).toBe(1)
  })

  test('pointerdown capture throw + touches + no-coord arms', async () => {
    const { slider, canvas } = await mount()

    canvas.setPointerCapture = () => {
      throw new Error('no capture')
    }

    slider.onPointerDown({ pointerId: 2, clientX: 0, touches: [{ clientX: 200 }] })

    expect(slider.isDragging).toBe(true)
    expect(slider.targetP).not.toBe(0)

    slider.onPointerDown({ pointerId: 3, clientX: 0, touches: [] })
    slider.onPointerDown({ pointerId: 3, clientX: 0 })

    expect(slider.isDragging).toBe(true)
  })

  test('pointermove honors coalesced events, empty lists and absence', async () => {
    const { slider } = await mount()

    slider.onPointerMove({ clientX: 10 })

    expect(slider.isDragging).toBe(false)

    slider.onPointerDown({ pointerId: 1, clientX: 140 })

    const before = slider.targetP

    slider.onPointerMove({
      clientX: 0,
      getCoalescedEvents: () => [{ clientX: 10 }, { clientX: 220 }],
    })

    expect(slider.targetP).not.toBe(before)

    slider.onPointerMove({ clientX: 30, getCoalescedEvents: () => [] })
    slider.onPointerMove({ clientX: 60 })
    slider.onPointerMove({ clientX: 0, touches: [{ clientX: 250 }] })
    slider.onPointerMove({ clientX: 0, touches: [{ clientX: 0 }] })

    expect(slider.isDragging).toBe(true)
  })

  test('pointerup snaps and fires onThemeChange on a real change', async () => {
    const onThemeChange = jest.fn()
    const { slider, canvas } = await mount(THEME.DARK, onThemeChange)

    canvas.releasePointerCapture = jest.fn()

    slider.onPointerUp({ pointerId: 1 })

    expect(slider.isDragging).toBe(false)

    slider.onPointerDown({ pointerId: 1, clientX: 265 })
    slider.onPointerUp({ pointerId: 1 })

    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(1)
    expect(onThemeChange).toHaveBeenCalledWith(THEME.LIGHT)
  })

  test('pointerup release-throw and no-change arms', async () => {
    const onThemeChange = jest.fn()
    const { slider, canvas } = await mount(THEME.SYSTEM, onThemeChange)

    const throwing = jest.fn(() => {
      throw new Error('no release')
    })

    canvas.releasePointerCapture = throwing

    slider.onPointerDown({ pointerId: 1, clientX: 140 })
    slider.onPointerUp({ pointerId: 1 })

    expect(throwing).toHaveBeenCalled()

    expect(slider.isDragging).toBe(false)
    expect(onThemeChange).not.toHaveBeenCalled()

    canvas.releasePointerCapture = undefined
    slider.onPointerDown({ pointerId: 1, clientX: 140 })
    slider.onPointerUp({ pointerId: 1 })
  })

  test('pointerup theme change without a callback — the ?. skip arm', async () => {
    const { slider } = await mount(THEME.DARK, null)

    slider.onPointerDown({ pointerId: 1, clientX: 265 })
    slider.onPointerUp({ pointerId: 1 })

    expect(slider.currentTheme).toBe(THEME.LIGHT)
  })

  test('pointerup on a canvas that never had releasePointerCapture', async () => {
    const { slider, canvas } = await mount(THEME.DARK, null)

    delete canvas.releasePointerCapture

    slider.onPointerDown({ pointerId: 1, clientX: 265 })
    slider.onPointerUp({ pointerId: 1 })
  })

  test('pointerdown on a canvas that never had setPointerCapture', async () => {
    const { slider, canvas } = await mount(THEME.DARK, null)

    delete canvas.setPointerCapture

    slider.onPointerDown({ pointerId: 1, clientX: 140 })

    expect(slider.isDragging).toBe(true)
  })

  test('click snaps thirds incl. the rect.width fallback and no-change arm', async () => {
    const onThemeChange = jest.fn()
    const { slider, canvas } = await mount(THEME.SYSTEM, onThemeChange)

    slider.onClick({ clientX: 140 })

    expect(onThemeChange).not.toHaveBeenCalled()

    slider.onClick({ clientX: 270 })

    expect(onThemeChange).toHaveBeenCalledWith(THEME.LIGHT)

    onThemeChange.mockClear()

    slider.onClick({ clientX: 10 })

    expect(onThemeChange).toHaveBeenCalledWith(THEME.DARK)

    onThemeChange.mockClear()
    slider.onClick({ clientX: 140 })

    expect(onThemeChange).toHaveBeenCalledWith(THEME.SYSTEM)

    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 64 })
    onThemeChange.mockClear()
    slider.onClick({ clientX: 0 })

    expect(onThemeChange).toHaveBeenCalledWith(THEME.DARK)
  })

  test('keydown steps both directions, clamps, and ignores other keys', async () => {
    const onThemeChange = jest.fn()
    const { slider } = await mount(THEME.SYSTEM, onThemeChange)
    const evt = (key) => ({ key, preventDefault: jest.fn() })

    const left = evt(KEYS.ARROW_LEFT)

    slider.onKeyDown(left)

    expect(left.preventDefault).toHaveBeenCalled()
    expect(onThemeChange).toHaveBeenCalledWith(THEME.DARK)

    onThemeChange.mockClear()
    slider.onKeyDown(evt(KEYS.ARROW_LEFT))

    expect(onThemeChange).not.toHaveBeenCalled()

    const right = evt(KEYS.ARROW_RIGHT)

    slider.onKeyDown(right)
    slider.onKeyDown(evt(KEYS.ARROW_RIGHT))
    slider.onKeyDown(evt(KEYS.ARROW_UP))

    expect(onThemeChange).toHaveBeenCalledWith(THEME.LIGHT)

    slider.onKeyDown(evt(KEYS.ARROW_DOWN))
    slider.onKeyDown(evt(KEYS.ESCAPE))

    expect(slider.targetP).toBe(1)
  })
})
