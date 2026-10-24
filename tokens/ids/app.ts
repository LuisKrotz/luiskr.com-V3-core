/**
 * @file tokens/ids/app.js
 * @description App shell element id tokens — token group.
 */

import { _K_VIEW_OUTLET } from '../base.js'

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
})
