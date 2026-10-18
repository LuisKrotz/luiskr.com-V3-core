/**
 * @file tokens/motion/gpu-widgets.ts
 * @description WebGPU widget discriminants + artifact registry — the
 * numeric `kind` ids and the per-widget wasm module locations for the
 * one-artifact-per-animation architecture. Each `rust/<slug>/` crate
 * compiles to its own ~50KB `luiskr_<slug>.js`+`.wasm` pair under
 * `/wasm/<slug>/`; the bridge (`core/utils/gpu/webgpu-widget.ts`)
 * dynamic-imports it only when the widget's DOM surface mounts. The
 * skeleton is the exception: it loads FIRST, on the critical path,
 * because it's the loading placeholder itself. Uniform layouts mirror
 * each crate's `lib.rs` doc byte for byte — bump both together.
 */

import { ASSET_PATHS } from '@core/tokens/routes/paths.js'

/**
 * Widget kinds — one per animation domain migrated from a standalone
 * WebGL canvas to a dedicated WebGPU wasm artifact on the widget's own
 * canvas. Frozen; consumers import members, never redeclare literals.
 */
export const GPU_WIDGET_KINDS = Object.freeze({
  /** Nav burger hairline bars (fluid wave + breathing). */
  BURGER: 1,
  /** Locale flag — wind warp + specular + split transition. */
  FLAG: 2,
  /** Preference toggle — pill track + per-context waveform. */
  SWITCH_SLIDER: 3,
  /** Day/system/night slider — procedural sky scene. */
  THEME_SLIDER: 4,
  /** Modal close — liquid fill + rotating X strokes. */
  CLOSE_BUTTON: 5,
  /** Fullscreen menu backdrop — fbm contour field. */
  MENU_BACKGROUND: 6,
  /** Loading skeleton — morphing 0/1 glyph cells. */
  SKELETON: 7,
  /** Mosaic letter-burn — ember/char particle sim. */
  BURN: 8,
  /** Media surface — decoded image/video textured quad. */
  MEDIA: 9,
})

/**
 * Artifact registry — kind → wasm-pack glue URL + exported class name.
 * `url` is `/wasm/<slug>/<pkg>.js` under public/; `cls` is the crate's
 * `#[wasm_bindgen]` struct name (each crate exports a differently-
 * named widget, so the bridge indexes the module dynamically).
 * `eager` marks the skeleton — the only artifact allowed on the
 * critical path since it IS the loading placeholder.
 * Frozen; consumers import members, never redeclare literals.
 */
export const GPU_WIDGET_ARTIFACTS: Readonly<
  Record<number, { readonly url: string; readonly cls: string; readonly eager: boolean }>
> = Object.freeze({
  /** burger — nav burger hairline bars. */
  [GPU_WIDGET_KINDS.BURGER]: Object.freeze({
    url: `${ASSET_PATHS.WASM_WIDGETS_PREFIX}burger/luiskr_burger.js`,
    cls: 'Burger',
    eager: false,
  }),
  /** flag — locale flag (two textures for split flags). */
  [GPU_WIDGET_KINDS.FLAG]: Object.freeze({
    url: `${ASSET_PATHS.WASM_WIDGETS_PREFIX}flag/luiskr_flag.js`,
    cls: 'Flag',
    eager: false,
  }),
  /** switch-slider — preference toggle. */
  [GPU_WIDGET_KINDS.SWITCH_SLIDER]: Object.freeze({
    url: `${ASSET_PATHS.WASM_WIDGETS_PREFIX}switch-slider/luiskr_switch_slider.js`,
    cls: 'SwitchSlider',
    eager: false,
  }),
  /** theme-slider — day/system/night slider. */
  [GPU_WIDGET_KINDS.THEME_SLIDER]: Object.freeze({
    url: `${ASSET_PATHS.WASM_WIDGETS_PREFIX}theme-slider/luiskr_theme_slider.js`,
    cls: 'ThemeSlider',
    eager: false,
  }),
  /** close-button — modal close control. */
  [GPU_WIDGET_KINDS.CLOSE_BUTTON]: Object.freeze({
    url: `${ASSET_PATHS.WASM_WIDGETS_PREFIX}close-button/luiskr_close_button.js`,
    cls: 'CloseButton',
    eager: false,
  }),
  /** menu-background — fullscreen menu contour field. */
  [GPU_WIDGET_KINDS.MENU_BACKGROUND]: Object.freeze({
    url: `${ASSET_PATHS.WASM_WIDGETS_PREFIX}menu-background/luiskr_menu_background.js`,
    cls: 'MenuBackground',
    eager: false,
  }),
  /** skeleton — the FIRST-loading artifact (the loading placeholder). */
  [GPU_WIDGET_KINDS.SKELETON]: Object.freeze({
    url: `${ASSET_PATHS.WASM_WIDGETS_PREFIX}skeleton/luiskr_skeleton.js`,
    cls: 'Skeleton',
    eager: true,
  }),
  /** burn — mosaic letter-burn particle sim. */
  [GPU_WIDGET_KINDS.BURN]: Object.freeze({
    url: `${ASSET_PATHS.WASM_WIDGETS_PREFIX}burn/luiskr_burn.js`,
    cls: 'Burn',
    eager: false,
  }),
  /** media — decoded image/video quad. */
  [GPU_WIDGET_KINDS.MEDIA]: Object.freeze({
    url: `${ASSET_PATHS.WASM_WIDGETS_PREFIX}media/luiskr_media.js`,
    cls: 'Media',
    eager: false,
  }),
})

/**
 * Uniform f32 counts per kind — matches `UNIFORM_F32S` in each
 * `rust/<slug>/src/lib.rs` block-layout doc. Used by the bridge to
 * size/settle uniform writes.
 */
export const GPU_WIDGET_UNIFORM_F32S = Object.freeze({
  /** burger: time, res.xy, dark, rect(4). */
  [GPU_WIDGET_KINDS.BURGER]: 8,
  /** flag: res(2), time, hover, anim, split(2), pad, rect(4). */
  [GPU_WIDGET_KINDS.FLAG]: 12,
  /** switch: res(2), time, progress, knob_x, context, pad(2), rect(4). */
  [GPU_WIDGET_KINDS.SWITCH_SLIDER]: 12,
  /** theme: res(2), time, progress, knob_x, ripple(2), pad, rect(4). */
  [GPU_WIDGET_KINDS.THEME_SLIDER]: 12,
  /** close: res(2), time, liquid, draw, rot, click_time, pad, rect(4). */
  [GPU_WIDGET_KINDS.CLOSE_BUTTON]: 12,
  /** menu-bg: time, res(2), reveal, color(3), alpha, color2(3), pad, rect(4). */
  [GPU_WIDGET_KINDS.MENU_BACKGROUND]: 16,
  /** skeleton: res(2), time, resolve, ink_alpha, count, pad(2), rect(4). */
  [GPU_WIDGET_KINDS.SKELETON]: 12,
})

/**
 * Drive modes for `mountWebGpuWidget` — who owns the rAF clock.
 * Frozen; consumers import members, never redeclare literals.
 */
export const GPU_WIDGET_DRIVE = Object.freeze({
  /**
   * Bridge owns the rAF loop + resize listener — the default for
   * stateless widgets (burger, flag, sliders, close, menu, media).
   */
  RAF: 'raf',
  /**
   * Caller owns the loop — for widgets whose host already runs a
   * frame-scheduled loop with its own semantics (skeleton's
   * frame-skip + resolve-out, burn's stage pump). The bridge skips
   * rAF AND the resize listener entirely; the caller drives
   * `widget.frame(dt)`, `widget.set_size(css)`, and
   * `widget.resize(device)` through its existing paths so there is
   * never a second clock or a second resize observer.
   */
  MANUAL: 'manual',
})

/**
 * Flag animation personalities — mirrors `u_anim_type` in the flag
 * shader and `rust/flag`'s anim doc.
 */
export const GPU_FLAG_ANIMS = Object.freeze({
  /** EN (US — stars shimmer). */
  EN: 0,
  /** PT (BR — rhombus solar glow). */
  PT: 1,
  /** ES (Spain — flamenco silk). */
  ES: 2,
  /** DE (CH+DE split — cross-ribbon). */
  DE: 3,
  /** HRK (DE+BR — harmonic wave). */
  HRK: 4,
  /** CAS (AR+UY — Sol de Mayo rays). */
  CAS: 5,
  /** RIV (UY+BR — river reflection). */
  RIV: 6,
  /** GN (Paraguay — horizontal surge). */
  GN: 7,
  /** IT (Italy — mediterranean silk). */
  IT: 8,
  /** RU (Russia — aurora shimmer). */
  RU: 9,
  /** FR (France — satin ripple). */
  FR: 10,
  /** TLN (IT+BR — venetian pulse). */
  TLN: 11,
})
