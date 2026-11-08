/**
 * @file tokens/classes/related.js
 * @description Related-projects accordion-list class tokens — grouped
 * subset of CLASSES.
 */

import { _B_RELATED } from '../base.js'

/**
 * Frozen related class-name map — sole declaration site for these tokens; consumers read
 * members and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes
 * the token contract immutable at runtime.
 */
export const RELATED_CLASSES = Object.freeze({
  RELATED_LIST: _B_RELATED,
  RELATED_LIST_ITEM: `${_B_RELATED}-item`,
  /** Collapsed window slot — the item outside the 3-card viewport folds
   *  to zero height (grid-template-rows 0fr) until the conveyor expands
   *  it back in. */
  RELATED_LIST_ITEM_CLOSED: `${_B_RELATED}-item--closed`,
  /** Clip wrapper inside the item's animated grid row — min-height:0 +
   *  overflow:hidden is what lets the 0fr track collapse smoothly. */
  RELATED_LIST_INNER: `${_B_RELATED}-inner`,
  RELATED_LIST_MEDIA: `${_B_RELATED}-media`,
  RELATED_LIST_IMG: `${_B_RELATED}-img`,
  /** Progressive-cover layers — intrinsic-size SVG reserves the painted
   *  box, LQIP first paint, then the display ladder fades in over it. */
  RELATED_LIST_IMG_PLACEHOLDER: `${_B_RELATED}-img--placeholder`,
  RELATED_LIST_IMG_THUMB: `${_B_RELATED}-img--thumb`,
  RELATED_LIST_IMG_HIGH: `${_B_RELATED}-img--high`,
  /** Published on the high layer's `load` — the CSS crossfade trigger. */
  RELATED_LIST_IMG_LOADED: `${_B_RELATED}-img--loaded`,
  RELATED_LIST_INFO: `${_B_RELATED}-info`,
  RELATED_LIST_TITLE: `${_B_RELATED}-title`,
  RELATED_LIST_DESC: `${_B_RELATED}-desc`,
  /** WebGPU overlay canvas for the instanced border-sheen rings. */
  RELATED_LIST_RING_CANVAS: `${_B_RELATED}-ring-canvas`,
  /** Prev/next control row rendered under the conveyor. */
  RELATED_LIST_CONTROLS: `${_B_RELATED}-controls`,
  /** One conveyor step button (base + --prev/--next modifiers). */
  RELATED_LIST_BTN: `${_B_RELATED}-btn`,
  RELATED_LIST_BTN_PREV: `${_B_RELATED}-btn--prev`,
  RELATED_LIST_BTN_NEXT: `${_B_RELATED}-btn--next`,
})
