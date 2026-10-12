/**
 * @file tokens/starfield/params/spiral.ts
 * @description Procedural spiral-galaxy point-cloud parameters — the
 * Gaia-style star distribution: golden-ratio logarithmic arms with
 * per-arm pitch/luminance variation, arm sway and spur feathering,
 * star-forming knots (OB blue + H-II pink), the galactic bar, dust
 * lanes, bulge/disc/rim color ramp, the heliocentric exclusion bubble,
 * and the differential-rotation inner rotor. Split from the monolithic
 * `params.ts`; mirrored bit-identically inside `engine/fill-worker.ts`.
 */

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
  /**
   * Near-field point size (world units) — the floor while the camera is
   * embedded in the disc. When the camera pulls back, updateGalaxyClouds
   * grows the size linearly with distance so every point keeps at least
   * `VOLUMETRIC_PX_SCREEN` screen pixels — real stars are point sources
   * whose apparent size floors at one pixel, so the spiral arms resolve
   * from outside instead of vanishing into sub-pixel dust.
   */
  VOLUMETRIC_PX: 1.0,
  /**
   * Minimum apparent point size (device px) once the camera leaves the
   * disc. The shared soft-glow map keeps only ~1/3 of a point's sprite
   * lit, so this is set well above 1px for the lit core — not the sprite
   * edge — to stay resolved at galactic range.
   */
  VOLUMETRIC_PX_SCREEN: 4.5,
  /**
   * Far-field opacity gain — as the camera pulls clear of the disc the
   * fade drives opacity from VOLUMETRIC_OPACITY up to
   * VOLUMETRIC_OPACITY·(1+GAIN), so the spiral's arms read at galactic
   * range where 400k points would otherwise thin into a uniform wash.
   */
  VOLUMETRIC_FAR_GAIN: 1.15,
  /**
   * Arm angular jitter (rad) for the embedded volumetric disc — tighter
   * than photo-fallback spirals because the whole 400k-point field must
   * carry the arm lanes alone (no imagery underneath to do the work).
   */
  VOLUMETRIC_ARM_JITTER: 0.3,
  VOLUMETRIC_THICK: 0.45,
  VOLUMETRIC_HALO: 0,
  VOLUMETRIC_COUNT: 100000,
  /** Volumetric particle ceiling — `spiralDisc.count` may ask less. */
  VOLUMETRIC_COUNT_MAX: 500000,
  /**
   * Rotating inner-disc fraction (× radius) — volumetric galaxies split
   * their particle fill at this radius: the inner region carries the
   * `spin` revolution around the galactic centre while the outer disc
   * (which contains the carved heliocentric bubble) stays put so the
   * Sun's exclusion zone never sweeps stars through the solar system.
   * Real galactic rotation is differential anyway — inner material laps
   * the rim, so a spinning core inside a still outer disc is the honest
   * read. 0.3 keeps the rotors well inside the Sun's 0.51 ring.
   */
  INNER_SPIN_R: 0.3,
  /**
   * Differential-rotation factor — the inner-disc rotor spins at
   * ROTOR_DIFF× the whole-disc rate inside the rotating frame, so the
   * core laps the rim the way real flat rotation curves do (inner
   * material completes more revolutions per unit time).
   */
  ROTOR_DIFF: 1.6,
  /**
   * Volumetric dust lanes — the Great Rift. Large soft dark points laid
   * along the arm gaps with NORMAL blending so they absorb the lit disc
   * behind them; additive blending can't darken, so dust gets its own
   * cloud at a fraction of the star budget.
   */
  DUST_COUNT: 4800,
  /** Dust point size (world units) — fat soft occluders, not pinpricks. */
  DUST_PX: 18,
  /** Dust alpha — high enough to visibly rift the band, low enough to keep it translucent. */
  DUST_OPACITY: 0.68,
  /** Lane bands sit at these radius fractions of the disc. */
  DUST_R_MIN: 0.18,
  DUST_R_MAX: 0.85,
  /** Lane angular scatter (rad) around the mid-gap line. */
  DUST_JITTER: 0.3,
  /** Dust grain color — near-black with a warm cast (dust reddens). */
  DUST_R: 0.02,
  DUST_G: 0.012,
  DUST_B: 0.008,
  ARMS: 4,
  /**
   * Golden-ratio spiral geometry — real galactic arms are logarithmic
   * spirals, and a log spiral whose radius grows by φ per quarter-turn
   * has the constant golden pitch atan(2·ln φ/π) ≈ 17.03°. ARM_LOG_B is
   * that spiral's θ-coefficient (θ = B·ln r) so arm curvature follows
   * the same Fibonacci growth seen in phyllotaxis instead of a linear
   * wind; ARM_LOG_R0 is the nominal arm-origin radius (θ = 0 there,
   * just outside the bulge) and ARM_LOG_RMIN floors the log so
   * bulge-overlapping points wrap gracefully rather than diverging.
   */
  GOLDEN: 1.618033988749895,
  /** Golden angle ≈ 137.5° (2π·(2−φ)) — the divergence angle that keeps
   *  successive structures maximally non-repeating; phases the arm sway
   *  and spur offsets so no two arms share a rhythm. */
  GOLDEN_ANGLE: Math.PI * (3 - Math.sqrt(5)),
  ARM_LOG_B: Math.PI / (2 * Math.log(1.618033988749895)),
  /**
   * Pitch tightening — ARM_LOG_B keeps the golden reference value (the
   * spiral whose radius grows by φ per quarter-turn, pitch ≈17°). The
   * applied winding multiplies it by this factor: <1 loosens the arms
   * (fewer turns, bolder sweeps), >1 coils them. 0.85 lands the Milky
   * Way at ~0.9 turn per arm — arms that sweep instead of stacking
   * into ring-grooves (≥1.4 turns reads as concentric circles).
   */
  ARM_PITCH_TIGHT: 0.85,
  ARM_LOG_R0: 30,
  ARM_LOG_RMIN: 6,
  /**
   * Per-arm pitch variation — each lane winds at its own rate: the
   * golden coefficient is perturbed by ±ARM_PITCH_VAR with a
   * golden-angle phase per arm index, so no two arms draw as parallel
   * copies (real spirals are asymmetric — the MW's Perseus and
   * Scutum–Centaurus arms have measurably different pitch angles).
   */
  ARM_PITCH_VAR: 0.11,
  /**
   * Per-arm luminance variation — deterministic dimming per arm index
   * (golden-angle-keyed sinusoid in [0,1]) so arms differ in brightness
   * the way real major/minor arm pairs do instead of identical stripes.
   */
  ARM_LUM_VAR: 0.48,
  /**
   * Arm path wobble — a slow sinusoidal sway on the arm angle
   * (freq·radius ≈ 2.5 full waves, each arm phase-offset by the golden
   * angle) so arm lanes meander like real flocculent spirals instead of
   * drawing as perfect geometric curves.
   */
  ARM_SWAY_FREQ: 0.02,
  ARM_SWAY_AMP: 0.3,
  /**
   * Sway radius scaling — arm meander starts at ARM_SWAY_CORE× the
   * amplitude near the bulge (the inner disc is resonance-locked, so
   * its lanes run smoother) and reaches full amplitude at the rim where
   * flocculent turbulence dominates.
   */
  ARM_SWAY_CORE: 0.3,
  /**
   * Star-forming knots — per-point brightness modulation along each arm
   * (azimuthal lobes drifting with ln r) breaks uniform lanes into
   * glowing OB-association/H-II clumps; KNOT_DEPTH is the max dimming.
   */
  KNOT_LOBES: 7,
  KNOT_DRIFT: 2.3,
  KNOT_DEPTH: 0.78,
  /**
   * Sparse hot-knot shaping — `max(0, sin)^KNOT_POW` isolates discrete
   * star-forming regions along a lane (a high exponent turns the
   * continuous ripple into separated bright clumps instead of a smooth
   * wave); KNOT_HOT_* is the additive blue-white emission those OB
   * associations and H-II nebulae contribute on top of the arm color.
   */
  KNOT_POW: 6,
  KNOT_HOT_R: 0.85,
  KNOT_HOT_G: 0.95,
  KNOT_HOT_B: 1.5,
  /**
   * H-II region tint + fraction — HII_FRAC of hot knots glow
   * hydrogen-alpha pink instead of OB blue-white, the emission-nebula
   * beads real spiral arms are strung with (Orion, Eta Carinae, M8/20).
   */
  HII_FRAC: 0.4,
  HII_R: 1.3,
  HII_G: 0.3,
  HII_B: 0.6,
  /**
   * Galactic bar — the Milky Way is a barred spiral: bulge points
   * stretch ×BAR_X along a seeded in-plane axis (each galaxy's tilt is
   * derived by a golden-fraction hash of its seed — no extra RNG
   * stream, so worker/local parity is preserved).
   */
  BAR_X: 2.35,
  /**
   * On-lane blue shift — points near an arm's spine (small scatter
   * draw) blend toward this blue-white tint, the young disc population
   * real spirals show along their arms; scattered inter-arm points keep
   * the warm ramp. LANE_SCATTER_INV normalizes the three-die scatter
   * draw (range ±1.5) to a 0–1 lane distance.
   */
  LANE_MIX: 0.8,
  LANE_R: 0.45,
  LANE_G: 0.62,
  LANE_B: 1.25,
  LANE_SCATTER_INV: 0.6666666666666666,
  /**
   * Per-point luminance grain — ±LUM_JITTER brightness scatter (drawn
   * from a triangular distribution so most points sit near the mean)
   * keeps arm lanes granular like resolved stellar populations rather
   * than a painted uniform stripe.
   */
  LUM_JITTER: 0.28,
  /**
   * Disc overshoot + rim dissolve — arm points spread to
   * radius×DISC_SPREAD while brightness rolls to zero from
   * EDGE_FADE_START outward, so the disc edge vaporizes into
   * intergalactic dark instead of cutting a hard ring.
   */
  DISC_SPREAD: 1.08,
  EDGE_FADE_START: 0.8,
  THIN: 0.08,
  POINT_PX: 1.6,
  /** Arm angular jitter (rad) on photo-fallback spiral fills. */
  ARM_JITTER: 0.42,
  /**
   * Organic arm scatter — real spiral arms hold together at the core and
   * dissolve into flocculent wisps at the rim. The per-point jitter is
   * scaled from CORE×jitter at r=0 to RIM×jitter at r=radius, and
   * ARM_SPUR_FRAC of disc points drop into the inter-arm gaps with an
   * extra ARM_SPUR_JITTER spread — the branching feather lanes between
   * main arms that keep the pattern fibrous instead of geometric.
   */
  ARM_JITTER_CORE: 0.55,
  ARM_JITTER_RIM: 2.4,
  ARM_SPUR_FRAC: 0.2,
  ARM_SPUR_JITTER: 0.55,
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
   * Halo brightness floor — real stellar halos are ~1% of the disc's
   * light; undimmed points render as a giant fuzzy ball that washes
   * out the arms. Multiplies every halo vertex's color.
   */
  HALO_DIM: 0.35,
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
   * Sun still reads as embedded in the disc. Sized past the shrunken
   * Kuiper edge (~30 units under SOLAR_SCALE) with margin.
   */
  SUN_BUBBLE: 250,
  /**
   * Local-bubble sparsity — the carved neighborhood isn't truly empty
   * (the real Local Bubble is underdense, not hollow): BUBBLE_KEEP of
   * in-bubble points stay at BUBBLE_DIM brightness, so the solar
   * region shows a sparse faint scatter instead of a scrubbed hole.
   */
  BUBBLE_KEEP: 0.12,
  BUBBLE_DIM: 0.3,
  /**
   * Per-point Fibonacci hash step — the Knuth multiplicative constant
   * 2³²/φ scatters sequential point indices across the seed space so
   * each vertex owns an independent deterministic LCG stream. That makes
   * every buffer fill partitionable by index range — the same job runs
   * chunked across the multi-worker WASM pool on several threads and
   * bit-identically in the main-thread fallback.
   */
  SEED_STEP: 0x9e3779b1,
})
