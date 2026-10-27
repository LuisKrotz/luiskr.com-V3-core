/**
 * @file safari/patches/carousel-media.ts
 * @description Carousel-hosted media overrides for iOS/Safari — WebKit
 * never resolves loading="lazy" images or IntersectionObserver callbacks
 * for content painted inside the carousel's horizontally-scrolled,
 * transform-driven track behind nested shadow roots, so every slide
 * stayed an empty box on iOS. Three isolated workarounds (the whole
 * module only runs inside the Safari bundle):
 *   - patchCarouselMedia() wraps each carousel element's _updateDom so
 *     every <img> painted into its shadow root (pattern backdrops,
 *     awards slides) is forced to eager loading on every re-render.
 *   - isCarouselHosted() detects a media-figure mounted inside a
 *     carousel by reading the shadow root's host tag.
 *   - eagerizeCarouselFigure() gives carousel-hosted figures an eager
 *     thumbnail plus an immediate Q50 swap — no lazy/IO dependency.
 */

import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { MEDIA_CLASSES } from '@core/tokens/classes/media.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { deepQuerySelectorAll } from '@core/utils/dom.js'
import type { PatchableCtor, SafariPatchableEl } from '../types.js'

/**
 * Whether a media-figure is hosted inside a carousel — the figure's
 * shadow root is owned by the slide, so the *element's* root node is the
 * carousel's own shadow tree and `host` is the carousel element.
 * @param el The media-figure element being mounted.
 * @returns true when the figure lives inside <custom-carousel> or
 * <awards-carousel>.
 */
export const isCarouselHosted = (el: SafariPatchableEl): boolean => {
  if (typeof ShadowRoot === TYPE_STRINGS.UNDEFINED) return false

  // Walk the COMPOSED tree — parentElement within a shadow tree, then
  // across each shadow boundary via getRootNode().host — so figures are
  // detected whether they sit directly in the carousel's shadow root,
  // nested inside a slide wrapper, or slotted from the view's light DOM
  // (a slotted figure's root node is the VIEW's root, not the
  // carousel's — a host-tag-only check misses those and leaves them on
  // the lazy/IO path iOS silently drops inside the transformed track).
  let node: Element | null = el as unknown as Element

  while (node) {
    if (
      node.localName === COMPONENT_TAGS.CUSTOM_CAROUSEL ||
      node.localName === COMPONENT_TAGS.AWARDS_CAROUSEL
    )
      return true

    // parentElement climbs within the same tree; at a shadow-root edge
    // (direct child — parentElement is null) the composed parent is the
    // host element, reached via getRootNode().host.
    const parent: Element | null = node.parentElement

    if (parent) {
      node = parent

      continue
    }

    const root = node.getRootNode?.()

    node = root instanceof ShadowRoot ? (root.host as Element) : null
  }

  return false
}

/**
 * Eager image path for carousel-hosted figures: flip the thumbnail to
 * loading="eager" (lazy never fires for iOS WebKit inside the scrolled
 * track) and kick the Q50 high-res swap immediately instead of waiting
 * on the IntersectionObserver Safari silently drops. The `$` call is
 * optional-chained because the retroactive pass can encounter
 * not-yet-upgraded media-figure elements.
 * @param el The carousel-hosted media-figure.
 */
export const eagerizeCarouselFigure = (el: SafariPatchableEl): void => {
  const thumb = el.$?.(`.${MEDIA_CLASSES.RENDER_MEDIA_THUMB}`) as HTMLImageElement | null

  if (thumb) {
    thumb.setAttribute(MEDIA_ATTRS.LOADING, MEDIA_ATTRS.LOADING_EAGER)

    // iOS WebKit snapshots the lazy/eager decision at parse time — an
    // <img> painted with loading="lazy" inside the transform track keeps
    // its deferred fetch even after the attribute flips. Re-assigning
    // src is a no-op for the URL but forces the loader to re-evaluate
    // under the new eager policy, unpinning slides stuck on the skeleton.
    const src = thumb.getAttribute('src')

    if (src) thumb.src = src
  }

  el.loadHighRes?.()
}

/**
 * Eager pass over one carousel's shadow tree: flips every painted <img>
 * to loading="eager" (custom-carousel's mirrored pattern backdrops and
 * awards-carousel's lazy slide images alike) and eagerly arms every
 * media-figure inside — covering figures that mounted before the
 * MediaFigure onMounted patch could observe them. safariLoadHighRes
 * early-returns once isLoaded, so repeat passes on re-render are cheap
 * nudges, not duplicate loads.
 * @param host The carousel element whose shadow tree is scanned.
 */
const eagerizeShadowTree = (host: SafariPatchableEl): void => {
  // deepQuerySelectorAll pierces nested shadow roots; running it on both
  // the shadow tree and the host element also covers slotted light-DOM
  // slides — a shallow shadowRoot scan misses <img>s inside slide
  // wrappers' own shadows and slotted slides entirely.
  const imgs = deepQuerySelectorAll(HTML_TAGS.IMG, host.shadowRoot)

  imgs.push(...deepQuerySelectorAll(HTML_TAGS.IMG, host))

  imgs.forEach((img) => {
    img.setAttribute(MEDIA_ATTRS.LOADING, MEDIA_ATTRS.LOADING_EAGER)

    // Same parse-time lazy snapshot as eagerizeCarouselFigure — re-set
    // src so Safari re-evaluates the request under the eager policy.
    const src = img.getAttribute('src')

    if (src) (img as HTMLImageElement).src = src
  })

  // Same two-surface sweep for figures — a slotted figure sits in the
  // host's light DOM, a nested one inside a slide's shadow.
  deepQuerySelectorAll(COMPONENT_TAGS.MEDIA_FIGURE, host.shadowRoot)
    .concat(deepQuerySelectorAll(COMPONENT_TAGS.MEDIA_FIGURE, host))
    .forEach((fig) => eagerizeCarouselFigure(fig as SafariPatchableEl))
}

/**
 * Wraps a carousel element's _updateDom so every <img> painted into its
 * own shadow root is forced to eager loading on every re-render.
 * Elements already in the DOM upgrade synchronously inside the
 * customElements.define() call — before this whenDefined() microtask
 * installs the wrap — so a shadow-piercing retroactive pass (deep*
 * queries cross the nested view shadow roots) flips anything painted
 * in that window. Figures mounted later are handled per-mount via
 * eagerizeCarouselFigure() inside the MediaFigure onMounted patch.
 * @param tag Custom-element tag name to wrap.
 */
const eagerizeShadowImages = (tag: string): void => {
  customElements.whenDefined(tag).then(() => {
    const CarouselClass = customElements.get(tag) as PatchableCtor | undefined

    if (!CarouselClass) return

    const originalUpdateDom = CarouselClass.prototype._updateDom as () => void

    CarouselClass.prototype._updateDom = function (this: SafariPatchableEl) {
      originalUpdateDom.call(this)

      eagerizeShadowTree(this)
    }

    for (const host of deepQuerySelectorAll(tag) as SafariPatchableEl[]) {
      eagerizeShadowTree(host)
    }
  })
}

/**
 * Installs the eager-image wrap on both carousel elements — see
 * eagerizeShadowImages for the mechanics.
 */
export function patchCarouselMedia(): void {
  eagerizeShadowImages(COMPONENT_TAGS.CUSTOM_CAROUSEL)

  eagerizeShadowImages(COMPONENT_TAGS.AWARDS_CAROUSEL)
}
