/**
 * @file tokens/classes/loader.js
 * @description Intro loader class tokens — token group.
 */

import { _B_BOOT_VEIL, _B_LOADER } from '../base.js'

/**
 * Frozen loader class-name map — sole declaration site for these tokens; consumers read
 * members and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes
 * the token contract immutable at runtime.
 */
export const LOADER_CLASSES = Object.freeze({
  BOOT_VEIL: _B_BOOT_VEIL,
  INTRO_LOADER: _B_LOADER,
  INTRO_LOADER_GLOW: `${_B_LOADER}-glow`,
  INTRO_LOADER_GRID: `${_B_LOADER}-grid`,
  INTRO_LOADER_CONTENT: `${_B_LOADER}-content`,
  INTRO_LOADER_SPINNER: `${_B_LOADER}-spinner`,
  INTRO_LOADER_SPINNER_INNER: `${_B_LOADER}-spinner-inner`,
  INTRO_LOADER_COUNTER: `${_B_LOADER}-counter`,
  INTRO_LOADER_PERCENT: `${_B_LOADER}-percent`,
  INTRO_LOADER_TITLE: `${_B_LOADER}-title`,
  INTRO_LOADER_MSG: `${_B_LOADER}-msg`,
  INTRO_LOADER_BAR: `${_B_LOADER}-bar`,
  INTRO_LOADER_BAR_FILL: `${_B_LOADER}-bar-fill`,
  INTRO_LOADER_HIDDEN: `${_B_LOADER}--hidden`,
})
