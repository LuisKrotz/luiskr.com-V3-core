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
  /**
   * Artificial companion (ISS-class orbiters) — registered only inside
   * a host body's `satellites` list; gives the dossier badge a real
   * label instead of falling through to the raw kind string.
   */
  SATELLITE: 'satellite',
  /**
   * Icy small body on an eccentric orbit (Halley-class) — renders a
   * dark irregular nucleus wrapped in a sublimated coma with ion and
   * dust tails that stream anti-sunward and grow toward periapsis.
   */
  COMET: 'comet',
  /**
   * Airless small body — main-belt asteroids, NEOs and Kuiper-belt
   * objects (Vesta, Bennu, Ryugu, Arrokoth). Renders a crumpled
   * irregular rock with the cratered procedural surface; distinct from
   * DWARF (hydrostatic-ish bodies like Ceres/Pluto/Eris).
   */
  ASTEROID: 'asteroid',
})

/**
 * Surface-recipe hints — catalog defs may pin the procedural painter's
 * style so a body matches its dossier description (a tidally-locked
 * lava planet must never draw ocean bands). Absent → the seed picks
 * within the kind's bias as before.
 */
export const SF_SURFACES = Object.freeze({
  /** Cratered regolith — moons, asteroids, scorched inner worlds. */
  ROCK: 'rock',
  /** Bright fractured ice — Europa/Enceladus/KBO streaked surfaces. */
  ICE: 'ice',
  /** Banded atmosphere — gas/ice giants and mini-Neptunes. */
  GAS: 'gas',
  /** Dark crust split by glowing fault veins — lava worlds. */
  LAVA: 'lava',
  /** Deep water with island mottle + polar caps — ocean worlds. */
  OCEAN: 'ocean',
})

/**
 * Toolbar/panel action names dispatched through `data-action` clicks.
 */
export const SF_ACTIONS = Object.freeze({
  SCREENSHOT: 'screenshot',
  OVERVIEW: 'overview',
  NAV_TOGGLE: 'nav-toggle',
  PANEL_CLOSE: 'panel-close',
  INSTRUCTIONS_TOGGLE: 'instructions-toggle',
  INSTRUCTIONS_CLOSE: 'instructions-close',
})
