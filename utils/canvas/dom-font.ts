/**
 * @file utils/canvas/dom-font.ts
 * @description DOM-faithful canvas font helpers shared by every effect that
 * re-rasterizes live text (fluid draw-text snapshot, mosaic burn title).
 *
 * Canvas `ctx.font` only accepts a shorthand subset — style, weight, size
 * and family. Everything else the CSS engine applies is silently dropped:
 * `font-stretch`, `font-variant-caps`, `font-kerning`, `letter-spacing`,
 * `font-feature-settings`, `font-variation-settings`, and — worst —
 * `text-transform`, which canvas does not apply at all. Any of those
 * missing turns the rasterized glyphs into visibly different typography
 * (the "effect changed the font" bug class). These helpers push every
 * remaining axis onto the context and apply the transform to the string,
 * so the canvas copy is pixel-for-pixel the DOM's typography.
 */

import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'

/**
 * Pushes the font axes the `ctx.font` shorthand cannot express — stretch,
 * variant caps (small-caps), kerning, letter-spacing, OpenType feature and
 * variable-font variation settings — onto the context where the 2D API
 * exposes them. Each assignment is guarded: engines that haven't shipped
 * the property keep their default rather than throwing.
 * @param ctx Canvas 2D context being configured.
 * @param st Computed style of the source text element.
 */
export function applyFontExtras(ctx: CanvasRenderingContext2D, st: CSSStyleDeclaration): void {
  const c = ctx as CanvasRenderingContext2D & {
    fontStretch?: string
    fontVariantCaps?: string
    fontKerning?: string
    letterSpacing?: string
    fontFeatureSettings?: string
    fontVariationSettings?: string
  }

  if (st.fontStretch && c.fontStretch !== undefined) {
    c.fontStretch = st.fontStretch as typeof c.fontStretch
  }
  if (st.fontVariantCaps && c.fontVariantCaps !== undefined) {
    c.fontVariantCaps = st.fontVariantCaps as typeof c.fontVariantCaps
  }
  if (st.fontKerning && c.fontKerning !== undefined) {
    c.fontKerning = st.fontKerning as typeof c.fontKerning
  }
  if (st.letterSpacing && c.letterSpacing !== undefined) {
    c.letterSpacing = st.letterSpacing as typeof c.letterSpacing
  }
  if (st.fontFeatureSettings && c.fontFeatureSettings !== undefined) {
    c.fontFeatureSettings = st.fontFeatureSettings
  }
  if (st.fontVariationSettings && c.fontVariationSettings !== undefined) {
    c.fontVariationSettings = st.fontVariationSettings
  }
}

/**
 * Configures a 2D context so `fillText`/`measureText` reproduce the DOM
 * element's typography exactly: shorthand font (style/weight/size/family)
 * plus every extra axis via {@link applyFontExtras}, and the element's
 * resolved ink color. Callers still pick `textBaseline`/`textAlign`.
 * @param ctx Canvas 2D context being configured.
 * @param st Computed style of the source text element.
 */
export function syncCanvasFont(ctx: CanvasRenderingContext2D, st: CSSStyleDeclaration): void {
  ctx.font = `${st.fontStyle} ${st.fontWeight} ${st.fontSize} ${st.fontFamily}`

  applyFontExtras(ctx, st)

  ctx.fillStyle = st.color
}

/**
 * Applies a computed `text-transform` to raw text content. Canvas
 * `fillText` draws strings verbatim — a title styled
 * `text-transform: uppercase` would rasterize in its source casing.
 * `capitalize` uppercases the first letter after each word boundary.
 * @param text Raw textContent.
 * @param transform The computed text-transform keyword.
 * @returns The text as the DOM actually renders it.
 */
export function canvasTransformText(text: string, transform: string): string {
  switch (transform) {
    case 'uppercase':
      return text.toUpperCase()
    case 'lowercase':
      return text.toLowerCase()
    case 'capitalize':
      return text.replace(/(^|\s)(\S)/g, (_m, boundary, ch) => boundary + ch.toUpperCase())
    default:
      return text
  }
}

/**
 * Resolves once the document's webfonts have settled (`document.fonts.ready`)
 * — canvas rasterizes with whatever font is loaded AT draw time, so a
 * snapshot taken before the face arrives silently bakes in the fallback
 * family/metrics. `onReady` runs immediately when FontFaceSet is absent.
 * @param onReady Callback fired once fonts are usable.
 */
export function whenFontsReady(onReady: () => void): void {
  const fonts = (typeof document !== TYPE_STRINGS.UNDEFINED ? document : undefined)?.fonts as
    FontFaceSet | undefined

  if (fonts?.ready?.then) {
    fonts.ready.then(onReady)
  } else {
    onReady()
  }
}

/** Re-export so callers never re-declare the literal (zero-hardcoding). */
export const CANVAS_EMPTY_TEXT = ATTR_VALUES.EMPTY
