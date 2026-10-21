/**
 * @file safari-patch-safari-patch-carouselmedia-patch.test.js
 * @description Carousel-hosted media overrides — isCarouselHosted shadow-host
 * detection, eagerizeCarouselFigure's eager thumb + immediate Q50 swap,
 * the _updateDom de-lazy wrap on <custom-carousel>, and the carousel
 * branch inside bindSafariImageLoad.
 */
import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals'
import '@website/components/carousel/CustomCarousel.js'
import '@website/components/media/MediaFigure.js'
import '@website/components/media/MediaExpanded.js'
import '@website/views/project/Project.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { MEDIA_CLASSES } from '@core/tokens/classes/media.js'
import {
  isCarouselHosted,
  eagerizeCarouselFigure,
  patchCarouselMedia,
} from '@core/safari/patches/carousel-media.js'
import { bindSafariImageLoad } from '@core/safari/patches/media-figure/image-load.js'

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

/** Hosts a stub element inside `tag`'s own shadow root — the carousel context. */
const shadowHostedEl = (tag) => {
  const host = document.createElement(tag)
  const sr = host.shadowRoot || host.attachShadow({ mode: 'open' })

  const inner = document.createElement(HTML_TAGS.DIV)

  sr.appendChild(inner)

  return inner
}

describe('safari-patch — carousel media', () => {
  describe('isCarouselHosted', () => {
    test('light-DOM element is not carousel-hosted', () => {
      const el = document.createElement(HTML_TAGS.DIV)

      document.body.appendChild(el)
      expect(isCarouselHosted(el)).toBe(false)
      el.remove()
    })

    test('element inside a non-carousel shadow root is not hosted', () => {
      const inner = shadowHostedEl(HTML_TAGS.DIV)

      expect(isCarouselHosted(inner)).toBe(false)
    })

    test('element inside <custom-carousel> shadow root is hosted', () => {
      const inner = shadowHostedEl(COMPONENT_TAGS.CUSTOM_CAROUSEL)

      expect(isCarouselHosted(inner)).toBe(true)
    })

    test('element inside <awards-carousel> shadow root is hosted', () => {
      const inner = shadowHostedEl(COMPONENT_TAGS.AWARDS_CAROUSEL)

      expect(isCarouselHosted(inner)).toBe(true)
    })

    test('missing ShadowRoot constructor reports not hosted', () => {
      const prev = globalThis.ShadowRoot

      delete globalThis.ShadowRoot

      try {
        expect(isCarouselHosted({ getRootNode: () => document })).toBe(false)
      } finally {
        globalThis.ShadowRoot = prev
      }
    })
  })

  describe('eagerizeCarouselFigure', () => {
    test('flips the thumbnail to eager and fires the Q50 swap', () => {
      const thumb = document.createElement(HTML_TAGS.IMG)
      const loadHighRes = jest.fn()
      const el = { $: () => thumb, loadHighRes }

      eagerizeCarouselFigure(el)

      expect(thumb.getAttribute(MEDIA_ATTRS.LOADING)).toBe(MEDIA_ATTRS.LOADING_EAGER)
      expect(loadHighRes).toHaveBeenCalled()
    })

    test('re-sets a parsed src so WebKit re-evaluates under the eager policy', () => {
      const thumb = document.createElement(HTML_TAGS.IMG)

      thumb.setAttribute('src', '/covers/unit-thumb.jpg')

      const loadHighRes = jest.fn()

      eagerizeCarouselFigure({ $: () => thumb, loadHighRes })

      // The attr value is untouched — the re-assignment lands on the
      // resolved property, which forces the deferred fetch to re-arm.
      expect(thumb.getAttribute('src')).toBe('/covers/unit-thumb.jpg')
      expect(thumb.src).toContain('unit-thumb.jpg')
      expect(loadHighRes).toHaveBeenCalled()
    })

    test('still fires the swap when the thumbnail is absent', () => {
      const loadHighRes = jest.fn()

      eagerizeCarouselFigure({ $: () => null, loadHighRes })

      expect(loadHighRes).toHaveBeenCalled()
    })

    test('tolerates a figure without loadHighRes', () => {
      expect(() => eagerizeCarouselFigure({ $: () => null })).not.toThrow()
    })

    test('tolerates an unupgraded element with no $ method', () => {
      expect(() => eagerizeCarouselFigure({})).not.toThrow()
    })
  })

  describe('patchCarouselMedia', () => {
    test('reinstalling wraps _updateDom so painted imgs go eager', async () => {
      patchCarouselMedia()

      await new Promise((resolve) => setTimeout(resolve, 20))

      const el = document.createElement(COMPONENT_TAGS.CUSTOM_CAROUSEL)

      document.body.appendChild(el)

      await new Promise((resolve) => setTimeout(resolve, 20))

      const img = document.createElement(HTML_TAGS.IMG)

      img.setAttribute(MEDIA_ATTRS.LOADING, MEDIA_ATTRS.LOADING_LAZY)
      img.setAttribute('src', '/covers/unit-slide.jpg')
      el.shadowRoot.appendChild(img)

      el._updateDom()

      expect(img.getAttribute(MEDIA_ATTRS.LOADING)).toBe(MEDIA_ATTRS.LOADING_EAGER)
      expect(img.src).toContain('unit-slide.jpg')

      el.remove()
    })

    test('a null shadowRoot skips the eager pass cleanly', () => {
      expect(() =>
        cls(COMPONENT_TAGS.CUSTOM_CAROUSEL).prototype._updateDom.call({ shadowRoot: null })
      ).not.toThrow()
    })

    test('retro pass flips imgs + arms figures painted before install', async () => {
      const host = document.createElement(HTML_TAGS.DIV)
      const sr = host.attachShadow({ mode: 'open' })
      const el = document.createElement(COMPONENT_TAGS.CUSTOM_CAROUSEL)

      sr.appendChild(el)
      document.body.appendChild(host)

      await new Promise((resolve) => setTimeout(resolve, 20))

      const img = document.createElement(HTML_TAGS.IMG)
      const fig = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)
      const loadHighRes = jest.fn()

      img.setAttribute(MEDIA_ATTRS.LOADING, MEDIA_ATTRS.LOADING_LAZY)
      fig.loadHighRes = loadHighRes
      el.shadowRoot.appendChild(img)
      el.shadowRoot.appendChild(fig)

      patchCarouselMedia()

      await new Promise((resolve) => setTimeout(resolve, 20))

      expect(img.getAttribute(MEDIA_ATTRS.LOADING)).toBe(MEDIA_ATTRS.LOADING_EAGER)
      expect(loadHighRes).toHaveBeenCalled()

      host.remove()
    })
  })

  describe('bindSafariImageLoad carousel branch', () => {
    test('carousel-hosted figure takes the eager path and skips the observer', () => {
      const inner = shadowHostedEl(COMPONENT_TAGS.CUSTOM_CAROUSEL)
      const loadHighRes = jest.fn()
      const thumb = document.createElement(HTML_TAGS.IMG)
      const el = {
        getRootNode: () => inner.getRootNode(),
        $: (sel) => (sel.includes(MEDIA_CLASSES.RENDER_MEDIA_THUMB) ? thumb : null),
        loadHighRes,
        isVideo: false,
        isLoaded: false,
      }

      bindSafariImageLoad(el, null, false)

      expect(thumb.getAttribute(MEDIA_ATTRS.LOADING)).toBe(MEDIA_ATTRS.LOADING_EAGER)
      expect(loadHighRes).toHaveBeenCalled()
      expect(el.imgObserver).toBeUndefined()
    })
  })
})
