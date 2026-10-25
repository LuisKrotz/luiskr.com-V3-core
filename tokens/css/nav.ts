/**
 * @file tokens/css/nav.js
 * @description Nav gear SVG paint CSS custom-property names — the steel
 * ramp stops the gear gradients reference; declared by the nav-controls
 * SCSS on .nav-gear-svg. Grouped subset of CSS_PROPS.
 */

/**
 * Nav gear paint custom-property names. Sole declaration site — consumers
 * import members from this frozen map rather than re-declaring the
 * literals (zero-hardcoding rule).
 */
export const NAV_GEAR_CSS_PROPS = Object.freeze({
  /** Bright steel — face/hub highlight stop. */
  GEAR_HI: '--nav-gear-hi',
  /** Base steel — the metal mid tone (--text-primary pass-through). */
  GEAR_MID: '--nav-gear-mid',
  /** Shadowed steel — face/hub edge stop. */
  GEAR_LO: '--nav-gear-lo',
  /** Lit rim — tooth-edge highlight where the light lands. */
  GEAR_EDGE_HI: '--nav-gear-edge-hi',
  /** Dark rim — tooth-edge underside. */
  GEAR_EDGE_LO: '--nav-gear-edge-lo',
  /** Hole mid — drilled-cavity wall tone. */
  GEAR_HOLE: '--nav-gear-hole',
  /** Hole deep — the unlit cavity core. */
  GEAR_HOLE_LO: '--nav-gear-hole-lo',
  /** Hole lit — the far inner wall catching the light. */
  GEAR_HOLE_HI: '--nav-gear-hole-hi',
  /** Specular glint — the fixed top-left rim arc. */
  GEAR_GLINT: '--nav-gear-glint',
})
