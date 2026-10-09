/**
 * @file tokens/starfield/params.js
 * @description Star-field engine parameters — camera rig, fly-to tween
 * timing, approach thresholds that trigger the lazy dossier fetch, and
 * the procedural material palette used for bodies without real imagery
 * (dwarf planets, exoplanets, stars, nebulae, galaxies). Sole declaration
 * site — consumers import members (zero-hardcoding rule).
 */

/** Camera rig constants for the star-field engine. */
export const SF_CAMERA = Object.freeze({
  FOV: 55,
  NEAR: 0.1,
  FAR: 8000,
  /** Home/overview pose — pulled back far enough to read the whole chart. */
  HOME_X: 0,
  HOME_Y: 90,
  HOME_Z: 260,
  TARGET_X: 0,
  TARGET_Y: 0,
  TARGET_Z: 0,
})

/** Fly-to tween + idle drift timing (ms / scene-units per second). */
export const SF_MOTION = Object.freeze({
  /** Camera flight duration on body select — long enough to read as a glide. */
  FLY_MS: 2600,
  /** Controls damping factor per frame (OrbitControls.enableDamping). */
  DAMPING: 0.06,
  /** Base orbit angular speed (rad/s) multiplied by each body's speed field. */
  ORBIT_SPEED: 0.05,
  /** Base self-rotation speed (rad/s) multiplied by each body's spin field. */
  SPIN_SPEED: 0.12,
})

/**
 * Lazy-dossier trigger distance — the JSON for a body prefetches when the
 * camera comes within `approachPad + body.radius * approachScale` units,
 * so big bodies arm their data earlier than small ones.
 */
export const SF_APPROACH = Object.freeze({
  PAD: 30,
  SCALE: 6,
})

/**
 * Procedural material palette — hex colors for bodies with no real imagery.
 * Star tints follow spectral class (G yellow-white, B blue, M red);
 * nebula/galaxy hues are emissive accents on a dark sprite.
 */
export const SF_COLORS = Object.freeze({
  PLUTO: 0xa98c6f,
  CERES: 0x9a938a,
  PROXIMA_STAR: 0xd9594c,
  PROXIMA_PLANET: 0x6f8fa8,
  ALPHA_STAR: 0xf2e6b8,
  ALPHA_COMPANION: 0xd98a4a,
  SIRIUS: 0xcfe0ff,
  VEGA: 0xd6e4ff,
  BETELGEUSE: 0xe07b39,
  TRAPPIST_STAR: 0xb3543e,
  TRAPPIST_PLANET: 0x7d94a6,
  SAGITTARIUS_A: 0x000000,
  ACCRETION: 0xffb45e,
  ORION_NEBULA: 0x7ea8e0,
  EAGLE_NEBULA: 0x5e8f7a,
  CRAB_NEBULA: 0x7a5ea8,
  HELIX_NEBULA: 0x8fb8d8,
  MILKY_WAY: 0xcfd8ec,
  ANDROMEDA: 0xd8c8a8,
  TRIANGULUM: 0xc8b8d8,
  ORBIT_LINE: 0x4a5568,
  LABEL: 0xe6ecf5,
  AMBIENT: 0x223044,
  EMISSIVE_SUN: 0xffd27a,
  /** White sunlight point-light at the scene origin. */
  SUN_LIGHT: 0xffffff,
  /** Glow ramp stops — canvas gradient needs literal rgba strings. */
  GLOW_INNER: 'rgba(255,255,255,1)',
  GLOW_MID: 'rgba(255,255,255,0.55)',
  GLOW_OUTER: 'rgba(255,255,255,0)',
})

/** Skybox sphere + starfield scales. */
export const SF_SCENE = Object.freeze({
  SKYBOX_RADIUS: 3500,
  ORBIT_SEGMENTS: 128,
  SPHERE_SEGMENTS: 48,
  RING_SEGMENTS: 96,
})
