/**
 * @file tokens/classes/media.js
 * @description Media render/placeholder class tokens — grouped subset of
 * CLASSES importable without pulling the full registry.
 */

import {
  _B_MEDIA_AUDIO_NOTE,
  _B_MEDIA_FIGURE,
  _B_RENDER_MEDIA,
  _B_RENDER_PLACEHOLDER,
} from '../base.js'

/**
 * Frozen media class-name map — sole declaration site for these tokens; consumers read
 * members and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes
 * the token contract immutable at runtime.
 */
export const MEDIA_CLASSES = Object.freeze({
  RENDER_MEDIA: _B_RENDER_MEDIA,
  RENDER_MEDIA_HIGH: `${_B_RENDER_MEDIA}--high`,
  RENDER_MEDIA_EXPAND: `${_B_RENDER_MEDIA}--can-expand`,
  RENDER_MEDIA_THUMB: `${_B_RENDER_MEDIA}--thumb`,
  RENDER_MEDIA_LOADED: `${_B_RENDER_MEDIA}--loaded`,
  RENDER_PLACEHOLDER: _B_RENDER_PLACEHOLDER,
  RENDER_PLACEHOLDER_FIGURE: `${_B_RENDER_PLACEHOLDER}-figure`,
  MEDIA_FIGURE: _B_MEDIA_FIGURE,
  MEDIA_FIGURE_LOADED: `${_B_MEDIA_FIGURE}--loaded`,
  /** Play/pause toggle chip for ambient (controls-less) videos. */
  MEDIA_FIGURE_TOGGLE: `${_B_MEDIA_FIGURE}__toggle`,
  MEDIA_FIGURE_TOGGLE_PLAY: `${_B_MEDIA_FIGURE}__toggle-play`,
  MEDIA_FIGURE_TOGGLE_PAUSE: `${_B_MEDIA_FIGURE}__toggle-pause`,
  MEDIA_AUDIO_NOTE: _B_MEDIA_AUDIO_NOTE,
})
