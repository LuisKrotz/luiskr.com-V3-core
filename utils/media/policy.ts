/**
 * @file utils/media/policy.ts
 * @description Connection- and box-aware media budgets. The progressive
 * ladders (coverLadderStep / loadHighRes) and the <media-figure> video
 * path ask this module how far they may climb: a device on
 * `saveData`/2g, or a media box too small to resolve extra pixels,
 * should never fetch the top rungs (raw original + uncompressed are the
 * multi-megabyte tiers Lighthouse counts as waste).
 */
import { NET_STRINGS } from '@core/tokens/strings/net.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { IMAGE_DIMENSIONS } from '@core/tokens/media/dimensions.js'
import { MEDIA_BUDGET } from '@core/tokens/media/budget.js'

/**
 * Media spend tier for the current connection:
 *   low    — saveData or ≤2g: never autoplay video, first rung only
 *   medium — 3g: autoplay allowed, skip the top (uncompressed) rung
 *   full   — 4g/unknown: unrestricted
 */
export type MediaBudget =
  typeof MEDIA_BUDGET.LOW | typeof MEDIA_BUDGET.MEDIUM | typeof MEDIA_BUDGET.FULL

/**
 * Minimal shape of the Network Information API — `navigator.connection`
 * is non-standard but shipped by every Chromium engine; absent elsewhere.
 */
interface ConnectionLike {
  saveData?: boolean
  effectiveType?: string
}

/**
 * Reads the Network Information API when the engine exposes it —
 * `navigator.connection` is Chromium-only, so Firefox/Safari always
 * resolve 'full' and the policy degrades to the old unrestricted climb.
 * @returns The media spend tier for this connection.
 */
export function mediaBudget(): MediaBudget {
  if (typeof navigator === TYPE_STRINGS.UNDEFINED) return MEDIA_BUDGET.FULL

  const conn = (navigator as Navigator & { connection?: ConnectionLike }).connection

  if (!conn) return MEDIA_BUDGET.FULL

  if (conn.saveData) return MEDIA_BUDGET.LOW

  if (
    conn.effectiveType === NET_STRINGS.EFFECTIVE_SLOW_2G ||
    conn.effectiveType === NET_STRINGS.EFFECTIVE_2G
  )
    return MEDIA_BUDGET.LOW

  if (conn.effectiveType === NET_STRINGS.EFFECTIVE_3G) return MEDIA_BUDGET.MEDIUM

  return MEDIA_BUDGET.FULL
}

/**
 * Whether muted autoplay may attach sources and start playback. A low
 * budget treats video like reduced-motion: the poster stays painted and
 * no stream bytes are fetched — a 14 MB muted loop can never become the
 * LCP tax on a metered connection.
 */
export function videoAutoplayAllowed(): boolean {
  return mediaBudget() !== MEDIA_BUDGET.LOW
}

/**
 * Whether a rendered media box is small enough that the 768px-wide
 * `-mobile` derivative stem already over-resolves it — at ≤768 CSS px
 * every full-width rung (original/uncompressed are multi-MB) is
 * guaranteed waste regardless of connection. A 0/unknown width stays
 * false: the ladder then keeps the full stem and only the connection
 * term applies.
 * @param boxWidthCssPx Rendered width of the media box in CSS px.
 * @returns True when the mobile stem is the correct ladder.
 */
export function smallMediaBox(boxWidthCssPx: number): boolean {
  return boxWidthCssPx > 0 && boxWidthCssPx <= IMAGE_DIMENSIONS.SMALL_BOX_PX
}

/**
 * Highest ladder index the climb may reach. Rung order is fixed
 * (q50 → q75 → original → uncompressed), so the ceiling counts DOWN
 * from the top:
 *   low budget          → first rung only (q50-grade upgrade past LQIP)
 *   medium budget       → skip the top rung (uncompressed is the MB tier)
 *   small box (≤768px)  → skip two rungs — a ≤768 CSS-px box at 3× DPR
 *     still resolves under a full-resolution q75, so original and
 *     uncompressed are guaranteed waste
 * The terms stack: a small box on a 3g link lands on q50-grade quality.
 * @param rungCount Total rungs in the ladder (manifest-proven).
 * @param boxWidthCssPx Rendered width of the media box in CSS px; ≤0
 *   means "unknown" and applies no box term.
 * @returns Inclusive maximum rung index the climb may publish.
 */
export function ladderCeiling(rungCount: number, boxWidthCssPx: number): number {
  const last = rungCount - 1

  if (last <= 0) return last

  const budget = mediaBudget()

  if (budget === MEDIA_BUDGET.LOW) return 0

  let drop = 0

  if (budget === MEDIA_BUDGET.MEDIUM) drop += 1

  if (smallMediaBox(boxWidthCssPx)) drop += 2

  return Math.max(0, last - drop)
}

/**
 * Whether the `-scaledown-2x` video tier already over-resolves the
 * rendered box — scaled sources are half-resolution, so when
 * `box × DPR ≤ source ÷ 2` the full stream is guaranteed waste. A 0
 * box width (first render, before layout) falls back to the viewport
 * width — still a safe upper bound since a figure never exceeds it.
 * @param mediaWidth Intrinsic video width in px.
 * @param boxWidthCssPx Rendered box width in CSS px (0 = pre-layout).
 * @returns True when the scaled tier should be offered first.
 */
export function prefersScaledVideo(mediaWidth: number, boxWidthCssPx: number): boolean {
  const viewport =
    boxWidthCssPx > 0
      ? boxWidthCssPx
      : typeof window !== TYPE_STRINGS.UNDEFINED
        ? window.innerWidth
        : 0

  if (!viewport || !mediaWidth) return false

  const dpr = typeof window !== TYPE_STRINGS.UNDEFINED ? window.devicePixelRatio || 1 : 1

  return viewport * dpr <= mediaWidth / 2
}
