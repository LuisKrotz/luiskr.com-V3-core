/**
 * @file flag-anim.ts
 * @description Flag geometry + animation-mode mapping for FlagWebGL:
 * natural-aspect sizing, hybrid split-point math, and the per-locale
 * shader animation table (wave / ripple / static variants).
 */

import { LOCALES } from '@core/tokens/locales.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { GPU_FLAG_ANIMS } from '@core/tokens/motion/gpu-widgets.js'
import type { FlagWebGL } from '../flag-webgl.js'
import { FLAG_DIMENSIONS } from '@core/tokens/media/dimensions.js'

/**
 * Display aspect of the whole canvas. A split flag shows the left half of
 * the first flag and the right half of the second, each at natural scale,
 * so its width is the mean of both natural widths.
 * @returns {number} natural aspect ratio the flag should display at.
 */
export const displayAspect = (flag: FlagWebGL): number =>
  flag.lang.cc2 ? (flag.aspect1 + flag.aspect2) / 2 : flag.aspect1

/**
 * Normalized 0–1 x where a hybrid flag's two halves meet: the first
 * flag's share of the combined aspect widths (aspect1/(aspect1+aspect2))
 * so each half keeps its natural proportions instead of stretching 50/50.
 * @returns {number}
 */
export const splitPoint = (flag: FlagWebGL): number => flag.aspect1 / (flag.aspect1 + flag.aspect2)

/** Sizes the canvas to the flag's natural aspect ratio. */
export function resizeToNaturalAspect(flag: FlagWebGL): void {
  flag.width = Math.round(flag.height * flag._displayAspect())

  const dpr =
    Math.max((typeof window !== TYPE_STRINGS.UNDEFINED ? window.devicePixelRatio : 1) || 1, 2) * 2

  flag.canvas.width = Math.round(flag.width * dpr)

  flag.canvas.height = Math.round(flag.height * dpr)

  if (flag._wasm) {
    // Wasm surface: `res` = CSS px, `rect` = canvas bitmap px — both
    // follow the canvas's natural-aspect backing size.
    flag._wasm.widget.set_size(flag.width, flag.height)

    flag._wasm.widget.resize(flag.canvas.width, flag.canvas.height)
  }
}

/** Picks the shader's animation mode (wave / gentle ripple / static). */
export function getAnimType(flag: FlagWebGL): number {
  const code = flag.lang.code

  switch (code) {
    case LOCALES.EN:
      return 0.0
    case LOCALES.BR:
      return 1.0
    case LOCALES.ES:
      return 2.0
    case LOCALES.DE:
      return 3.0
    case LOCALES.HRK:
      return 4.0
    case LOCALES.CAS:
      return 5.0
    case LOCALES.RIV:
      return 6.0
    case LOCALES.GN:
      return 7.0
    case LOCALES.IT:
      return 8.0
    case LOCALES.RU:
      return 9.0
    case LOCALES.FR:
      return 10.0
    case LOCALES.TLN:
      return 11.0
    case LOCALES.GL:
      return 12.0
    case LOCALES.CA:
      return 13.0
    case LOCALES.NL:
      return 14.0
    case LOCALES.GA:
      return 15.0
    default:
      return 0.0
  }
}

/**
 * Picks the wasm flag shader's personality — locale code →
 * `GPU_FLAG_ANIMS` discriminant. The WebGL shader's four extra anim
 * slots (GL/CA/NL/GA) have no dedicated wasm personality and map to
 * the nearest regional effect.
 * @returns Wasm anim discriminant for the widget's set_state call.
 */
export function wasmAnimType(flag: FlagWebGL): number {
  switch (flag.lang.code) {
    case LOCALES.EN:
      return GPU_FLAG_ANIMS.EN
    case LOCALES.BR:
      return GPU_FLAG_ANIMS.PT
    case LOCALES.ES:
      return GPU_FLAG_ANIMS.ES
    case LOCALES.DE:
      return GPU_FLAG_ANIMS.DE
    case LOCALES.HRK:
      return GPU_FLAG_ANIMS.HRK
    case LOCALES.CAS:
      return GPU_FLAG_ANIMS.CAS
    case LOCALES.RIV:
      return GPU_FLAG_ANIMS.RIV
    case LOCALES.GN:
      return GPU_FLAG_ANIMS.GN
    case LOCALES.IT:
      return GPU_FLAG_ANIMS.IT
    case LOCALES.RU:
      return GPU_FLAG_ANIMS.RU
    case LOCALES.FR:
      return GPU_FLAG_ANIMS.FR
    case LOCALES.TLN:
      return GPU_FLAG_ANIMS.TLN
    case LOCALES.NL:
      return GPU_FLAG_ANIMS.DE
    default:
      // GL/CA/GA and unknown codes → the Spanish silk personality.
      return GPU_FLAG_ANIMS.ES
  }
}

/**
 * flags display aspect default.
 */
export const FLAG_DISPLAY_ASPECT_DEFAULT = FLAG_DIMENSIONS.FLAG_DEFAULT_ASPECT
