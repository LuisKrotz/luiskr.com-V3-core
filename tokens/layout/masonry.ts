/**
 * @file tokens/layout/masonry.js
 * @description Masonry layout constants. These match the Vue source values
 * exactly — any change must be reflected in both the WASM layout worker and
 * these constants.
 */

/**
 * Masonry layout constants. These match the Vue source values exactly. Sole declaration site — consumers import members
 * from this frozen map rather than re-declaring the literals
 * (zero-hardcoding rule).
 */
export const LAYOUT = Object.freeze({
  /** Aspect ratio multiplier for featured (wide) cards */
  FEAT_MULT: 0.48,
  /** Cycling aspect ratio multipliers for standard cards */
  COMP_MULTS: Object.freeze([0.56, 0.58, 0.54, 0.57, 0.55]),
  /** Inter-card gap in pixels */
  GAP: 16,
})

/**
 * Internals media-mosaic constants — the natural-size masonry wall that
 * replaces a carousel when a project section mixes wildly different media
 * heights. Sole declaration site — consumers import members rather than
 * re-declaring the literals (zero-hardcoding rule).
 */
export const INTERNAL_MOSAIC = Object.freeze({
  /**
   * Height-spread gate: a media group renders as a mosaic wall when
   * max(h/w) ÷ min(h/w) reaches this ratio — the tallest tile would paint
   * at least twice the height of the shortest at equal width (a 50/50
   * 16:9 + 9:16 mix spreads ≈3.16; uniform 16:9 sets stay ≈1.0).
   */
  RATIO_SPREAD_MIN: 2,
  /**
   * Natural-height cap (px) — a source taller than this can never paint
   * legibly inside a fixed-height carousel strip even when every sibling
   * shares its aspect (a 6000px capture renders ≈200px wide at strip
   * height). Any item past the cap flags the whole group for the wall.
   */
  TALL_ITEM_H: 2560,
  /** Default downscale divisor — tiles render at a third of the source's
   *  natural size so the painted box is always smaller than the file
   *  (display density ≥ 3× keeps every raster crisp). */
  DIVISOR_DEFAULT: 3,
  /** Deeper divisor for sources that still overflow the wall at /3. */
  DIVISOR_WIDE: 4,
  /** Floor-side divisor — when /3 (or /4) would shrink the tile below
   *  the expand-button minimum, halving keeps it usable. */
  DIVISOR_SMALL: 2,
  /**
   * Extreme-width gate (w ÷ h) — strips at least this wide (e.g. a
   * 1242×157 breadcrumb ≈ 7.9) cap at the DIVISOR_SMALL half-size rung:
   * their height can't reach MIN_TILE_H at /2, and the undivided rung
   * would paint them at original size across the whole wall.
   */
  EXTREME_WIDE_RATIO: 4,
  /**
   * Natural-size spread gate: a group also renders as the mosaic wall
   * when max(w·h) ÷ min(w·h) reaches this ratio — same-aspect sources
   * whose pixel sizes differ ≥3× (≈1.73× per side) paint at visibly
   * different scales in a uniform carousel strip.
   */
  AREA_SPREAD_MIN: 3,
  /**
   * Minimum rendered tile width (px) — the expand-modal trigger
   * ('click to open' pill + corner brackets ≈ 140px) must keep a usable
   * footprint; tiles under this floor re-derive at a smaller divisor.
   * Fibonacci-aligned with $space-5xl.
   */
  MIN_TILE_W: 144,
  /**
   * Minimum rendered tile height (px) — the same affordance constraint
   * on the short axis (button + bottom offset + breathing room).
   * Fibonacci-aligned with $space-4xl.
   */
  MIN_TILE_H: 89,
  /** Viewport width (px) at/below which the wall swaps back to the
   *  regular <custom-carousel> — the mobile layout contract. */
  CAROUSEL_MAX_W: 640,
})
