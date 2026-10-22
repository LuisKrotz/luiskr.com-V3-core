/**
 * @file tokens/classes/a11y.js
 * @description Accessibility-only class tokens — token group.
 */

/**
 * Accessibility-only class tokens. Sole declaration site — consumers import members
 * from this frozen map rather than re-declaring the literals
 * (zero-hardcoding rule).
 */
export const A11Y_CLASSES = Object.freeze({
  SR_ONLY: 'sr-only',
  SR_ONLY_ALPHA: 'sr-only-alpha',
  /** Keyboard skip-link — visually hidden until :focus-visible. */
  SKIP_LINK: 'skip-link',
})
