/**
 * @file tokens/starfield/params/weather.ts
 * @description Living-planet parameters — the procedural weather field
 * (cloud coverage, jet-stream drift, ITCZ convergence, hurricane
 * vortices, polar snow advance/retreat, volcanic ash), the solar-wind
 * activity cycle that drives flares and auroras, and the LEO satellite
 * constellation shell. All shader-facing math constants live here so the
 * TSL graphs in `engine/bodies/weather.ts` carry no literals.
 */

/**
 * Procedural weather field — Earth-grade cloud/climate constants.
 * Angles are radians, times are scene seconds (`s.t`), densities are
 * 0..1 coverages blended into the cloud deck's alpha.
 */
export const SF_WEATHER = Object.freeze({
  /**
   * Base fbm coverage frequency — sampled in unit-sphere space so the
   * value counts octaves of planetary-scale features (2.8 ≈ continent-
   * sized cloud banks with sub-structure).
   */
  CLOUD_FREQ: 2.8,
  /**
   * Detail octave — a second fbm layer at ~4× the base frequency that
   * breaks coverage into clumpy, cauliflower-edged banks instead of
   * smooth latitude stripes; DETAIL_GAIN is its blend weight.
   */
  CLOUD_DETAIL_FREQ: 4.3,
  CLOUD_DETAIL_GAIN: 0.4,
  /** Noise-field evolution rate (scene-seconds⁻¹) — slow morph, no boil. */
  CLOUD_EVOLVE: 0.012,
  /** How much the real 8k cloud map steers procedural coverage (0..1). */
  CLOUD_STEER: 0.55,
  /**
   * Coverage ramp edges — below LO is clear sky, above HI is overcast.
   * A tight ramp punches broken cloud shapes out of the field; a wide
   * soft ramp reads as haze stripes.
   */
  COVER_LO: 0.3,
  COVER_HI: 0.58,
  /**
   * Differential rotation — air masses shear against the surface:
   * base equatorial drift plus a mid-latitude jet boost (lat-weighted
   * so weather visibly races around the temperate bands, slow near the
   * poles — the read that makes the planet feel alive in close orbit).
   */
  JET_BASE: 0.016,
  JET_LAT: 0.02,
  /**
   * Latitude meander — slow noise that warps the coverage sample in the
   * vertical direction so jet-sheared banks undulate north/south
   * instead of ringing the globe in straight east-west stripes.
   */
  LAT_MEANDER: 0.16,
  /**
   * ITCZ — the equatorial convergence band where trade winds meet.
   * HALF is the band half-width (radians of latitude), GAIN its extra
   * cover, WANDER how far it migrates with the solar declination
   * (monsoon seasonality — the band follows the sun north/south).
   */
  ITCZ_HALF: 0.14,
  ITCZ_GAIN: 0.55,
  ITCZ_WANDER: 0.3,
  /**
   * Hurricane vortices — N seeded tropical cyclones; R is the chord
   * radius of the storm envelope, GAIN its cover contribution, SWIRL
   * the spiral-arm twist (radians at core), DRIFT the band-limited
   * westward walk, FREQ the feeder-band noise frequency, EYE_R/DIP the
   * calm eye punch-out.
   */
  STORM_N: 4,
  STORM_R: 0.22,
  STORM_GAIN: 1.1,
  STORM_SWIRL: 2.6,
  STORM_DRIFT: 0.006,
  STORM_FREQ: 9.0,
  EYE_R: 0.05,
  EYE_DIP: 0.9,
  /**
   * Polar snow/ice — ICE_BASE is the solstice cap edge in |lat| units
   * (0.82 ≈ 55°N/S keeps the cap polar instead of blanketing half the
   * globe); ICE_DECL swings the line against the solar declination so
   * caps visibly grow into winter and retreat in summer; SNOW_GAIN is
   * the cap's deck-brightness contribution — a fraction, not a coat.
   */
  ICE_BASE: 0.82,
  ICE_DECL: 0.1,
  ICE_SOFT: 0.06,
  SNOW_GAIN: 0.45,
  /**
   * Volcanic ash — one seeded eruption site pulsing on a slow period;
   * GAIN is plume darkness, VOLC_R its radius (unit-sphere chord),
   * VOLC_PERIOD the eruption cycle in scene-seconds.
   */
  VOLC_R: 0.12,
  VOLC_GAIN: 0.8,
  VOLC_PERIOD: 73,
  /** Ash plume tint — dark gray-brown against the white deck. */
  ASH_TINT: 0x4a4440,
  /**
   * Cloud shadow — the fraction the surface dims under dense deck on
   * the day side only (night lights must never be occluded).
   */
  SHADOW: 0.32,
})

/**
 * Solar-wind activity cycle — one shared uniform drives the sun's flare
 * frequency AND every aurora shell, so a storm spike on the Sun visibly
 * reaches Earth/Jupiter/Saturn/Neptune a beat later. BASE+WAVE give the
 * slow ~11-year-style swell; the storm term multiplies two detuned sines
 * and takes a high power so spikes stay rare and sharp.
 */
export const SF_SOLAR_WIND = Object.freeze({
  /** Quiet-Sun floor of the wind uniform. */
  BASE: 0.35,
  /** Slow activity swell amplitude + period (scene-seconds). */
  WAVE_AMP: 0.3,
  WAVE_PERIOD: 41,
  /**
   * Storm spikes — product of two detuned sines to a high power lands a
   * bright gust every ~90–140 s that lasts a few seconds; GAIN scales
   * the spike on top of BASE+WAVE.
   */
  STORM_F1: 0.071,
  STORM_F2: 0.045,
  STORM_POW: 6,
  STORM_GAIN: 0.9,
  /**
   * Limb flares — N seeded prominence sprites on the Sun's equatorial
   * band; each breathes at its own rate and stretches past the limb when
   * the wind spikes.
   */
  FLARE_N: 5,
  FLARE_MIN_SCALE: 0.5,
  FLARE_MAX_STRETCH: 2.1,
})

/**
 * Aurora shells — polar emission curtains on atmosphere-bearing bodies.
 * Driven by the shared solar-wind uniform: quiet wind shows a faint oval
 * shimmer, storms ignite bright rippling curtains.
 */
/**
 * Aurora ovals — thin rayed emission rings centered on each planet's
 * MAGNETIC pole (not the spin pole — a per-body `tilt` rotates the
 * sampling frame so Neptune's 47° dipole offset reads as an oval swung
 * far off the axis). A second, higher shell carries the curtain tops
 * so the arcs stand off the limb instead of painting a flat cap.
 */
export const SF_AURORA = Object.freeze({
  /**
   * Auroral oval center — |lat| on the unit sphere (~0.8 ≈ 53° from
   * the equator, the real auroral zone sits just inside the pole).
   */
  LAT0: 0.87,
  /**
   * Oval gaussian half-width — the emission is a thin curtain RING
   * hugging the oval; wide windows read as a smeared cap (the old
   * "green fried egg"), so this stays deliberately narrow.
   */
  OVAL_W: 0.045,
  /**
   * Oval waviness — substorm arcs buckle the ring with longitude;
   * sampled as noise on the sphere so there's no seam at ±π.
   */
  LAT_WOBBLE: 0.05,
  WOBBLE_FREQ: 2.6,
  WOBBLE_DRIFT: 0.05,
  /**
   * Curtain rays — the oval is striated into N ray pleats around the
   * full 360° (a longitude sine stays continuous across the ±π seam
   * for integer counts); RAY_JAG jitters each ray's phase with noise
   * so they waver like hanging drapes instead of a barcode, RAY_SHARP
   * (a power) thins the bright core of each pleat, and RAY_DRIFT walks
   * the pattern around the oval as substorms rotate.
   */
  RAY_FREQ: 24,
  RAY_JAG: 5,
  RAY_SHARP: 2.4,
  RAY_DRIFT: 0.35,
  /** Ray floor — gaps stay dimly lit, never fully dark. */
  RAY_FLOOR: 0.12,
  /**
   * Arc breakup — low-frequency longitude modulation flares sections
   * of the oval (auroral substorms brighten one sector at a time);
   * ARC_GAIN is the modulation contrast — high values let sectors go
   * dark so storms never wash the whole oval flat.
   */
  ARC_FREQ: 1.4,
  ARC_DRIFT: 0.11,
  ARC_GAIN: 0.9,
  /**
   * Brightness scale against the wind uniform — a faint shimmer that
   * storms multiply through `wind`, visible on the dark limb without
   * reading as a second surface layer.
   */
  INTENSITY: 0.28,
  /** Shell lift above the surface radius — hugs the atmosphere top. */
  SHELL_SCALE: 1.02,
  /**
   * Limb-fade power — |view normal z| powered this high so the oval
   * only glows when seen against the planet's face; at the silhouette
   * the shell would otherwise draw arcs floating off the limb.
   */
  LIMB_POW: 2.2,
  /**
   * Default magnetic-axis tilt (radians) — Earth's dipole sits ~11°
   * off the spin axis; per-body `aurora.tilt` overrides (Neptune's
   * dipole is offset ~47°, swinging its oval wildly off-pole).
   */
  TILT: 0.19,
  /**
   * Night-side gate — auroras read through darkness: `dot(normal,
   * sunDir)` smoothstepped between the edges so day-side emission
   * fades to DAY_FLOOR instead of vanishing (UV aurora still runs
   * in sunlight, it just doesn't show).
   */
  NIGHT_LO: 0.3,
  NIGHT_HI: -0.25,
  DAY_FLOOR: 0.01,
  /**
   * Hemisphere gate — `aurora.south === false` fades the oval out
   * across the magnetic equator so only the boreal (north) curtain
   * shows; the giants keep both ovals. Edges are signed magnetic
   * latitude on the unit sphere.
   */
  HEMI_LO: 0.05,
  HEMI_HI: 0.3,
  /**
   * Default palette — oxygen-green curtain top over a violet-red
   * lower edge (Earth); per-body `aurora.color/colorLow` override for
   * the giants' hydrogen-dominated blues and cyans.
   */
  TOP: 0x3aff8c,
  LOW: 0xb050ff,
})

/**
 * Meteor strikes — airless cratered bodies (Moon, Callisto, Mercury,
 * the asteroid dwarfs) still take hits; a small pooled sprite flashes
 * at a random surface point every few seconds, the way a real impact
 * fireball flickers. Pool keeps allocation out of the frame loop.
 */
export const SF_METEOR = Object.freeze({
  /** Mean seconds between strikes per body (per-strike jitter ±60%). */
  INTERVAL: 3.5,
  /** Flash duration — rise fast (25% of life), decay slow. */
  LIFE: 0.9,
  /** Flash sprite diameter × the body radius. */
  SIZE: 0.09,
  /** Sprites pooled per flagged body. */
  POOL: 3,
  /** Impact flash tint — hot white-gold impact fireball. */
  COLOR: 0xffd9a0,
})

/**
 * LEO constellation shell — the Starlink-class swarm: dozens of small
 * lit specks sharing one inclined orbital plane that sweeps as a unit.
 */
export const SF_CONSTELLATION = Object.freeze({
  /** Shell altitude as a multiple of the body radius. */
  ORBIT: 1.45,
  /** Shell angular speed multiplier (frame pivot). */
  SPEED: 7.5,
  /** Orbital plane inclination (radians, ~53° like Starlink). */
  INCLINE: 0.92,
  /** Altitude jitter fraction — the shell has thickness, not a line. */
  JITTER: 0.06,
  /** Point size vs the host body radius — glints, not balls. */
  SIZE: 0.012,
})
