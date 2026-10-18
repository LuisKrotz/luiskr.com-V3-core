/**
 * @file tokens/motion/gpu-widgets.ts
 * @description WebGPU overlay widget discriminants — the numeric `kind`
 * ids the JS bridge passes to `Overlay.register_widget`. Mirrors
 * `widgets::kinds` in `rust/overlay/src/widgets/mod.rs` byte for byte;
 * bump both together (cross-language mirror — the same contract
 * `INPUT_TYPES`/`input::kinds` already uses).
 */

/**
 * Widget kinds — one per animation domain migrated from a standalone
 * WebGL canvas to a scissored region of the overlay surface.
 * Frozen; consumers import members, never redeclare literals.
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
})

/**
 * Uniform f32 counts per kind — matches `UNIFORM_F32S` in each
 * `rust/overlay/src/widgets/<kind>.rs` block-layout doc. Used by the
 * bridge to size/settle uniform writes.
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
 * Flag animation personalities — mirrors `u_anim_type` in the flag
 * shader and `widgets::flag::anims` in the crate.
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
