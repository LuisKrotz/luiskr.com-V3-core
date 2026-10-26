/**
 * @file tokens/playground/control-groups.js
 * @description Declarative control-panel schema for the Earth Playground —
 * the group → control → action tree the panel renders from, stripped of
 * every runtime token reference so plain-Node build scripts (locale pages,
 * LLM replicas) can import it under native type stripping.
 *
 * ZERO-IMPORT leaf by design (same contract as lang-slugs.ts): rows carry
 * the SP_*_PARAMS / SP_ACTIONS *member names* in `key`, never the wire
 * strings — `space/controls.ts` and the build scripts resolve each key
 * through the token maps, keeping params.ts/actions.ts the sole
 * declaration sites for the wire values. Input type is shape-derived:
 * a row with `min`/`max`/`step`/`def` is a range slider, a row with
 * `checked` is a checkbox — no 'range'/'checkbox' literal repeats the
 * FORM_ATTRS vocabulary.
 */

/** Range-slider row — `key` names the SP_*_PARAMS member that owns the wire param string. */
export interface SpControlRangeSpec {
  /** SP_*_PARAMS member name (e.g. 'FOV' → SP_CAMERA_PARAMS.FOV). */
  key: string
  /** Translation key looked up in the earth-playground node (and the CMS `defaults` map key). */
  label: string
  /** Slider minimum. */
  min: number
  /** Slider maximum. */
  max: number
  /** Slider step granularity. */
  step: number
  /** Shipped numeric default — CMS defaults and saved values override it. */
  def: number
}

/** Checkbox row — same `key`/`label` contract, `checked` carries the shipped state. */
export interface SpControlCheckSpec {
  /** SP_*_PARAMS member name (e.g. 'BLOOM' → SP_POST_PARAMS.BLOOM). */
  key: string
  /** Translation key looked up in the earth-playground node (and the CMS `defaults` map key). */
  label: string
  /** Shipped checkbox state — same override precedence as `def`. */
  checked: boolean
}

/** One control row — slider or checkbox by shape. */
export type SpControlSpec = SpControlRangeSpec | SpControlCheckSpec

/** Group-level action button — `key` names the SP_ACTIONS member that owns the wire action string. */
export interface SpControlActionSpec {
  /** SP_ACTIONS member name (e.g. 'RESET' → SP_ACTIONS.RESET). */
  key: string
  /** Translation key looked up in the earth-playground node. */
  label: string
}

/** One collapsible panel group — `label` is the group's translation key. */
export interface SpControlGroupSpec {
  /** Translation key for the group header. */
  label: string
  /** Whether the group starts folded. */
  collapsed: boolean
  /** The group's input rows. */
  controls: readonly SpControlSpec[]
  /** Optional buttons rendered under the controls. */
  actions?: readonly SpControlActionSpec[]
}

/**
 * Control-panel group tree — sole declaration site for the panel's
 * structure (group order, fold state, per-control range geometry and
 * shipped defaults). `space/controls.ts` expands it into SLIDER_GROUPS
 * by resolving `key` through the param/action token maps and deriving
 * the FORM_ATTRS input type from each row's shape; the build scripts
 * expand it the same way to describe the canvas-rendered control
 * surface to crawlers and agents.
 * @type {ReadonlyArray<SpControlGroupSpec>}
 */
export const SP_CONTROL_GROUPS: readonly SpControlGroupSpec[] = Object.freeze([
  {
    label: 'engine',
    collapsed: true,
    controls: [
      { key: 'WATER_METALNESS', label: 'waterMetalness', min: 0, max: 1, step: 0.01, def: 0 },
    ],
  },
  {
    label: 'terrain',
    collapsed: true,
    controls: [
      { key: 'BUMP_SCALE', label: 'bumpScale', min: 0, max: 20, step: 0.5, def: 5 },
      { key: 'SELF_SHADOW', label: 'selfShadow', min: 0, max: 5, step: 0.1, def: 1 },
      {
        key: 'SELF_SHADOW_OFFSET',
        label: 'selfShadowOff',
        min: 0,
        max: 0.01,
        step: 0.0005,
        def: 0.002,
      },
    ],
  },
  {
    label: 'postFx',
    collapsed: true,
    controls: [
      { key: 'BLOOM', label: 'bloom', checked: false },
      { key: 'BLOOM_STRENGTH', label: 'bloomStr', min: 0, max: 3, step: 0.05, def: 0.1 },
      { key: 'BLOOM_RADIUS', label: 'bloomRadius', min: 0, max: 2, step: 0.05, def: 0.3 },
      { key: 'BLOOM_THRESHOLD', label: 'bloomThreshold', min: 0, max: 1.5, step: 0.01, def: 0.9 },
      { key: 'VIGNETTE', label: 'vignette', checked: false },
      { key: 'VIGNETTE_DARKNESS', label: 'vigDarkness', min: 0, max: 2, step: 0.05, def: 1 },
      { key: 'VIGNETTE_OFFSET', label: 'vigOffset', min: 0, max: 1, step: 0.01, def: 0.5 },
      { key: 'CHROMATIC', label: 'chromaticAb', checked: false },
      { key: 'CA_STRENGTH', label: 'caStrength', min: 0, max: 2, step: 0.01, def: 0.25 },
      { key: 'FILM_GRAIN', label: 'filmGrain', min: 0, max: 1, step: 0.01, def: 0 },
    ],
  },
  {
    label: 'camera',
    collapsed: false,
    controls: [
      { key: 'FOV', label: 'fov', min: 15, max: 90, step: 1, def: 45 },
      { key: 'AUTO_ROTATE', label: 'autoRotate', checked: false },
      { key: 'ROTATE_SPEED', label: 'rotateSpeed', min: -5, max: 5, step: 0.01, def: 0.05 },
    ],
    actions: [{ key: 'RESET', label: 'resetView' }],
  },
  {
    label: 'earth',
    collapsed: true,
    controls: [
      { key: 'EARTH_SPEED', label: 'spinSpeed', min: 0, max: 50, step: 1, def: 1 },
      { key: 'SUN_AUTO_ROTATE', label: 'sunAutoRotate', checked: true },
    ],
  },
  {
    label: 'color',
    collapsed: true,
    controls: [
      { key: 'CONTRAST', label: 'contrast', min: 0.5, max: 2, step: 0.01, def: 1 },
      { key: 'SATURATION', label: 'saturation', min: 0, max: 2, step: 0.01, def: 1.5 },
      { key: 'BLACK_LEVEL', label: 'blackLevel', min: 0, max: 0.2, step: 0.005, def: 0.015 },
    ],
  },
  {
    label: 'displayDebug',
    collapsed: true,
    controls: [{ key: 'RES_SCALE', label: 'resScale', min: 0.5, max: 2, step: 0.1, def: 1 }],
    actions: [
      { key: 'COPY_CONSTANTS', label: 'copyConstants' },
      { key: 'SCREENSHOT', label: 'screenshot' },
    ],
  },
])
