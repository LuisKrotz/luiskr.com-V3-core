/**
 * @file tokens/classes/related.js
 * @description Related-projects mosaic class tokens — grouped subset of
 * CLASSES.
 */

import { _B_RELATED } from '../base.js'

/**
 * Frozen related class-name map — sole declaration site for these tokens; consumers read
 * members and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes
 * the token contract immutable at runtime.
 */
export const RELATED_CLASSES = Object.freeze({
  RELATED_MOSAIC: _B_RELATED,
  RELATED_MOSAIC_ITEM: `${_B_RELATED}-item`,
  RELATED_MOSAIC_ITEM_FEATURED: `${_B_RELATED}-item--featured`,
  RELATED_MOSAIC_MEDIA: `${_B_RELATED}-media`,
  RELATED_MOSAIC_IMG: `${_B_RELATED}-img`,
  /** Progressive-cover layers — intrinsic-size SVG reserves the painted
   *  box, LQIP first paint, then the display ladder fades in over it. */
  RELATED_MOSAIC_IMG_PLACEHOLDER: `${_B_RELATED}-img--placeholder`,
  RELATED_MOSAIC_IMG_THUMB: `${_B_RELATED}-img--thumb`,
  RELATED_MOSAIC_IMG_HIGH: `${_B_RELATED}-img--high`,
  /** Published on the high layer's `load` — the CSS crossfade trigger. */
  RELATED_MOSAIC_IMG_LOADED: `${_B_RELATED}-img--loaded`,
  RELATED_MOSAIC_OVERLAY: `${_B_RELATED}-overlay`,
  RELATED_MOSAIC_INFO: `${_B_RELATED}-info`,
  RELATED_MOSAIC_TITLE: `${_B_RELATED}-title`,
  RELATED_MOSAIC_DESC: `${_B_RELATED}-desc`,
  /** WebGPU overlay canvas for the instanced border-sheen rings. */
  RELATED_MOSAIC_RING_CANVAS: `${_B_RELATED}-ring-canvas`,
})
