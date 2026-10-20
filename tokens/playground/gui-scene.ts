/**
 * @file tokens/playground/gui-scene.js
 * @description Scene-subsystem start values for the Earth Playground —
 * moon orbit, atmosphere scattering, cloud shadows, ocean BRDF, earth
 * surface, sun, camera, environment. Grouped subsets of DEFAULT_SP_GUI.
 */

/**
 * Scene-subsystem start values for the Earth Playground. Sole declaration site — consumers import members
 * from this frozen map rather than re-declaring the literals
 * (zero-hardcoding rule).
 */
export const SP_MOON_DEFAULTS = Object.freeze({
  ENABLED: true,
  SPEED: 0.0002,
  DISTANCE: 50,
  INCLINATION: 0,
})

/**
 * Frozen sp atmosphere map — sole declaration site for these tokens; consumers read members
 * and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes the
 * token contract immutable at runtime.
 */
export const SP_ATMOSPHERE_DEFAULTS = Object.freeze({
  MODE: 'Airglow',
  DENSITY: 20,
  RAYLEIGH_COLOR: 0x3377ff,
  MIE_COLOR: 0x0d374a,
  TWILIGHT_COLOR: 0xff5533,
  AIRGLOW_COLOR: 0x44ff55,
})

/**
 * Frozen sp cloud shadow map — sole declaration site for these tokens; consumers read
 * members and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes
 * the token contract immutable at runtime.
 */
export const SP_CLOUD_SHADOW_DEFAULTS = Object.freeze({
  DISTANCE: 1.2,
  INTENSITY: 0.8,
  COLOR: 0x334059,
})

/**
 * Frozen sp ocean map — sole declaration site for these tokens; consumers read members and
 * never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes the token
 * contract immutable at runtime.
 */
export const SP_OCEAN_DEFAULTS = Object.freeze({
  ROUGHNESS: 0,
  METALNESS: 0,
})

/**
 * Frozen sp earth map — sole declaration site for these tokens; consumers read members and
 * never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes the token
 * contract immutable at runtime.
 */
export const SP_EARTH_DEFAULTS = Object.freeze({
  ROTATION_SPEED: 0.0001,
  BUMP_SCALE: 5,
  TERRAIN_SHADOW_INTENSITY: 1,
  TERRAIN_SHADOW_OFFSET: 0.002,
  TRUE_INCLINATION: true,
  // Close-zoom detail ramp — the 2K equirect maps run out of texels far
  // above the ~100 km zoom floor, so camera-altitude-scaled boosters keep
  // terrain relief and city clusters readable on the way down.
  // Distances are world units (10u = 6371 km surface radius):
  //   DETAIL_START_DIST 12u ≈ 1274 km — ramp begins (previous zoom floor)
  //   DETAIL_FULL_DIST  10.6u ≈ 382 km — fully boosted below this
  DETAIL_START_DIST: 12,
  DETAIL_FULL_DIST: 10.6,
  DETAIL_BUMP_BOOST: 3,
  DETAIL_SHADOW_BOOST: 2,
  DETAIL_SHADOW_OFFSET_BOOST: 2,
  DETAIL_CITY_BOOST: 2.5,
})

/**
 * Frozen sp camera map — sole declaration site for these tokens; consumers read members and
 * never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes the token
 * contract immutable at runtime.
 */
export const SP_CAMERA_DEFAULTS = Object.freeze({
  FOV: 45,
  POSITION: Object.freeze({
    x: 21.856154240766372,
    y: -3.6712368727086657,
    z: 20.125738437375286,
  }),
  TARGET: Object.freeze({
    x: 0,
    y: 0,
    z: 0,
  }),
  AUTO_ROTATE: false,
  AUTO_ROTATE_SPEED: 0.05,
  // Zoom clamps in Earth radii — min 1.016 ≈ 102 km altitude: just inside
  // the atmosphere shell (10.2u), where its BackSide wall still renders as
  // a limb ring at the horizon. Max 10× frames the moon orbit.
  MIN_RADIUS_FACTOR: 1.016,
  MAX_RADIUS_FACTOR: 10,
})

/**
 * Frozen sp environment map — sole declaration site for these tokens; consumers read members
 * and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes the
 * token contract immutable at runtime.
 */
export const SP_ENVIRONMENT_DEFAULTS = Object.freeze({
  SKYBOX_INTENSITY: 0.5,
  SKYBOX_AZIMUTH: 1.75,
  SKYBOX_PITCH: 0,
  SKYBOX_ROLL: 0,
  DARK_SIDE_BRIGHTNESS: 0.055,
  CITY_LIGHTS: 6.3,
})

/**
 * Frozen sp sun map — sole declaration site for these tokens; consumers read members and
 * never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes the token
 * contract immutable at runtime.
 */
export const SP_SUN_DEFAULTS = Object.freeze({
  INTENSITY: 2.5,
  COLOR: 0xffffff,
  AUTO_ROTATE: true,
  SPEED: 0.05,
  INCLINATION: 0.076,
})
