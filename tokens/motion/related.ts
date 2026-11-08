/**
 * @file tokens/motion/related.js
 * @description Related-projects accordion-list timing/geometry tokens —
 * grouped subsets of the shared CAROUSEL-style motion contract.
 */

/**
 * Visible-window geometry for the related-projects conveyor. Sole
 * declaration site — consumers import members from this frozen map
 * rather than re-declaring the literals (zero-hardcoding rule).
 */
export const RELATED_LAYOUT = Object.freeze({
  /** Cards expanded in the list viewport at once — the conveyor keeps
   *  exactly this many items unfolded; the rest sit in zero-height
   *  (grid-template-rows 0fr) slots until a manual step folds them in. */
  VISIBLE_COUNT: 3,
})

/**
 * Related-list motion tokens. Sole declaration site — consumers import
 * members from this frozen map rather than re-declaring the literals.
 */
export const RELATED_TIMING = Object.freeze({
  /**
   * Collapsed-node reorder watchdog (ms). Sized just past the .6s
   * grid-template-rows fold so a manually folded item finishes
   * collapsing before it is appended (at zero height, invisibly) to
   * the list tail — the same watchdog pattern
   * CAROUSEL_TIMING.TELEPORT_DELAY uses for clone→real jumps.
   */
  REORDER_DELAY: 750,
})
