/**
 * @file tokens/ids/app.js
 * @description App shell element id tokens — token group.
 */

import { _B_COOKIES, _K_VIEW_OUTLET } from '../base.js'

/**
 * Frozen app element-id map — sole declaration site for these tokens; consumers read members
 * and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes the
 * token contract immutable at runtime.
 */
export const APP_IDS = Object.freeze({
  APP: 'app',
  MAIN: 'main',
  MAIN_CONTENT: 'main-content',
  VIEW_OUTLET: _K_VIEW_OUTLET,
  /** Star-field navigator drawer — aria-controls target for its toggle. */
  SF_NAV_PANEL: 'sf-nav-panel',
  /** Star-field mobile instructions drawer — aria-controls target for its toggle. */
  SF_INSTRUCTIONS_PANEL: 'sf-instructions-panel',
  /** Star-field dossier panel title — aria-labelledby target for the aside landmark. */
  SF_PANEL_TITLE: 'sf-panel-title',
  /** Star-field navigator description node — aria-describedby target for
   *  the drawer landmark and its toggle button. */
  SF_NAV_DESC: 'sf-nav-desc',
  /** Star-field dossier tagline — aria-describedby target for the panel. */
  SF_PANEL_TAGLINE: 'sf-panel-tagline',
  /** Star-field instructions hint — aria-describedby target for the dialog. */
  SF_INSTRUCTIONS_HINT: 'sf-instructions-hint',
  /** Star-field navigator item description id PREFIX — the per-body
   *  describedby target is `<prefix><body-id>` inside each row button. */
  SF_ITEM_DESC_PREFIX: 'sf-item-desc-',
  /** Star-field playlist track list — aria-controls target for the
   *  card's collapse toggle. */
  SF_MUSIC_LIST: 'sf-music-list',
  /** Nav menu overlay — aria-controls target for the burger toggles. */
  NAV_MENU_PANEL: 'nav-menu-panel',
  /** Nav menu overlay title — aria-labelledby target for the open menu
   *  navigation landmark. */
  NAV_MENU_TITLE: 'nav-menu-title',
  /** Cookie-banner message text — aria-labelledby target giving the
   *  consent aside a *visible* label (aria-label alone is invisible). */
  COOKIES_INFO: `${_B_COOKIES}-info`,
  /** Parked reader article — the light-DOM skip link's static target.
   *  Deliberately different from MAIN_CONTENT (which lives inside the
   *  app-root shadow tree): identical ids across trees are legal, but
   *  DOM-wide uniqueness checkers count the composed tree. At runtime a
   *  delegated handler re-aims the link at the shadow #main-content. */
  READER_CONTENT: 'reader-content',
})

/**
 * Frozen nav-gear SVG gradient-id map — the defs↔url(#…) link ids inside
 * the machined-gear glyph (nav gear.tsx). Sole declaration site; the
 * markup reads members via the `url()` ref helper instead of re-declaring
 * the literals (zero-hardcoding rules 4–5).
 */
export const NAV_GEAR_IDS = Object.freeze({
  /** Radial face ramp — the tooth ring's base metal fill. */
  FACE: 'nav-gear-face',
  /** Linear rim ramp — top-lit edge stroke on the outline + groove. */
  RIM: 'nav-gear-rim',
  /** Radial hub ramp — the raised center cylinder. */
  HUB: 'nav-gear-hub',
  /** Linear cavity ramp — drilled lightening holes + the center bore. */
  HOLE: 'nav-gear-hole',
})
