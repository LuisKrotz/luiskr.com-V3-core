/**
 * @file carousel-controls-paint-2d.ts
 * @description Canvas2D renderer for CarouselArrowWebGL, extracted from
 * carousel-controls.ts — mirrors the shader look (glass disc, progress
 * ring with glow head, click shockwave, hover glove/arrow morph) when a
 * GL context is unavailable or the pool purges the widget.
 */

import { ARROW_TYPES } from '@core/tokens/theme/arrows.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { THEME_CSS_PROPS as CSS_PROPS } from '@core/tokens/css/theme.js'

/** Theme inks the painter needs — resolved CSS values, safe as canvas colors. */
interface ArrowPalette {
  /** Disc glass — `--bg-primary` (white in light mode, black in dark). */
  disc: string
  /** Arrow glyph ink — `--text-primary` (dark on light disc, white on dark). */
  ink: string
}

/** Cached palette keyed to the theme flag it was sampled under. */
let _palKey: boolean | null = null

let _pal: ArrowPalette | null = null

/**
 * Samples `--bg-primary`/`--text-primary` once per theme so the disc + arrow
 * flip with the site palette (light mode paints the light-glass/dark-ink
 * variant instead of the always-dark obsidian). Re-samples on a theme flip.
 * @returns The resolved disc + glyph inks.
 */
const arrowPalette = (): ArrowPalette => {
  const dark = document.documentElement.classList.contains(STATE_CLASSES.DARK_MODE)

  if (_pal && _palKey === dark) return _pal

  const cs = getComputedStyle(document.documentElement)

  _pal = {
    disc: cs.getPropertyValue(CSS_PROPS.BG_PRIMARY).trim(),
    ink: cs.getPropertyValue(CSS_PROPS.TEXT_PRIMARY).trim(),
  }

  _palKey = dark

  return _pal
}

/** Everything the 2D paint pass needs from the widget instance. */
export interface CarouselArrowPaintState {
  dpr: number
  width: number
  height: number
  canvasWidth: number
  canvasHeight: number
  type: string
  startTime: number
  isHovered: boolean
  hoverLevel: number
  isPlaying: boolean
  progress: number
  clickTime: number
}

/**
 * paints carousel arrow2 d.
 */
export function paintCarouselArrow2D(
  ctx: CanvasRenderingContext2D | null | undefined,
  state: CarouselArrowPaintState,
  now: number
): void {
  if (!ctx) return

  const dpr = state.dpr || 2

  const w = state.width

  const h = state.height

  const cx = w * 0.5

  const cy = h * 0.5

  const r = w * 0.5 - 2

  const dir = state.type === ARROW_TYPES.NEXT ? 1.0 : -1.0

  const t = (now - state.startTime) * 0.001

  ctx.save()

  ctx.clearRect(0, 0, state.canvasWidth, state.canvasHeight)

  ctx.scale(dpr, dpr)

  ctx.imageSmoothingEnabled = true

  ctx.imageSmoothingQuality = 'high'

  const pal = arrowPalette()

  // ── 1. Single Button Disc (theme glass, NO double border) ──
  ctx.beginPath()

  ctx.arc(cx, cy, r, 0, Math.PI * 2)

  ctx.globalAlpha = state.isHovered ? 0.96 : 0.88

  ctx.fillStyle = pal.disc

  ctx.fill()

  ctx.globalAlpha = 1

  // ── 2. Loading Progress Ring Track ──
  const ringR = r - 2.5

  if (state.isPlaying || state.progress > 0.005) {
    ctx.beginPath()

    ctx.arc(cx, cy, ringR, 0, Math.PI * 2)

    ctx.strokeStyle = 'rgba(102, 252, 241, 0.14)'

    ctx.lineWidth = 1.8

    ctx.stroke()
  }

  // ── 3. Active Circular Progress Arc with Glowing Turquoise Light Effect ──
  if (state.progress > 0.005) {
    const startAngle = -Math.PI * 0.5

    const endAngle = startAngle + state.progress * Math.PI * 2

    ctx.save()

    ctx.beginPath()

    ctx.arc(cx, cy, ringR, startAngle, endAngle)

    ctx.strokeStyle = '#66fcf1'

    ctx.lineWidth = 2.4

    ctx.lineCap = 'round'

    ctx.shadowColor = 'rgba(102, 252, 241, 0.95)'

    ctx.shadowBlur = 8

    ctx.stroke()

    // Luminous white/turquoise leading flare bead
    const px = cx + Math.cos(endAngle) * ringR

    const py = cy + Math.sin(endAngle) * ringR

    ctx.beginPath()

    ctx.arc(px, py, 2.2, 0, Math.PI * 2)

    ctx.fillStyle = '#ffffff'

    ctx.shadowColor = '#66fcf1'

    ctx.shadowBlur = 10

    ctx.fill()

    ctx.restore()
  }

  // ── 5. Click Shockwave Ripple ──
  const clickElapsed = (now - state.startTime) * 0.001 - state.clickTime

  if (clickElapsed >= 0.0 && clickElapsed < 0.45) {
    const shockR = clickElapsed * (r * 2.0)

    const shockAlpha = (1.0 - clickElapsed / 0.45) * 0.75

    ctx.save()

    ctx.beginPath()

    ctx.arc(cx, cy, shockR, 0, Math.PI * 2)

    ctx.strokeStyle = `rgba(102, 252, 241, ${shockAlpha.toFixed(3)})`

    ctx.lineWidth = 1.8

    ctx.stroke()

    ctx.restore()
  }

  // ── 6. Center Controls: Touch Glove on Hover & Dynamic Transformation ──
  const hLevel = state.hoverLevel

  const idleAlpha = Math.max(0.0, 1.0 - hLevel * 1.2)

  const hoverAlpha = Math.min(1.0, hLevel * 1.2)

  ctx.save()

  // Dynamic nudge along direction on hover
  const nudge = dir * hLevel * 2.5

  ctx.translate(cx + nudge, cy)

  // A) IDLE STATE: Crisp anti-aliased directional arrow in project white/turquoise
  if (idleAlpha > 0.01) {
    ctx.save()

    ctx.globalAlpha = idleAlpha

    ctx.strokeStyle = pal.ink

    ctx.fillStyle = pal.ink

    ctx.lineWidth = 2.2

    ctx.lineCap = 'round'

    ctx.lineJoin = 'round'

    ctx.shadowColor = 'rgba(102, 252, 241, 0.4)'

    ctx.shadowBlur = 4

    const shaft = 7.5

    const head = 5.0

    ctx.beginPath()

    ctx.moveTo(-dir * shaft, 0)

    ctx.lineTo(dir * shaft, 0)

    ctx.moveTo(dir * (shaft - head), -head * 0.9)

    ctx.lineTo(dir * shaft, 0)

    ctx.lineTo(dir * (shaft - head), head * 0.9)

    ctx.stroke()

    ctx.restore()
  }

  // B) HOVER STATE: Animated Touch Glove & Forward Kinetic Arrow Morphing
  if (hoverAlpha > 0.01) {
    ctx.save()

    ctx.globalAlpha = hoverAlpha

    // Expanding touch pulse ripples from contact point
    const touchOriginX = -dir * 2

    const rippleR1 = (t * 22) % 13

    const rippleA1 = (1.0 - rippleR1 / 13) * 0.65

    ctx.beginPath()

    ctx.arc(touchOriginX, 0, rippleR1, 0, Math.PI * 2)

    ctx.strokeStyle = `rgba(102, 252, 241, ${rippleA1.toFixed(3)})`

    ctx.lineWidth = 1.2

    ctx.stroke()

    const rippleR2 = (t * 22 + 6.5) % 13

    const rippleA2 = (1.0 - rippleR2 / 13) * 0.45

    ctx.beginPath()

    ctx.arc(touchOriginX, 0, rippleR2, 0, Math.PI * 2)

    ctx.strokeStyle = `rgba(102, 252, 241, ${rippleA2.toFixed(3)})`

    ctx.lineWidth = 1.0

    ctx.stroke()

    // Stylized Touch Glove: wrist cuff, palm curve, and pointing index finger
    ctx.strokeStyle = '#66fcf1'

    ctx.fillStyle = 'rgba(102, 252, 241, 0.15)'

    ctx.lineWidth = 1.8

    ctx.lineCap = 'round'

    ctx.lineJoin = 'round'

    ctx.shadowColor = 'rgba(102, 252, 241, 0.85)'

    ctx.shadowBlur = 6

    ctx.beginPath()

    // Glove wrist base
    ctx.moveTo(-dir * 8, 5)

    ctx.lineTo(-dir * 8, -5)

    // Top hand curve to index finger base
    ctx.lineTo(-dir * 3, -5)

    // Extended index finger pointing in navigation direction
    ctx.lineTo(dir * 5, -2)

    ctx.arc(dir * 5, 0, 2, -Math.PI * 0.5, Math.PI * 0.5, dir < 0)

    // Lower hand curve returning to wrist
    ctx.lineTo(-dir * 3, 5)

    ctx.closePath()

    ctx.fill()

    ctx.stroke()

    // Forward kinetic arrow stream emitted from finger touch
    const streamOffset = (t * 24) % 10

    const streamAlpha = (1.0 - streamOffset / 10) * 0.85

    const streamX = dir * (6 + streamOffset)

    ctx.save()

    ctx.strokeStyle = `rgba(102, 252, 241, ${streamAlpha.toFixed(3)})`

    ctx.lineWidth = 2.0

    ctx.beginPath()

    ctx.moveTo(streamX - dir * 3, -3.5)

    ctx.lineTo(streamX, 0)

    ctx.lineTo(streamX - dir * 3, 3.5)

    ctx.stroke()

    ctx.restore()

    ctx.restore()
  }

  ctx.restore()

  ctx.restore()
}
