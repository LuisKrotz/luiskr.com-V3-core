/**
 * @file tokens/starfield/params/catalog.ts
 * @description Catalog-facing parameters — well-known body ids and the
 * procedural material palette for bodies without real imagery (spectral
 * star tints, moon/planet greys, nebula and galaxy hues, black-hole
 * relativistic colors, hierarchy shells, the star-cloud B-V ramp, glow
 * gradient stops). Split from the monolithic `params.ts`.
 */

/** Catalog body ids referenced outside the catalog itself. */
export const SF_BODY_IDS = Object.freeze({
  MILKY_WAY: 'milky-way',
  /** Heliocentric anchor — the deep-field cloud mounts on the Sun. */
  SUN: 'sun',
})

/**
 * Procedural material palette — hex colors for bodies with no real imagery.
 * Star tints follow spectral class (G yellow-white, B blue, M red);
 * nebula/galaxy hues are emissive accents on a dark sprite.
 */
export const SF_COLORS = Object.freeze({
  PLUTO: 0xa98c6f,
  CERES: 0x9a938a,
  PHOBOS: 0x8a7f74,
  DEIMOS: 0x9a8f82,
  VESTA: 0x9aa0a6,
  IO: 0xe8d24a,
  EUROPA: 0xd8dce2,
  GANYMEDE: 0xa89a8a,
  CALLISTO: 0x8a8378,
  MIMAS: 0xbfc2c6,
  ENCELADUS: 0xe8f0f4,
  DIONE: 0xb8bcc0,
  RHEA: 0xaeb2b6,
  TITAN: 0xd8a04a,
  IAPETUS: 0x8a8078,
  TRITON: 0xc8d4dc,
  RYUGU: 0x5a5650,
  BENNU: 0x4a4642,
  /** Halley's nucleus — icy dust, faint cyan-white. */
  HALLEY: 0xbfd8de,
  /** ISS truss — bright metallic white. */
  ISS: 0xe8ecf0,
  /** ISS solar arrays — the wings' burnished gold kapton over silicon. */
  ISS_PANEL: 0xb8862f,
  EARTH_ICE: 0xbfd8e8,
  /** Earth atmosphere fresnel tints — day limb, terminator dusk, night. */
  ATMO_DAY: 0x7ab8f0,
  ATMO_DUSK: 0xe8a05c,
  ATMO_NIGHT: 0x2a4a78,
  /**
   * Giant-planet aurora palettes — hydrogen-dominated upper atmospheres
   * emit UV-blue curtains instead of Earth's oxygen green: Jupiter's
   * powerful oval reads cyan-white, Saturn's a deep blue, Neptune's a
   * faint violet (weak far-out field, 47°-tilted dipole).
   */
  AURORA_JUPITER: 0x8fd8ff,
  AURORA_JUPITER_LOW: 0xb86aff,
  AURORA_SATURN: 0x5f9df0,
  AURORA_SATURN_LOW: 0x3a5fd0,
  AURORA_NEPTUNE: 0x9a78ff,
  AURORA_NEPTUNE_LOW: 0x38c8d8,
  AURORA_URANUS: 0x62e8d8,
  AURORA_URANUS_LOW: 0x3a8ad0,
  PROXIMA_STAR: 0xd9594c,
  PROXIMA_PLANET: 0x6f8fa8,
  ALPHA_STAR: 0xf2e6b8,
  ALPHA_COMPANION: 0xd98a4a,
  SIRIUS: 0xcfe0ff,
  VEGA: 0xd6e4ff,
  BETELGEUSE: 0xe07b39,
  TRAPPIST_STAR: 0xb3543e,
  TRAPPIST_PLANET: 0x7d94a6,
  /**
   * Per-world tints for the seven-planet chain — shared color made every
   * member read as the same ball. Inner pair scorched rock, mid worlds
   * through the volatile line into the habitable-zone teal/ocean slate,
   * outermost icy.
   */
  TRAPPIST_B: 0x8a7562,
  TRAPPIST_C: 0x9a8874,
  TRAPPIST_D: 0x9aa8b4,
  TRAPPIST_E: 0x5f9ea8,
  TRAPPIST_F: 0x6f8fa8,
  TRAPPIST_G: 0x7d94a6,
  TRAPPIST_H: 0xcfe0ea,
  SAGITTARIUS_A: 0x000000,
  ACCRETION: 0xffb45e,
  ORION_NEBULA: 0x7ea8e0,
  EAGLE_NEBULA: 0x5e8f7a,
  CRAB_NEBULA: 0x7a5ea8,
  HELIX_NEBULA: 0x8fb8d8,
  BARNARD_STAR: 0xc4584a,
  EPS_ERI: 0xf0b97e,
  EPS_ERI_PLANET: 0x9aa8b4,
  TAU_CETI: 0xf6e0a8,
  TAU_CETI_PLANET: 0x8fa88f,
  ARCTURUS: 0xe8a05c,
  PEGASI_STAR: 0xf2e2a0,
  PEGASI_PLANET: 0xc8a060,
  ALDEBARAN: 0xe08a4a,
  CAPELLA: 0xf0dfa0,
  CANOPUS: 0xf4ecd0,
  POLARIS: 0xf8e8b0,
  ANTARES: 0xd94f2a,
  RIGEL: 0xa8c8ff,
  DENEB: 0xf0f4ff,
  KEPLER_STAR: 0xf4e6ac,
  KEPLER_PLANET: 0x5f9ea8,
  PLEIADES: 0x9fc8f0,
  RING_NEBULA: 0x6fbfae,
  HORSEHEAD: 0x8a5a3e,
  LAGOON: 0xcf7fa8,
  CARINA: 0xd8a0b8,
  TARANTULA: 0xd07088,
  OMEGA_CEN: 0xf0e6c8,
  MILKY_WAY: 0xeadfc2,
  ANDROMEDA: 0xd8c8a8,
  TRIANGULUM: 0xc8b8d8,
  LMC: 0xc0b8e0,
  SMC: 0xb8c8dc,
  M32: 0xe0d8c8,
  M110: 0xd0ccc0,
  /**
   * Dwarf-galaxy tints — spheroidals get a warm old-population wash,
   * irregulars a cooler young-star haze.
   */
  DWARF_SPH: 0xd8cbb0,
  DWARF_IRR: 0xaec6e8,
  /** Sagittarius A* relativistic jets — blue synchrotron plasma. */
  BH_JET: 0x7ea8ff,
  BH_PHOTON: 0xffe8c0,
  /** Cosmic-hierarchy shells + member speckles. */
  SHELL_LOCAL: 0x6a86b8,
  SHELL_SUPER: 0x7a68a8,
  SHELL_UNIVERSE: 0x9a8fb8,
  SPECKLE: 0x8fa8d8,
  /** Small-body belts — rocky rubble grey-brown, Kuiper ice blue-white. */
  ASTEROID_BELT: 0x9a8d7c,
  KUIPER_BELT: 0xa8c4e0,
  /**
   * Belt hero-rock material classes — ordinary chondrite stone,
   * carbonaceous black, nickel-iron sheen, cometary ice and regolith
   * dust. Hero rocks pick one seeded class so the belt reads as mixed
   * debris, not a single material.
   */
  ROCK_STONE: 0x8a7f70,
  ROCK_CARBON: 0x4a463f,
  ROCK_METAL: 0x9aa4ac,
  ROCK_ICE: 0xcfe0ea,
  ROCK_DUST: 0x7a6a58,
  LABEL: 0xe6ecf5,
  /** Star-cloud spectral ramp — B-V index stops for the real HYG field. */
  STAR_BLUE: 0x9fb8ff,
  STAR_WHITE: 0xf4f2ff,
  STAR_GOLD: 0xffe9b8,
  STAR_ORANGE: 0xffb56a,
  STAR_RED: 0xff7a52,
  /** Deep-field kind tints — exoplanet hosts warm, far-field DSOs cool. */
  EXOPLANET_PT: 0xffcf7a,
  DSO_PT: 0x9fb4e8,
  /**
   * Neutral body grey — fallback base tint for procedural surfaces when
   * a catalog def carries no `color` (rare; satellites/loose bodies).
   */
  BODY_NEUTRAL: 0x8a8f9a,
  AMBIENT: 0x223044,
  EMISSIVE_SUN: 0xffb545,
  /** White sunlight point-light at the scene origin. */
  SUN_LIGHT: 0xffffff,
  /** Photosphere limb tint — hot near-white that melts into the halo. */
  STAR_RIM: 0xfff3d6,
  /**
   * Darkened limb — real photospheres show limb darkening (we see
   * deeper, hotter layers at disc centre; the limb is higher, cooler
   * gas). Stars that carry a `rim` def tint mix toward this deep amber
   * at the silhouette instead of the default hot rim, so a resolved
   * disc darkens at the edge the way the Sun does in H-alpha imagery.
   */
  STAR_LIMB: 0xb25c14,
  /**
   * Hα eruption tint — prominence/ejecta plasma glows in hydrogen
   * alpha, a saturated orange-red distinct from the photosphere's
   * gold, so flares and arc prominences read as hot gas, not paint.
   */
  STAR_FLARE: 0xff5a1a,
  /** Glow ramp stops — canvas gradient needs literal rgba strings. */
  GLOW_INNER: 'rgba(255,255,255,1)',
  GLOW_MID: 'rgba(255,255,255,0.55)',
  GLOW_OUTER: 'rgba(255,255,255,0)',
})
