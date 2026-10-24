/**
 * @file route-warmer.js
 * @description Post-load route-chunk warming.
 *
 * On the first interaction signal (or a long quiet-window bound), the
 * remaining route bundles are imported one per idle slice — the browser
 * fetches each ESM chunk into the module cache at low priority, so a
 * later navigation resolves instantly. Gating on intent keeps the eval
 * of never-navigated routes out of the boot window entirely.
 *
 * The WebGPU playground chunk is deliberately excluded: it pulls ~1.3 MB of
 * three.js and is already prefetched on real navigation intent by the
 * PredictiveLoader + router's dynamic import.
 */
import { PREFETCH_CONFIG } from '@core/tokens/motion/prefetch.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { onUserIntent } from '@core/utils/motion/intent.js'

/** Small route chunks safe to warm during idle time. */
const ROUTE_CHUNKS = [
  () => import('@website/views/home/Home.js'),
  () => import('@website/views/project/Project.js'),
  () => import('@website/views/legal/Legal.js'),
  () => import('@website/views/not-found/NotFound.js'),
]

let _started = false
let _stopped = false

/**
 * Runs `cb` at the next idle slice — requestIdleCallback with a bounded
 * timeout when available, a short setTimeout fallback otherwise. Evaluated
 * per call so the probe reflects the live environment in tests.
 * @param {Function} cb — the unit of warm work to defer
 */
const _schedule = (cb: () => void) => {
  if (typeof window.requestIdleCallback === TYPE_STRINGS.FUNCTION) {
    window.requestIdleCallback(cb, { timeout: PREFETCH_CONFIG.IDLE_TIMEOUT })
  } else {
    setTimeout(cb, PREFETCH_CONFIG.FALLBACK_DELAY)
  }
}

/**
 * Schedules the next route chunk import. Stops early when warming was
 * halted or the chain is exhausted; each chunk resolves or rejects into
 * `advance` so a failed chunk never stalls the rest of the chain.
 * @param {number} index — position into ROUTE_CHUNKS
 */
const _warmNext = (index: number) => {
  if (_stopped || index >= ROUTE_CHUNKS.length) return

  _schedule(() => {
    if (_stopped) return

    // import() never throws synchronously — failures surface via the promise.
    // `then(advance, advance)` continues the chain whether the chunk resolved
    // or rejected, and needs no separate empty catch handler.
    const advance = () => _warmNext(index + 1)

    ROUTE_CHUNKS[index]().then(advance, advance)
  })
}

/** Halts the idle warm chain — any pending scheduled imports are skipped. */
export const stopRouteWarming = () => {
  _stopped = true
}

/**
 * Arms warming on the first interaction signal (or the long quiet-window
 * bound) — each chunk still resolves inside an idle slice once released.
 * Warming at load put the unused-route chunk evals inside the interactive
 * window for users who never navigated at all.
 */
export const startRouteWarming = () => {
  if (_started || typeof window === TYPE_STRINGS.UNDEFINED) return

  _started = true

  onUserIntent(() => _schedule(() => _warmNext(0)))
}
