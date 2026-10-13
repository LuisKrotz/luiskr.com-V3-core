/**
 * @file tokens/strings/queries.js
 * @description Selector/media-query/rootMargin string tokens — grouped
 * token group.
 */

/**
 * Selector/media-query/rootMargin string tokens. Sole declaration site — consumers import members
 * from this frozen map rather than re-declaring the literals
 * (zero-hardcoding rule).
 */
export const QUERY_STRINGS = Object.freeze({
  SELECTOR_LINKS: 'a[href^="/"], [data-route]',
  LINK_CANONICAL: 'link[rel="canonical"]',
  META_ROBOTS: 'meta[name="robots"]',
  /** Head-sync selectors — the meta tags syncDocumentHead/setMetaDescription rewrite per route. */
  META_DESCRIPTION: 'meta[name="description"]',
  META_OG_TITLE: 'meta[property="og:title"]',
  META_TW_TITLE: 'meta[name="twitter:title"]',
  META_DC_TITLE: 'meta[name="DC.Title"]',
  META_OG_DESCRIPTION: 'meta[property="og:description"]',
  META_TW_DESCRIPTION: 'meta[name="twitter:description"]',
  META_DC_DESCRIPTION: 'meta[name="DC.Description"]',
  META_OG_IMAGE_ALT: 'meta[property="og:image:alt"]',
  META_OG_URL: 'meta[property="og:url"]',
  META_TW_URL: 'meta[name="twitter:url"]',
  ROOT_MARGIN_200: '200px 0px',
  ROOT_MARGIN_100: '100px 0px',
  ROOT_MARGIN_50: '50px 0px',
  DARK_SCHEME_QUERY: '(prefers-color-scheme: dark)',
  CONTAINER_TYPE: 'container-type',
  INLINE_SIZE: 'inline-size',
})
