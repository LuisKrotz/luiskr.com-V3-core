/**
 * @file tokens/starfield/params/scene.ts
 * @description Scene-shell and fallback parameters — the skybox radius,
 * sphere/ring tessellation and the scene light rig, plus the 2D canvas
 * fallback starfield tuning (density, glints, milky-band geometry) used
 * when the WebGL engine cannot boot. Split from the monolithic
 * `params.ts`.
 */

/**
 * 2D fallback starfield — painted once into a plain canvas when the WebGL
 * engine can't boot. Density/seed constants so the no-GPU surface still
 * reads as the same chart instead of a black void.
 */
export const SF_FALLBACK = Object.freeze({
  /** One star per N² css px of surface area. */
  STAR_DENSITY: 2400,
  /** Hard cap so 8K displays don't allocate thousands of arcs. */
  STAR_MAX: 1600,
  /** Brightest star radius in css px (most stars draw smaller). */
  STAR_SIZE_MAX: 1.7,
  /** Fraction of stars that get a diffraction-cross glint. */
  GLINT_RATIO: 0.05,
  /** Extra micro-stars densified along the milky band. */
  BAND_STARS: 320,
  /** Band slope (dy/dx) across the viewport. */
  BAND_TILT: -0.32,
  /** Band thickness as a fraction of viewport height. */
  BAND_WIDTH: 0.18,
  /** Alpha ceiling for the dimmest quartile of field stars. */
  DIM_ALPHA: 0.35,
})

/** Skybox sphere + starfield scales. */
export const SF_SCENE = Object.freeze({
  /**
   * Skybox sphere radius — wraps the whole multi-tier chart (the
   * observable-universe shell clamps at ~46k units, the skybox must sit
   * beyond it or the panorama would clip through the boundary).
   */
  SKYBOX_RADIUS: 64000,
  SPHERE_SEGMENTS: 48,
  RING_SEGMENTS: 96,
  /**
   * Icosahedron subdivision detail for irregular bodies (Phobos-class
   * rubble moons) — detail 4 ≈ 5k triangles, matching the 48-segment
   * sphere's vertex density so a crumpled moon stays smooth between
   * dimples while still reading faceted at the silhouette.
   */
  ROCK_DETAIL: 4,
  /**
   * Fill-light intensity — kept low so the sun point light owns the
   * terminator and planets shade with real day/night contrast instead of
   * reading flat (a high ambient lifts the unlit hemisphere to nearly
   * the lit-side brightness and washes out every texture).
   */
  AMBIENT_INT: 0.35,
  /** Sun point-light intensity at the scene origin (no decay). */
  SUN_INT: 3,
})
