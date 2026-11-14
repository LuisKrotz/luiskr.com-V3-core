/**
 * @file router/playground.ts
 * @description Playground-experiment route predicates — earth-playground
 * and star-field are dark-only experiment surfaces: the theme resolver
 * (store/mutations/theme.ts) forces dark while one is active and the
 * preferences dialog hides theme switching there, so both share these
 * checks instead of re-deriving slug sets.
 *
 * Pure by contract: reads `window.location` only when no pathname is
 * passed and never imports the router singleton — `core/store` can
 * consume it without a store → router → store module cycle.
 */

import { LANG_SLUGS } from '@core/locale/lang-slugs.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { ROUTE_NAMES } from '@core/tokens/routes/names.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'

/**
 * Pre-computed set of every locale's localized earth-playground slug —
 * O(1) membership tests on the last URL segment (the route resolver may
 * not have run when a consumer first checks), so all locales' slugs are
 * flattened once at module load rather than re-built per call.
 */
const _EARTH_SLUGS = new Set(
  Object.values(LANG_SLUGS)
    .map((s) => s.earthPlayground)
    .filter(Boolean)
)

/**
 * Same slug set for the star-field experiment — a separate key so each
 * playground surface can be told apart (nav suppresses only the current
 * experiment's own menu item).
 */
const _STAR_SLUGS = new Set(
  Object.values(LANG_SLUGS)
    .map((s) => s.starField)
    .filter(Boolean)
)

/**
 * Last non-empty URL path segment — shared by the playground checks.
 * @param pathname Raw location pathname (a pre-extracted bare segment
 *  also works — it contains no `/` to split on).
 * @returns The trailing segment.
 */
const lastPathSegment = (pathname: string): string => {
  const segments = pathname.split(CHAR_STRINGS.SLASH).filter(Boolean)

  return segments[segments.length - 1]
}

/**
 * The live pathname — window-free callers (SSR, tests without a DOM)
 * resolve to '', which never matches a playground slug.
 * @returns `window.location.pathname`, or '' off-DOM.
 */
const livePath = (): string =>
  typeof window !== TYPE_STRINGS.UNDEFINED ? window.location.pathname : ATTR_VALUES.EMPTY

/**
 * True on the earth-playground route (or its space-playground alias).
 * The resolved route name is checked first — the fast path covers the
 * window before the URL's last segment re-resolves — then the last
 * segment falls back through canonical segments and every locale's
 * localized slug.
 * @param routeName Resolved route descriptor name, when the caller has one.
 * @param pathname Path to check; defaults to the live `location.pathname`.
 * @returns Whether the route is the earth playground.
 */
export function isEarthPlaygroundRoute(routeName?: string | null, pathname?: string): boolean {
  if (routeName === ROUTE_NAMES.EARTH_PLAYGROUND) return true

  const last = lastPathSegment(pathname ?? livePath())

  return (
    last === ROUTE_PATHS.EARTH_PLAYGROUND_SEGMENT ||
    last === ROUTE_PATHS.SPACE_PLAYGROUND_SEGMENT ||
    _EARTH_SLUGS.has(last)
  )
}

/**
 * True on the star-field experiment route — same resolution order as
 * {@link isEarthPlaygroundRoute}.
 * @param routeName Resolved route descriptor name, when the caller has one.
 * @param pathname Path to check; defaults to the live `location.pathname`.
 * @returns Whether the route is the star-field experiment.
 */
export function isStarFieldRoute(routeName?: string | null, pathname?: string): boolean {
  if (routeName === ROUTE_NAMES.STAR_FIELD) return true

  const last = lastPathSegment(pathname ?? livePath())

  return last === ROUTE_PATHS.STAR_FIELD_SEGMENT || _STAR_SLUGS.has(last)
}

/**
 * True on either playground-experiment route — the "force dark, no theme
 * switching" surface test the theme resolver and preferences dialog use.
 * @param routeName Resolved route descriptor name, when the caller has one.
 * @param pathname Path to check; defaults to the live `location.pathname`.
 * @returns Whether the route is a playground experiment.
 */
export function isPlaygroundRoute(routeName?: string | null, pathname?: string): boolean {
  return isEarthPlaygroundRoute(routeName, pathname) || isStarFieldRoute(routeName, pathname)
}
