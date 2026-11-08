/**
 * @file tokens/classes/route-search.js
 * @description Route-search (404 autocomplete) class tokens — grouped subset
 * of CLASSES. All members compose from the single `_B_ROUTE_SEARCH` block
 * declared in base.ts (zero-hardcoding rules 4–5).
 */

import { _B_ROUTE_SEARCH, _K_ACTIVE } from '../base.js'

/**
 * Frozen route-search class-name map — sole declaration site for these
 * tokens; consumers read members and never re-declare the strings
 * (zero-hardcoding rules 4–5). Object.freeze makes the token contract
 * immutable at runtime.
 */
export const ROUTE_SEARCH_CLASSES = Object.freeze({
  /** Block root — also the custom-element tag name. */
  ROUTE_SEARCH: _B_ROUTE_SEARCH,
  /** Pill wrapper around the input — carries the glow border. */
  ROUTE_SEARCH_FIELD: `${_B_ROUTE_SEARCH}-field`,
  /** The search input itself. */
  ROUTE_SEARCH_INPUT: `${_B_ROUTE_SEARCH}-input`,
  /** Visible label heading above the field. */
  ROUTE_SEARCH_LABEL: `${_B_ROUTE_SEARCH}-label`,
  /** Header row holding the label (left) and the result status (right). */
  ROUTE_SEARCH_HEAD: `${_B_ROUTE_SEARCH}-head`,
  /** Status line opposite the label — "N results found" / search dots. */
  ROUTE_SEARCH_FOUND: `${_B_ROUTE_SEARCH}-found`,
  /** The status' text node (count copy) — swapped for dots while busy. */
  ROUTE_SEARCH_FOUND_TEXT: `${_B_ROUTE_SEARCH}-found-text`,
  /** Three-dot searching indicator inside the status. */
  ROUTE_SEARCH_FOUND_DOTS: `${_B_ROUTE_SEARCH}-found-dots`,
  /** Circular submit button glued inside the field's right edge. */
  ROUTE_SEARCH_SUBMIT: `${_B_ROUTE_SEARCH}-submit`,
  /** Arrow SVG inside the submit button. */
  ROUTE_SEARCH_SUBMIT_ICON: `${_B_ROUTE_SEARCH}-submit-icon`,
  /** Conic-gradient ring fallback on the field (the WASM fill target). */
  ROUTE_SEARCH_FIELD_RING: `${_B_ROUTE_SEARCH}-field-ring`,
  /** Anchor wrapping the field + panel — the floated panel's containing
   *  block (layout-transparent `display: contents` by default). */
  ROUTE_SEARCH_COMBO: `${_B_ROUTE_SEARCH}-combo`,
  /** Dropdown panel wrapping the listbox + no-match row — in flow by
   *  default; hosts can float it under the field via --rs-panel-position. */
  ROUTE_SEARCH_PANEL: `${_B_ROUTE_SEARCH}-panel`,
  /** Results list (role=listbox). */
  ROUTE_SEARCH_LIST: `${_B_ROUTE_SEARCH}-list`,
  /** A single result row (role=option). */
  ROUTE_SEARCH_ITEM: `${_B_ROUTE_SEARCH}-item`,
  /** BEM modifier — the keyboard/hover-active row. */
  ROUTE_SEARCH_ITEM_ACTIVE: `${_B_ROUTE_SEARCH}-item--${_K_ACTIVE}`,
  /** The row-spanning anchor inside each item. */
  ROUTE_SEARCH_LINK: `${_B_ROUTE_SEARCH}-link`,
  /** Numbered circle at the row's leading edge (image-2 style). */
  ROUTE_SEARCH_INDEX: `${_B_ROUTE_SEARCH}-index`,
  /** Text column (title + preview + path). */
  ROUTE_SEARCH_BODY: `${_B_ROUTE_SEARCH}-body`,
  /** Route title line. */
  ROUTE_SEARCH_TITLE: `${_B_ROUTE_SEARCH}-title`,
  /** One-line "what's inside" preview. */
  ROUTE_SEARCH_PREVIEW: `${_B_ROUTE_SEARCH}-preview`,
  /** URL path line under the title. */
  ROUTE_SEARCH_PATH: `${_B_ROUTE_SEARCH}-path`,
  /** Trailing arrow span inside each result row. */
  ROUTE_SEARCH_ARROW: `${_B_ROUTE_SEARCH}-arrow`,
  /** The SVG element inside the row arrow. */
  ROUTE_SEARCH_ARROW_ICON: `${_B_ROUTE_SEARCH}-arrow-icon`,
  /** Project cover thumbnail inside a result row. */
  ROUTE_SEARCH_THUMB: `${_B_ROUTE_SEARCH}-thumb`,
  /** In-list group header row separating the kind-ordered hit buckets. */
  ROUTE_SEARCH_GROUP: `${_B_ROUTE_SEARCH}-group`,
  /** Text label inside the group header row. */
  ROUTE_SEARCH_GROUP_LABEL: `${_B_ROUTE_SEARCH}-group-label`,
  /** Result pager — prev/status/next row under the listbox. */
  ROUTE_SEARCH_PAGER: `${_B_ROUTE_SEARCH}-pager`,
  /** Previous-page pager button. */
  ROUTE_SEARCH_PAGER_PREV: `${_B_ROUTE_SEARCH}-pager-prev`,
  /** "Page x / y" status text inside the pager. */
  ROUTE_SEARCH_PAGER_STATUS: `${_B_ROUTE_SEARCH}-pager-status`,
  /** Next-page pager button. */
  ROUTE_SEARCH_PAGER_NEXT: `${_B_ROUTE_SEARCH}-pager-next`,
  /** No-results row. */
  ROUTE_SEARCH_EMPTY: `${_B_ROUTE_SEARCH}-empty`,
  /** Keyboard hint line under the field. */
  ROUTE_SEARCH_HINT: `${_B_ROUTE_SEARCH}-hint`,
  /** Overlay canvas for the WebGPU ring-fill widget. */
  ROUTE_SEARCH_CANVAS: `${_B_ROUTE_SEARCH}-canvas`,
  /** BEM modifier on the root while the listbox is open. */
  ROUTE_SEARCH_OPEN: `${_B_ROUTE_SEARCH}--open`,
  /** BEM modifier on the root while a scoring dispatch is in flight —
   *  the submit glyph spins so the wait reads as progress, not dead UI. */
  ROUTE_SEARCH_LOADING: `${_B_ROUTE_SEARCH}--loading`,
  /** BEM host marker — the standalone /search view mounts the surface
   *  as its page hero: the label takes the .ttl-xxl ramp. */
  ROUTE_SEARCH_HERO: `${_B_ROUTE_SEARCH}--hero`,
  /** <view-search> page root — the column that centers the surface. */
  SEARCH_VIEW: 'search-view',
})
