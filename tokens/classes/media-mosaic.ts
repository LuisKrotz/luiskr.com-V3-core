/**
 * @file tokens/classes/media-mosaic.js
 * @description Internals media-mosaic wall class tokens — token group.
 */

import { _B_MEDIA_MOSAIC } from '../base.js'

/**
 * Frozen media-mosaic class-name map — sole declaration site for these tokens; consumers read
 * members and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes
 * the token contract immutable at runtime.
 */
export const MEDIA_MOSAIC_CLASSES = Object.freeze({
  /** The absolutely-packed masonry wall container inside <media-mosaic>. */
  MEDIA_MOSAIC: _B_MEDIA_MOSAIC,
  /** One positioned tile on the wall (top/left/width/height set inline). */
  MEDIA_MOSAIC_ITEM: `${_B_MEDIA_MOSAIC}-item`,
  /** Class forwarded onto each tile's <media-figure> host — lets the
   *  figure shadow root resolve the mosaic sizing context via
   *  :host-context / :host([classes*=…]). */
  MEDIA_MOSAIC_ITEM_FIGURE: `${_B_MEDIA_MOSAIC}-item-figure`,
})
