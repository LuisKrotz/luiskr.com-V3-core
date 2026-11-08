/**
 * @file tokens/selectors/card-stack.js
 * @description Card-stack deck selector tokens — token group.
 */

import {
  _B_CARD_STACK,
  _B_CARD_STACK_CARD,
  _B_CARD_STACK_DECK,
  _B_CARD_STACK_DOT,
  _B_CARD_STACK_INDEX,
  _B_CARD_STACK_INFO,
  _B_CARD_STACK_TOGGLE,
} from '../base.js'

/**
 * Frozen card-stack selector map — sole declaration site for these tokens; consumers read
 * members and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes
 * the token contract immutable at runtime.
 */
export const CARD_STACK_SELECTORS = Object.freeze({
  CARD_STACK: `.${_B_CARD_STACK}`,
  /** The section's "SELECTED WORK" header row — a chrome row the stage
   *  budget subtracts in measure(). */
  CARD_STACK_HEADER: `.${_B_CARD_STACK}-header`,
  CARD_STACK_DECK: `.${_B_CARD_STACK_DECK}`,
  CARD_STACK_CARD: `.${_B_CARD_STACK_CARD}`,
  CARD_STACK_CARD_LINK: `.${_B_CARD_STACK_CARD}-link`,
  CARD_STACK_COUNTER: `.${_B_CARD_STACK}-counter`,
  CARD_STACK_INFO: `.${_B_CARD_STACK_INFO}`,
  CARD_STACK_INFO_TITLE: `.${_B_CARD_STACK_INFO}-title`,
  CARD_STACK_INFO_DESC: `.${_B_CARD_STACK_INFO}-desc`,
  CARD_STACK_INFO_CTA: `.${_B_CARD_STACK_INFO}-cta`,
  CARD_STACK_PREV: `.${_B_CARD_STACK}-prev`,
  CARD_STACK_NEXT: `.${_B_CARD_STACK}-next`,
  /** The autoplay play/pause transport in the foot nav. */
  CARD_STACK_AUTOPLAY: `.${_B_CARD_STACK}-autoplay`,
  /** The in-card copy column (title + description + CTA) inside a
   *  stacked card — the content box the fit observer watches so
   *  injected copy re-runs the stage-cap fit. */
  CARD_STACK_CARD_INFO: `.${_B_CARD_STACK_CARD}-info`,
  CARD_STACK_CARD_INFO_TITLE: `.${_B_CARD_STACK_CARD}-info-title`,
  /** The in-card description slot — its <draw-text> writer re-arms on
   *  every front change (stacked tiers animate the body text per card). */
  CARD_STACK_CARD_INFO_DESC: `.${_B_CARD_STACK_CARD}-info-desc`,
  CARD_STACK_NAV_INDEX: `.${_B_CARD_STACK}-nav-index`,
  /** Live position text inside the nav-index button. */
  CARD_STACK_NAV_INDEX_NUM: `.${_B_CARD_STACK}-nav-index-num`,
  CARD_STACK_DOT: `.${_B_CARD_STACK_DOT}`,
  /** The controls row (hint + prev/dots/index/next nav) — the chrome row
   *  below the deck the stage budget subtracts in measure(). */
  CARD_STACK_FOOT: `.${_B_CARD_STACK}-foot`,
  CARD_STACK_TOGGLE: `.${_B_CARD_STACK_TOGGLE}`,
  CARD_STACK_INDEX: `.${_B_CARD_STACK_INDEX}`,
  CARD_STACK_INDEX_CLOSE: `.${_B_CARD_STACK_INDEX}-close`,
  CARD_STACK_INDEX_LIST: `.${_B_CARD_STACK_INDEX}-list`,
  CARD_STACK_INDEX_PREV: `.${_B_CARD_STACK_INDEX}-prev`,
  CARD_STACK_INDEX_NEXT: `.${_B_CARD_STACK_INDEX}-next`,
  CARD_STACK_INDEX_ITEM: `.${_B_CARD_STACK_INDEX}-item`,
})
