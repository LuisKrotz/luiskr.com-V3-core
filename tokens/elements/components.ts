/**
 * @file tokens/elements/components.js
 * @description Component custom-element tag tokens — grouped subset of
 * TAGS.
 */

import {
  _B_ANIM_DEMO,
  _B_CARD_STACK,
  _B_DRAW_TEXT,
  _B_HOME_MOSAIC,
  _B_LANG_DIALOG,
  _B_MEDIA_FIGURE,
  _B_MEDIA_MOSAIC,
  _B_MENTIONS_DECK,
  _B_ROUTE_SEARCH,
  _B_SITE_TOAST,
  _B_STATS_HUD,
  _K_ABOUT_SECTION,
  _K_LEGAL_FOOTER,
  _K_PREFERENCES_MODAL,
} from '../base.js'

/**
 * Frozen component element tag-name map — sole declaration site for these tokens; consumers
 * read members and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze
 * makes the token contract immutable at runtime.
 */
export const COMPONENT_TAGS = Object.freeze({
  MEDIA_EXPANDED: 'media-expanded',
  MEDIA_FIGURE: _B_MEDIA_FIGURE,
  DRAW_TEXT: _B_DRAW_TEXT,
  ANIM_DEMO: _B_ANIM_DEMO,
  CUSTOM_CAROUSEL: 'custom-carousel',
  MEDIA_MOSAIC: _B_MEDIA_MOSAIC,
  AWARDS_CAROUSEL: 'awards-carousel',
  HOME_MOSAIC: _B_HOME_MOSAIC,
  CARD_STACK: _B_CARD_STACK,
  MENTIONS_DECK: _B_MENTIONS_DECK,
  ABOUT_SECTION: _K_ABOUT_SECTION,
  CONTACT_SECTION: 'contact-section',
  AWARDS_MENTIONS: 'awards-mentions',
  PORTFOLIO_RELATED: 'portfolio-related',
  LEGAL_FOOTER: _K_LEGAL_FOOTER,
  PREFERENCES_MODAL: _K_PREFERENCES_MODAL,
  LANG_DIALOG: _B_LANG_DIALOG,
  COOKIE_BANNER: 'cookie-banner',
  SITE_TOAST: _B_SITE_TOAST,
  APP_NAV: 'app-nav',
  APP_ROOT: 'app-root',
  STATS_HUD: _B_STATS_HUD,
  ROUTE_SEARCH: _B_ROUTE_SEARCH,
  SEARCH_MODAL: 'search-modal',
  NAV_SEARCH_ICON: 'nav-search-icon',
  NAV_BRUSH_ICON: 'nav-brush-icon',
  NAV_GLOBE_ICON: 'nav-globe-icon',
  NAV_GRID_ICON: 'nav-grid-icon',
})
