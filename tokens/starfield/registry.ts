/**
 * @file tokens/starfield/registry.js
 * @description Deep-catalog registry vocabulary — the shard-directory
 * name, manifest filename, per-kind metadata (label keys + source
 * credits) and the abbreviated shard-record field dictionaries.
 *
 * ZERO-IMPORT leaf by design (same contract as lang-slugs.ts): node
 * build scripts (locale pages, LLM replicas) and the runtime engine
 * import it under native type stripping, so the catalog's public data
 * surface is declared once and described identically to crawlers.
 */

/** Shard-directory segment under the star-field data root — `…/data/index/`. */
export const SF_REGISTRY_INDEX_DIR = 'index'

/** Manifest filename inside the index dir — record totals + per-kind shard lists. */
export const SF_REGISTRY_MANIFEST = 'manifest.json'

/**
 * One registry kind — `kind` is both the shard filename stem and the
 * record id prefix (`star-000042`); `labelKey`/`aboutKey` are
 * `pages/star-field` translation keys for the localized label/blurb and
 * `credit` names the source archive the kind is drawn from.
 */
export interface SFRegistryKindMeta {
  /** Shard filename stem + record id prefix. */
  kind: string
  /** `pages/star-field` key holding the localized registry label. */
  labelKey: string
  /** `pages/star-field` key holding the localized provenance blurb. */
  aboutKey: string
  /** Source catalogue the records derive from. */
  credit: string
}

/**
 * Registry kinds in directory order — HYG stars, NASA exoplanets,
 * OpenNGC deep-sky objects. Sole declaration site for the kind→label
 * wiring shared by the runtime navigator, the prerendered index page
 * and the replica/JSON-LD emitters.
 * @type {ReadonlyArray<SFRegistryKindMeta>}
 */
export const SF_REGISTRY_KINDS: readonly SFRegistryKindMeta[] = Object.freeze([
  {
    kind: 'star',
    labelKey: 'registry_star',
    aboutKey: 'registry_star_about',
    credit: 'HYG Star Database (Hipparcos/Gliese/Tycho)',
  },
  {
    kind: 'exoplanet',
    labelKey: 'registry_exoplanet',
    aboutKey: 'registry_exoplanet_about',
    credit: 'NASA Exoplanet Archive',
  },
  {
    kind: 'dso',
    labelKey: 'registry_dso',
    aboutKey: 'registry_dso_about',
    credit: 'OpenNGC catalogue',
  },
])

/**
 * Abbreviated shard-record field dictionary per kind — the single-letter
 * JSON keys each record carries (mirrors `SFRegistryRecord` in
 * engine/registry.ts). Emitted to robots so the packed shard vocabulary
 * is self-describing.
 * @type {Readonly<Record<string, Readonly<Record<string, string>>>>}
 */
export const SF_REGISTRY_FIELDS: Readonly<Record<string, Readonly<Record<string, string>>>> =
  Object.freeze({
    star: {
      n: 'name',
      m: 'apparent magnitude',
      d: 'distance (light-years)',
      s: 'spectral type',
      c: 'constellation',
      'x, y, z': 'heliocentric position (light-years)',
      i: 'catalog id',
    },
    exoplanet: {
      n: 'name',
      h: 'host star',
      d: 'distance (light-years)',
      s: 'host spectral type',
      y2: 'discovery year',
      'x, y, z': 'heliocentric position (light-years)',
      i: 'catalog id',
    },
    dso: {
      n: 'name',
      c: 'NGC/IC designation',
      t: 'object type code',
      m: 'apparent magnitude',
      d: 'distance',
      r: 'redshift',
      'x, y, z': 'heliocentric position',
      i: 'catalog id',
    },
  })
