/**
 * @file tokens/classes/card-stack.js
 * @description Card-stack deck class tokens — token group.
 */

import {
  _B_CARD_STACK,
  _B_CARD_STACK_CARD,
  _B_CARD_STACK_CARD_IMG,
  _B_CARD_STACK_DECK,
  _B_CARD_STACK_DOT,
  _B_CARD_STACK_HINT,
  _B_CARD_STACK_INDEX,
  _B_CARD_STACK_INFO,
  _B_CARD_STACK_TOGGLE,
} from '../base.js'

/**
 * Frozen card-stack class-name map — sole declaration site for these tokens; consumers read
 * members and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes
 * the token contract immutable at runtime.
 */
export const CARD_STACK_CLASSES = Object.freeze({
  CARD_STACK: _B_CARD_STACK,
  /** Section-level modifier published while the all-projects index is open —
   *  dims the deck and reveals the index panel. */
  CARD_STACK_INDEX_OPEN: `${_B_CARD_STACK}--index-open`,
  CARD_STACK_HEADER: `${_B_CARD_STACK}-header`,
  CARD_STACK_TITLE: `${_B_CARD_STACK}-title`,
  /** "View all" pill toggle in the header. */
  CARD_STACK_TOGGLE: _B_CARD_STACK_TOGGLE,
  CARD_STACK_TOGGLE_COUNT: `${_B_CARD_STACK_TOGGLE}-count`,
  /** The fanned deck region — pointer/swipe surface. */
  CARD_STACK_DECK: _B_CARD_STACK_DECK,
  /** Modifier on the deck while a drag gesture is live — kills CSS
   *  transitions so transforms track the pointer 1:1. */
  CARD_STACK_DECK_DRAGGING: `${_B_CARD_STACK_DECK}--dragging`,
  CARD_STACK_CARD: _B_CARD_STACK_CARD,
  /** Front-card modifier — the lit, face-on card of the coverflow. */
  CARD_STACK_CARD_ACTIVE: `${_B_CARD_STACK_CARD}--active`,
  /** Off-fan modifier — the card left the visible coverflow window. */
  CARD_STACK_CARD_HIDDEN: `${_B_CARD_STACK_CARD}--hidden`,
  CARD_STACK_CARD_LINK: `${_B_CARD_STACK_CARD}-link`,
  CARD_STACK_CARD_MEDIA: `${_B_CARD_STACK_CARD}-media`,
  CARD_STACK_CARD_IMG: _B_CARD_STACK_CARD_IMG,
  /** Progressive-cover layers — intrinsic-size SVG reserves the painted
   *  box, LQIP first paint, then the display ladder fades in over it. */
  CARD_STACK_CARD_IMG_PLACEHOLDER: `${_B_CARD_STACK_CARD_IMG}--placeholder`,
  CARD_STACK_CARD_IMG_THUMB: `${_B_CARD_STACK_CARD_IMG}--thumb`,
  CARD_STACK_CARD_IMG_HIGH: `${_B_CARD_STACK_CARD_IMG}--high`,
  /** Published on the high layer's `load` — the CSS crossfade trigger. */
  CARD_STACK_CARD_IMG_LOADED: `${_B_CARD_STACK_CARD_IMG}--loaded`,
  /** In-card project copy (title/description/link) — the "entire card"
   *  content of the stacked phone/portrait layouts; hidden on the fan
   *  tiers where the text column carries the copy instead. */
  CARD_STACK_CARD_INFO: `${_B_CARD_STACK_CARD}-info`,
  /** The card's own project name on stacked layouts. */
  CARD_STACK_CARD_INFO_TITLE: `${_B_CARD_STACK_CARD}-info-title`,
  /** The card's own CMS description on stacked layouts. */
  CARD_STACK_CARD_INFO_DESC: `${_B_CARD_STACK_CARD}-info-desc`,
  /** The card's own "Check out" affordance on stacked layouts (the card
   *  link itself is the anchor — this is styled copy, not a nested
   *  interactive element). */
  CARD_STACK_CARD_INFO_CTA: `${_B_CARD_STACK_CARD}-info-cta`,
  /** Modifier on the card while a burn session owns its in-card title. */
  CARD_STACK_CARD_BURNING: `${_B_CARD_STACK_CARD}--burning`,
  /** Ink-hidden state on the in-card title while the canvas owns its
   *  pixels. */
  CARD_STACK_CARD_INFO_TITLE_BURNING: `${_B_CARD_STACK_CARD}-info-title--burning`,
  /** The combustion canvas absolutely positioned over the in-card
   *  title box. */
  CARD_STACK_CARD_INFO_TITLE_BURN: `${_B_CARD_STACK_CARD}-info-title-burn`,
  /** Rewrite-slot class the burn contract requires — card-stack never
   *  inserts the slot. */
  CARD_STACK_CARD_INFO_TITLE_SLOT: `${_B_CARD_STACK_CARD}-info-title-slot`,
  /** Spacer-dup class the burn contract requires (unused — no slot). */
  CARD_STACK_CARD_INFO_TITLE_DUP: `${_B_CARD_STACK_CARD}-info-title-dup`,
  /** Draw-text rewrite class the burn contract requires (unused). */
  CARD_STACK_CARD_INFO_TITLE_REWRITE: `${_B_CARD_STACK_CARD}-info-title-rewrite`,
  /** Active-project text column — left of the fan on landscape/desktop
   *  layouts, stacked under it on phones and portrait tablets. */
  CARD_STACK_INFO: _B_CARD_STACK_INFO,
  /** Active project's name — plain text the paper-burn consumes and
   *  re-knits on every nav (burn-out, text swap, burn-in). */
  CARD_STACK_INFO_TITLE: `${_B_CARD_STACK_INFO}-title`,
  /** Body copy — the project's full CMS description. */
  CARD_STACK_INFO_DESC: `${_B_CARD_STACK_INFO}-desc`,
  /** "Check out →" link to the active project's route. */
  CARD_STACK_INFO_CTA: `${_B_CARD_STACK_INFO}-cta`,
  /** Modifier on the text column while a burn session owns the title. */
  CARD_STACK_INFO_BURNING: `${_B_CARD_STACK_INFO}--burning`,
  /** Ink-hidden state on the title while the canvas owns its pixels. */
  CARD_STACK_INFO_TITLE_BURNING: `${_B_CARD_STACK_INFO}-title--burning`,
  /** The combustion canvas absolutely positioned over the title box. */
  CARD_STACK_INFO_TITLE_BURN: `${_B_CARD_STACK_INFO}-title-burn`,
  /** Rewrite-slot class the burn contract requires — card-stack never
   *  inserts the slot (burn-in happens on the title itself). */
  CARD_STACK_INFO_TITLE_SLOT: `${_B_CARD_STACK_INFO}-title-slot`,
  /** Spacer-dup class the burn contract requires (unused — no slot). */
  CARD_STACK_INFO_TITLE_DUP: `${_B_CARD_STACK_INFO}-title-dup`,
  /** Draw-text rewrite class the burn contract requires (unused — no slot). */
  CARD_STACK_INFO_TITLE_REWRITE: `${_B_CARD_STACK_INFO}-title-rewrite`,
  /** "PROJECT 01 OF 08" counter heading the text column. */
  CARD_STACK_COUNTER: `${_B_CARD_STACK}-counter`,
  CARD_STACK_FOOT: `${_B_CARD_STACK}-foot`,
  /** "Drag or swipe to explore" affordance copy. */
  CARD_STACK_HINT: _B_CARD_STACK_HINT,
  /** Animated hand-gesture SVG inside the hint. */
  CARD_STACK_HINT_ICON: `${_B_CARD_STACK_HINT}-icon`,
  CARD_STACK_NAV: `${_B_CARD_STACK}-nav`,
  CARD_STACK_PREV: `${_B_CARD_STACK}-prev`,
  CARD_STACK_NEXT: `${_B_CARD_STACK}-next`,
  /** Arrow glyph inside the prev/next foot buttons — nudges outward on
   *  hover/focus (the carousel controls' ±4px affordance contract). */
  CARD_STACK_ARROW: `${_B_CARD_STACK}-arrow`,
  /** Autoplay play/pause transport in the foot nav — the border-light
   *  countdown's only manual control. */
  CARD_STACK_AUTOPLAY: `${_B_CARD_STACK}-autoplay`,
  /** Button modifier while the countdown runs — swaps the play glyph
   *  for pause bars (the button shows the ACTION it performs). */
  CARD_STACK_AUTOPLAY_ARMED: `${_B_CARD_STACK}-autoplay--armed`,
  /** The play-triangle glyph inside the autoplay button. */
  CARD_STACK_AUTOPLAY_PLAY: `${_B_CARD_STACK}-autoplay-play`,
  /** The pause-bars glyph inside the autoplay button. */
  CARD_STACK_AUTOPLAY_PAUSE: `${_B_CARD_STACK}-autoplay-pause`,
  /** The border-light band inside each card — a conic-gradient fill
   *  masked to the rounded edge that draws itself while the autoplay
   *  countdown runs (the 10s progress a user can see without a
   *  numeric counter). */
  CARD_STACK_TIMER: `${_B_CARD_STACK}-timer`,
  /** Section modifier while the countdown is armed — reveals the
   *  active card's border light. */
  CARD_STACK_AUTO: `${_B_CARD_STACK}--auto`,
  /** Section modifier while the countdown is frozen — a user pause or
   *  the off-screen hold; the light hangs mid-orbit. */
  CARD_STACK_AUTO_PAUSED: `${_B_CARD_STACK}--auto-paused`,
  /** Deck-stack icon button between prev/next — the stacked layouts'
   *  compact "view all" affordance (replaces the dot cluster there;
   *  opens the same index overlay the header toggle does). */
  CARD_STACK_NAV_INDEX: `${_B_CARD_STACK}-nav-index`,
  /** Stacked-cards glyph inside the nav-index button. */
  CARD_STACK_NAV_INDEX_ICON: `${_B_CARD_STACK}-nav-index-icon`,
  /** Live "1 / 13" position text beside the nav-index glyph — the
   *  stacked layouts' counter (replaces the header counter there; the
   *  aria-label carries the localized "Project 1 of 13" phrase). */
  CARD_STACK_NAV_INDEX_NUM: `${_B_CARD_STACK}-nav-index-num`,
  /** Deal animation on the nav-index icon after a next nav — the top
   *  card of the glyph flings forward and slides back under the stack. */
  CARD_STACK_NAV_INDEX_DEAL_NEXT: `${_B_CARD_STACK}-nav-index--deal-next`,
  /** Deal animation mirrored for a prev nav. */
  CARD_STACK_NAV_INDEX_DEAL_PREV: `${_B_CARD_STACK}-nav-index--deal-prev`,
  CARD_STACK_DOTS: `${_B_CARD_STACK}-dots`,
  CARD_STACK_DOT: _B_CARD_STACK_DOT,
  /** Visible position number inside each nav dot (shared dot-nav grid). */
  CARD_STACK_DOT_NUM: `${_B_CARD_STACK_DOT}-num`,
  CARD_STACK_DOT_ACTIVE: `${_B_CARD_STACK_DOT}--active`,
  /** All-projects index overlay — strip rail on desktop, bottom sheet on mobile. */
  CARD_STACK_INDEX: _B_CARD_STACK_INDEX,
  CARD_STACK_INDEX_HEAD: `${_B_CARD_STACK_INDEX}-head`,
  CARD_STACK_INDEX_TITLE: `${_B_CARD_STACK_INDEX}-title`,
  CARD_STACK_INDEX_CLOSE: `${_B_CARD_STACK_INDEX}-close`,
  /** Prev/next arrow cluster in the index head — scrolls the rail. */
  CARD_STACK_INDEX_NAV: `${_B_CARD_STACK_INDEX}-nav`,
  /** Rail scroll-backward arrow. */
  CARD_STACK_INDEX_PREV: `${_B_CARD_STACK_INDEX}-prev`,
  /** Rail scroll-forward arrow. */
  CARD_STACK_INDEX_NEXT: `${_B_CARD_STACK_INDEX}-next`,
  CARD_STACK_INDEX_LIST: `${_B_CARD_STACK_INDEX}-list`,
  CARD_STACK_INDEX_ITEM: `${_B_CARD_STACK_INDEX}-item`,
  CARD_STACK_INDEX_NUM: `${_B_CARD_STACK_INDEX}-num`,
  CARD_STACK_INDEX_NAME: `${_B_CARD_STACK_INDEX}-name`,
  CARD_STACK_INDEX_SUB: `${_B_CARD_STACK_INDEX}-sub`,
  CARD_STACK_INDEX_THUMB: `${_B_CARD_STACK_INDEX}-thumb`,
})
