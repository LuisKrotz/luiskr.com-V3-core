/**
 * @file tokens/classes/about.js
 * @description About section class tokens — token group.
 */

import {
  _B_ABOUT,
  _B_ABOUT_INTRO,
  _B_ABOUT_ITEM,
  _B_ABOUT_MAIN,
  _B_ABOUT_PROFILE,
  _B_ABOUT_PROFILE_HUD,
  _B_ABOUT_PROFILE_MEDIA,
  _B_ABOUT_PROFILE_NAME,
  _B_ABOUT_PROFILE_PICTURE,
  _B_ABOUT_PROFILE_TEXT,
} from '../base.js'

/**
 * Frozen about class-name map — sole declaration site for these tokens; consumers read
 * members and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes
 * the token contract immutable at runtime.
 */
export const ABOUT_CLASSES = Object.freeze({
  ABOUT: _B_ABOUT,
  ABOUT_MAIN: _B_ABOUT_MAIN,
  ABOUT_TITLE: `${_B_ABOUT}-title`,
  ABOUT_SUBTITLE: `${_B_ABOUT}-subtitle`,
  ABOUT_INTRO: _B_ABOUT_INTRO,
  ABOUT_PROFILE_SECTION: `${_B_ABOUT_PROFILE}-section`,
  ABOUT_PROFILE_MEDIA: _B_ABOUT_PROFILE_MEDIA,
  ABOUT_PROFILE_NAME: _B_ABOUT_PROFILE_NAME,
  ABOUT_PROFILE_PICTURE: _B_ABOUT_PROFILE_PICTURE,
  ABOUT_PROFILE_PICTURE_IMG: `${_B_ABOUT_PROFILE_PICTURE}-img`,
  ABOUT_PROFILE_PICTURE_PLACEHOLDER: `${_B_ABOUT_PROFILE_PICTURE}-placeholder`,
  ABOUT_PROFILE_PICTURE_GLITCH: `${_B_ABOUT_PROFILE_PICTURE}-glitch`,
  ABOUT_PROFILE_PICTURE_MESH: `${_B_ABOUT_PROFILE_PICTURE}-mesh`,
  ABOUT_PROFILE_HUD: _B_ABOUT_PROFILE_HUD,
  ABOUT_HUD_NAME: `${_B_ABOUT_PROFILE_HUD}-name`,
  ABOUT_HUD_COORDS: `${_B_ABOUT_PROFILE_HUD}-coords`,
  ABOUT_HUD_LINE: `${_B_ABOUT_PROFILE_HUD}-line`,
  ABOUT_HUD_OUT: `${_B_ABOUT_PROFILE_HUD}-out`,
  ABOUT_PROFILE_TEXT: _B_ABOUT_PROFILE_TEXT,
  ABOUT_ITEM: _B_ABOUT_ITEM,
  ABOUT_ITEM_TEXT: `${_B_ABOUT_ITEM}-text`,
})
