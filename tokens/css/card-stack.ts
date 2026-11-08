/**
 * @file tokens/css/card-stack.js
 * @description Card-stack CSS custom-property names — grouped subset
 * of CSS_PROPS.
 */

/**
 * Card-stack-related CSS custom-property names. Sole declaration site —
 * consumers import members from this frozen map rather than re-declaring
 * the literals (zero-hardcoding rule).
 */
export const CARD_STACK_CSS_PROPS = Object.freeze({
  /** The autoplay border light's progress — a 0–100% custom property
   *  autoplay.ts writes per-frame on the host element; it inherits
   *  through the shadow boundary into the active card's conic-gradient
   *  border band and the transport's rim ring. */
  CARD_STACK_TIMER_P: '--card-stack-timer-p',
})
