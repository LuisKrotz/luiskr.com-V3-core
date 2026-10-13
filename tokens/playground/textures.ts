/**
 * @file tokens/playground/textures.js
 * @description CDN URLs for the Earth Playground texture set — every map
 * lives on Google Cloud Storage under
 * `${CDN_URLS.CDN_BASE}experiments/earth-playground/textures/earth/`
 * (the local `public/textures/` copies were removed from git).
 * NASA-visible-earth style maps: day albedo, night city lights, ocean
 * specular mask, bump/normal, cloud layer, star field backdrop, moon
 * albedo + lunar displacement (LDEM).
 */
import { CDN_URLS } from '../media/urls.js'

/** CDN root this module's assets upload under. */
const _CDN = `${CDN_URLS.CDN_BASE}experiments/earth-playground/textures/earth`

/**
 * CDN URLs for the Earth Playground texture set. Sole declaration site —
 * consumers import members from this frozen map rather than
 * re-declaring the literals (zero-hardcoding rule).
 * @type {Readonly<Record<string, string>>}
 */
export const EARTH_TEXTURES = Object.freeze({
  ALBEDO: `${_CDN}/2k_earth_daymap.jpg`,
  ALBEDO_2K: `${_CDN}/2k_earth_daymap.jpg`,
  NIGHT: `${_CDN}/2k_earth_nightmap.jpg`,
  SPECULAR: `${_CDN}/2k_earth_specular_map.jpg`,
  NORMAL: `${_CDN}/2k_earth_normal_map.jpg`,
  CLOUDS: `${_CDN}/2k_earth_clouds.jpg`,
  STARS: `${_CDN}/starmap_2k.jpg`,
  MOON: `${_CDN}/2k_moon.jpg`,
  MOON_DISP: `${_CDN}/ldem_4.png`,
})
