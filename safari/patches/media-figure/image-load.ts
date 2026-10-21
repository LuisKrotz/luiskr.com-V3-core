/**
 * @file safari/patches/media-figure/image-load.ts
 * @description Safari image-loading overrides for MediaFigure: a
 * loadHighRes that requests the Q50 (medium) variant instead of the
 * uncompressed source — the medium tier stays under WebKit's ~4096px
 * decode ceiling — and the lazy-thumbnail / img-observer wiring for
 * non-hero images.
 */

import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { MEDIA_CLASSES } from '@core/tokens/classes/media.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { QUERY_STRINGS } from '@core/tokens/strings/queries.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { encodeMediaUrl } from '@core/utils/media.js'
import store from '@core/store.js'
import type { SafariPatchableEl } from '../../types.js'
import { isCarouselHosted, eagerizeCarouselFigure } from '../carousel-media.js'

/**
 * Safari loadHighRes: requests the Q50 (medium) variant instead of the
 * uncompressed source — the medium tier is the decode-safe asset for
 * WebKit's ~4096px image ceiling, so every source (however large the
 * original) gets a real high-res paint instead of a permanent thumb.
 * The URL is emission-encoded exactly like load.ts's path — raw
 * concatenation breaks on bucket keys carrying spaces/non-ASCII, which
 * Safari resolves to a 404 where Chromium tolerated the literal.
 */
export function safariLoadHighRes(el: SafariPatchableEl): void {
  if (el.isVideo || el.isLoaded) return

  const storage = store.getters.getStorage()

  const targetUrl = encodeMediaUrl(storage + el.mediaSrc + MEDIA.MOZ + MEDIA.Q50 + MEDIA.EXT)

  el.highResSrc = targetUrl

  const highEl = el.$(`.${MEDIA_CLASSES.RENDER_MEDIA_HIGH}`) as HTMLImageElement | null

  if (highEl) {
    highEl.src = targetUrl

    const onFinish = () => {
      el.isLoaded = true

      highEl.classList.add(MEDIA_CLASSES.RENDER_MEDIA_LOADED)

      const thumbEl = el.$(`.${MEDIA_CLASSES.RENDER_MEDIA_THUMB}`)

      if (thumbEl) {
        thumbEl.style.display = ATTR_VALUES.NONE
      }
    }

    if (highEl.complete && highEl.naturalWidth > 0) {
      onFinish()
    } else {
      highEl.onload = () => {
        onFinish()
      }

      highEl.onerror = () => {
        el.isLoaded = true
      }
    }
  } else if (el._isMounted) {
    el.isLoaded = true

    el._updateDom()
  }
}

/**
 * Lazy-thumbnail + img-observer wiring for non-hero images: the thumb
 * defers via loading=lazy and the Q50 swap triggers once the figure
 * scrolls within ROOT_MARGIN_50 of the viewport.
 */
export function bindSafariImageLoad(
  el: SafariPatchableEl,
  fig: Element | null,
  isHero: boolean
): void {
  // Carousel-hosted figures can't rely on the lazy thumbnail or the
  // IntersectionObserver below — iOS WebKit never fires either inside
  // the carousel track's transform context, so go fully eager instead.
  if (isCarouselHosted(el)) {
    eagerizeCarouselFigure(el)

    return
  }

  const thumb = el.$(`.${MEDIA_CLASSES.RENDER_MEDIA_THUMB}`) as HTMLImageElement | null

  if (thumb && !isHero) {
    thumb.setAttribute('loading', MEDIA_ATTRS.LOADING_LAZY)
  }

  if (isHero) {
    el.loadHighRes?.()
  }

  if (el.isVideo || el.isLoaded || isHero) return

  const target = (fig || el) as HTMLElement

  if (typeof IntersectionObserver === TYPE_STRINGS.UNDEFINED) return

  if (el.imgObserver) {
    el.imgObserver.disconnect()
  }

  el.imgObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !el.isLoaded) {
          el.loadHighRes?.()

          if (el.imgObserver) {
            el.imgObserver.disconnect()

            el.imgObserver = null
          }
        }
      })
    },
    { rootMargin: QUERY_STRINGS.ROOT_MARGIN_50, threshold: 0.01 }
  )

  el.imgObserver.observe(target)
}
