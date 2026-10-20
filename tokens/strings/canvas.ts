/**
 * @file tokens/strings/canvas.ts
 * @description Canvas 2D composite-mode and channel-mask string tokens —
 * token group.
 */

/**
 * Canvas 2D compositing strings. Sole declaration site — consumers import
 * members from this frozen map rather than re-declaring the literals
 * (zero-hardcoding rule).
 *
 * CHANNEL_RED / CHANNEL_CYAN are channel-isolation mask inks, not theme
 * colors: filling an image's copy with them under `multiply` keeps only
 * that RGB channel so offset 'lighter' composites re-add it as a chromatic
 * ghost — the mechanism behind real analog-style RGB split.
 */
export const CANVAS_STRINGS = Object.freeze({
  COMPOSITE_SOURCE_OVER: 'source-over',
  COMPOSITE_MULTIPLY: 'multiply',
  COMPOSITE_LIGHTER: 'lighter',
  COMPOSITE_DIFFERENCE: 'difference',
  COMPOSITE_DESTINATION_OUT: 'destination-out',
  COMPOSITE_DESTINATION_IN: 'destination-in',
  COMPOSITE_SOURCE_ATOP: 'source-atop',
  CHANNEL_RED: 'rgb(255, 0, 0)',
  CHANNEL_CYAN: 'rgb(0, 255, 255)',
  // Inversion-flash fill — 'difference' composite of near-white ≈ invert(0.92).
  INVERT_FILL: 'rgb(235, 235, 235)',
  INK_BLACK: 'black',
  INK_WHITE: 'white',
  // Fully clear ink — gradient stops for scorch bands that fade to nothing.
  INK_CLEAR: 'transparent',
  // Rolling-band filter + the identity filter used to reset ctx.filter.
  FILTER_ROLL: 'saturate(1.7) brightness(1.12)',
  FILTER_NONE: 'none',
  // Canvas2D text-shaping switches — 'none' disables kerning/ligatures so a
  // rasterized glyph matches per-char DOM spans 1:1 (draw-text atlas).
  FONT_KERNING_NONE: 'none',
  // GPU canvas context kind — canvas.getContext(CONTEXT_WEBGPU).
  CONTEXT_WEBGPU: 'webgpu',
  // Paper-combustion inks (mosaic title burn) — ember glow ramp and the
  // charred-paper scorch band. Solid-stroke strings for ctx styles.
  EMBER_CORE: 'rgb(255, 214, 130)',
  EMBER_MID: 'rgb(255, 122, 26)',
  EMBER_TIP: 'rgb(198, 44, 10)',
  BURN_SCORCH: 'rgba(26, 20, 16, 0.85)',
  BURN_SMOKE: 'rgba(96, 88, 80, 0.5)',
  BURN_GLOW: 'rgba(255, 96, 18, 0.55)',
} as const)
