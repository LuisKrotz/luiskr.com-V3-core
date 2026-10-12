/**
 * @file tokens/starfield/params/worker.ts
 * @description Worker-dispatch and deep-field layer parameters — the
 * chunked WASM-pool fill tuning (split bounds for the 400k-point disc
 * and the 139k-record decode) and the real HYG/Hipparcos star-cloud
 * settings: packed-binary format, scale, color-index ramp, edge/camera
 * fades, far-field DSO clamp, and registry shard geometry. Split from
 * the monolithic `params.ts`.
 */

/**
 * Worker-dispatch tuning for the seeded buffer fills — chunking bounds
 * so large fills (the 400k-point disc, the 139k-record decode) split
 * across the pool for true multi-threaded throughput while small fills
 * ride a single dispatch.
 */
export const SF_WORKER = Object.freeze({
  /** Points per chunk before a fill splits across the pool. */
  CHUNK_MIN: 40000,
  /** Chunk ceiling — the pool is ≤4 workers, extra chunks just queue. */
  MAX_CHUNKS: 4,
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
  UNITS_PER_LY: 250,
  /** Sun's galactocentric radius in light-years (ring offset on the disc). */
  SUN_GC_LY: 26700,
  /** Point size (px) — magnitude-attenuated in the shader-free material. */
  POINT_PX: 1.35,
  /** Camera distance beyond which the cloud hides — disc carries the read. */
  LOD_DIST: 500000,
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
   * Star-record sentinel cutoff (light-years) — the source catalogue
   * stamps ~1% of stars at exactly ~100 kpc when parallax is
   * unmeasurable; verbatim they draw a sparse ghost sphere far outside
   * the disc, so records past this distance are dropped.
   */
  STAR_MAX_LY: 50000,
  /**
   * Selection-boundary fade (light-years) — the star catalogue ends at
   * ~3 200 ly, which rendered as a hard golden sphere around the Sun.
   * Star and exoplanet brightness rolls to zero from `EDGE_LY` across
   * `EDGE_BAND_LY` so the cloud dissolves into the disc; DSOs are exempt
   * (their compressed far-shell is already a background layer).
   */
  EDGE_LY: 2200,
  EDGE_BAND_LY: 1100,
  /** Whole-cloud opacity — additive vertex colors, so slightly <1. */
  OPACITY: 0.95,
  /**
   * Camera-distance fade (chart units from the Sun) — inside CAM_FADE_IN
   * the full density surrounds the viewer; past it the whole cloud rolls
   * toward CAM_FADE_FLOOR so the catalog's isotropic bubble never reads
   * as a solid sphere from outside. The authored catalog and the
   * volumetric disc carry the far-field read instead.
   */
  CAM_FADE_IN: 500,
  CAM_FADE_OUT: 20000,
  /** Floor of 0 — the catalogue fully dissolves at range so its
   *  isotropic extent can never silhouette a sphere against the disc. */
  CAM_FADE_FLOOR: 0,
  /**
   * Far-field radius clamp (chart units) — deep-sky objects keep their
   * true sky direction but compress onto this shell when their real
   * distance exceeds it, so NGC galaxies stay visible inside the
   * Local-Group zoom bound instead of sitting at unreachable radii.
   */
  FAR_CLAMP: 500000,
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
  FLY_OFFSET: 50,
  /**
   * Lazy registry-body spawning — when a catalog record is selected its
   * plain cloud point gets a real rendered body (textured star disc,
   * procedural exoplanet, DSO speckle cloud) mounted at the record's
   * heliocentric position on the Sun's pivot. BODY_CACHE caps the LRU
   * set so browsing never accumulates meshes; the radius tunables size
   * each spawned object for the fixed FLY_OFFSET standoff.
   */
  BODY_CACHE: 12,
  /** Star sphere base radius (chart units) at magnitude 0. */
  BODY_STAR_R: 2.4,
  /** Magnitude → radius slope: dimmer stars spawn smaller discs. */
  BODY_STAR_MAGK: 0.18,
  /** Star sphere radius clamps (chart units). */
  BODY_STAR_MIN_R: 0.9,
  BODY_STAR_MAX_R: 4.4,
  /** Exoplanet sphere radius (chart units). */
  BODY_PLANET_R: 0.9,
  /** DSO speckle-cloud radius + member count (galaxies/clusters). */
  BODY_DSO_R: 7,
  BODY_DSO_SPECKLES: 420,
})
