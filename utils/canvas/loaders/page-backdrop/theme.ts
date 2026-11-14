/**
 * @file page-backdrop-theme.ts — palette sampling for the page backdrop:
 * reads the seven `--field-*` material tokens plus `--bg-primary`, the
 * specular white and the ink pole from the document root into
 * preallocated uniform buffers, picks the light/dark lobe gains, and
 * records the theme so the frame loop can detect a flip without
 * re-reading computed style every frame.
 */

import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { FIELD_CSS_PROPS, FIELD_CSS_PROP_LIST } from '@core/tokens/css/field.js'
import { THEME_CSS_PROPS } from '@core/tokens/css/theme.js'
import { PAGE_BACKDROP } from '@core/tokens/motion/page-backdrop.js'
import { parseCssColor } from '../../css-color.js'
import type { PageBackdropWebGL } from '../page-backdrop-webgl.js'

/**
 * Samples the theme palette into the host's uniform buffers.
 *
 * `_base` receives `--bg-primary`; `_colors` receives the seven field
 * hues in FIELD_CSS_PROP_LIST order (the shader's `u_col[i]` slots) as
 * one flat RGB Float32Array so the upload is a single `uniform3fv`. An
 * unparseable hue copies the base colour (a lobe of the surface tint is
 * invisible) rather than defaulting to a literal; an unparseable base
 * returns false so the caller can take the CSS fallback — there is no
 * sensible colour to invent for the page surface.
 * `_key` receives the specular white + the theme's key gain (rgb +
 * alpha packed vec4); `_shade` receives the ink pole + the counter-pool
 * gain the same way. `_gain` is the dark/light lobe strength;
 * `_darkAtStart` records the theme so `renderFrame` can detect a
 * mid-loop flip.
 * @param host - the backdrop instance whose buffers to fill
 * @returns true when the base surface colour parsed
 */
export function sampleTheme(host: PageBackdropWebGL): boolean {
  const root = document.documentElement

  const isDark = root.classList.contains(STATE_CLASSES.DARK_MODE)

  let style: CSSStyleDeclaration | null

  try {
    style = getComputedStyle(root)
  } catch {
    style = null
  }

  const base = style ? parseCssColor(style.getPropertyValue(THEME_CSS_PROPS.BG_PRIMARY)) : null

  if (!base) return false

  host._base[0] = base[0]
  host._base[1] = base[1]
  host._base[2] = base[2]

  for (let i = 0; i < FIELD_CSS_PROP_LIST.length; i++) {
    const hue = parseCssColor(
      (style as CSSStyleDeclaration).getPropertyValue(FIELD_CSS_PROP_LIST[i])
    )

    const rgb = hue || base

    host._colors[i * 3] = rgb[0]
    host._colors[i * 3 + 1] = rgb[1]
    host._colors[i * 3 + 2] = rgb[2]
  }

  const specular =
    parseCssColor((style as CSSStyleDeclaration).getPropertyValue(FIELD_CSS_PROPS.SPECULAR)) || base

  const ink =
    parseCssColor((style as CSSStyleDeclaration).getPropertyValue(FIELD_CSS_PROPS.INK)) || base

  host._key[0] = specular[0]
  host._key[1] = specular[1]
  host._key[2] = specular[2]
  host._key[3] = isDark ? PAGE_BACKDROP.KEY_GAIN_DARK : PAGE_BACKDROP.KEY_GAIN_LIGHT

  host._shade[0] = ink[0]
  host._shade[1] = ink[1]
  host._shade[2] = ink[2]
  host._shade[3] = isDark ? PAGE_BACKDROP.SHADE_GAIN_DARK : PAGE_BACKDROP.SHADE_GAIN_LIGHT

  host._gain = isDark ? PAGE_BACKDROP.DARK_GAIN : PAGE_BACKDROP.LIGHT_GAIN

  host._darkAtStart = isDark

  host._paletteDirty = true

  return true
}
