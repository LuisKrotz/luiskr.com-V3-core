/**
 * @file scroll-state.js
 * @description Global "is the window currently scrolling" flag plus an
 * onScrollStop() one-shot registry — used to defer expensive work (layout
 * reads, lazy swaps, decoding) until a scroll gesture settles. Settling is
 * debounce-driven: scroll AND scrollend both re-arm the 120ms timer because
 * atomic programmatic scrolls (per-frame scrollTop writes, smooth-scroll
 * drivers) emit scroll+scrollend inside one task — settling on scrollend
 * would unlatch the flag mid-gesture and flicker every parked animation
 * and deferred swap back on at exactly the moment they must stay off.
 */
import { WINDOW_EVENTS } from '@core/tokens/events/dom.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'

/** Settle window — a gap this long with no scroll/scrollend ends the gesture. */
const SETTLE_MS = 120

/** Live scroll flag — true while the user is actively scrolling the window. */
let isWindowScrolling = false

/** Debounce handle — reset on every scroll event so it fires only on stop. */
let scrollStopTimer: ReturnType<typeof setTimeout> | null = null

/** Subscribers invoked once per scroll-settle, then cleared. */
const scrollStopCallbacks = new Set<() => void>()

/** Fires when scrolling settles: clears the flag and drains pending callbacks. */
const handleScrollStop = () => {
  isWindowScrolling = false

  document.documentElement.classList.remove(STATE_CLASSES.IS_SCROLLING)

  // Reachable only as the armed timer's own callback — the handle is
  // provably non-null, so clearing it is the fired-timer no-op.
  clearTimeout(scrollStopTimer as ReturnType<typeof setTimeout>)

  scrollStopTimer = null

  const callbacks = Array.from(scrollStopCallbacks)

  scrollStopCallbacks.clear()

  callbacks.forEach((cb) => {
    try {
      cb()
    } catch {
      // listener errors must not break the scroll pipeline
    }
  })
}

/** Marks scrolling as active and arms the settle debounce for the gesture. */
const handleScroll = () => {
  // The html.is-scrolling marker flips only on the gesture's rising edge —
  // one class write per gesture so parked animations freeze/resume once,
  // not per scroll event.
  if (!isWindowScrolling) {
    isWindowScrolling = true

    document.documentElement.classList.add(STATE_CLASSES.IS_SCROLLING)
  }

  if (scrollStopTimer) {
    clearTimeout(scrollStopTimer)
  }

  scrollStopTimer = setTimeout(handleScrollStop, SETTLE_MS)
}

/**
 * scrollend only re-arms the settle debounce — it can never end the gesture
 * by itself. A real gesture's tail (last scroll → scrollend) settles
 * SETTLE_MS later; a per-write scrollend inside a programmatic scroll stream
 * gets absorbed when the next scroll event re-arms the same timer first.
 * An orphan scrollend while idle is a no-op — it never latches the flag.
 */
const handleScrollEnd = () => {
  if (!isWindowScrolling) return

  handleScroll()
}

if (typeof window !== TYPE_STRINGS.UNDEFINED) {
  window.addEventListener(WINDOW_EVENTS.SCROLL, handleScroll, { passive: true })

  if ('onscrollend' in window) {
    window.addEventListener(WINDOW_EVENTS.SCROLLEND, handleScrollEnd, { passive: true })
  }
}

/** True while a window scroll gesture is in progress. */
export const isScrolling = () => isWindowScrolling

/**
 * Queues a one-shot callback for the next scroll stop; fires immediately
 * when the window isn't scrolling right now.
 */
export const onScrollStop = (callback: () => void) => {
  if (typeof callback !== TYPE_STRINGS.FUNCTION) return

  if (!isWindowScrolling) {
    callback()

    return
  }

  scrollStopCallbacks.add(callback)
}
