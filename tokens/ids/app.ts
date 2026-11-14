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
  /** Fullscreen WebGL field canvas parked behind #app (body's first child). */
  PAGE_BACKDROP: 'page-backdrop',
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
  /** Route-search listbox — the combobox's aria-controls target. */
  ROUTE_SEARCH_LIST: 'route-search-list',
  ROUTE_SEARCH_INPUT: 'route-search-input',
  SEARCH_MODAL_TITLE: 'search-modal-title',
  /** Route-search option id PREFIX — aria-activedescendant points at
   *  `<prefix><n>` rows inside the listbox. */
  ROUTE_SEARCH_OPTION_PREFIX: 'route-search-option-',
  /** Parked reader article — the light-DOM skip link's static target.
   *  Deliberately different from MAIN_CONTENT (which lives inside the
   *  app-root shadow tree): identical ids across trees are legal, but
   *  DOM-wide uniqueness checkers count the composed tree. At runtime a
   *  delegated handler re-aims the link at the shadow #main-content. */
  READER_CONTENT: 'reader-content',
  /** Sitemap collapsible-group region id PREFIX — the toggle's
   *  aria-controls points at `<prefix><group-key>` (the wall container
   *  that mounts the group's children on first open). */
  SITEMAP_GROUP_PREFIX: 'sitemap-group-',
})

/** Gradient ids for the nav search magnifier SVG. */
export const NAV_SEARCH_IDS = Object.freeze({
  /** Radial glass ramp — the lens face's soft convex fill. */
  GLASS: 'nav-search-glass',
  /** Linear rim ramp — top-lit metal ring edge. */
  RIM: 'nav-search-rim',
  /** Linear handle ramp — the machined grip's edge shading. */
  HANDLE: 'nav-search-handle',
  /** Prompt chevron silver gradient (search glyph). */
  CHEV: 'nav-search-chev',
  /** Motion streak gradient (search glyph). */
  STREAK: 'nav-search-streak',
  /** Brush shaft gradient. */
  SHAFT: 'nav-brush-shaft',
  /** Chrome ferrule gradient. */
  FERRULE: 'nav-brush-ferrule',
  /** Bristle tip gradient. */
  TIP: 'nav-brush-tip',
  /** Paint swoosh gradient. */
  SWOOSH: 'nav-brush-swoosh',
  /** Globe outline gradient (language glyph). */
  GLOBE: 'nav-globe-line',
  /** Grid outline gradient (menu glyph). */
  GRID: 'nav-grid-line',
})
