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
  /**
   * Sphere tessellation — 128×64 ≈ 16k triangles per body, the ultra
   * tier: at this density a planet's limb holds a smooth arc even at
   * full-screen zoom and the terminator never facets under refraction
   * in the fresnel shells. Catalog bodies stay resident (~150 meshes ≈
   * 2.4M tris is trivially GPU-bound territory) while registry bodies
   * ride the LRU spawn/evict path, so the budget holds.
   */
  SPHERE_SEGMENTS: 128,
  RING_SEGMENTS: 192,
  /**
   * Icosahedron subdivision detail for irregular bodies (Phobos-class
   * rubble moons, comet nuclei, asteroids) — detail 6 ≈ 82k triangles:
   * the crumpled silhouette stays continuous under glancing light, no
   * facet flash at the terminator. Only `def.irregular` bodies pay the
   * density — a dozen catalog bodies at most.
   */
  ROCK_DETAIL: 6,
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
