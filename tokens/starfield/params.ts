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
  NEAR: 0.5,
  /**
   * Far plane — the chart spans ~50k units to the observable-universe
   * boundary shell; the camera at max zoom looks across twice that, so
   * the frustum reaches ~4× the shell radius. 24-bit depth buffers stay
   * precise to ~NEAR×1e6, so NEAR=0.5 keeps the ratio inside that bound.
   */
  FAR: 200000,
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
 * Orbit-controls zoom bounds — clamps how far the camera can dolly:
 * MIN keeps a close approach above the body surface; MAX frames the
 * whole cosmic hierarchy — Milky Way, the Local Group neighbourhood and
 * the supercluster/observable-universe shells — and stops just inside
 * the boundary so the chart never zooms into empty space.
 */
export const SF_ZOOM = Object.freeze({
  MIN: 4,
  MAX: 52000,
})

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
  /** Light-years per chart unit inside the galactic tier. */
  GALACTIC_LY: 100,
  /** Galactic→Local-Group break distance in light-years. */
  GALACTIC_BREAK: 1e6,
  /** Light-years per unit between the two breaks. */
  LOCAL_GROUP_LY: 800,
  /** Local-Group→cosmic break distance in light-years. */
  LOCAL_GROUP_BREAK: 1e7,
  /** Light-years per unit in the cosmic tier. */
  COSMIC_LY: 20000,
  /** Observable-universe boundary shell — far-field clamp in units. */
  COSMIC_CLAMP: 46000,
  /**
   * Milky Way disc tilt (radians) — the one shared frame lean applied by
   * the particle disc, the deep-field cloud, and every authored body
   * placed through `sfGalacticPos`, so all layers share one galaxy plane.
   */
  MW_TILT: 0.35,
  /**
   * Milky Way disc radius in light-years (~52 000 ly → 520 chart units at
   * the galactic tier). The disc center sits `SUN_GC_LY` down −X so the
   * Sun lands at its true 0.51 galactocentric radius inside the disc.
   */
  MW_DISC_LY: 52000,
  /**
   * Neighborhood-band placement — authored bodies closer than ~3 000 ly
   * collapse to sub-unit chart radii under the exaggerated solar system,
   * so near stars/nebulae keep their true galactic direction but ride a
   * legibility band that starts past Pluto's orbit (INNER) and widens
   * monotonically with real distance for another BAND units before the
   * honest compressed radius takes over.
   */
  NEIGHBORHOOD_INNER: 150,
  NEIGHBORHOOD_BAND: 150,
})

/**
 * Black-hole feature tuning — Sgr A* renders as a layered relativistic
 * object: the event-horizon sphere, a thin photon ring, a hot accretion
 * torus plus a swirl of orbiting plasma particles, and twin polar jets.
 * All sizes are multiples of the catalog `radius` so the dossier value
 * stays the single source of truth.
 */
export const SF_BH = Object.freeze({
  /** Photon-sphere ring radius (× radius) — the bright thin ring. */
  PHOTON_RING: 1.35,
  /** Accretion disc inner/outer radii (× radius). */
  DISC_INNER: 1.6,
  DISC_OUTER: 4.2,
  /** Orbiting plasma particles inside the disc and their point size. */
  SWIRL_COUNT: 2600,
  SWIRL_PX: 1.4,
  /** Bipolar jet: half-length and base radius (× radius). */
  JET_LEN: 9,
  JET_WIDTH: 0.55,
  /** Jet tip radius (× radius) — keeps the beam collimated. */
  JET_TIP: 0.06,
  /**
   * Jet opacity — a whisper, not a lightsaber. Sgr A*'s outflow is
   * radio-faint optically; at chart scale the beams only hint the disc
   * poles. Vertex fade multiplies it to nothing by mid-beam.
   */
  JET_OPACITY: 0.1,
  /**
   * Warm glow sprite behind the hole (× radius) and its opacity — kept
   * tight so the additive stack (disc + photon + jets + glow) doesn't
   * wash the whole frame to cream at fly-in distance.
   */
  GLOW_SCALE: 6,
  GLOW_OPACITY: 0.32,
  /** Photon-ring torus tube thickness (× radius) and opacity. */
  PHOTON_TUBE: 0.07,
  PHOTON_OPACITY: 0.95,
  /** Smooth accretion annulus opacity under the particle swirl. */
  DISC_OPACITY: 0.5,
  /** Ring tessellation of the accretion annulus mesh. */
  DISC_SEGMENTS: 128,
  /**
   * Dust-lane math (disc node shader) — two detuned ring harmonics
   * multiply into irregular dark absorption bands. `LANE_FLOOR` keeps
   * the lanes translucent instead of cutting solid black; `LANE_AMP`
   * is the modulation depth around it.
   */
  DISC_LANE_FLOOR: 0.62,
  DISC_LANE_AMP: 0.38,
  /** Lane harmonic frequencies — angular/radial for wave A and B. */
  DISC_LANE_ANG_A: 5.0,
  DISC_LANE_RAD_A: 0.9,
  DISC_LANE_RAD_B: 2.3,
  DISC_LANE_ANG_B: 2.0,
  /** Radial heat exponent — ISCO edge blinding, rim fading to dust. */
  DISC_CORE_EXP: 1.6,
  /** Alpha envelope — floor keeps the outer dust faintly lit. */
  DISC_A_FLOOR: 0.25,
  DISC_A_AMP: 0.75,
  /** Swirl vertical puff (× radius) and inner-thickness bias. */
  SWIRL_PUFF: 0.12,
  SWIRL_BIAS: 0.4,
  /**
   * Swirl vertex ramp — near-white at the ISCO edge dimming to amber at
   * the rim, which is what produces the glowing-ring silhouette.
   */
  SWIRL_CORE_R: 1.0,
  SWIRL_CORE_G: 0.82,
  SWIRL_CORE_B: 0.5,
  SWIRL_EDGE_R: 0.65,
  SWIRL_EDGE_G: 0.52,
  SWIRL_EDGE_B: 0.18,
})

/**
 * Small-body belts (asteroid + Kuiper) — the seeded Points annulus each
 * `kind: belt` catalog entry renders. Radii live on the def itself
 * (belt.inner/belt.outer); these tokens own particle size, opacity and
 * the default vertical half-thickness fraction.
 */
export const SF_BELT = Object.freeze({
  /** Particle sprite size in px — small enough to read as rubble. */
  PX: 1.1,
  /** Overall belt opacity — translucent so orbits read through it. */
  OPACITY: 0.85,
  /**
   * Default vertical half-thickness as a fraction of the annulus width
   * when the def omits `belt.puff` — real belts are thin but not flat.
   */
  PUFF: 0.16,
  /**
   * Per-particle brightness variation — vertex colors jitter ±this so
   * the annulus reads as mixed albedos (dark C-types vs bright S-types)
   * rather than a uniform dotted ring.
   */
  ALBEDO_JITTER: 0.45,
  /**
   * Kirkwood-style gap frequency for the asteroid belt — the density
   * modulation `sin(r·GAP_FREQ)` carves resonance lanes; the Kuiper belt
   * passes a def-level 0 to keep its smooth classical disc.
   */
  GAP_FREQ: 1.9,
  /** Gap depth — fraction of particles rejected inside a lane (0–1). */
  GAP_DEPTH: 0.55,
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
  /** Shell rim brightness at grazing angles — kept low because additive
   *  rims still stack into a visible film when the camera sits inside a
   *  huge boundary (e.g. interstellar-neighborhood). */
  SHELL_OPACITY: 0.18,
  /** Fresnel exponent — higher tightens the rim to a hairline bubble
   *  edge; lower spreads a broad halo inward. */
  SHELL_RIM: 4.0,
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

/**
 * Arrow-key view rotation — radians per keypress applied around the
 * controls target; POLAR clamps keep the camera off the poles.
 */
export const SF_KEYS = Object.freeze({
  AZIMUTH: 0.12,
  POLAR: 0.1,
  PHI_MIN: 0.08,
})

/**
 * Detail level-of-detail — secondary geometry (atmosphere shells, ring
 * discs, satellite companions, orbit guides) renders only while the
 * camera is within `PAD + size * SCALE` of the body's anchor, so distant
 * bodies draw as a single primitive like a streaming game world.
 */
export const SF_LOD = Object.freeze({
  PAD: 80,
  SCALE: 12,
})

/**
 * Photographic-surface tuning — the real-imagery rendering layer for
 * planets and deep-sky objects. Photo masks feather a source image's
 * rectangular edge into transparency so NASA/ESA stills composite into
 * the black scene; `MASK_PX` caps the composite canvas (source images
 * run 1–6k px but are viewed at tens of screen px). Ring UVs are
 * remapped radially (`RING_V` samples the strip's center row) because
 * RingGeometry ships planar UVs but the Saturn strip is radius-indexed.
 * `HALO_SCALE` sizes the additive star-glow sprite against the body's
 * drawn radius; `CLOUD_*`/`EMISSIVE_*` tune Earth's layered maps.
 */
export const SF_DETAIL = Object.freeze({
  /** Composite canvas edge cap (px) for masked photo textures. */
  MASK_PX: 1024,
  /**
   * Radial feather — the alpha ramp starts at this fraction of the
   * half-extent and reaches zero at the corner, so the photo's square
   * frame dissolves into space instead of showing a hard border.
   */
  MASK_INNER: 0.62,
  /** V coordinate sampling the ring strip's center row (radius = U). */
  RING_V: 0.5,
  /** Saturn ring radii as body-radius multiples (matches ring texture). */
  RING_INNER: 1.24,
  RING_OUTER: 2.28,
  /** Additive halo sprite diameter as a multiple of the star's radius. */
  HALO_SCALE: 4.6,
  /** Halo sprite opacity — kept under 1 so the limb stays crisp. */
  HALO_OPACITY: 0.55,
  /**
   * Fresnel exponent on the luminous-sphere shader — how tightly the rim
   * hugs the limb. ~2.2 keeps a bright core with a hot narrow bloom;
   * satellites use the looser value so their small discs stay soft.
   */
  STAR_RIM_FALLOFF: 2.2,
  SAT_RIM_FALLOFF: 1.5,
  /** Earth's cloud shell rides this multiple above the surface sphere. */
  CLOUD_SCALE: 1.018,
  CLOUD_OPACITY: 0.55,
  /**
   * City-lights emissive on the night side — the map is black except
   * lit land, so a moderate intensity glows only where the texture is.
   */
  EMISSIVE_INT: 0.9,
  /**
   * Terrain bump depth — the elevation map's grayscale gradient offsets
   * the shading normal; at globe scale only a whisper of relief reads
   * correctly (full-scale units would spike the limb into noise).
   */
  BUMP_SCALE: 0.05,
  /** Fraction of the galaxy particle budget kept for sparkle points. */
  SPARKLE_FRAC: 0.05,
  /** Sparkle point size (px) — slightly fatter than the dust field so
   *  foreground stars sparkle against the photo disc. */
  SPARKLE_PX: 2.4,
  /**
   * Minimum pickable radius (world units) — a body sphere smaller than
   * this subtends only a few pixels at the home camera, so an invisible
   * proxy bubble of this radius rides inside its mesh for raycasts.
   */
  PICK_MIN: 5,
  /** Photo-disc diameter as a multiple of the catalog radius. */
  GALAXY_DISC: 2.2,
})

/**
 * Procedural spiral-galaxy point cloud — Gaia-style star distribution:
 * `COUNT` points spread over `ARMS` logarithmic arms plus a bulge, sized
 * by `POINT_PX`; `WIND` is the arm winding tightness and `THIN` the disc
 * thickness ratio. One Points draw call per galaxy — the "all stars"
 * layer beneath the named catalog markers.
 */
export const SF_SPIRAL = Object.freeze({
  COUNT: 60000,
  /** Per-galaxy particle count ceiling — `spiralDisc.count` may ask less. */
  COUNT_MAX: 1000000,
  /** Mobile particle divisor — caps GPU buffers on small viewports. */
  MOBILE_DIVISOR: 4,
  /** Viewport width (px) below which the mobile divisor applies. */
  MOBILE_WIDTH: 900,
  /**
   * Volumetric galaxies (the Milky Way) are viewed from inside — keep
   * the particle layer faint and thin so it reads as a stellar disc/band
   * instead of an opaque glowing ball that fills half the screen.
   */
  VOLUMETRIC_OPACITY: 0.18,
  VOLUMETRIC_PX: 1.0,
  VOLUMETRIC_THICK: 0.45,
  VOLUMETRIC_HALO: 0,
  VOLUMETRIC_COUNT: 100000,
  /**
   * Volumetric dust lanes — the Great Rift. Large soft dark points laid
   * along the arm gaps with NORMAL blending so they absorb the lit disc
   * behind them; additive blending can't darken, so dust gets its own
   * cloud at a fraction of the star budget.
   */
  DUST_COUNT: 3200,
  /** Dust point size (world units) — fat soft occluders, not pinpricks. */
  DUST_PX: 14,
  /** Dust alpha — high enough to visibly rift the band, low enough to keep it translucent. */
  DUST_OPACITY: 0.55,
  /** Lane bands sit at these radius fractions of the disc. */
  DUST_R_MIN: 0.18,
  DUST_R_MAX: 0.85,
  ARMS: 4,
  WIND: 5.2,
  THIN: 0.08,
  POINT_PX: 1.6,
  /** Fraction of points inside the central bulge (rest go to the arms). */
  BULGE: 0.18,
  /** Core-glow sprite opacity over the photographic disc (whisper bloom). */
  CORE_PHOTO: 0.45,
  /** Core-glow sprite opacity on the procedural fallback disc. */
  CORE_GLOW: 0.9,
  /** Per-point color ramp — hot amber bulge → dusty pale-violet rim,
   *  matching the real Milky Way's warm dust lane palette (pure blue
   *  edges read as a grey fog from inside the disc). */
  CORE_R: 1.0,
  CORE_G: 0.86,
  CORE_B: 0.6,
  EDGE_R: 0.66,
  EDGE_G: 0.62,
  EDGE_B: 0.78,
  /** Stellar-halo radius (× disc radius) for `spiralDisc.halo` layers. */
  HALO_RADIUS: 0.6,
  /**
   * Elliptical-dwarf distribution — radial profile length (× radius),
   * vertical squash, and the core→rim brightness ramp.
   */
  ELLIPSE_RADIAL: 0.9,
  ELLIPSE_FLAT: 0.6,
  ELLIPSE_CORE: 1.05,
  ELLIPSE_FADE: 0.7,
  /**
   * Rim fade start — fraction of the filled volume's outer extent where
   * per-point brightness begins its smooth roll-off to zero. Without it
   * the density cutoff reads as a hard ball boundary instead of a haze
   * that dissolves into the sky.
   */
  ELLIPSE_EDGE: 0.55,
  /**
   * Heliocentric exclusion bubble (chart units) carved out of a
   * `spiralDisc.bubble` galaxy's particle fill around the solar system —
   * keeps random disc stars from overlapping the Sun/planet meshes while
   * staying far smaller than the ~267-unit galactocentric gap, so the
   * Sun still reads as embedded in the disc.
   */
  SUN_BUBBLE: 30,
})

/**
 * Real star-cloud layer — HYG/Hipparcos catalogued stars (78k, mag ≤ 9,
 * heliocentric light-years) decoded from a packed Float32 binary and
 * drawn as one Points call at the Sun's true galactocentric position on
 * the Milky Way disc, so zooming toward the disc reveals real stellar
 * density rather than a stylized sprite. The proper-named subset lives
 * in the milky-way dossier JSON (`namedStars`) for future labelling.
 */
export const SF_STAR_CLOUD = Object.freeze({
  /** Lazy asset under the module data root (Float32 x,y,z,mag,ci,kind ×N). */
  FILE: 'deep-field.bin',
  /** Record stride per object in the binary (x,y,z,mag,ci,kind). */
  STRIDE: 6,
  /** Safety bound on the record count read from the binary header. */
  MAX_STARS: 300000,
  /**
   * Chart units per light-year — the galactic tier scale (SF_SCALE.
   * GALACTIC_LY) so real stars sit at true scale inside the volumetric
   * Milky Way disc: the ~3 000-ly HYG bubble spans ~60 units around the
   * Sun and resolves on zoom.
   */
  UNITS_PER_LY: 1 / 100,
  /** Sun's galactocentric radius in light-years (ring offset on the disc). */
  SUN_GC_LY: 26700,
  /** Point size (px) — magnitude-attenuated in the shader-free material. */
  POINT_PX: 1.35,
  /** Camera distance beyond which the cloud hides — disc carries the read. */
  LOD_DIST: 400,
  /** B-V color-index ramp stops — below LOW reads blue-white, above RED red. */
  CI_LOW: 0.0,
  CI_WARM: 0.45,
  CI_GOLD: 0.9,
  CI_RED: 1.55,
  /** Magnitude → brightness curve: `BIAS − mag·SLOPE`, floor `FLOOR`. */
  MAG_BIAS: 1.12,
  MAG_SLOPE: 0.13,
  MAG_FLOOR: 0.16,
  /**
   * Far-field radius clamp (chart units) — deep-sky objects keep their
   * true sky direction but compress onto this shell when their real
   * distance exceeds it, so NGC galaxies stay visible inside the
   * Local-Group zoom bound instead of sitting at unreachable radii.
   */
  FAR_CLAMP: 1900,
  /** Kind tags in the packed record (`kind` float). */
  KIND_STAR: 0,
  KIND_EXOPLANET: 1,
  KIND_DSO: 2,
  /**
   * Provenance + distance formatting for the 139k registry — ACQUIRED
   * is the ISO date the HYG/Exoplanet-Archive/OpenNGC source data was
   * pulled; MLY is the light-year cutoff above which distances render
   * in millions (keeps far-field DSO labels readable).
   */
  REGISTRY_ACQUIRED: '2026-10-09',
  MLY: 1e6,
  /** Provenance strings shown on synthesized record panels. */
  SRC_HYG: 'HYG Database v4 (Hipparcos/Gliese/Tycho)',
  SRC_EXO: 'NASA Exoplanet Archive (pscomppars)',
  SRC_DSO: 'OpenNGC database (NGC/IC catalogue)',
  /**
   * Registry index geometry — `public/data/index/` ships one JSON
   * manifest plus `<kind>-NNN.json` shards of SHARD_SIZE records each;
   * a body id's global rank decodes to shard/slot by pure division.
   */
  SHARD_SIZE: 1000,
  /** Registry kinds in shard-scan order for incremental search. */
  REGISTRY_KINDS: ['star', 'exoplanet', 'dso'] as const,
  /** Cap on collected matches per registry search (UI page bound). */
  SEARCH_LIMIT: 200,
  /** Directory rows rendered before the "load more" affordance. */
  PAGE_SIZE: 100,
  /**
   * Camera stand-off (chart units) when flying to a registry object —
   * point sources have no radius so the offset is fixed; the zoom
   * clamp still bounds how close OrbitControls lets the camera get.
   */
  FLY_OFFSET: 3,
})

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
  EARTH_ICE: 0xbfd8e8,
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
  ORBIT_LINE: 0x4a5568,
  /** Small-body belts — rocky rubble grey-brown, Kuiper ice blue-white. */
  ASTEROID_BELT: 0x9a8d7c,
  KUIPER_BELT: 0xa8c4e0,
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
  AMBIENT: 0x223044,
  EMISSIVE_SUN: 0xffd27a,
  /** White sunlight point-light at the scene origin. */
  SUN_LIGHT: 0xffffff,
  /** Photosphere limb tint — hot near-white that melts into the halo. */
  STAR_RIM: 0xfff3d6,
  /** Glow ramp stops — canvas gradient needs literal rgba strings. */
  GLOW_INNER: 'rgba(255,255,255,1)',
  GLOW_MID: 'rgba(255,255,255,0.55)',
  GLOW_OUTER: 'rgba(255,255,255,0)',
})

/** Skybox sphere + starfield scales. */
export const SF_SCENE = Object.freeze({
  /**
   * Skybox sphere radius — wraps the whole multi-tier chart (the
   * observable-universe shell clamps at ~46k units, the skybox must sit
   * beyond it or the panorama would clip through the boundary).
   */
  SKYBOX_RADIUS: 64000,
  ORBIT_SEGMENTS: 128,
  /** Guide-ring base opacity — the edge-on fade scales this per frame. */
  ORBIT_OPACITY: 0.35,
  /**
   * Edge-on gain for orbit guides — opacity = base × min(1, edge·gain),
   * where `edge` is |normal·viewDir| (1 face-on → 0 edge-on). ~2 keeps
   * rings near-full until ~30° tilt, then fades them out so a guide
   * never renders as a hard straight line through the body.
   */
  ORBIT_EDGE_GAIN: 2,
  SPHERE_SEGMENTS: 48,
  RING_SEGMENTS: 96,
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
