/**
 * @file utils/data/footer-links.ts
 * @description Shared footer-link helpers — the locale RSS feed URL +
 * inline glyph and the localized sitemap-page URL. Lives in utils so
 * <legal-footer> and <awards-mentions> (home) share one declaration —
 * neither component may import from the other's folder (portability).
 */

import { LOCALES } from '@core/tokens/locales.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { h } from '@core/jsx.js'
import { routeSlugs } from '@core/locale/ui-text.js'

// ── RSS glyph geometry (24×24 viewBox units) ─────────────────────────
// The canonical feed mark: a source dot in the lower-left corner and two
// concentric quarter-arcs centred on it. Each arc starts on the left edge
// (x = FEED_EDGE) and sweeps clockwise to the bottom edge (y = 24 -
// FEED_EDGE), so its radius equals the vertical drop from its start
// point: the inner arc starts at y = FEED_EDGE + FEED_GAP (radius
// 24 - 2·FEED_EDGE - FEED_GAP = 9), the outer at y = FEED_EDGE (radius 16).
const FEED_EDGE = 4
const FEED_GAP = 7
const FEED_DOT_R = 2
const FEED_FAR = 24 - FEED_EDGE
const FEED_ARCS = [FEED_FAR - FEED_EDGE - FEED_GAP, FEED_FAR - FEED_EDGE]

/** viewBox of the RSS glyph — one declaration for every consumer. */
const FEED_VIEWBOX = '0 0 24 24'

/**
 * Locale RSS feed URL — `/feed.xml` for English, `/<loc>/feed.xml`
 * otherwise; both are firebase rewrites onto the generated meta feeds.
 * @param locale active locale code
 * @returns root-relative feed path for that locale
 */
export const feedHrefFor = (locale: string): string =>
  `${locale === LOCALES.EN ? CHAR_STRINGS.EMPTY : `${CHAR_STRINGS.SLASH}${locale}`}${CHAR_STRINGS.SLASH}${ROUTE_PATHS.FEED_FILE}`

/**
 * Localized sitemap-page URL — `/<sitemap>` for English,
 * `/<loc>/<localized-slug>` otherwise; mirrors the router's canonical
 * resolution (CMS slug overrides merged over LANG_SLUGS via routeSlugs).
 * @param locale active locale code
 * @returns root-relative sitemap path for that locale
 */
export const sitemapHrefFor = (locale: string): string =>
  `${locale === LOCALES.EN ? CHAR_STRINGS.EMPTY : `${CHAR_STRINGS.SLASH}${locale}`}${CHAR_STRINGS.SLASH}${routeSlugs(locale).sitemap}`

/**
 * Localized animations-page URL — `/<animations>` for English,
 * `/<loc>/<localized-slug>` otherwise; same routeSlugs resolution as
 * the sitemap link.
 * @param locale active locale code
 * @returns root-relative animations path for that locale
 */
export const animationsHrefFor = (locale: string): string =>
  `${locale === LOCALES.EN ? CHAR_STRINGS.EMPTY : `${CHAR_STRINGS.SLASH}${locale}`}${CHAR_STRINGS.SLASH}${routeSlugs(locale).animations}`

/**
 * Inline RSS glyph — decorative (`aria-hidden`, the anchor's visible text
 * carries the accessible name). Paints in currentColor so it inherits the
 * link ink in every theme; the arcs carry the wave class that pulses them
 * outward on hover/focus (reduced-motion aware in each consumer's SCSS).
 * @param iconClass class token for the <svg> element
 * @param waveClass class token applied to each broadcast-arc <path>
 * @returns the SVG element
 */
export const feedGlyph = (iconClass: string, waveClass: string): SVGElement =>
  h(
    'svg',
    {
      className: iconClass,
      viewBox: FEED_VIEWBOX,
      'aria-hidden': ATTR_VALUES.TRUE,
      focusable: ATTR_VALUES.FALSE,
    },
    h('circle', {
      cx: FEED_EDGE + FEED_DOT_R,
      cy: FEED_FAR - FEED_DOT_R,
      r: FEED_DOT_R,
    }),
    FEED_ARCS.map((r) =>
      h('path', {
        className: waveClass,
        d: `M${FEED_EDGE} ${FEED_FAR - r}a${r} ${r} 0 0 1 ${r} ${r}`,
      })
    )
  ) as SVGElement
