/**
 * @file tokens/classes/mosaic.js
 * @description Home mosaic grid class tokens — token group.
 */

import { _B_HOME_MOSAIC } from '../base.js'

/**
 * Frozen home mosaic class-name map — sole declaration site for these tokens; consumers read
 * members and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes
 * the token contract immutable at runtime.
 */
export const HOME_MOSAIC_CLASSES = Object.freeze({
  HOME_PORTFOLIO_SECTION: 'home-portfolio-section',
  HOME_SECTION_TITLE: 'home-section-title',
  HOME_MOSAIC: _B_HOME_MOSAIC,
  HOME_MOSAIC_ITEM: `${_B_HOME_MOSAIC}-item`,
  HOME_MOSAIC_ITEM_FEATURED: `${_B_HOME_MOSAIC}-item--featured`,
  HOME_MOSAIC_ITEM_EXPANDED: `${_B_HOME_MOSAIC}-item--expanded`,
  /** Set on the card while its title burn session runs — silences the
   *  border sheen so only the combustion reads as the hover effect. */
  HOME_MOSAIC_ITEM_BURNING: `${_B_HOME_MOSAIC}-item--burning`,
  HOME_MOSAIC_MEDIA: `${_B_HOME_MOSAIC}-media`,
  HOME_MOSAIC_IMG: `${_B_HOME_MOSAIC}-img`,
  /** Progressive-cover layers — intrinsic-size SVG reserves the painted
   *  box, LQIP first paint, then the display ladder fades in over it. */
  HOME_MOSAIC_IMG_PLACEHOLDER: `${_B_HOME_MOSAIC}-img--placeholder`,
  HOME_MOSAIC_IMG_THUMB: `${_B_HOME_MOSAIC}-img--thumb`,
  HOME_MOSAIC_IMG_HIGH: `${_B_HOME_MOSAIC}-img--high`,
  /** Published on the high layer's `load` — the CSS crossfade trigger. */
  HOME_MOSAIC_IMG_LOADED: `${_B_HOME_MOSAIC}-img--loaded`,
  HOME_MOSAIC_TITLE_OVERLAY: `${_B_HOME_MOSAIC}-title-overlay`,
  HOME_MOSAIC_TITLE: `${_B_HOME_MOSAIC}-title`,
  HOME_MOSAIC_TITLE_BURNING: `${_B_HOME_MOSAIC}-title--burning`,
  HOME_MOSAIC_TITLE_BURN: `${_B_HOME_MOSAIC}-title-burn`,
  HOME_MOSAIC_TITLE_SLOT: `${_B_HOME_MOSAIC}-title-slot`,
  HOME_MOSAIC_TITLE_DUP: `${_B_HOME_MOSAIC}-title-dup`,
  HOME_MOSAIC_TITLE_REWRITE: `${_B_HOME_MOSAIC}-title-rewrite`,
  HOME_MOSAIC_BOTTOM: `${_B_HOME_MOSAIC}-bottom`,
  HOME_MOSAIC_DETAILS: `${_B_HOME_MOSAIC}-details`,
  HOME_MOSAIC_DESC: `${_B_HOME_MOSAIC}-desc`,
  HOME_MOSAIC_BTN: `${_B_HOME_MOSAIC}-btn`,
  /** WebGPU overlay canvas for the corner-bracket widget on card CTAs. */
  HOME_MOSAIC_BTN_CANVAS: `${_B_HOME_MOSAIC}-btn-canvas`,
  /** WebGPU overlay canvas for the instanced border-sheen rings. */
  HOME_MOSAIC_RING_CANVAS: `${_B_HOME_MOSAIC}-ring-canvas`,
})
