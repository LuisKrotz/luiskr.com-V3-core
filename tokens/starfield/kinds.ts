/**
 * @file tokens/starfield/kinds.js
 * @description Star-field taxonomy + action tokens: the region groups the
 * navigator drawer renders (solar system, Milky Way neighborhood, nebulae,
 * galaxies), the per-body `kind` used for badge labels and procedural
 * material selection, and the `data-action` names the toolbar dispatches.
 * @type {Readonly<Record<string, string>>}
 */

/**
 * Region groups — bucket a body belongs to in the navigator + catalog.
 * Sole declaration site; consumers read members (zero-hardcoding rule).
 */
export const SF_GROUPS = Object.freeze({
  SOLAR: 'solar',
  MILKY_WAY: 'milkyWay',
  NEBULAE: 'nebulae',
  GALAXIES: 'galaxies',
  /**
   * Local Group dwarf + satellite galaxies — the ~30 small companions
   * orbiting the Milky Way and Andromeda (SagDEG, LMC/SMC, the faint
   * spheroidals, and the M31 subgroup).
   */
  LOCAL_GROUP: 'localGroup',
  /**
   * Cosmic-hierarchy boundary structures — Interstellar Neighborhood,
   * Local Group volume, superclusters, and the observable-universe rim.
   */
  HIERARCHY: 'hierarchy',
})

/**
 * Body kinds — drive the dossier badge label and the material recipe in
 * the scene builder (textured sphere vs emissive star vs sprite nebula).
 */
export const SF_KINDS = Object.freeze({
  STAR: 'star',
  PLANET: 'planet',
  DWARF: 'dwarfPlanet',
  MOON: 'moon',
  BLACK_HOLE: 'blackHole',
  SYSTEM: 'system',
  NEBULA: 'nebula',
  /** Star clusters (open/globular) — sprite recipe shared with nebulae. */
  CLUSTER: 'cluster',
  GALAXY: 'galaxy',
  /**
   * Dwarf spheroidal/irregular galaxies — seeded elliptical point clouds
   * (unresolved smudges, no photographic disc to fake).
   */
  DWARF_GALAXY: 'dwarfGalaxy',
  /** Cosmic-hierarchy boundary shells + speckle volumes. */
  STRUCTURE: 'structure',
  /**
   * Small-body annulus (asteroid belt, Kuiper belt) — a seeded Points
   * disc between `belt.inner`/`belt.outer`; not raycast-pickable, the
   * navigator still flies to it for the dossier.
   */
  BELT: 'belt',
})

/**
 * Toolbar/panel action names dispatched through `data-action` clicks.
 */
export const SF_ACTIONS = Object.freeze({
  SCREENSHOT: 'screenshot',
  OVERVIEW: 'overview',
  NAV_TOGGLE: 'nav-toggle',
  PANEL_CLOSE: 'panel-close',
})
