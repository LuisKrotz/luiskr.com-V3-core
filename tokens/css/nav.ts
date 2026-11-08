/**
 * @file tokens/css/nav.js
 * @description Nav strip glyph paint CSS custom-property names — the
 * search magnifier's glass/rim ramp and the neon palette the globe, grid,
 * brush and search glyphs reference; declared by the nav-controls SCSS and
 * the token sheet. Grouped subset of CSS_PROPS.
 */

/**
 * CSS custom properties for the nav strip glyphs. Sole declaration site —
 * consumers import members from this frozen map rather than re-declaring
 * the literals (zero-hardcoding rule).
 */
export const NAV_SEARCH_CSS_PROPS = Object.freeze({
  /** Glass highlight — lens face lit center. */
  SEARCH_HI: '--nav-search-hi',
  /** Glass base — lens face mid tone. */
  SEARCH_MID: '--nav-search-mid',
  /** Glass shadow — lens face edge falloff. */
  SEARCH_LO: '--nav-search-lo',
  /** Lit rim — ring edge highlight where the light lands. */
  SEARCH_EDGE_HI: '--nav-search-edge-hi',
  /** Dark rim — ring edge underside. */
  SEARCH_EDGE_LO: '--nav-search-edge-lo',
  /** Specular glint — the orbiting lens flare. */
  SEARCH_GLINT: '--nav-search-glint',
  /** Neon palette — published from the token sheet. */
  NEON_TEAL: '--nav-neon-teal',
  NEON_GREEN: '--nav-neon-green',
  NEON_VIOLET: '--nav-neon-violet',
  NEON_MAGENTA: '--nav-neon-magenta',
  NEON_ORANGE: '--nav-neon-orange',
  NEON_CHROME: '--nav-neon-chrome',
})
