/**
 * @file tokens/media/budget.js
 * @description Media spend-tier vocabulary — the values `mediaBudget()`
 * returns and every consumer compares against. Sole declaration site
 * (zero-hardcoding rules 4–5); Object.freeze makes the contract
 * immutable at runtime.
 */

/**
 * Frozen media budget map — 'low' (saveData/≤2g: poster + first rung
 * only), 'medium' (3g: autoplay allowed, top rung skipped), 'full'
 * (4g/unknown: unrestricted climb).
 */
export const MEDIA_BUDGET = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  FULL: 'full',
})
