/**
 * @file tokens/css/route-search.js
 * @description Route-search CSS custom-property names — the host-tunable
 * knobs consumed by route-search.scss and measured by RouteSearch.ts.
 */

/**
 * Route-search CSS custom-property names. Sole declaration site —
 * consumers import members rather than re-declaring the literals
 * (zero-hardcoding rule). `RS_LIST_GAP` is authored in SCSS tokens and
 * read back by the component's viewport-fit measurement; `RS_LIST_AVAIL`
 * is the measured value the stylesheet min()es into the listbox cap.
 */
export const RS_CSS_PROPS = Object.freeze({
  /** Breathing room kept under the open dropdown at the screen edge. */
  RS_LIST_GAP: '--rs-list-gap',
  /** Measured space remaining below the panel — written per open/resize. */
  RS_LIST_AVAIL: '--rs-list-avail',
})
