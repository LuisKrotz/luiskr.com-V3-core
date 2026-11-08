/**
 * @file tokens/motion/mentions-deck.js
 * @description Mentions-deck strip geometry + timing tokens — grouped subset
 * of the deck motion config.
 */

/**
 * Strip geometry for <mentions-deck> — all per-card pose numbers are computed in
 * JS (mentions-deck/deck.ts) and written as inline transform/opacity/z-index;
 * these constants are the sole declaration site for the strip curve. The
 * mention deck is a flat centered band: the front card anchors at the deck's
 * horizontal center and neighbours extend at a small margin in both
 * directions — no tilt, drop or scale, so the row reads as one continuous
 * strip. Wide decks dissolve cards out as they approach the deck edge —
 * a card is never abruptly cut by the boundary. Narrow (mobile) decks
 * instead run a peek layout: the dissolve lane collapses to 0 and
 * neighbours clip at the boundary at full opacity, so partial cards
 * show on both sides of the front card.
 */
export const MENTIONS_DECK_LAYOUT = Object.freeze({
  /** Front-card anchor as a fraction of deck width — 0.5 centers the active
   *  card; the strip extends symmetrically to both edges. */
  ANCHOR_FRAC: 0.5,
  /** Inter-card margin as a fraction of card width — the small gap that
   *  separates neighbours in the strip. */
  GAP_RATIO: 0.05,
  /** Edge-dissolve span as a fraction of card width — a card dims over
   *  this distance while crossing the deck edge, reaching opacity 0 by
   *  the time its center leaves the canvas. The same span sizes the
   *  deck's mask-gradient dissolve lane (--mentions-deck-fade), so the
   *  boundary itself fades to 0 and no card is ever visibly cut. */
  FADE_FRAC: 0.5,
  /** Edge-dissolve span on mobile decks — 0 disables the dissolve: the
   *  mask lane collapses to the clip edge and a card stays fully opaque
   *  while any pixel is inside the deck, so partial neighbours peek at
   *  full color instead of dimming into a vignette. */
  FADE_FRAC_MOBILE: 0,
  /** Minimum ring length that may fit its full strip inside the deck —
   *  shorter rings keep the width clamp and center what they have. */
  FILL_MIN: 3,
  /** Lower bound the fill-fit may shrink to, as a fraction of CARD_W_MIN —
   *  below it the ring can't fit at a readable width and the clamp stands
   *  (extra cards dissolve at the edges instead). */
  FILL_FLOOR: 0.85,
  /** z-index stride between depth layers. */
  Z_STRIDE: 10,
  /** Card width floor (px) on small viewports. */
  CARD_W_MIN: 270,
  /** Card width cap (px) on wide viewports — the fill-fit may exceed it
   *  when the ring is too short to span the deck otherwise. */
  CARD_W_MAX: 312,
  /** Card width as a fraction of the deck width when unclamped. */
  CARD_W_VW: 0.25,
  /** Card width as a fraction of the deck width on mobile decks — ~72%
   *  leaves an even sliver of each neighbour peeking past the clip edge,
   *  so the strip advertises more cards on both sides of the front. */
  CARD_W_VW_MOBILE: 0.72,
  /** Card width floor (px) on mobile decks — the readability bound under
   *  the vw fraction on the narrowest phones. */
  CARD_W_MIN_MOBILE: 240,
  /** Card height as a multiple of its width — landscape cards (~1.56:1). */
  CARD_H_RATIO: 0.64,
  /** Deck region height as a multiple of card height — headroom so card
   *  shadows never clip against the deck's overflow edge. */
  DECK_H_RATIO: 1.24,
  /** Fallback card width (px) when layout is unmeasurable (pre-paint). */
  CARD_W_FALLBACK: 300,
  /** Drag distance (px) before a gesture commits to the deck (versus a
   *  vertical page scroll). */
  DRAG_SLOP: 6,
  /** Drag fraction of one step that triggers a nav on release. */
  DRAG_THRESHOLD: 0.22,
  /** Flick velocity (px/ms) that carries a short drag to the next card. */
  FLICK_VEL: 0.35,
  /** px tolerance for "offset ≈ front" — class/ARIA front detection. */
  FRONT_EPS: 0.5,
  /** Zero-pad width for the card ordinals ('01', '08'). */
  PAD: 2,
  /** Autoplay dwell per front card (ms) — 10s matches the retired footer
   *  carousel's ambient pace; gated on ≥50% visibility + reduced-motion. */
  AUTOPLAY_MS: 10000,
})
