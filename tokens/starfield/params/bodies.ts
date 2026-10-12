/**
 * @file tokens/starfield/params/bodies.ts
 * @description Per-body feature tuning — the Sgr A* black-hole composite
 * (photon ring, accretion disc, jets), small-body belt particle fields,
 * the LOD reveal radii, and the photographic-surface detail layer
 * (photo masks, halos, coronae, rings, pick proxies). Split from the
 * monolithic `params.ts`.
 */

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
 * Belt hero rocks — seeded irregular meshes riding each belt so the
 * annulus reads as real varied debris (ice, metal, carbon, stone, dust;
 * fragments through large bodies) instead of uniform glowing points.
 * Sizes are fractions of the annulus width; every rock owns a Keplerian
 * pivot (`speed ∝ 1/√r`) plus a tumble rate, both riding the shared
 * satPivots update.
 */
export const SF_BELT_ROCK = Object.freeze({
  /** Hero rocks per belt — enough variety to read at fly-in distance. */
  COUNT: 40,
  /**
   * Rock radius as a fraction of annulus width — fragments at MIN,
   * regular bodies in the mid band, BIG_FRAC of rocks promoted to the
   * large-body range (Ceres-class stand-ins, still far under planets).
   */
  SIZE_MIN: 0.005,
  SIZE_MAX: 0.02,
  /** Large-body fraction + their size ceiling (× annulus width). */
  BIG_FRAC: 0.12,
  BIG_MAX: 0.05,
  /** Collision-fragment fraction — tetrahedral shards, smallest rocks. */
  FRAGMENT_FRAC: 0.25,
  /**
   * Vertex jitter — per-axis displacement fraction (0–1) applied to
   * every vertex, so each rock is a unique irregular potato/shard
   * instead of a sphere or a repeated cookie-cutter lump.
   */
  JITTER: 0.55,
  /** Fragments deform harder — broken shards, not rounded potatoes. */
  JITTER_FRAG: 0.8,
  /**
   * Material-class mix — probabilities must sum to 1: ordinary
   * stony (chondrite) dominates, carbonaceous + dusty bodies next,
   * then ice and nickel-iron.
   */
  CLASS_STONE: 0.34,
  CLASS_CARBON: 0.2,
  CLASS_DUST: 0.16,
  CLASS_ICE: 0.16,
  /** (remainder → metal) */
  /** Keplerian speed law — orbit angular speed ∝ 1/√(r/inner). Sits
   *  under Mars's catalog speed so the belt sweeps slower than the
   *  planets it lies between (honest orbital mechanics). */
  ORBIT_SPEED: 0.16,
  /** Tumble rates in rad/s — fragments spin fastest (collision
   *  fragments do); asteroid rotations run minutes-to-hours. */
  SPIN_MIN: 0.05,
  SPIN_SPAN: 0.4,
})

/**
 * Detail level-of-detail — secondary geometry (atmosphere shells, ring
 * discs, satellite companions) renders only while the
 * camera is within `PAD + size * SCALE` of the body's anchor, so distant
 * bodies draw as a single primitive like a streaming game world.
 */
export const SF_LOD = Object.freeze({
  PAD: 40,
  SCALE: 12,
  /**
   * Deep-tier reveal — while the camera sits inside the local bubble
   * (this many chart units from the solar barycenter) black holes,
   * external galaxies, dwarf galaxies and hierarchy shells do not draw
   * at all: from the Sun's neighborhood the galactic centre is a radio
   * point source, not a resolvable object. The volumetric Milky Way disc
   * is exempt — it is the sky band the camera is embedded in. The value
   * sits just past the neighborhood band edge (300 + 300) so one zoom
   * tier out of home reveals the galactic hierarchy.
   */
  DEEP_REVEAL: 800,
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
   * frame dissolves into space instead of showing a hard border. Under
   * additive blending the mask is the ONLY edge control, so the inner
   * two-fifths stays full-strength and the outer ~62% of every still is
   * pure melt — galaxies and nebulae dissolve into the star field with
   * no detectable rim.
   */
  MASK_INNER: 0.38,
  /** Nebula lobe-mask scatter — distance band, lobe radius band, and the
   *  per-lobe alpha range (base + jitter). */
  MASK_LOBE_DIST: 0.3,
  MASK_LOBE_DIST_VAR: 0.55,
  MASK_LOBE_R: 0.35,
  MASK_LOBE_R_VAR: 0.35,
  MASK_LOBE_ALPHA: 0.55,
  MASK_LOBE_ALPHA_VAR: 0.35,
  MASK_LOBE_ALPHA_MAX: 1.0,
  /** V coordinate sampling the ring strip's center row (radius = U). */
  RING_V: 0.5,
  /** Saturn ring radii as body-radius multiples (matches ring texture). */
  RING_INNER: 1.24,
  RING_OUTER: 2.28,
  /** Additive halo sprite diameter as a multiple of the star's radius —
   *  the eased tail (see `_HALO_T*` in procedural.ts) makes the outer
   *  third invisible, so 3.6 keeps the glow hugging the limb without
   *  ballooning into the bounded-ball look a wide linear ramp gives. */
  HALO_SCALE: 3.6,
  /**
   * Corona sprite diameter as a multiple of the star's radius — the
   * prominence layer hugs the limb (the wide atmospheric glow belongs
   * to the halo sprite), so it stays well under HALO_SCALE.
   */
  CORONA_SCALE: 2.2,
  /** Halo sprite opacity — kept under 1 so the limb stays crisp. */
  HALO_OPACITY: 0.55,
  /**
   * Galactic-star photosphere clamp (world units) — at honest chart
   * distances every star beyond the solar tier is an unresolvable point
   * of light: 0.003 u subtends under a degree even at the nearest fly-to
   * standoff, so no marker can render as a planet-like ball adjacent to
   * another body. The authored `def.radius` still sizes the luminosity
   * halo, the pick proxy and the fly-to standoff — only the sphere,
   * its corona and its satellites shrink to the point.
   */
  POINT_RADIUS: 0.003,
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
   * Night-lights dusk band — `dot(worldNormal, sunDir)` smoothstep
   * edges gating the emissive node: fully dark below NIGHT_LO, fully
   * lit above NIGHT_HI, so city lights fade in through twilight and
   * never glow on the lit hemisphere.
   */
  NIGHT_LO: -0.04,
  NIGHT_HI: 0.34,
  /**
   * Earth atmosphere rim shell — `ATMO_SCALE` lifts the fresnel shell
   * just past the cloud deck, `ATMO_POW` tightens the limb falloff,
   * `ATMO_ALPHA` the base opacity. `DAY_*`/`DUSK_*` are the
   * `dot(worldNormal, sunDir)` smoothstep edges driving the day/dusk/
   * night tint migration across the terminator.
   */
  ATMO_SCALE: 1.04,
  ATMO_POW: 2.6,
  ATMO_ALPHA: 0.75,
  ATMO_DAY_LO: -0.08,
  ATMO_DAY_HI: 0.45,
  ATMO_DUSK_LO: -0.28,
  ATMO_DUSK_MID: -0.04,
  ATMO_DUSK_HI: 0.3,
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
   * proxy bubble rides inside its mesh for raycasts.
   */
  PICK_MIN: 2,
  /**
   * Pick-proxy radius multiplier — the invisible raycast sphere is
   * PICK_PROXY × the body's true radius (never a fixed size), so honest
   * stellar-scale bodies stay tappable without a fake giant bubble that
   * would swallow neighbours at their real distances.
   */
  PICK_PROXY: 4,
  /** Photo-disc diameter as a multiple of the catalog radius. */
  GALAXY_DISC: 2.2,
})

/**
 * Diffraction-spike starburst — the telescope-optics cross that rides
 * bright stars. Spikes are soft elliptical gradients (never stroked
 * lines), seeded-rotated per star so no two crosses align. Kept as its
 * own bag since the sprite is a separate layer from halo + corona.
 */
export const SF_SPIKE = Object.freeze({
  /**
   * Spike sprite diameter as a multiple of the star's authored radius —
   * like the halo it tracks luminosity, not the clamped point sphere,
   * so catalog giants throw longer crosses than dwarfs. Sits a step
   * beyond HALO_SCALE so the spike tips pierce the glow edge.
   */
  SPIKE_SCALE: 4.6,
  /** Sprite opacity — under HALO_OPACITY so it reads as optics, not gas. */
  SPIKE_OPACITY: 0.45,
  /**
   * Spike ray count — 6 throws the hexagonal cross of a real segmented
   * mirror (JWST), plus a faint second cross at SPIKE_ROT2 for depth.
   */
  SPIKE_RAYS: 6,
  /** Second cross angular offset (radians fraction of a full turn). */
  SPIKE_ROT2: 0.25,
  /** Second cross reach multiplier vs the primary rays. */
  SPIKE_LEN2: 0.55,
  /** Ray ellipse minor-axis width as a fraction of the half-sprite. */
  SPIKE_THIN: 0.05,
  /** Center knot radius as a fraction of the half-sprite. */
  SPIKE_CORE: 0.09,
  /** Rotation jitter added to the seeded base angle (radians). */
  SPIKE_JITTER: 0.12,
})

/**
 * Nebula depth layering — a parallax echo + wide underlay glow composed
 * under the photo sprite so a nebula reads as a volume of gas at
 * different depths instead of one flat billboard.
 */
export const SF_NEBULA_DEPTH = Object.freeze({
  /** Echo layer scale multiplier over the photo sprite. */
  ECHO_SCALE: 1.28,
  /** Echo layer opacity — ghost of the photo rotated off-axis. */
  ECHO_OPACITY: 0.22,
  /** Underlay glow scale multiplier — the wide light-field behind. */
  UNDER_SCALE: 1.9,
  /** Underlay glow opacity. */
  UNDER_OPACITY: 0.18,
})
