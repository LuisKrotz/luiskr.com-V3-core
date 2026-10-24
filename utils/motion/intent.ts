/**
 * @file utils/motion/intent.js
 * @description User-intent gate for warm-path work. Non-critical chunk
 * warm-up (route prefetch, lazy global components) only matters once a
 * human shows engagement intent — a synthetic/crawling page never needs
 * it — so the work arms on the first interaction signal or a long
 * quiet-window bound, whichever comes first. Firing it eagerly at load
 * puts its fetch+eval inside the interactive window for no user benefit.
 */
import {
  POINTER_EVENTS,
  KEYBOARD_EVENTS,
  TOUCH_EVENTS,
  MOUSE_EVENTS,
  WINDOW_EVENTS,
} from '@core/tokens/events/dom.js'
import { PREFETCH_CONFIG } from '@core/tokens/motion/prefetch.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'

/** Input modalities that prove a human is engaging with the page. */
const INTENT_EVENTS = [
  POINTER_EVENTS.POINTERDOWN,
  KEYBOARD_EVENTS.KEYDOWN,
  TOUCH_EVENTS.TOUCHSTART,
  WINDOW_EVENTS.SCROLL,
  MOUSE_EVENTS.WHEEL,
]

/**
 * Runs `cb` on the first user-interaction signal (pointer, key, touch,
 * scroll) or after `PREFETCH_CONFIG.INTENT_FALLBACK` ms of quiet —
 * whichever arrives first, exactly once. Listeners are passive so the
 * gate never delays an input.
 * @param cb Warm work to release on intent.
 */
export const onUserIntent = (cb: () => void): void => {
  if (typeof window === TYPE_STRINGS.UNDEFINED) return

  let fired = false

  const fire = (): void => {
    if (fired) return

    fired = true
    clearTimeout(timer)

    for (const type of INTENT_EVENTS) window.removeEventListener(type, fire)

    cb()
  }

  for (const type of INTENT_EVENTS) {
    window.addEventListener(type, fire, { once: true, passive: true })
  }

  // `fire` can only run asynchronously — listener dispatch and this timer
  // both settle after `timer` initialises, so no TDZ hazard.
  const timer = setTimeout(fire, PREFETCH_CONFIG.INTENT_FALLBACK)
}
