/**
 * @file media-figure-image-load-tails.test.js
 * @description Coverage tails for safari/patches/media-figure/image-load.ts —
 * safariLoadHighRes's detached-successor guard inside the load callback and
 * the already-decoded shortcut (complete && naturalWidth > 0) that skips the
 * async wait after the Q50 clone takes over.
 */
import { describe, test, expect } from '@jest/globals'
import {
  bindSafariImageLoad,
  safariLoadHighRes,
} from '@core/safari/patches/media-figure/image-load.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { MEDIA_CLASSES } from '@core/tokens/classes/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'

/**
 * Builds a patchable figure stub whose shadow lookup resolves the high layer
 * and thumbnail img, hosted inside `container` (attached or detached).
 */
const makeEl = (container) => {
  const highEl = document.createElement(HTML_TAGS.IMG)
  const thumb = document.createElement(HTML_TAGS.IMG)

  highEl.classList.add(MEDIA_CLASSES.RENDER_MEDIA_HIGH)
  thumb.classList.add(MEDIA_CLASSES.RENDER_MEDIA_THUMB)
  container.appendChild(highEl)
  container.appendChild(thumb)

  return {
    isVideo: false,
    isLoaded: false,
    mediaSrc: 'cover',
    highResSrc: '',
    highEl,
    thumb,
    $: (sel) =>
      sel.includes(MEDIA_CLASSES.RENDER_MEDIA_HIGH)
        ? highEl
        : sel.includes(MEDIA_CLASSES.RENDER_MEDIA_THUMB)
          ? thumb
          : null,
  }
}

describe('safariLoadHighRes tails', () => {
  test('a successor whose frame detached before load bails without mutating', () => {
    const container = document.createElement(HTML_TAGS.DIV)
    const el = makeEl(container)

    safariLoadHighRes(el)

    const successor = el.highEl.nextElementSibling

    successor.onload()

    expect(el.isLoaded).toBe(true)
    expect(successor.classList.contains(MEDIA_CLASSES.RENDER_MEDIA_LOADED)).toBe(false)
    expect(el.highEl.parentNode).toBe(container)
    expect(el.thumb.style.display).not.toBe(ATTR_VALUES.NONE)
  })

  test('an already-decoded successor finishes synchronously', () => {
    const container = document.createElement(HTML_TAGS.DIV)

    document.body.appendChild(container)

    const el = makeEl(container)
    const origClone = el.highEl.cloneNode.bind(el.highEl)

    // Seed the clone as decoded — happy-dom images report complete=true but
    // naturalWidth=0, so the decode flag is pinned on the instance.
    el.highEl.cloneNode = () => {
      const successor = origClone(false)

      Object.defineProperty(successor, 'naturalWidth', { value: 600, configurable: true })

      return successor
    }

    safariLoadHighRes(el)

    const successor = container.querySelector(`.${MEDIA_CLASSES.RENDER_MEDIA_HIGH}`)

    expect(el.isLoaded).toBe(true)
    expect(successor).not.toBe(el.highEl)
    expect(successor.classList.contains(MEDIA_CLASSES.RENDER_MEDIA_LOADED)).toBe(true)
    expect(el.highEl.isConnected).toBe(false)
    expect(el.thumb.style.display).toBe(ATTR_VALUES.NONE)

    container.remove()
  })

  test('safariLoadHighRes falls back to _updateDom on a mounted el with no high layer', () => {
    const container = document.createElement(HTML_TAGS.DIV)
    const el = makeEl(container)

    el._isMounted = true

    let updated = 0

    el._updateDom = () => {
      updated++
    }

    // No .render-media-high in shadow — the clone path is skipped and the
    // mounted-else arm reloads the DOM directly.
    el.$ = () => null

    safariLoadHighRes(el)

    expect(el.isLoaded).toBe(true)
    expect(updated).toBe(1)
  })

  test('bindSafariImageLoad skips the lazy thumb and covers observer-callback arms', () => {
    let ioCb

    globalThis.IntersectionObserver = class {
      constructor(cb) {
        ioCb = cb
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    const el = document.createElement(HTML_TAGS.DIV)

    el.isVideo = false
    el.isLoaded = false
    el.imgObserver = null
    el.$ = () => null // no thumb — the `thumb && !isHero` else arm

    bindSafariImageLoad(el, null, false)

    expect(el.imgObserver).not.toBeNull()

    // Non-intersecting entry — `entry.isIntersecting` false arm.
    ioCb([{ isIntersecting: false, target: el }])

    // Intersecting entry while the observer was already released — the
    // inner `el.imgObserver` null arm.
    el.imgObserver = null

    ioCb([{ isIntersecting: true, target: el }])
  })
})
