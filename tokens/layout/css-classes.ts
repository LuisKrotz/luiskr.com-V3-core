/**
 * @file tokens/layout/css-classes.js
 * @description Width-class registry for breakpoint-scoped stylesheet
 * delivery — the runtime mirror of shared/build/css-classes.mjs
 * WIDTH_CLASSES. The compiled component sheets arrive tiered (?tiers):
 * an embedded base plus cumulative min-width media tiers fetched per
 * class, so a viewport only downloads the responsive CSS it can apply.
 * These tokens name the classes and hold the matchMedia gates; a
 * governance test asserts this table never drifts from the build-side
 * registry.
 */

/** Ordered narrow → wide; the rank drives "highest tier ≤ viewport" picks. */
export const WIDTH_CLASS_NAMES = Object.freeze(['mobile', 'tablet', 'desktop', 'wide'] as const)

/** A cumulative-stylesheet width class. */
export type WidthClass = (typeof WIDTH_CLASS_NAMES)[number]

/**
 * Class → rank (mobile 0 … wide 3). Ordering is load-bearing: a picked
 * tier is the highest-ranked key whose gate the viewport satisfies.
 */
export const WIDTH_CLASS_RANK: Readonly<Record<WidthClass, number>> = Object.freeze({
  mobile: 0,
  tablet: 1,
  desktop: 2,
  wide: 3,
})

/**
 * Class → matchMedia query that first makes the class reachable — the
 * lowest member breakpoint of the class. Mirrors
 * `WIDTH_CLASSES[].gate` in shared/build/css-classes.mjs.
 */
export const WIDTH_CLASS_GATES: Readonly<Record<WidthClass, string>> = Object.freeze({
  mobile: '(min-width: 319px)',
  tablet: '(min-width: 767px)',
  desktop: '(min-width: 1279px)',
  wide: '(min-width: 2559px)',
})
