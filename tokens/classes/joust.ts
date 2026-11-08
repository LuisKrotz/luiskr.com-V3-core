/**
 * @file tokens/classes/joust.js
 * @description Joust class tokens — the shared click-to-reveal contract
 * for round icon chips. `joust` marks the chip root (the element the gate
 * pins), `joust--open` is the pinned modifier the chip stylesheets pair
 * with their `:hover`/`:focus-visible` reveal selectors, and `joust-label`
 * marks the revealed text span. Grouped token group.
 */

import { _B_JOUST } from '../base.js'

/**
 * Frozen joust class-name map — sole declaration site for these tokens; consumers read members
 * and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes the
 * token contract immutable at runtime.
 */
export const JOUST_CLASSES = Object.freeze({
  JOUST: _B_JOUST,
  JOUST_OPEN: `${_B_JOUST}--open`,
  JOUST_LABEL: `${_B_JOUST}-label`,
})
