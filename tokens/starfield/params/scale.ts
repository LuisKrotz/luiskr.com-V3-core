/**
 * @file tokens/starfield/params/scale.ts
 * @description Astronomical-scale and hierarchy-structure parameters —
 * the three-tier distance compression (galactic / Local-Group / cosmic),
 * the Milky Way disc geometry and co-rotation bubble, the solar-tier
 * legibility shrink, and the boundary-shell/speckle tuning for cluster
 * and universe structures. Split from the monolithic `params.ts`.
 */

/**
 * Astronomical scale tiers — the chart is a multi-scale diagram, not a
 * linear map: 20 orders of magnitude separate Neptune's orbit from the
 * observable universe, so distance compresses in three documented tiers
 * while every direction stays astronomically true.
 *
 *   Galactic tier  — 1 unit = 100 ly; the Milky Way disc (radius 520
 *                    units ≈ 52 000 ly) and its satellite dwarfs sit at
 *                    real scale relative to each other. The Sun rests at
 *                    267 units ≈ 26 700 ly from the disc centre.
 *   Local-Group    — beyond 1 Mly the scale drops to 800 ly/unit so M31
 *   tier             lands ~11 900 units out (true direction kept).
 *   Cosmic tier    — beyond 10 Mly the scale drops to 20 000 ly/unit;
 *                    superclusters and the observable-universe boundary
 *                    shell clamp onto the far field (~46k units) inside
 *                    the skybox.
 */
export const SF_SCALE = Object.freeze({
  /** Light-years per chart unit inside the galactic tier (1 ly = 250 chart units). */
  GALACTIC_LY: 0.004,
  /** Galactic→Local-Group break distance in light-years. */
  GALACTIC_BREAK: 100000,
  /** Light-years per unit between the two breaks. */
  LOCAL_GROUP_LY: 0.04,
  /** Local-Group→cosmic break distance in light-years. */
  LOCAL_GROUP_BREAK: 1e7,
  /** Light-years per unit in the cosmic tier. */
  COSMIC_LY: 1.0,
  /** Observable-universe boundary shell — far-field clamp in units. */
  COSMIC_CLAMP: 500000000,
  /**
   * Milky Way disc tilt (radians) — the one shared frame lean applied by
   * the particle disc, the deep-field cloud, and every authored body
   * placed through `sfGalacticPos`, so all layers share one galaxy plane.
   */
  MW_TILT: 0.35,
  /**
   * Milky Way disc radius in light-years (~52 000 ly → 13 000 000 chart units at
   * the galactic tier). The disc center sits `SUN_GC_LY` down −X so the
   * Sun lands at its true 0.51 galactocentric radius inside the disc.
   */
  MW_DISC_LY: 52000,
  /**
   * Galactic co-rotation radius (chart units, heliocentric) — covers the
   * Milky Way disc so the solar system, the named-star neighborhood,
   * nebulae, and the deep-field cloud orbit the galactic centre as one
   * structure, while extragalactic structures stay world-fixed.
   */
  CO_ROTATE_R: 20000000,
  /**
   * Solar-tier diagram scale — 1 preserves the authored planetary system
   * dimensions (Sun radius 12, Earth orbit 39, Neptune orbit 106, Kuiper belt
   * 150) cleanly within its own domain without shrinking bodies to sub-pixels.
   */
  SOLAR_SCALE: 1,
})

/**
 * Cosmic-hierarchy structures — boundary shells and member speckles for
 * the Local Group, superclusters and the observable universe. Shells are
 * huge translucent spheres (camera sits inside or outside depending on
 * zoom) and the speckle clouds inside them stand in for member galaxies.
 */
export const SF_STRUCTURE = Object.freeze({
  /** Shell sphere tessellation — low, it is a boundary hint not a body. */
  SEGMENTS: 48,
  /** Shell rim brightness at grazing angles — a whisper: the boundary
   *  must read as a faint meniscus at extreme grazing angles only, never
   *  as a painted ball. Additive rims still stack into a visible film
   *  when the camera sits inside a huge boundary (e.g.
   *  interstellar-neighborhood), so this stays far under the speckle
   *  opacity the member-galaxy field carries. */
  SHELL_OPACITY: 0.028,
  /** Fresnel exponent — higher tightens the rim to a hairline bubble
   *  edge; lower spreads a broad halo inward. */
  SHELL_RIM: 7.0,
  /**
   * Shell fade-in band (× radius) — the camera must pull back to at least
   * FADE_IN·r before the boundary becomes visible, ramping to full at
   * FADE_OUT·r. This hides the inside of every hierarchy bubble while the
   * viewer is deep within it (the giant cream-ball / soap-bubble bug).
   */
  FADE_IN: 1.25,
  FADE_OUT: 1.7,
  /** Member-galaxy speckle count inside cluster/supercluster volumes. */
  SPECKLE_COUNT: 1400,
  /**
   * Speckle size (world units) — small enough that thousands of members
   * read as a point field at cosmic zoom, not an additive fog.
   */
  SPECKLE_PX: 2,
  SPECKLE_OPACITY: 0.35,
  /** Per-speckle brightness floor — jitters up to 1.0 like a galaxy field. */
  SPECKLE_DIM: 0.35,
  /** Speckle radius fraction of the shell — members keep off the skin. */
  SPECKLE_FILL: 0.82,
  /**
   * Speckle volume flattening — galaxy clusters and superclusters are
   *  flattened filament/sheet-like collections, not uniform spheres. The Y
   *  axis is squashed by this factor to break the "disco ball" look.
   */
  SPECKLE_FLATTEN: 0.25,
  /**
   * Speckle radial concentration — lower exponents push members toward the
   *  center (dense core + sparse outskirts); 1.0 is uniform volume.
   */
  SPECKLE_CONCENTRATE: 0.55,
})
