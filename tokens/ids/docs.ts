/**
 * @file tokens/ids/docs.js
 * @description Docs-portal element id tokens — grouped subset of IDS.
 */

import { _B_DOCS } from '../base.js'

/**
 * Frozen docs element-id map — sole declaration site for these tokens;
 * consumers read members and never re-declare the strings
 * (zero-hardcoding rules 4–5). Object.freeze makes the token contract
 * immutable at runtime.
 */
export const DOCS_IDS = Object.freeze({
  GL: `${_B_DOCS}-gl`,
  TREE: `${_B_DOCS}-tree`,
  /** Combobox dropdown — the toggle's aria-controls target (crumbs +
   *  treeview container), distinct from the tree list id. */
  NAV_PANEL: `${_B_DOCS}-nav-panel`,
  CRUMBS: `${_B_DOCS}-crumbs`,
  GRID: `${_B_DOCS}-grid`,
  VIEWER: `${_B_DOCS}-viewer`,
  SCENE: `${_B_DOCS}-scene`,
  /** Zoom trigger's aria-controls target — the architecture-map dialog. */
  MAP_MODAL: `${_B_DOCS}-map-modal`,
})
