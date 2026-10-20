/**
 * @file skeleton-measure-tails.test.js
 * @description Coverage tails for skeleton measure/init edges: host-bounds
 * clipping (the overlay canvas may never bleed into sibling components),
 * padding-box offsets, ResizeObserver re-sync after content rebuilds, the
 * display:contents client-box fallback, and the immediate first-frame paint.
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { SkeletonWebGL } from '@core/utils/canvas/loaders/skeleton-webgl.js'
import { measureSkeleton } from '@core/utils/canvas/loaders/skeleton/measure.js'
import { skeletonRenderer } from '@core/utils/canvas/loaders/skeleton/renderer.js'
import { createMockGL, createMock2D } from '@tests/fixtures/mock-webgl.js'
import { SKELETON_CLASSES } from '@core/tokens/classes/skeleton.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { WEBGL_STRINGS } from '@core/tokens/strings/webgl.js'

let mockGL
let mock2D
let origGetContext

beforeEach(() => {
  mockGL = createMockGL()
  mock2D = createMock2D()

  const proto = window.HTMLCanvasElement?.prototype || HTMLCanvasElement.prototype

  origGetContext = proto.getContext

  proto.getContext = function patchedGetContext(type) {
    if (String(type) === WEBGL_STRINGS.CONTEXT_2D) return mock2D
    if (/webgl/i.test(String(type))) return mockGL

    return null
  }
})

afterEach(() => {
  const proto = window.HTMLCanvasElement?.prototype || HTMLCanvasElement.prototype

  proto.getContext = origGetContext
})

const makeHost = (rect = { left: 0, top: 0, width: 400, height: 300 }) => {
  const host = document.createElement(HTML_TAGS.DIV)
  const root = document.createElement(HTML_TAGS.DIV)
  const content = document.createElement(HTML_TAGS.DIV)

  host.getBoundingClientRect = () => rect

  root.appendChild(content)
  host.appendChild(root)
  document.body.appendChild(host)

  return { host, root, content }
}

const makeSkel = (rect) => {
  const el = document.createElement(HTML_TAGS.DIV)

  el.className = SKELETON_CLASSES.SKELETON_BLOCK
  el.getBoundingClientRect = () => rect

  return el
}

describe('skeleton measure tails', () => {
  test('rects are clipped to the host box so the canvas cannot bleed into siblings', () => {
    const { host, root, content } = makeHost()

    Object.defineProperty(host, 'clientWidth', { value: 400, configurable: true })
    Object.defineProperty(host, 'clientHeight', { value: 300, configurable: true })

    const layer = new SkeletonWebGL(host, root, content)

    layer.base = [0.1, 0.1, 0.1]
    layer.ink = [0.9, 0.9, 0.9]

    const overflow = makeSkel({ left: 300, top: 200, width: 400, height: 400 })
    const outside = makeSkel({ left: -500, top: -500, width: 100, height: 40 })

    content.appendChild(overflow)
    content.appendChild(outside)

    layer.refresh()

    expect(layer.rects).toHaveLength(1)
    expect(layer.rects[0].x).toBe(300)
    expect(layer.rects[0].y).toBe(200)
    expect(layer.rects[0].w).toBe(100)
    expect(layer.rects[0].h).toBe(100)

    layer.destroy()
    host.remove()
  })

  test('host border offsets shift rects into padding-box coordinates', () => {
    const { host, root, content } = makeHost()

    Object.defineProperty(host, 'clientLeft', { value: 5, configurable: true })
    Object.defineProperty(host, 'clientTop', { value: 7, configurable: true })
    Object.defineProperty(host, 'clientWidth', { value: 390, configurable: true })
    Object.defineProperty(host, 'clientHeight', { value: 286, configurable: true })

    const layer = new SkeletonWebGL(host, root, content)

    layer.base = [0.1, 0.1, 0.1]
    layer.ink = [0.9, 0.9, 0.9]

    content.appendChild(makeSkel({ left: 15, top: 27, width: 100, height: 40 }))

    layer.refresh()

    expect(layer.rects[0].x).toBe(10)
    expect(layer.rects[0].y).toBe(20)

    layer.destroy()
    host.remove()
  })

  test('display:contents hosts fall back to the border box for clipping', () => {
    const { host, root, content } = makeHost()

    Object.defineProperty(host, 'clientWidth', { value: 0, configurable: true })
    Object.defineProperty(host, 'clientHeight', { value: 0, configurable: true })

    const layer = new SkeletonWebGL(host, root, content)

    layer.base = [0.1, 0.1, 0.1]
    layer.ink = [0.9, 0.9, 0.9]

    content.appendChild(makeSkel({ left: 10, top: 20, width: 100, height: 40 }))

    layer.refresh()

    expect(layer.rects).toHaveLength(1)
    expect(layer.rects[0].w).toBe(100)

    layer.destroy()
    host.remove()
  })

  test('observer set re-syncs to live placeholders after a content rebuild', () => {
    const observed = []
    const unobserved = []

    globalThis.ResizeObserver = class {
      constructor(cb) {
        this.cb = cb
      }
      observe(el) {
        observed.push(el)
      }
      unobserve(el) {
        unobserved.push(el)
      }
      disconnect() {}
    }

    const { host, root, content } = makeHost()
    const stale = makeSkel({ left: 0, top: 0, width: 100, height: 40 })

    content.appendChild(stale)

    const layer = new SkeletonWebGL(host, root, content)

    layer.base = [0.1, 0.1, 0.1]
    layer.ink = [0.9, 0.9, 0.9]

    const fresh = makeSkel({ left: 0, top: 0, width: 100, height: 40 })

    content.replaceChildren(fresh)

    layer.refresh()

    expect(unobserved).toContain(stale)
    expect(observed).toContain(fresh)

    // Second measure with the same live node keeps the observation and hits
    // the style-cache warm path instead of re-reading computed styles.
    observed.length = 0

    layer.refresh()

    expect(observed).not.toContain(fresh)

    delete globalThis.ResizeObserver

    layer.destroy()
    host.remove()
  })

  test('the first frame paints immediately instead of waiting for the idle loop', () => {
    const themeSpy = jest
      .spyOn(SkeletonWebGL.prototype, '_sampleTheme')
      .mockImplementation(function mockTheme() {
        this.base = [0.1, 0.1, 0.1]
        this.ink = [0.9, 0.9, 0.9]
        this.inkAlpha = 1
      })
    const drawSpy = jest.spyOn(skeletonRenderer, 'draw')

    const { host, root, content } = makeHost()

    content.appendChild(makeSkel({ left: 0, top: 0, width: 100, height: 40 }))

    const layer = new SkeletonWebGL(host, root, content)

    expect(layer.useWebGL).toBe(true)
    expect(drawSpy).toHaveBeenCalled()

    drawSpy.mockRestore()
    themeSpy.mockRestore()

    layer.destroy()
    host.remove()
  })

  test('measure guards skip dead, host-less, and resolving layers', () => {
    expect(measureSkeleton({ useWebGL: false })).toBeUndefined()
    expect(measureSkeleton({ useWebGL: true, host: null })).toBeUndefined()
    expect(measureSkeleton({ useWebGL: true, host: {}, resolveStart: 1 })).toBeUndefined()
  })

  test('measure no-ops on empty content and a missing canvas', () => {
    const { host, root, content } = makeHost()
    const layer = new SkeletonWebGL(host, root, content)

    layer.base = [0.1, 0.1, 0.1]
    layer.ink = [0.9, 0.9, 0.9]

    layer.refresh()

    expect(layer.rects).toHaveLength(0)

    layer.canvas = null

    content.appendChild(makeSkel({ left: 0, top: 0, width: 100, height: 40 }))

    layer.refresh()

    expect(layer.rects).toHaveLength(0)

    layer.destroy()
    host.remove()
  })

  test('text placeholders derive rows from line-height and glyph cells', () => {
    const realCompute = globalThis.getComputedStyle

    globalThis.getComputedStyle = (el) => ({
      ...realCompute(el),
      lineHeight: '16px',
      borderTopLeftRadius: '0px',
      getPropertyValue: () => '',
    })

    const { host, root, content } = makeHost()

    Object.defineProperty(host, 'clientWidth', { value: 400, configurable: true })
    Object.defineProperty(host, 'clientHeight', { value: 300, configurable: true })

    const layer = new SkeletonWebGL(host, root, content)

    layer.base = [0.1, 0.1, 0.1]
    layer.ink = [0.9, 0.9, 0.9]

    // PARA_FULL matches the text-like selector; height > lh * 1.4 → row = lh.
    const para = makeSkel({ left: 0, top: 0, width: 100, height: 30 })

    para.className = SKELETON_CLASSES.SKELETON_PARA_FULL

    // Small height picks the glyph path without the text-like selector.
    const small = makeSkel({ left: 0, top: 40, width: 100, height: 20 })

    // Tall block stays media (isText false → row 0, media cell).
    const media = makeSkel({ left: 0, top: 70, width: 100, height: 200 })

    // Zero-height text-like node → row falls through `row || r.height`.
    const emptyPara = makeSkel({ left: 0, top: 275, width: 100, height: 0 })

    emptyPara.className = SKELETON_CLASSES.SKELETON_PARA_FULL

    // Zero-height non-text node → `r.height > 0` fails isText.
    const emptyBlock = makeSkel({ left: 120, top: 275, width: 100, height: 0 })

    content.appendChild(para)
    content.appendChild(small)
    content.appendChild(media)
    content.appendChild(emptyPara)
    content.appendChild(emptyBlock)

    layer.refresh()

    expect(layer.rects).toHaveLength(3)
    expect(layer.rects[0].row).toBe(16)
    expect(layer.rects[1].row).toBe(20)
    expect(layer.rects[2].row).toBe(0)

    globalThis.getComputedStyle = realCompute

    layer.destroy()
    host.remove()
  })

  test('a zero devicePixelRatio falls back to one for backing size', () => {
    const origDpr = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio')

    Object.defineProperty(window, 'devicePixelRatio', { value: 0, configurable: true })

    const { host, root, content } = makeHost()

    content.appendChild(makeSkel({ left: 0, top: 0, width: 100, height: 40 }))

    const layer = new SkeletonWebGL(host, root, content)

    layer.base = [0.1, 0.1, 0.1]
    layer.ink = [0.9, 0.9, 0.9]

    layer.refresh()

    expect(layer.dpr).toBe(1)

    if (origDpr) {
      Object.defineProperty(window, 'devicePixelRatio', origDpr)
    } else {
      delete window.devicePixelRatio
    }

    layer.destroy()
    host.remove()
  })
})
