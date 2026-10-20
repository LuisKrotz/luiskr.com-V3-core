/**
 * @file tokens/classes/animations.js
 * @description Animations-reference view class tokens — grouped subset of
 * CLASSES for the /animations route (the SEO/crawler-readable hub listing
 * every animated element's alt + longdesc records).
 */

import { _K_ANIMATIONS } from '../base.js'

/**
 * Frozen animations-reference class-name map — sole declaration site for
 * these tokens; consumers read members and never re-declare the strings
 * (zero-hardcoding rules 4–5). Object.freeze makes the token contract
 * immutable at runtime.
 */
export const ANIMATIONS_CLASSES = Object.freeze({
  ANIMATIONS: _K_ANIMATIONS,
  ANIMATIONS_LIST: `${_K_ANIMATIONS}-list`,
  ANIMATIONS_RECORD: `${_K_ANIMATIONS}-record`,
  ANIMATIONS_TERM: `${_K_ANIMATIONS}-term`,
  ANIMATIONS_DESC: `${_K_ANIMATIONS}-desc`,
})
