/**
 * @file tokens/selectors/loader.js
 * @description Intro loader selector tokens — grouped subset of
 * SELECTORS. Lets IntroLoader adopt the statically-emitted veil markup
 * (index.html) instead of building a second overlay at boot.
 */

import { _B_LOADER } from '../base.js'

/**
 * Frozen loader selector map — sole declaration site for these tokens; consumers read
 * members and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes
 * the token contract immutable at runtime.
 */
export const LOADER_SELECTORS = Object.freeze({
  INTRO_LOADER: `.${_B_LOADER}`,
  PERCENT: `.${_B_LOADER}-percent`,
  MSG: `.${_B_LOADER}-msg`,
  BAR: `.${_B_LOADER}-bar`,
})
