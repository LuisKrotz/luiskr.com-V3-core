/**
 * @file tokens/classes/state.js
 * @description Global state modifier class tokens — grouped subset of
 * CLASSES.
 */

import { _K_ACTIVE } from '../base.js'

/**
 * Frozen state class-name map — sole declaration site for these tokens; consumers read
 * members and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes
 * the token contract immutable at runtime.
 */
export const STATE_CLASSES = Object.freeze({
  ACTIVE: _K_ACTIVE,
  IS_OPEN: 'is-open',
  IS_TRUNCATED: 'is-truncated',
  IS_FALLBACK: 'is-fallback',
  HAS_FALLBACK: 'has-fallback',
  IS_SAFARI: 'is-safari',
  REDUCED_MOTION: 'reduced-motion',
  DARK_MODE: 'dark-mode',
  SHOW_GRID: 'show-grid',
  PAGE_FADE_IN: 'page-fade-in',
  PAGE_FADE_OUT: 'page-fade-out',
  CYRILLIC_FONT: 'cyrillic-font',
  /** Document-level JS-capability marker — set by the head inline script. */
  JS: 'js',
  /** Document-level no-JS marker shipped in index.html until JS flips it. */
  NO_JS: 'no-js',
  /** Document-level intro-skip marker — the head script stamps it when the
   *  boot intro already ran this session or reduced-motion disables it, so
   *  the statically-emitted loader markup never paints. */
  INTRO_SKIP: 'intro-skip',
})
