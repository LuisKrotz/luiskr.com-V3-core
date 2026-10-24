/**
 * @file tokens/starfield/badge.js
 * @description "Featured on Three.js Resources" showcase-badge tokens —
 * the provider's showcase deep link and logo mark for the star-field
 * experiment chrome. Sole declaration site — consumers import members
 * from this frozen map rather than re-declaring the literals
 * (zero-hardcoding rule).
 * @type {Readonly<Record<string, string>>}
 */

/**
 * Frozen showcase-badge URL map — sole declaration site; consumers read
 * members and never re-declare the strings.
 */
export const SF_BADGE = Object.freeze({
  /** Showcase deep link — `?ref=badge` is the provider's attribution parameter. */
  SHOWCASE: 'https://threejsresources.com/showcase/star-field-experiment?ref=badge',
  /** Provider mark — remote SVG rendered inside the badge chip. */
  LOGO: 'https://threejsresources.com/logo.svg',
})
