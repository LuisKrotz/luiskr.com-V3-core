/**
 * @file mosaic/burn/paper.ts — the "paper" raster pipeline: resolve the
 * theme ink palette, re-render the h2 title onto the offscreen canvas at
 * DOM glyph fidelity, detect per-glyph burn units from the ink's alpha
 * channel, and re-anchor the session canvas as the DOM box moves. Split
 * from the monolithic burn.ts.
 */
import { CANVAS_STRINGS } from '@core/tokens/strings/canvas.js'
import { WEBGL_STRINGS } from '@core/tokens/strings/webgl.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { THEME_CSS_PROPS } from '@core/tokens/css/theme.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { syncCanvasFont, canvasTransformText } from '@core/utils/canvas/dom-font.js'
import {
  _ALPHA_STRIDE,
  _BURN_END,
  _COL_SPEED_MIN,
  _COL_SPEED_SPAN,
  _DPR_CAP,
  _IGNITE_DELAY,
  _INK_ALPHA_MIN,
  _PAD_BOTTOM,
  _PAD_TOP,
  _PAD_X,
} from './tuning.js'
import type { BurnInk, BurnSession, LetterBurn } from './types.js'
import { mirrorBurnGpuCanvas } from './wasm.js'

/**
 * Resolves the burn palette from the root CSS custom properties — dark
 * theme publishes a cyan-blue plasma ramp, light theme an airy
 * paper-fire ramp. Falls back to the fixed canvas inks when the
 * properties are absent (older stylesheet, non-themed host).
 * @returns The combustion ink ramp (embers ×3, scorch, smoke).
 */
export function readBurnInk(): BurnInk {
  const root = typeof document !== TYPE_STRINGS.UNDEFINED ? document.documentElement : null
  const cs = root ? getComputedStyle(root) : null
  const pick = (prop: string, fallback: string): string =>
    (cs?.getPropertyValue(prop) || ATTR_VALUES.EMPTY).trim() || fallback

  return {
    core: pick(THEME_CSS_PROPS.BURN_CORE, CANVAS_STRINGS.EMBER_CORE),
    mid: pick(THEME_CSS_PROPS.BURN_MID, CANVAS_STRINGS.EMBER_MID),
    edge: pick(THEME_CSS_PROPS.BURN_EDGE, CANVAS_STRINGS.EMBER_MID),
    scorch: pick(THEME_CSS_PROPS.BURN_SCORCH, CANVAS_STRINGS.BURN_SCORCH),
    smoke: pick(THEME_CSS_PROPS.BURN_SMOKE, CANVAS_STRINGS.BURN_SMOKE),
  }
}

/**
 * The title's anchor + box in the overlay's local LAYOUT space —
 * transform-immune by construction. `getBoundingClientRect` reports the
 * transformed box, and hosts that animate the overlay's ancestor
 * transform during the session (the card-stack deck eases every card's
 * translate3d/rotateY/scale on each deal; the mosaic card scales on
 * hover) would otherwise feed projected deltas into
 * `canvas.style.top/left`: the raster then slid in Y as the transform
 * eased and caught the card's scale on top of its own (the "burn drifts
 * vertically and loses its shape on mobile" defect). The offsetParent
 * chain walks the same coordinate space the canvas's absolute position
 * writes into, so the raster rides the host's transform exactly like the
 * hidden DOM title does.
 * @param titleEl The title element being burned.
 * @param overlayEl The overlay the session canvas is positioned inside.
 * @returns Layout-space anchor + dims, or null when the overlay isn't on
 *   the title's offsetParent chain (unpositioned overlay) or the layout
 *   metrics are degenerate — the caller then falls back to rect deltas,
 *   which are exact on transform-free hosts.
 */
interface LayoutBox {
  /** Title's left edge inside the overlay's border box, layout px. */
  x: number
  /** Title's top edge inside the overlay's border box, layout px. */
  y: number
  /** Title box width in layout px. */
  w: number
  /** Title box height in layout px. */
  h: number
  /** Overlay box width in layout px — the degenerate-overlay guard. */
  ow: number
}

/**
 * Accumulates `offsetTop`/`offsetLeft` from the title up to the overlay.
 * `offsetParent` never sees ancestor transforms, so the sum is the
 * title's layout offset inside the overlay's padding box. Each
 * `offsetTop` step counts from the parent's PADDING edge, so every
 * positioned ancestor's `clientTop`/`clientLeft` (border widths) is
 * added back — the result equals the border-box delta
 * `box.top - oBox.top` the rect path produced.
 * @param titleEl The title element being burned.
 * @param overlayEl The overlay the session canvas is positioned inside.
 * @returns The layout-space geometry, or null for the rect fallback.
 */
function layoutBox(titleEl: HTMLElement, overlayEl: HTMLElement): LayoutBox | null {
  let x = 0
  let y = 0
  let node: HTMLElement | null = titleEl

  while (node && node !== overlayEl) {
    x += node.offsetLeft
    y += node.offsetTop
    node = node.offsetParent as HTMLElement | null

    // Intermediate ancestors undercount by their own border width —
    // offsetTop measures from their padding edge, the rect delta from
    // their border edge.
    if (node && node !== overlayEl) {
      x += node.clientLeft
      y += node.clientTop
    }
  }

  const w = titleEl.offsetWidth
  const h = titleEl.offsetHeight
  const ow = overlayEl.offsetWidth

  // `!(x > 0)` instead of `x < 1` — a DOM that reports offsets without
  // sizes yields NaN, which must take the rect fallback too.
  if (node !== overlayEl || !(w > 0) || !(h > 0) || !(ow > 0)) return null

  return { x: x + overlayEl.clientLeft, y: y + overlayEl.clientTop, w, h, ow }
}

/**
 * Word box for DOM-faithful rasterization — the word's position inside the
 * title element in CSS px (`y` is the word fragment's bottom edge; the
 * caller subtracts the descent to land on the baseline).
 */
interface TitleWordBox {
  /** The raw (pre-transform) word as it appears in the text node. */
  text: string
  /** Left edge of the word fragment relative to the title box. */
  x: number
  /** Bottom edge of the word fragment relative to the title box. */
  y: number
}

/**
 * Reads each word's rendered box straight from the DOM via Range rects —
 * the browser's own line-breaking is the wrap authority. Canvas
 * `measureText` metrics drift sub-pixel from the layout engine
 * (letter-spacing accumulation, shaping/hinting differences): the drift
 * used to push the wrap loop a word early, the extra line drew ABOVE the
 * bottom-anchored paper's top edge, and the visible title collapsed to
 * its last word — burning only that fragment (the "title cut to its last
 * word" bug). Positioning each word at its DOM fragment makes phantom
 * wraps impossible and also reproduces justified/aligned spacing for
 * free. Returns null when the API or a usable text node is absent.
 * @param title The h2 element holding the title text.
 * @returns Per-word boxes in title-relative CSS px, or null to fall back.
 */
function titleWordBoxes(title: HTMLElement): TitleWordBox[] | null {
  if (
    typeof document === TYPE_STRINGS.UNDEFINED ||
    typeof document.createRange !== TYPE_STRINGS.FUNCTION
  ) {
    return null
  }

  const box = title.getBoundingClientRect()

  // Range rects live in the same transformed space as the title's rect —
  // under a host transform (the dealt card's scale/rotate eases while the
  // burn knits) each fragment delta carries that scale on top of the
  // local geometry. Dividing by the title's transformed:layout ratio
  // lands the words in layout px, matching the paper's layout-space box;
  // the ratio is 1 whenever layout metrics are unavailable.
  const kx = title.offsetWidth > 0 ? box.width / title.offsetWidth : 1
  const ky = title.offsetHeight > 0 ? box.height / title.offsetHeight : 1
  const out: TitleWordBox[] = []

  for (const node of title.childNodes) {
    if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) continue

    const re = /\S+/g
    let m: RegExpExecArray | null

    while ((m = re.exec(node.textContent))) {
      const range = document.createRange()

      range.setStart(node, m.index)
      range.setEnd(node, m.index + m[0].length)

      const rect = range.getClientRects()[0]

      if (rect) {
        out.push({
          text: m[0],
          x: (rect.left - box.left) / kx,
          y: (rect.bottom - box.top) / ky,
        })
      }
    }
  }

  return out.length ? out : null
}

/**
 * Rasterizes the h2 text into the paper canvas. Words are drawn at their
 * DOM Range fragment positions (see `titleWordBoxes`), so the raster
 * is pixel-faithful to the rendered title — same wraps, same spacing.
 * Engines without Range fall back to a measured word-pack matching the
 * DOM box, drawn bottom-anchored like the overlay's `align-items:
 * flex-end`.
 *
 * `cssW`/`cssH` are the title box in CSS px while the paper's backing
 * store is device px (cssW × dpr): canvas font and measureText units are
 * CSS px, so the context is scaled cssW→paper.width first — without the
 * transform the glyphs land at 1/dpr size on hidpi/fractional displays
 * (the "burn text renders smaller than the title" bug).
 * @param title The h2 element whose glyphs are re-rendered.
 * @param paper Offscreen canvas sized in device px.
 * @param cssW Title box width in CSS px.
 * @param cssH Title box height in CSS px.
 * @param ink Pre-capture resolved ink color.
 */
export function rasterizeTitle(
  title: HTMLElement,
  paper: HTMLCanvasElement,
  cssW: number,
  cssH: number,
  ink: string
): void {
  const ctx = paper.getContext(WEBGL_STRINGS.CONTEXT_2D)

  if (!ctx) return

  // Map CSS-px drawing onto the device-px backing store (≈dpr, exact
  // through the rounded canvas width). One uniform scale — splitting
  // x/y over independently-rounded edges would distort the glyphs.
  const scale = paper.width / cssW

  ctx.setTransform(scale, 0, 0, scale, 0, 0)

  const st = getComputedStyle(title)

  // Full DOM typography — shorthand + stretch/variant/kerning/letter-
  // spacing/feature/variation axes — so the paper never drifts from the
  // title's real glyphs (the "effect changed the font" bug class). Ink
  // comes from the pre-hide capture: the element's live color is
  // transparent while the canvas owns the pixels.
  syncCanvasFont(ctx, st)
  ctx.fillStyle = ink
  ctx.textBaseline = 'alphabetic'

  const fontPx = parseFloat(st.fontSize) || 12
  const descent = fontPx * 0.22

  const wordBoxes = titleWordBoxes(title)

  if (wordBoxes) {
    // Each word lands exactly where the DOM rendered it — baseline from
    // the fragment's bottom edge minus the font descent.
    for (const w of wordBoxes) {
      ctx.fillText(canvasTransformText(w.text, st.textTransform), w.x, w.y - descent)
    }

    return
  }

  // Fallback for engines without Range#getClientRects: measure and pack
  // words into lines matching the DOM box.
  const text = canvasTransformText(
    (title.textContent || ATTR_VALUES.EMPTY).trim(),
    st.textTransform
  )
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line: string = ATTR_VALUES.EMPTY

  for (const word of words) {
    const trial = line ? `${line} ${word}` : word

    if (line && ctx.measureText(trial).width > cssW) {
      lines.push(line)
      line = word
    } else {
      line = trial
    }
  }

  if (line) lines.push(line)
  if (!lines.length) return

  const lineH = parseFloat(st.lineHeight) || fontPx * 1.2

  // Anchor the block to the paper's bottom like flex-end does in the DOM.
  const firstBase = cssH - (lines.length - 1) * lineH - descent

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 0, firstBase + i * lineH)
  }
}

/**
 * Reads the rasterized paper's alpha channel to locate each glyph:
 * columns that carry ink form runs — a space leaves a transparent gap,
 * so each contiguous run IS one letter (kerned pairs may fuse, which
 * just makes them burn as a unit). Builds:
 *
 *  - `colInk`: 1 where a paper-x column has any glyph pixel — ember
 *    spawning and the char band use it so nothing glows in the spaces.
 *  - `letters`: per-run ink bounds (x0..x1, y0..y1) plus a random burn
 *    speed and ignition delay. Speeds spread 0.55..1.45×, delays up to
 *    22% of total progress — letters catch at different moments and
 *    burn at different paces.
 *  - `colLetter`: paper-x → owning letter index; gap columns bind to
 *    the nearest run so the erase polygon stays coherent across spaces.
 *
 * Finally every letter's speed is normalized so the SLOWEST ignitor
 * finishes at ~98% progress — the burn ends with the description's
 * typing, never after.
 * @param s The live session — fills letters/colInk/colLetter + work size.
 */
export function analyzePaper(s: BurnSession): void {
  const ctx = s.paper.getContext(WEBGL_STRINGS.CONTEXT_2D)

  if (!ctx) return

  const pw = s.paperW
  const ph = s.paperH
  const data = ctx.getImageData(0, 0, pw, ph).data

  s.colInk = new Uint8Array(pw)
  s.colLetter = new Int16Array(pw).fill(-1)

  // Column ink extents — topmost / bottommost opaque row per column.
  const y0s = new Int32Array(pw).fill(-1)
  const y1s = new Int32Array(pw)

  for (let y = 0; y < ph; y++) {
    const row = y * pw * 4 + _ALPHA_STRIDE

    for (let x = 0; x < pw; x++) {
      if (data[row + x * 4] <= _INK_ALPHA_MIN) continue

      s.colInk[x] = 1

      if (y0s[x] < 0) y0s[x] = y

      y1s[x] = y
    }
  }

  // Ink runs → letters. A run ends where a gap column appears; trailing
  // gap columns are not part of the letter span.
  const letters: LetterBurn[] = []
  let x = 0

  while (x < pw) {
    while (x < pw && !s.colInk[x]) x++

    if (x >= pw) break

    const x0 = x
    let y0 = ph
    let y1 = 0

    while (x < pw && s.colInk[x]) {
      y0 = Math.min(y0, y0s[x])
      y1 = Math.max(y1, y1s[x])
      x++
    }

    letters.push({
      x0,
      x1: x,
      y0,
      y1,
      v: _COL_SPEED_MIN + Math.random() * _COL_SPEED_SPAN,
      delay: Math.random() * _IGNITE_DELAY,
    })
  }

  // Every column binds to its nearest letter — the gap between two runs
  // splits at its midpoint, so a front lookup inside a space still
  // resolves coherently.
  for (let li = 0; li < letters.length; li++) {
    const L = letters[li]
    const prev = letters[li - 1]
    const next = letters[li + 1]
    const lo = prev ? (prev.x1 + L.x0) >> 1 : 0
    const hi = next ? (L.x1 + next.x0) >> 1 : pw

    for (let cx = lo; cx < hi; cx++) s.colLetter[cx] = li
  }

  // Normalize: the last letter to finish lands at ~_BURN_END progress so
  // the combustion completes with the description typing. A letter's
  // finish progress is (1+delay)/v — scaling v by worst/_BURN_END pulls
  // the slowest finisher exactly onto _BURN_END (the reciprocal would
  // stretch it past progress 1 and freeze the burn mid-letter).
  let worst = 0

  for (const L of letters) worst = Math.max(worst, (1 + L.delay) / L.v)

  const norm = worst > 0 ? worst / _BURN_END : 1

  for (const L of letters) L.v *= norm

  s.letters = letters

  s.work.width = pw
  s.work.height = ph
}

/**
 * Computed-font signature for the knit re-raster guard. `fontSize`,
 * `fontWeight`, `fontStretch` and `fontFamily` are the glyph-shape
 * terms — the card's `cqw` expand ease mutates the size and the
 * `--fw-lift` weight ease mutates the weight for ~0.42s after a card
 * takes the front. The terms are composed instead of reading the
 * `font` shorthand so engines that resolve shorthand to an empty
 * string still track.
 * @param el The title element whose computed font is fingerprinted.
 * @returns A comparable signature — changes whenever the glyph-shape terms move.
 */
function fontSignature(el: HTMLElement): string {
  const st = getComputedStyle(el)

  return `${st.fontSize}|${st.fontWeight}|${st.fontStretch}|${st.fontFamily}`
}

/**
 * Anchors the canvas once at arm size AND arm position — the raster
 * burns exactly where the glyphs stood when they caught fire. The
 * card's expand ease animates the h2's `cqw` font-size for ~0.42s after
 * hover; re-measuring the box every step baked that shrink into the
 * raster, so the burning glyphs visibly collapsed with the DOM font
 * (the reported font-reduction bug). Freezing the raster keeps the
 * title the size it was when it caught fire.
 *
 * Position stays frozen too: hosts ease layout during the session —
 * the dealt pile's heights grow with the front card's typing and the
 * bottom-anchored copy columns slide — and chasing those boxes made
 * the raster visibly drift (the "burn moves in Y on mobile" defect).
 * The DOM ink is hidden the whole session, so the only correct anchor
 * is where the title stood at arm time. Hosts that publish
 * `cls.ITEM_BURNED` opt into live position tracking — their CSS
 * relocates the title box at the consume beat and the same session
 * replays the consume front in reverse at the new anchor.
 * `lastBox`/`lastPos` signatures skip all work when nothing moved.
 *
 * Knit sessions (dir −1) get one exception: the SAME font transition
 * means an arm-time raster freezes mid-transition letterforms, and the
 * deposit motes knit glyphs that pop back to the live DOM ink at
 * teardown — the "chunks when font style changes" report. A knit
 * re-rasterizes whenever the computed-font signature drifts, so the
 * knit continuously morphs toward the final ink and the handoff is
 * shape-identical.
 * @param s The live session — owns the canvases and DOM elements.
 */
export function syncPaper(s: BurnSession): void {
  // Geometry is read in the overlay's LAYOUT space whenever the overlay
  // sits on the title's offsetParent chain — getBoundingClientRect
  // reports the transformed box, and hosts that ease a transform during
  // the session (the dealt card's translate3d/rotateY/scale) fed
  // projected deltas into style.top while the raster caught the card's
  // scale on top of its own (the "burn drifts vertically and deforms on
  // mobile" defect). Rect deltas remain as the fallback for overlays
  // outside the offset chain — exact on transform-free hosts.
  const lay = layoutBox(s.titleEl, s.overlayEl)
  const box = s.titleEl.getBoundingClientRect()
  const oBox = s.overlayEl.getBoundingClientRect()

  const x = lay ? lay.x : box.left - oBox.left
  const y = lay ? lay.y : box.top - oBox.top
  const titleW = lay ? lay.w : box.width
  const titleH = lay ? lay.h : box.height
  const overW = lay ? lay.ow : oBox.width

  if (titleW < 4 || titleH < 4 || overW < 1) return

  const posSig = `${x},${y}`

  // Paper already rasterized — position-only re-anchor, never re-measure.
  if (s.lastBox) {
    if (s.dir < 0) {
      const font = fontSignature(s.titleEl)

      if (font !== s.lastFont) {
        s.lastFont = font

        // Fall through to the raster branch — the knit picks up the
        // settled (or still-settling) letterforms instead of the
        // arm-time font.
        s.lastBox = ATTR_VALUES.EMPTY
      }
    }

    if (s.lastBox) {
      // Position-only re-anchor exists ONLY for the ITEM_BURNED
      // relocation contract — a host that publishes it relocates the
      // title box in CSS at the consume beat and the canvas must
      // follow. Hosts without it anchor once at the arm-time box:
      // chasing reflowed geometry (the dealt pile's heights growing
      // with the front card's typing, bottom-anchored columns sliding)
      // made the raster visibly drift — the DOM ink is hidden anyway,
      // so the burn plays where the title stood when it caught fire.
      if (!s.cls.ITEM_BURNED || posSig === s.lastPos) return

      s.lastPos = posSig

      s.canvas.style.left = `${x - _PAD_X}px`
      s.canvas.style.top = `${y - _PAD_TOP}px`

      // The GPU particle canvas rides the same re-anchor.
      mirrorBurnGpuCanvas(s)

      return
    }
  }

  const dpr = Math.min(_DPR_CAP, globalThis.devicePixelRatio || 1)

  s.lastBox = `${titleW},${titleH},${dpr}`
  s.lastPos = posSig

  const cssW = titleW + _PAD_X * 2
  const cssH = titleH + _PAD_TOP + _PAD_BOTTOM
  const w = Math.max(2, Math.round(cssW * dpr))
  const h = Math.max(2, Math.round(cssH * dpr))

  s.w = w
  s.h = h
  s.dpr = dpr
  s.paperW = Math.max(2, Math.round(titleW * dpr))
  s.paperH = Math.max(2, Math.round(titleH * dpr))
  s.paperX = _PAD_X * dpr
  s.paperY = _PAD_TOP * dpr

  s.canvas.width = w
  s.canvas.height = h
  s.canvas.style.left = `${x - _PAD_X}px`
  s.canvas.style.top = `${y - _PAD_TOP}px`
  s.canvas.style.width = `${cssW}px`
  s.canvas.style.height = `${cssH}px`

  s.paper.width = s.paperW
  s.paper.height = s.paperH

  // A knit re-raster keeps each letter's ignition delay and speed — the
  // new raster re-derives geometry, but copying the prior timing by run
  // index stops the mid-knit reshuffle from flickering columns in/out.
  const prevLetters = s.dir < 0 ? s.letters : null

  rasterizeTitle(s.titleEl, s.paper, titleW, titleH, s.inkColor)
  analyzePaper(s)

  if (prevLetters) {
    for (let i = 0; i < s.letters.length; i++) {
      const prev = prevLetters[i]

      if (prev) {
        s.letters[i].v = prev.v

        s.letters[i].delay = prev.delay
      }
    }
  }

  // The raster now carries this font state — a knit that catches the
  // next ease step re-enters here through the signature check above.
  s.lastFont = fontSignature(s.titleEl)
}
