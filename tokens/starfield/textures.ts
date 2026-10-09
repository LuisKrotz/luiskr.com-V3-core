/**
 * @file tokens/starfield/textures.js
 * @description Public-URL paths for the Star Field experiment texture set
 * (served from `experiments/star-field/public/textures/`). Solar-system
 * maps are the Solar System Scope CC-BY set; the milky-way skybox is the
 * 8k equirect panorama; exoplanet/system bodies use procedural materials
 * (no real imagery exists). Sole declaration site — consumers import
 * members from this frozen map rather than re-declaring the literals
 * (zero-hardcoding rule).
 * @type {Readonly<Record<string, string>>}
 */
export const SF_TEXTURES = Object.freeze({
  SKYBOX: '/experiments/star-field/textures/8k_stars_milky_way.jpg',
  SUN: '/experiments/star-field/textures/2k_sun.jpg',
  MERCURY: '/experiments/star-field/textures/2k_mercury.jpg',
  VENUS_SURFACE: '/experiments/star-field/textures/2k_venus_surface.jpg',
  VENUS_ATMOS: '/experiments/star-field/textures/2k_venus_atmosphere.jpg',
  EARTH_DAY: '/experiments/star-field/textures/2k_earth_daymap.jpg',
  EARTH_NIGHT: '/experiments/star-field/textures/2k_earth_nightmap.jpg',
  EARTH_SPEC: '/experiments/star-field/textures/2k_earth_specular_map.jpg',
  EARTH_NORMAL: '/experiments/star-field/textures/2k_earth_normal_map.jpg',
  EARTH_CLOUDS: '/experiments/star-field/textures/2k_earth_clouds.jpg',
  MOON: '/experiments/star-field/textures/2k_moon.jpg',
  MARS: '/experiments/star-field/textures/2k_mars.jpg',
  JUPITER: '/experiments/star-field/textures/2k_jupiter.jpg',
  SATURN: '/experiments/star-field/textures/2k_saturn.jpg',
  SATURN_RING: '/experiments/star-field/textures/2k_saturn_ring_alpha.png',
  URANUS: '/experiments/star-field/textures/2k_uranus.jpg',
  NEPTUNE: '/experiments/star-field/textures/2k_neptune.jpg',
})

/** Public-URL prefix for the per-body lazy-loaded JSON dossiers. */
export const SF_DATA_BASE = '/experiments/star-field/data'
