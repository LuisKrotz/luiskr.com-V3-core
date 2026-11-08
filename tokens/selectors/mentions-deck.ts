/**
 * @file tokens/selectors/mentions-deck.js
 * @description Mentions-deck selector tokens — token group.
 */

import { _B_MENTIONS_DECK } from '../base.js'

/**
 * Frozen mentions-deck selector map — sole declaration site for these tokens;
 * consumers read members and never re-declare the strings (zero-hardcoding
 * rules 4–5). Object.freeze makes the token contract immutable at runtime.
 */
export const MENTIONS_DECK_SELECTORS = Object.freeze({
  MENTIONS_DECK: `.${_B_MENTIONS_DECK}`,
  MENTIONS_DECK_DECK: `.${_B_MENTIONS_DECK}-deck`,
  MENTIONS_DECK_CARD: `.${_B_MENTIONS_DECK}-card`,
  MENTIONS_DECK_DOT: `.${_B_MENTIONS_DECK}-dot`,
})
