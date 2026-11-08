/**
 * @file wasm-search.ts
 * @description Route-search scorer — the 404 autocomplete ranks its
 * catalog off the main thread through the shared wasm-pool
 * (WASM_ACTIONS.ROUTE_SEARCH, implemented in
 * scripts/workers/wasm-worker.js). One batch dispatch per keystroke
 * carries every entry's title/keywords/path so the worker does all
 * normalization + scoring; when the pool is unavailable the identical
 * main-thread implementation (`scoreRoutesJs`) is the fallback arm.
 */

import { WASM_ACTIONS } from '@core/tokens/data/wasm.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { wasmPool } from './wasm-pool.js'

/** A scorable catalog row — the fields the matcher reads. */
export interface RouteSearchItem {
  /** Display title (strongest match field). */
  title: string
  /** URL path — matched so typing "/port" filters to the portfolio. */
  path: string
  /** Preview/description text (weakest field). */
  preview: string
  /** Search keywords (the DB searchThemes lists). */
  keywords: string[]
}

/** One ranked hit — `index` addresses the caller's catalog array. */
export interface RouteSearchHit {
  index: number
  score: number
}

/** Score weights — title beats keywords beats path beats preview. */
const SCORE_TITLE_EXACT = 100
const SCORE_TITLE_PREFIX = 60
const SCORE_TITLE_CONTAINS = 40
const SCORE_KEYWORD_CONTAINS = 25
const SCORE_PATH_CONTAINS = 15
const SCORE_PREVIEW_CONTAINS = 10

/** Diacritic-folding lowercaser shared by query and field normalization. */
export const normalizeSearchText = (s: string): string =>
  (s || CHAR_STRINGS.EMPTY)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, CHAR_STRINGS.EMPTY)
    .replace(/\s+/g, CHAR_STRINGS.SPACE_CHAR)
    .trim()

/**
 * `scoreRoutesJs` — the synchronous scorer. Every query term must hit at
 * least one field (AND semantics so "dell design" can intersect title
 * words); an empty query returns the whole catalog in declaration order
 * (predict mode lists every route on focus).
 * @param items Catalog rows to rank.
 * @param query Raw input text.
 * @returns Hits sorted by score desc, stable on catalog order.
 */
export function scoreRoutesJs(items: RouteSearchItem[], query: string): RouteSearchHit[] {
  const terms = normalizeSearchText(query).split(CHAR_STRINGS.SPACE_CHAR).filter(Boolean)

  if (!terms.length) {
    return items.map((_, index) => ({ index, score: 1 }))
  }

  const hits: RouteSearchHit[] = []

  items.forEach((item, index) => {
    const title = normalizeSearchText(item.title)
    const path = normalizeSearchText(item.path)
    const preview = normalizeSearchText(item.preview)
    const keywords = (item.keywords || []).map(normalizeSearchText)

    let score = 0
    let matchedAll = true

    for (const term of terms) {
      let best = 0

      if (title === term) best = SCORE_TITLE_EXACT
      else if (title.startsWith(term)) best = SCORE_TITLE_PREFIX
      else if (title.includes(term)) best = SCORE_TITLE_CONTAINS

      for (const kw of keywords) {
        if (kw.includes(term)) best = Math.max(best, SCORE_KEYWORD_CONTAINS)
      }

      if (path.includes(term)) best = Math.max(best, SCORE_PATH_CONTAINS)
      if (preview.includes(term)) best = Math.max(best, SCORE_PREVIEW_CONTAINS)

      if (best === 0) {
        matchedAll = false
        break
      }

      score += best
    }

    if (matchedAll) hits.push({ index, score })
  })

  hits.sort((a, b) => b.score - a.score || a.index - b.index)

  return hits
}

/** Worker payload row — trimmed to the scorable fields. */
interface WireItem {
  t: string
  p: string
  d: string
  k: string[]
}

/** Worker reply row — mirrors the postMessage body in wasm-worker.js. */
interface WireHit {
  i: number
  s: number
}

/**
 * `searchRoutes` — batch-dispatches the scoring to the wasm pool and
 * resolves the ranked hits; resolves the identical JS result when the
 * pool can't answer (no workers, timeout, wiped pool).
 * @param items Catalog rows.
 * @param query Raw input text.
 * @returns Ranked hits; never rejects.
 */
export async function searchRoutes(
  items: RouteSearchItem[],
  query: string
): Promise<RouteSearchHit[]> {
  const wire: WireItem[] = items.map((it) => ({
    t: it.title,
    p: it.path,
    d: it.preview,
    k: it.keywords,
  }))

  const reply = (await wasmPool.dispatch(WASM_ACTIONS.ROUTE_SEARCH, {
    query,
    items: wire,
  })) as { results?: WireHit[] } | null

  if (reply && Array.isArray(reply.results)) {
    return reply.results
      .filter(
        (h) =>
          h &&
          typeof h.i === TYPE_STRINGS.NUMBER &&
          h.i >= 0 &&
          h.i < items.length &&
          typeof h.s === TYPE_STRINGS.NUMBER
      )
      .map((h) => ({ index: h.i, score: h.s }))
  }

  return scoreRoutesJs(items, query)
}
