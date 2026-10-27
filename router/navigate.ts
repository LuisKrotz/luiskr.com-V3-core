/**
 * @file routes/navigate.ts — the navigation pipeline: resolve → before
 * hooks (redirect-capable) → history push/replace → title + canonical
 * sync → scroll (to the meta.scrollTo marker or top) → after hooks →
 * subscriber notification.
 */

import { BASE_TITLE } from '@core/tokens/routes.js'
import { LINK_ATTRS } from '@core/tokens/attrs/link.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { VIEW_TAGS } from '@core/tokens/elements/views.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { DOM_STRINGS } from '@core/tokens/strings/dom.js'
import { NET_STRINGS } from '@core/tokens/strings/net.js'
import { QUERY_STRINGS } from '@core/tokens/strings/queries.js'
import { ROUTE_STRINGS } from '@core/tokens/strings/routes.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { SPACE } from '@core/tokens/layout/space.js'
import { deepQuerySelector } from '@core/utils/dom.js'
import { notifyLoadFailed } from '@core/utils/notify.js'
import { generateRouteSchema, updateJsonLd, setRobotsMeta } from '@core/utils/schema.js'
import { syncEarthShare, syncStarShare, cancelShare } from '@core/utils/share-gallery.js'
import { ROUTE_NAMES } from '@core/tokens/routes/names.js'
import { parsePath } from '@core/router/parse-path.js'
import type { RouteDescriptor } from '@core/router/types.js'
import type { Router } from '@core/router/router.js'

/** ms to wait before scrolling to an anchored route's marker element. */
const ANCHOR_SCROLL_DELAY = 300

/**
 * The CMS is a separate document/app (cms/index.html) — /cms and /admin
 * are hard navigations so the CMS boots in isolation. In production the
 * firebase.json rewrites cover this; in dev Vite resolves /cms to the
 * CMS document directly. The clean /cms path keeps index.html out of the
 * address bar — the rewrite stays internal to hosting.
 */
function isCmsPath(path: string): boolean {
  const firstSeg = path.split(CHAR_STRINGS.SLASH).filter(Boolean)[0]

  return firstSeg === ROUTE_STRINGS.CMS || firstSeg === ROUTE_STRINGS.ADMIN
}

/**
 * Writes `content` into one head <meta> selected by `selector`; no-ops when
 * absent. Exported for views that resolve their title asynchronously
 * (project data lands after navigation) and must keep the social mirrors
 * in step.
 */
export const setMetaContent = (selector: string, content: string): void => {
  const el = document.querySelector<HTMLMetaElement>(selector)

  if (el) el.content = content
}

/**
 * Pushes a resolved description into every description-bearing head meta —
 * description, og:description, twitter:description, DC.Description and
 * og:image:alt (the share card's alt text mirrors the snippet). Views call
 * this after their localized content node resolves, since route parsing
 * runs before the per-locale data chunks land.
 */
export function setMetaDescription(text: string): void {
  if (!text) return

  for (const selector of [
    QUERY_STRINGS.META_DESCRIPTION,
    QUERY_STRINGS.META_OG_DESCRIPTION,
    QUERY_STRINGS.META_TW_DESCRIPTION,
    QUERY_STRINGS.META_DC_DESCRIPTION,
    QUERY_STRINGS.META_OG_IMAGE_ALT,
  ]) {
    setMetaContent(selector, text)
  }
}

/**
 * document.title + canonical <link> sync for the resolved route — extended
 * to the social/url mirrors (og:title, twitter:title, DC.Title, og:url,
 * twitter:url) so every head tag agrees with the active route instead of
 * keeping the homepage values the shell booted with. `meta.canonical`
 * normalizes alias URLs (e.g. /portfolio/brazilian-leather → /portfolio/cicb);
 * `meta.description` feeds the description metas via setMetaDescription.
 */
export function syncDocumentHead(to: RouteDescriptor): void {
  const title = String(to.meta.title || BASE_TITLE)

  document.title = title

  for (const selector of [
    QUERY_STRINGS.META_OG_TITLE,
    QUERY_STRINGS.META_TW_TITLE,
    QUERY_STRINGS.META_DC_TITLE,
  ]) {
    setMetaContent(selector, title)
  }

  let canonicalEl = document.querySelector(QUERY_STRINGS.LINK_CANONICAL)

  if (!canonicalEl) {
    canonicalEl = document.createElement(HTML_TAGS.LINK)

    canonicalEl.setAttribute(DOM_STRINGS.REL, DOM_STRINGS.REL_CANONICAL)

    document.head.appendChild(canonicalEl)
  }

  const cleanPath = to.path === ROUTE_PATHS.ROOT ? CHAR_STRINGS.EMPTY : to.path

  // Root keeps the trailing slash — sitemap.xml and the prerendered
  // documents all declare `https://luiskr.com/`.
  const canonicalUrl = `${NET_STRINGS.SITE_URL}${to.meta.canonical || cleanPath || ROUTE_PATHS.ROOT}`

  canonicalEl.setAttribute(LINK_ATTRS.HREF, canonicalUrl)

  setMetaContent(QUERY_STRINGS.META_OG_URL, canonicalUrl)

  setMetaContent(QUERY_STRINGS.META_TW_URL, canonicalUrl)

  if (to.meta.description) setMetaDescription(to.meta.description)

  // Indexation discipline — every navigation resets the robots meta so a
  // stale noindex can never leak onto an indexable route, then re-arms it
  // for the not-found route. Views re-assert noindex post-fetch when a
  // deep-link slug fails to resolve (media/body) or a project is a draft.
  setRobotsMeta(to.name === ROUTE_NAMES.NOT_FOUND)

  updateJsonLd(buildRouteJsonLd(to, canonicalUrl))

  // Playground share rotation — every earth/star-field navigation draws
  // a fresh random capture from that set's build-emitted manifest into
  // the card metas and re-emits the graph with the ImageObject gallery;
  // every other route cancels it (stale picks can never leak across
  // routes).
  if (to.name === ROUTE_NAMES.EARTH_PLAYGROUND) {
    void syncEarthShare(to, canonicalUrl, (image) =>
      buildRouteJsonLd(to, canonicalUrl, undefined, image)
    )
  } else if (to.name === ROUTE_NAMES.STAR_FIELD) {
    void syncStarShare(to, canonicalUrl, (image) =>
      buildRouteJsonLd(to, canonicalUrl, undefined, image)
    )
  } else {
    cancelShare()
  }
}

/**
 * Base JSON-LD entities for a resolved route — exported so views whose
 * localized descriptions resolve post-navigation (home/about) can
 * re-emit the graph with the real description instead of the parse-time
 * fallback, and so rich views can append entities to the same base.
 * `canonicalOverride` lets syncDocumentHead pass the URL it already
 * computed for the <link canonical> so both stay identical.
 * @param to Resolved route descriptor.
 * @param canonicalOverride Canonical URL; recomputed from `to` when absent.
 * @param description Description override (post-fetch localized text).
 * @param image primaryImageOfPage override — the share-gallery rotation
 *   passes its random capture so the graph matches the card metas.
 * @returns JSON-LD entity array for updateJsonLd().
 */
export function buildRouteJsonLd(
  to: RouteDescriptor,
  canonicalOverride?: string,
  description?: string,
  image?: string
): Record<string, unknown>[] {
  const title = String(to.meta.title || BASE_TITLE)

  const titlePrefix = `${BASE_TITLE} ${CHAR_STRINGS.PIPE_SEP} `

  const pageName = title.startsWith(titlePrefix) ? title.slice(titlePrefix.length) : title

  const canonicalUrl =
    canonicalOverride ||
    `${NET_STRINGS.SITE_URL}${
      to.meta.canonical || (to.path === ROUTE_PATHS.ROOT ? CHAR_STRINGS.EMPTY : to.path)
    }`

  return generateRouteSchema({
    url: canonicalUrl,
    name: pageName,
    description: description || to.meta.description,
    lang: to.lang,
    ...(image ? { image } : {}),
    ...(to.path === ROUTE_PATHS.ROOT
      ? {}
      : {
          breadcrumb: [
            { name: BASE_TITLE, url: `${NET_STRINGS.SITE_URL}${ROUTE_PATHS.ROOT}` },
            { name: pageName, url: canonicalUrl },
          ],
        }),
  })
}

/**
 * Anchored routes (#about/#contact) wait 300ms — long enough for the
 * home view's dynamic chunk to mount its shadow DOM — then
 * deepQuerySelector pierces that shadow to find the marker element.
 * All other routes hard-reset to top so the new view doesn't inherit
 * the previous page's scroll depth.
 */
function syncScroll(to: RouteDescriptor): void {
  if (to.meta.scrollTo) {
    setTimeout(() => {
      const scrollTo = to.meta.scrollTo as string

      const el = deepQuerySelector(CHAR_STRINGS.HASH + scrollTo)

      if (el) {
        // Park the anchor below the fixed nav (top 13px + ~47px row) —
        // 4XL (89px) matches the .home-portfolio-section padding-top so
        // the scrolled-to section clears the logo/burger on every size.
        const targetY = Math.max(0, window.scrollY + el.getBoundingClientRect().top - SPACE['4XL'])

        window.scrollTo({ top: targetY, behavior: ATTR_VALUES.SMOOTH })
      }
    }, ANCHOR_SCROLL_DELAY)
  } else {
    window.scrollTo(0, 0)
  }
}

/** Runs the redirect-capable before hooks; resolves true when nav proceeds. */
async function runBeforeHooks(
  host: Router,
  to: RouteDescriptor,
  from: RouteDescriptor | null
): Promise<boolean> {
  for (const hook of host.beforeHooks) {
    const redirect = await hook(to, from)

    if (redirect) {
      if (typeof redirect === TYPE_STRINGS.STRING) {
        // Redirecting to the path already being resolved would loop
        // forever (hook → push → hook → …) — treat it as a pass-through.
        if (redirect === to.path) continue

        // Redirects replace rather than push — a rewritten entry must
        // not litter history (Chrome marks interaction-less pushes as
        // skippable, breaking back/forward semantics).
        await host.replace(redirect as string)

        return false
      }

      const redirectPath = (redirect as { path?: string }).path

      if (redirectPath) {
        if (redirectPath === to.path) continue

        await host.replace(redirectPath)

        return false
      }
    }
  }

  return true
}

/**
 * Full navigation pipeline — the space-playground chunk is preloaded
 * when navigated to, since it's excluded from the idle route warmer
 * for size.
 */
export async function handleNavigation(host: Router, path: string, replace = false): Promise<void> {
  if (isCmsPath(path)) {
    window.location.replace(ROUTE_PATHS.CMS)

    return
  }

  const to = parsePath(path)

  const from = host.currentRoute

  if (!(await runBeforeHooks(host, to, from))) return

  // History update
  if (replace) {
    window.history.replaceState({}, CHAR_STRINGS.EMPTY, path)
  } else if (window.location.pathname !== to.path) {
    window.history.pushState({}, CHAR_STRINGS.EMPTY, path)
  }

  host.currentRoute = to

  syncDocumentHead(to)

  syncScroll(to)

  // Execute after hooks
  for (const hook of host.afterHooks) {
    hook(to, from)
  }

  if (to.view === VIEW_TAGS.VIEW_SPACE_PLAYGROUND) {
    try {
      await import('@earth/SpacePlayground.js')
    } catch {
      // Chunk fetch failed (offline, stale deploy) — surface it gracefully
      // instead of leaving the user on a blank transitioning view.
      notifyLoadFailed()
    }
  }

  host.notify(to, from)
}
