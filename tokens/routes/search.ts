/**
 * @file tokens/routes/search.js
 * @description Route-search vocabulary — the entry-kind discriminants the
 * 404 autocomplete catalog carries. Sole declaration site for these
 * literals (zero-hardcoding rules 4–5); scoring and grouping code compares
 * against these members, never re-declared strings.
 */

/**
 * Frozen route-entry kind map — classifies each catalog entry so the
 * list can rank and label it. `PAGE` covers the home/about/contact
 * anchors, `LEGAL` the statutory pages, `EXPERIMENT` the playground and
 * reference surfaces, `PROJECT` the portfolio items joined from the
 * home portfoliolist.
 */
export const ROUTE_SEARCH_KINDS = Object.freeze({
  /** Static site pages: home, about, contact. */
  PAGE: 'page',
  /** Statutory pages: privacy, GDPR, terms, license. */
  LEGAL: 'legal',
  /** Interactive surfaces: earth playground, star field, animations. */
  EXPERIMENT: 'experiment',
  /** Portfolio project detail pages joined from the portfoliolist. */
  PROJECT: 'project',
  /** Docs-portal pages — the English-only manifest corpus. */
  DOCS: 'docs',
})

/**
 * Frozen route-search limits — `MAX_HITS` is the page size: how many
 * ranked rows the listbox renders per results page. The catalog holds
 * thousands of entries; a one-letter query matched ~6.7k rows, and
 * patching them all into the DOM per keystroke cost ≈600ms first paint —
 * the pager walks the full hit list one slice at a time instead.
 */
export const ROUTE_SEARCH_LIMITS = Object.freeze({
  /** Rows rendered per results page — one slice of the ranked hits. */
  MAX_HITS: 50,
})
