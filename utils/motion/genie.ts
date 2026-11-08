/**
 * @file genie.js
 * @description "Genie" dialog transition shared by the preferences modal,
 * language dialog and search modal: the dialog scales from the control
 * that triggered it (store.modalOrigin) on open and zooms back into it on
 * close, via the --genie-x/--genie-y transform-origin custom properties.
 * Reduced motion skips the animation entirely.
 */

import { PREF_CLASSES } from '@core/tokens/classes/preferences.js'
import { GENIE_CSS_PROPS } from '@core/tokens/css/genie.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { STATE_STRINGS } from '@core/tokens/strings/state.js'
import store from '@core/store.js'
import { ANIMATION_DURATIONS } from '@core/tokens/motion/animation.js'
import { framePool } from './frame.js'

/** Any component exposing the shadow-scoped `$` selector helper. */
interface GenieHost {
  $(_selector: string): HTMLElement | null
}

/**
 * Class contract a genie host must satisfy: the element the enter/leave
 * modifier lands on (the backdrop), the two modifiers themselves, and the
 * dialog panel that scales from the recorded origin.
 */
export interface GenieClasses {
  /** Selector for the element that carries the enter/leave modifier. */
  backdrop: string
  /** Modifier applied while the dialog flies in (collapsed start state). */
  backdropEnter: string
  /** Modifier applied while the dialog collapses back to the origin. */
  backdropLeave: string
  /** Selector for the dialog panel the genie transforms. */
  dialog: string
}

/** The default contract — the preferences + language dialogs' classes. */
const PREF_GENIE_CLASSES: GenieClasses = {
  backdrop: PREF_CLASSES.PREF_BACKDROP,
  backdropEnter: PREF_CLASSES.PREF_BACKDROP_ENTER,
  backdropLeave: PREF_CLASSES.PREF_BACKDROP_LEAVE,
  dialog: PREF_CLASSES.PREF_DIALOG,
}

/**
 * Genie open/close shared by the preferences, language and search dialogs.
 * The dialog scales from the control that opened it (store.modalOrigin) and
 * zooms back into it on close. Honors reduced motion (instant).
 * @param component host exposing the shadow-scoped `$` helper
 * @param classes class contract — defaults to the preferences dialog set
 */
export const genieEnter = (
  component: GenieHost,
  classes: GenieClasses = PREF_GENIE_CLASSES
): void => {
  const backdrop = component.$(`.${classes.backdrop}`)

  const dialog = component.$(`.${classes.dialog}`)

  if (!backdrop || !dialog) return

  if (store.getters.getReducedMotion()) return

  const origin = store.getters.getModalOrigin() as { x: number; y: number } | null

  const rect = dialog.getBoundingClientRect()

  // Transform origin in dialog-local coords: the trigger's viewport
  // position minus the dialog's top-left = the point the scale-up grows
  // from. No origin recorded → dialog center (generic zoom, not genie).
  const x = origin ? origin.x - rect.left : rect.width / 2

  const y = origin ? origin.y - rect.top : rect.height / 2

  dialog.style.setProperty(GENIE_CSS_PROPS.GENIE_X, `${x}px`)

  dialog.style.setProperty(GENIE_CSS_PROPS.GENIE_Y, `${y}px`)

  // Jump to the collapsed start state without animating (layout may already
  // have been flushed at full size by the WebGL controls), then release.
  dialog.style.transition = STATE_STRINGS.NONE

  backdrop.style.transition = STATE_STRINGS.NONE

  backdrop.classList.add(classes.backdropEnter)

  void dialog.offsetWidth

  dialog.style.transition = CHAR_STRINGS.EMPTY

  backdrop.style.transition = CHAR_STRINGS.EMPTY

  framePool.request(() => {
    framePool.request(() => backdrop.classList.remove(classes.backdropEnter))
  })
}

/**
 * Plays the collapse-back-to-origin animation, then runs done() so the
 * caller can finish unmounting. Instant (done() immediately) under reduced
 * motion or when the backdrop isn't in the DOM.
 * @param component host exposing the shadow-scoped `$` helper
 * @param done callback run once the collapse has finished (or instantly)
 * @param classes class contract — defaults to the preferences dialog set
 */
export const genieLeave = (
  component: GenieHost,
  done: () => void,
  classes: GenieClasses = PREF_GENIE_CLASSES
): void => {
  const backdrop = component.$(`.${classes.backdrop}`)

  if (!backdrop || store.getters.getReducedMotion()) {
    done()

    return
  }

  backdrop.classList.add(classes.backdropLeave)

  setTimeout(done, ANIMATION_DURATIONS.DIALOG_LEAVE_DURATION)
}
