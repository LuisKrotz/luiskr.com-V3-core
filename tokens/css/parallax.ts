/**
 * @file tokens/css/parallax.js
 * @description Scroll-parallax CSS custom-property names — grouped
 * subset of CSS_PROPS.
 */

/**
 * Parallax CSS custom-property names — sole declaration site. The home
 * view's parallax session (routes/views/home/parallax.ts) writes these
 * inline on each section host once per scroll frame; the custom
 * properties inherit into the host's shadow DOM where the component's
 * own stylesheet consumes them (`var(--…)` inside translate3d on INNER
 * content — never on the painted section root, so section backgrounds
 * and boundaries stay glued to the page).
 */
export const PARALLAX_CSS_PROPS = Object.freeze({
  /** .card-stack-deck drift — written on the <card-stack> host,
   *  consumed inside card-stack's own sheet so the deck slides
   *  against the section's static chrome. */
  DECK_Y: '--deck-parallax-y',
  /** .card-stack-foot drift — same host; the controls row rises
   *  counter to the deck so it never clashes with the about
   *  section sliding in beneath it. */
  FOOT_Y: '--foot-parallax-y',
  /** .about-main column drift — written on the <about-section> host,
   *  inherited into its shadow and consumed by about/_section.scss. */
  ABOUT_MAIN_Y: '--about-parallax-main-y',
  /** .about-profile-text column drift — same host/inheritance path. */
  ABOUT_TEXT_Y: '--about-parallax-text-y',
  /** Contact text block drift — written on the <contact-section> host,
   *  consumed by .contact-title/.contact-subtitle/.contact-row as one
   *  glued unit inside the painted band. */
  CONTACT_Y: '--contact-parallax-y',
  /** Awards band content drift — written on <awards-mentions>, consumed
   *  by the footer's inner rows as one glued unit. */
  AWARDS_Y: '--awards-parallax-y',
})
