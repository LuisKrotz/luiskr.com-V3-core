/**
 * @file safari-patch-safari-patch-mediafigure-patch.test.js
 * @description Split from safari-patch.test.js — covers the "safari-patch — MediaFigure patch" describe.
 */
import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals'
import '@website/components/carousel/CustomCarousel.js'
import '@website/components/media/MediaFigure.js'
import '@website/components/media/MediaExpanded.js'
import '@website/views/project/Project.js'
import store from '@core/store.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { MEDIA_CLASSES } from '@core/tokens/classes/media.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'

// The patch registers whenDefined() callbacks at module-eval — the component
// imports above ensure the tags already resolve when it installs.
beforeAll(async () => {
  await import('@core/safari/patch.js')
  await new Promise((resolve) => setTimeout(resolve, 20))
})

afterAll(() => {
  document.documentElement.classList.remove(STATE_CLASSES.IS_SAFARI)
})

const cls = (tag) => customElements.get(tag)

const _tick = () => new Promise((resolve) => setTimeout(resolve, 20))

// Bound after each module-registry reset so commits always reach the store
// instance the currently-installed prototype patches close over.
let _activeStore = store

describe('safari-patch — MediaFigure patch', () => {
  const proto = () => cls(COMPONENT_TAGS.MEDIA_FIGURE).prototype

  test('loadHighRes early-returns for video or loaded figures', () => {
    const ctx = { isVideo: true, isLoaded: false, $: () => null }
    proto().loadHighRes.call(ctx)
    expect(ctx.highResSrc).toBeUndefined()

    const ctx2 = { isVideo: false, isLoaded: true, $: () => null }
    proto().loadHighRes.call(ctx2)
    expect(ctx2.highResSrc).toBeUndefined()
  })

  test('loadHighRes still loads the Q50 variant for >4096px originals', () => {
    const ctx = {
      isVideo: false,
      isLoaded: false,
      mediaHeight: 5000,
      mediaWidth: 5000,
      mediaSrc: 'p/big',
      $: () => null,
      _isMounted: true,
      _updateDom: jest.fn(),
    }

    proto().loadHighRes.call(ctx)

    expect(ctx.highResSrc).toContain('p/big')
    expect(ctx.isLoaded).toBe(true)
    expect(ctx._updateDom).toHaveBeenCalled()
  })

  test('loadHighRes builds the Q50 storage URL and marks loaded when element exists', () => {
    // Real elements — the stacked swap clones the painted img and mounts
    // the clone as a connected sibling, so the stub needs live DOM.
    const highEl = document.createElement(HTML_TAGS.IMG)
    const host = document.createElement(HTML_TAGS.DIV)

    host.appendChild(highEl)
    document.body.appendChild(host)

    const ctx = {
      isVideo: false,
      isLoaded: false,
      mediaHeight: 100,
      mediaWidth: 100,
      mediaSrc: 'p/img',
      $: (sel) => (sel.includes(MEDIA_CLASSES.RENDER_MEDIA_HIGH) ? highEl : { style: {} }),
      _isMounted: true,
    }

    proto().loadHighRes.call(ctx)

    expect(ctx.highResSrc).toContain('p/img')

    const successor = highEl.nextElementSibling

    expect(successor).not.toBeNull()
    expect(typeof successor.onload).toBe(TYPE_STRINGS.FUNCTION)

    successor.onload()

    expect(ctx.isLoaded).toBe(true)
    expect(successor.classList.contains(MEDIA_CLASSES.RENDER_MEDIA_LOADED)).toBe(true)
    expect(highEl.isConnected).toBe(false)

    host.remove()
  })

  test('loadHighRes marks loaded via onerror when the image fails', () => {
    const highEl = document.createElement(HTML_TAGS.IMG)
    const host = document.createElement(HTML_TAGS.DIV)

    host.appendChild(highEl)
    document.body.appendChild(host)

    const ctx = {
      isVideo: false,
      isLoaded: false,
      mediaHeight: 100,
      mediaWidth: 100,
      mediaSrc: 'p/img',
      $: () => highEl,
      _isMounted: true,
    }

    proto().loadHighRes.call(ctx)

    const successor = highEl.nextElementSibling

    expect(successor).not.toBeNull()
    expect(typeof successor.onload).toBe(TYPE_STRINGS.FUNCTION)
    expect(typeof successor.onerror).toBe(TYPE_STRINGS.FUNCTION)

    successor.onerror()

    expect(ctx.isLoaded).toBe(true)
    expect(successor.isConnected).toBe(false)

    host.remove()
  })

  test('loadHighRes falls back to _updateDom when no high-res element exists', () => {
    const ctx = {
      isVideo: false,
      isLoaded: false,
      mediaHeight: 0,
      mediaWidth: 0,
      mediaSrc: 'p/img',
      $: () => null,
      _isMounted: true,
      _updateDom: jest.fn(),
    }

    proto().loadHighRes.call(ctx)
    expect(ctx.isLoaded).toBe(true)
    expect(ctx._updateDom).toHaveBeenCalled()
  })
})
