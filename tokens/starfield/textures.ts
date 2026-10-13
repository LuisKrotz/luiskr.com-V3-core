/**
 * @file tokens/starfield/textures.js
 * @description CDN URLs for the Star Field experiment texture set —
 * every map lives on Google Cloud Storage under
 * `${CDN_URLS.CDN_BASE}experiments/star-field/textures/` (the local
 * `public/textures/` copies were removed from git; drop files there
 * only for offline dev — the folder is gitignored). Solar-system maps
 * are the Solar System Scope CC-BY 8k set; moons/dwarfs are NASA
 * global mosaics (NASA-3D-Resources, USGS, JPL/Dawn HAMO, Askaniy
 * albedo maps) — every catalog body carries real imagery, no
 * procedural flats. The milky-way skybox is the 8k equirect panorama;
 * exoplanet/system bodies stay procedural (no real imagery exists).
 * Sole declaration site — consumers import members from this frozen
 * map rather than re-declaring the literals (zero-hardcoding rule).
 * @type {Readonly<Record<string, string>>}
 */
import { CDN_URLS } from '../media/urls.js'

/** CDN root the Star Field texture set uploads under. */
const _SF_TEX = `${CDN_URLS.CDN_BASE}experiments/star-field/textures`

/**
 * CDN URLs for the full Star Field texture set — sole declaration site;
 * consumers import members rather than re-declaring the literals.
 */
export const SF_TEXTURES = Object.freeze({
  SKYBOX: `${_SF_TEX}/8k_stars_milky_way.jpg`,
  SUN: `${_SF_TEX}/8k_sun.jpg`,
  MERCURY: `${_SF_TEX}/8k_mercury.jpg`,
  VENUS_SURFACE: `${_SF_TEX}/8k_venus_surface.jpg`,
  VENUS_ATMOS: `${_SF_TEX}/4k_venus_atmosphere.jpg`,
  // Earth runs the 8k SSS set — close fly-to needs real city/terrain
  // detail; the normal map is a 4k bake from the elevation source.
  EARTH_DAY: `${_SF_TEX}/8k_earth_daymap.jpg`,
  EARTH_NIGHT: `${_SF_TEX}/8k_earth_nightmap.jpg`,
  EARTH_SPEC: `${_SF_TEX}/2k_earth_specular_map.jpg`,
  EARTH_NORMAL: `${_SF_TEX}/4k_earth_normal.jpg`,
  EARTH_CLOUDS: `${_SF_TEX}/8k_earth_clouds.jpg`,
  EARTH_ELEVATION: `${_SF_TEX}/earth_elevation.png`,
  MOON: `${_SF_TEX}/8k_moon.jpg`,
  MARS: `${_SF_TEX}/8k_mars.jpg`,
  JUPITER: `${_SF_TEX}/8k_jupiter.jpg`,
  SATURN: `${_SF_TEX}/8k_saturn.jpg`,
  SATURN_RING: `${_SF_TEX}/2k_saturn_ring_alpha.png`,
  // Uranus/Neptune top out at 2k on SSS — the only res distributed.
  URANUS: `${_SF_TEX}/2k_uranus.jpg`,
  NEPTUNE: `${_SF_TEX}/2k_neptune.jpg`,
  /**
   * Moons — NASA-3D-Resources equirect global mosaics (Galileo/Cassini/
   * Voyager basemaps). 1440×720 is the highest public distribution for
   * most of these bodies; Phobos upgrades to the 5499px USGS map.
   */
  IO: `${_SF_TEX}/4k_io.jpg`,
  EUROPA: `${_SF_TEX}/4k_europa.jpg`,
  GANYMEDE: `${_SF_TEX}/4k_ganymede.jpg`,
  CALLISTO: `${_SF_TEX}/4k_callisto.jpg`,
  PHOBOS: `${_SF_TEX}/4k_phobos.jpg`,
  DEIMOS: `${_SF_TEX}/4k_deimos.jpg`,
  MIMAS: `${_SF_TEX}/4k_mimas.jpg`,
  ENCELADUS: `${_SF_TEX}/4k_enceladus.jpg`,
  DIONE: `${_SF_TEX}/4k_dione.jpg`,
  RHEA: `${_SF_TEX}/4k_rhea.jpg`,
  TITAN: `${_SF_TEX}/4k_titan.jpg`,
  IAPETUS: `${_SF_TEX}/4k_iapetus.jpg`,
  TRITON: `${_SF_TEX}/4k_triton.jpg`,
  PLUTO: `${_SF_TEX}/4k_pluto.jpg`,
  /**
   * Dwarf planets / small bodies — Ceres is the Dawn HAMO elliptical map
   * (PIA20351, 4000px); Vesta the GeoHack Dawn mosaic; Phobos the USGS
   * 5499px map above; Bennu the 8k OSIRIS-REx-derived albedo; Ryugu the
   * ONC albedo map. Asteroid albedos are grayscale — honest to the data.
   */
  CERES: `${_SF_TEX}/4k_ceres.jpg`,
  VESTA: `${_SF_TEX}/4k_vesta.jpg`,
  RYUGU: `${_SF_TEX}/2k_ryugu.jpg`,
  BENNU: `${_SF_TEX}/8k_bennu.jpg`,
  /**
   * Real-photography billboards — NASA/Hubble/ESA imagery on the
   * deep-sky bodies (nebulae, star clusters, external galaxies). All
   * served from the CDN bucket; additive/masked compositing
   * hides the rectangular edge so the photo reads as the object.
   */
  NEBULA_CARINA: `${_SF_TEX}/nebula-carina.png`,
  NEBULA_ORION: `${_SF_TEX}/nebula-orion.jpg`,
  NEBULA_EAGLE: `${_SF_TEX}/nebula-eagle.jpg`,
  NEBULA_CRAB: `${_SF_TEX}/nebula-crab.jpg`,
  NEBULA_HELIX: `${_SF_TEX}/nebula-helix.jpg`,
  NEBULA_RING: `${_SF_TEX}/nebula-ring.jpg`,
  NEBULA_HORSEHEAD: `${_SF_TEX}/nebula-horsehead.jpg`,
  NEBULA_LAGOON: `${_SF_TEX}/nebula-lagoon.jpg`,
  NEBULA_TARANTULA: `${_SF_TEX}/nebula-tarantula.jpg`,
  CLUSTER_PLEIADES: `${_SF_TEX}/cluster-pleiades.jpg`,
  CLUSTER_OMEGA: `${_SF_TEX}/cluster-omega.jpg`,
  GALAXY_MILKYWAY: `${_SF_TEX}/galaxy-milkyway.jpg`,
  GALAXY_ANDROMEDA: `${_SF_TEX}/galaxy-andromeda.jpg`,
  GALAXY_TRIANGULUM: `${_SF_TEX}/galaxy-triangulum.jpg`,
  GALAXY_LMC: `${_SF_TEX}/galaxy-lmc.jpg`,
  GALAXY_SMC: `${_SF_TEX}/galaxy-smc.jpg`,
})

/** Public-URL prefix for the per-body lazy-loaded JSON dossiers. */
export const SF_DATA_BASE = '/experiments/star-field/data'

/** Module public-asset root — dossier media entries join under this. */
export const SF_ASSET_BASE = '/experiments/star-field'
