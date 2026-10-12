/**
 * @file tokens/starfield/params/camera.ts
 * @description Camera-rig and navigation parameters — field of view,
 * far/near planes, the fly-to tween and idle-drift timing, approach
 * thresholds that arm the lazy dossier fetch, orbit-controls zoom
 * bounds, and arrow-key view rotation. Split from the monolithic
 * `params.ts`; consumers keep importing through the `../params.js`
 * barrel.
 */

/** Camera rig constants for the star-field engine. */
export const SF_CAMERA = Object.freeze({
  FOV: 55,
  /**
   * Near plane — the solar tier is drawn at honest stellar-neighbourhood
   * scale (planets are ~0.001-unit specks), so the near plane must sit
   * under the closest lawful approach (SF_ZOOM.MIN 0.02). The FAR/NEAR
   * ratio of 2e7 is far beyond linear 24-bit depth precision, so the
   * renderer runs a logarithmic depth buffer — see renderer-setup.
   */
  NEAR: 0.1,
  /**
   * Far plane — reaches the cosmic tier and observable-universe boundary
   * shell with logarithmic depth buffer precision.
   */
  FAR: 1000000000,
  /** Home/overview pose — frames the solar system tier out to Kuiper belt. */
  HOME_X: 0,
  HOME_Y: 60,
  HOME_Z: 180,
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
  PAD: 50,
  SCALE: 4,
})

/**
 * Orbit-controls zoom bounds — clamps how far the camera can dolly:
 * MIN keeps a close approach above the body surface; MAX frames the
 * whole cosmic hierarchy — Milky Way, the Local Group neighbourhood and
 * the supercluster/observable-universe shells.
 */
export const SF_ZOOM = Object.freeze({
  /** Closest lawful camera–target distance above body surface. */
  MIN: 1.0,
  MAX: 600000000,
  /**
   * Fly-to standoff multiplier — the camera glides to STANDOFF × the
   * body's radius along its current view direction.
   */
  STANDOFF: 3.5,
  /** Fly-to standoff floor. */
  STANDOFF_MIN: 5,
})

/**
 * Hover/hint tooltip projection — the navigator's position hint clamps
 * the picked body's projected marker inside the canvas edge when the
 * object sits off-screen or behind the camera, so hovering a catalog row
 * locates it at any zoom level. EDGE_PAD is the canvas-space inset (px)
 * that keeps the marker dot and its label readable on the frame edge.
 */
export const SF_TIP = Object.freeze({
  EDGE_PAD: 56,
})

/**
 * Arrow-key view rotation — radians per keypress applied around the
 * controls target; POLAR clamps keep the camera off the poles.
 */
export const SF_KEYS = Object.freeze({
  AZIMUTH: 0.12,
  POLAR: 0.1,
  PHI_MIN: 0.08,
})
