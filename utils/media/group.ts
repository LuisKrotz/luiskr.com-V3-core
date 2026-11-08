/**
 * @file media/group.ts
 * @description Media-group shape predicates shared by the project view and
 * the media-mosaic component: intrinsic height ratios, the all-landscape
 * classifier, and the irregular-heights detector that decides whether a
 * section renders as the masonry wall instead of a carousel strip.
 */

import { INTERNAL_MOSAIC } from '@core/tokens/layout/masonry.js'
import { STATE_STRINGS } from '@core/tokens/strings/state.js'

/** Loose media-item shape — both the view's ProjectMediaItem and the
 *  carousel's CarouselItem satisfy it. */
interface MediaGroupItem {
  src?: string
  size?: number[]
  class?: string
  [key: string]: unknown
}

/**
 * Height ratio (h/w) of one media item — the rendered height the media
 * would take at a common width, which is exactly the axis a uniform
 * carousel strip flattens. Null when the item carries no usable intrinsic
 * size (unsized rows are excluded from the spread decision rather than
 * guessed — a row that can't prove variation keeps the carousel).
 * @param item One media descriptor.
 * @returns h ÷ w, or null for missing/degenerate sizes.
 */
export const mediaItemHeightRatio = (item: MediaGroupItem | null | undefined): number | null => {
  const w = item?.size?.[0]

  const h = item?.size?.[1]

  return w && h && w > 0 && h > 0 ? h / w : null
}

/**
 * Whether every item in the group is flagged landscape — all-landscape
 * groups can't pair side-by-side in the two-up carousel layout, so they
 * force the scroll track (the `forceActive` contract shared by the
 * project binder and the mosaic's mobile carousel fallback).
 * @param group A media item array (shape-checked, not trusted).
 * @returns true when every item is landscape and the group is non-empty.
 */
export const isAllLandscapeGroup = (group: unknown): boolean =>
  Array.isArray(group) &&
  group.length >= 1 &&
  group.every((i) => (i as MediaGroupItem)?.class === STATE_STRINGS.LANDSCAPE)

/**
 * Irregular-heights detector: reports "mosaic" on the spread signal —
 * (a) any sized item whose natural height exceeds TALL_ITEM_H disqualifies
 * the whole group (a >2560px source never renders in the natural-height
 * wall — the group stays on the capped carousel strip), or (b) a
 * max/min h/w spread of
 * INTERNAL_MOSAIC.RATIO_SPREAD_MIN across the group's sized items — e.g.
 * half 16:9 + half 9:16 (≈3.16×), or very-wide shots next to squares
 * (≈2.3×), or (c) a max/min natural pixel-area spread of
 * INTERNAL_MOSAIC.AREA_SPREAD_MIN — same-aspect sources at very different
 * resolutions (997×720 beside 1980×1108 ≈3.06×) that a uniform strip
 * would flatten. Unsized items are skipped; spread needs two sized items to
 * prove variation while the tall-item signal stands alone.
 * @param items A media item array (shape-checked, not trusted).
 * @returns true when the group should render as the masonry wall.
 */
export const hasIrregularMediaHeights = (items: unknown): boolean => {
  if (!Array.isArray(items) || items.length < 1) return false

  const ratios: number[] = []

  const areas: number[] = []

  for (const item of items) {
    const w = (item as MediaGroupItem)?.size?.[0]

    const h = (item as MediaGroupItem)?.size?.[1]

    if (!(w && h && w > 0 && h > 0)) continue

    // A >2560px-tall source VETOES the wall — the mosaic never applies
    // when any item stands taller than TALL_ITEM_H (an oversized source
    // belongs to the capped carousel strip, not the natural-height wall).
    if (h > INTERNAL_MOSAIC.TALL_ITEM_H) return false

    ratios.push(h / w)

    areas.push(w * h)
  }

  if (ratios.length < 2) return false

  // Majority-same gate: sorted-ratio runs within MAJORITY_RATIO_EPS
  // cluster identical tile shapes. When the largest cluster covers more
  // than half the sized items, the outliers ride the uniform strip —
  // "one item is different" is a carousel with a narrow slide, not a
  // masonry wall with one odd hole.
  const sorted = [...ratios].sort((a, b) => a - b)

  let bestRun = 1
  let run = 1

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] / sorted[i - 1] <= INTERNAL_MOSAIC.MAJORITY_RATIO_EPS) {
      run++
    } else {
      run = 1
    }

    if (run > bestRun) bestRun = run
  }

  if (bestRun * 2 > ratios.length) return false

  return (
    Math.max(...ratios) / Math.min(...ratios) >= INTERNAL_MOSAIC.RATIO_SPREAD_MIN ||
    Math.max(...areas) / Math.min(...areas) >= INTERNAL_MOSAIC.AREA_SPREAD_MIN
  )
}
