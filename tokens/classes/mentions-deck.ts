/**
 * @file tokens/classes/mentions-deck.js
 * @description Mentions-deck class tokens — token group.
 */

import { _B_MENTIONS_DECK } from '../base.js'

/**
 * Frozen mentions-deck class-name map — sole declaration site for these
 * tokens; consumers read members and never re-declare the strings
 * (zero-hardcoding rules 4–5). Object.freeze makes the token contract
 * immutable at runtime.
 */
export const MENTIONS_DECK_CLASSES = Object.freeze({
  MENTIONS_DECK: _B_MENTIONS_DECK,
  /** "Some mentions" section heading above the fanned cards. */
  MENTIONS_DECK_TITLE: `${_B_MENTIONS_DECK}-title`,
  /** The fanned deck region — pointer/swipe surface. */
  MENTIONS_DECK_DECK: `${_B_MENTIONS_DECK}-deck`,
  /** Modifier on the deck while a drag gesture is live — kills CSS
   *  transitions so transforms track the pointer 1:1. */
  MENTIONS_DECK_DECK_DRAGGING: `${_B_MENTIONS_DECK}-deck--dragging`,
  MENTIONS_DECK_CARD: `${_B_MENTIONS_DECK}-card`,
  /** Front-card modifier — the light surface + enabled link state. */
  MENTIONS_DECK_CARD_ACTIVE: `${_B_MENTIONS_DECK}-card--active`,
  MENTIONS_DECK_CARD_LINK: `${_B_MENTIONS_DECK}-card-link`,
  /** Zero-padded ordinal in the card's top corner ('01'). */
  MENTIONS_DECK_CARD_NUM: `${_B_MENTIONS_DECK}-card-num`,
  MENTIONS_DECK_CARD_MEDIA: `${_B_MENTIONS_DECK}-card-media`,
  MENTIONS_DECK_CARD_IMG: `${_B_MENTIONS_DECK}-card-img`,
  MENTIONS_DECK_CARD_ICON: `${_B_MENTIONS_DECK}-card-icon`,
  /** Award/mention copy block (CMS description markup). */
  MENTIONS_DECK_CARD_TEXT: `${_B_MENTIONS_DECK}-card-text`,
  MENTIONS_DECK_FOOT: `${_B_MENTIONS_DECK}-foot`,
  /** "Drag or swipe…" affordance copy. */
  MENTIONS_DECK_HINT: `${_B_MENTIONS_DECK}-hint`,
  MENTIONS_DECK_HINT_ICON: `${_B_MENTIONS_DECK}-hint-icon`,
  MENTIONS_DECK_DOTS: `${_B_MENTIONS_DECK}-dots`,
  MENTIONS_DECK_DOT: `${_B_MENTIONS_DECK}-dot`,
  MENTIONS_DECK_DOT_ACTIVE: `${_B_MENTIONS_DECK}-dot--active`,
  MENTIONS_DECK_DOT_NUM: `${_B_MENTIONS_DECK}-dot-num`,
})
