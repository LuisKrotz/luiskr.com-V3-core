/**
 * @file tokens/motion/parallax.js
 * @description Scroll-parallax parameters for the home view — per-layer
 * px amplitudes and the write deadband. Consumed by
 * routes/views/home/parallax.ts (desktop ≥1280 only).
 */

/**
 * Frozen home-parallax parameter map — sole declaration site for these
 * numbers; consumers import members rather than re-declaring literals.
 *
 * Each amplitude is the translateY magnitude (px) a layer reaches at
 * progress ±1 — i.e. when its centre sits one transit-range above or
 * below the viewport centre. Positive values TRAIL the scroll (the
 * layer moves slower than the page → reads as depth); a negative value
 * LEADS it (counter-drift).
 */
export const PARALLAX = Object.freeze({
  /** .card-stack-deck inside <card-stack> — the cards RECEDE slower
   *  than the scroll (linger on exit, slide under the incoming
   *  section) while the section chrome stays put — the classic
   *  hero parallax and the strongest depth cue on the page. */
  DECK_Y: -160,
  /** .card-stack-foot inside <card-stack> — the controls row RISES
   *  (leads the exit) so it pulls clear of the about section
   *  instead of being dragged over the boundary. */
  DECK_FOOT_Y: 120,
  /** .about-main column inside <about-section> — trails the scroll so
   *  the portrait/title stack lags the bio column. */
  ABOUT_MAIN_Y: 96,
  /** .about-profile-text column — counter-drift vs .about-main: the
   *  bio sweeps ahead, so the two columns slide against each other by
   *  the combined differential. */
  ABOUT_TEXT_Y: -56,
  /** Contact text block (title/subtitle/links row) — LEADS into the
   *  band while the nested mentions deck stays fixed; on exit the
   *  copy lingers, sliding over the fan below. */
  CONTACT_Y: -64,
  /** Awards band content rows — LEAD the scroll (never trail): the
   *  footer is the page's last element, so a trailing drift would
   *  extend the document's scrollable overflow and grow a dead
   *  scroll range past the footer. Leading keeps every offset
   *  inside the page. */
  AWARDS_Y: -88,
  /** |Δpx| floor before a layer's CSS var is rewritten — anything
   *  smaller paints identically, so skipping it kills sub-pixel
   *  style-recalc churn during long flings. */
  WRITE_EPSILON: 0.5,
})
