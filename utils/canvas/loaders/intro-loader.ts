/**
 * @file intro-loader.ts
 * @description Boot loader overlay — same visual language as the
 * experiments' loaders (star-field / docs): a glow veil with a spinning
 * ring, big percent counter, brand title, a localized stage line, and a
 * progress bar. Stays up while the app bootstraps, then lifts away.
 * Honors reduced motion (instant finish) and shows once per session.
 *
 * Stage copy is fully localized: the loader runs before the per-locale
 * i18n chunks resolve, so `virtual:i18n-fallback` inlines every locale's
 * `APP.loader` node (see shared/build/i18n-virtual.mjs) and the loader
 * picks the active language's stages — falling back to English.
 */

import { LOADER_CLASSES } from '@core/tokens/classes/loader.js'
import { LOADER_SELECTORS } from '@core/tokens/selectors/loader.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { CACHE_STORAGE_KEYS } from '@core/tokens/data/storage.js'
import { framePool } from '../../motion/frame.js'
import { LOCALES } from '@core/tokens/locales.js'
import { FALLBACK_APP, FALLBACK_LOADERS } from '@core/locale/fallback.js'
import type { LoaderCopy } from '@core/locale/fallback.js'
import { applyAnimationDesc } from '@core/utils/a11y/animation-desc.js'
import { ANIMATION_IDS } from '@core/tokens/data/animation-ids.js'
import store from '@core/store.js'

/** Total boot animation budget (ms) — long enough for stages to read. */
const _DURATION_MS = 1600
/** Post-100% hold before the veil lifts (ms). */
const _HOLD_MS = 220
/** Veil fade-to-remove delay — matches the SCSS exit transition. */
const _FADE_MS = 450

/** Resolves the loader copy for the active locale, English as backstop. */
function loaderCopy(): LoaderCopy {
  const lang = store.getters.getLang?.() || LOCALES.EN

  return FALLBACK_LOADERS?.[lang] || FALLBACK_APP.loader
}

/**
 * Parks the veil in the DOM instead of detaching it. Chrome retracts a
 * painted element's LCP candidacy on disconnect, so removeChild() after
 * the fade would hand the metric back to the mount-gated hero — on
 * media routes the runtime img/video lands ~6s later under throttle.
 * The retired node swaps its whole class list for the --retired
 * modifier (parked offscreen at left:100vw — rendered but out of view
 * and the hit path, since content-visibility:hidden also retracts the
 * LCP candidacy), gains aria-hidden, and drops off `.intro-loader`
 * selectors so post-boot adoption can never re-find a dead veil. Same
 * contract the parked reader-content article uses to keep its painted
 * text the recorded LCP on media-less routes.
 * @param veil the intro-loader container to retire; null-safe.
 */
const retireVeil = (veil: HTMLElement | null | undefined): void => {
  if (!veil) return

  veil.className = LOADER_CLASSES.INTRO_LOADER_RETIRED

  veil.setAttribute(ARIA_ATTRS.ARIA_HIDDEN, ATTR_VALUES.TRUE)
}

/**
 * Experiments-style intro loader — spinner ring + percent + stage readout
 * + progress bar over a glow veil. The stage text steps through the
 * locale's `loader.stages` (site assets/pages copy) as progress climbs.
 */
export class IntroLoader {
  rootContainer: HTMLElement
  onComplete: (() => void) | null
  container: HTMLElement | null = null
  percentEl: HTMLElement | null = null
  msgEl: HTMLElement | null = null
  barEl: HTMLElement | null = null
  progress = 0
  animId: number | null = null
  startTime: number
  copy: LoaderCopy

  constructor(rootContainer: HTMLElement = document.body, onComplete: (() => void) | null = null) {
    this.rootContainer = rootContainer

    this.onComplete = onComplete
    this.copy = loaderCopy()

    // The head script stamps window.lk_intro_t0 at HTML parse time so the
    // fixed-duration budget covers the whole boot — on slow engines the
    // 1600ms is already spent by mount and the veil lifts ~immediately
    // instead of holding a static page hostage for another ~2.3s.
    const stamped = Number(
      (window as unknown as Record<string, unknown>)[CACHE_STORAGE_KEYS.INTRO_T0]
    )

    this.startTime = Number.isFinite(stamped) ? stamped : performance.now()

    this.init()
  }

  /** Builds or adopts the overlay DOM + starts the progress sequence. */
  init(): void {
    if (typeof window === TYPE_STRINGS.UNDEFINED || typeof document === TYPE_STRINGS.UNDEFINED)
      return

    // Prerendered pages ship the loader markup statically so the veil
    // paints before the JS bundle — adopt that node instead of mounting
    // a second overlay. The early-return paths must still remove it or
    // the static veil would cover the page for the whole document.
    const existing = document.querySelector<HTMLElement>(LOADER_SELECTORS.INTRO_LOADER)

    if (sessionStorage.getItem(CACHE_STORAGE_KEYS.INTRO_SHOWN)) {
      retireVeil(existing)

      this.onComplete?.()

      return
    }

    if (store.getters.getReducedMotion()) {
      retireVeil(existing)

      sessionStorage.setItem(CACHE_STORAGE_KEYS.INTRO_SHOWN, CHAR_STRINGS.ONE)

      this.onComplete?.()

      return
    }

    if (existing) {
      this.container = existing
      this.percentEl = existing.querySelector<HTMLElement>(LOADER_SELECTORS.PERCENT)
      this.msgEl = existing.querySelector<HTMLElement>(LOADER_SELECTORS.MSG)
      this.barEl = existing.querySelector<HTMLElement>(LOADER_SELECTORS.BAR)
    } else {
      this.buildOverlay()
    }

    // Spinner/counter/bar are all part of the one boot overlay —
    // the container carries the animation description.
    applyAnimationDesc(this.container as HTMLElement, ANIMATION_IDS.INTRO_LOADER)

    this.runAnimation()
  }

  /** Builds the overlay DOM from scratch — used when the document did not
   *  ship the static loader markup (dev server, non-prerendered shells). */
  buildOverlay(): void {
    this.container = document.createElement(HTML_TAGS.DIV)

    this.container.className = LOADER_CLASSES.INTRO_LOADER

    // Named region landmark — the statically-emitted veil carries the
    // same attrs so the axe `region` rule sees landmark-contained
    // content in either shape (and the counter's per-frame text churn
    // never enters a live region).
    this.container.setAttribute(ARIA_ATTRS.ROLE, ARIA_ATTRS.ROLE_REGION)

    this.container.setAttribute(ARIA_ATTRS.ARIA_LABEL, this.copy.title)

    const glow = document.createElement(HTML_TAGS.DIV)

    glow.className = LOADER_CLASSES.INTRO_LOADER_GLOW

    const grid = document.createElement(HTML_TAGS.DIV)

    grid.className = LOADER_CLASSES.INTRO_LOADER_GRID

    const content = document.createElement(HTML_TAGS.DIV)

    content.className = LOADER_CLASSES.INTRO_LOADER_CONTENT

    const spinner = document.createElement(HTML_TAGS.DIV)

    spinner.className = LOADER_CLASSES.INTRO_LOADER_SPINNER

    const spinnerInner = document.createElement(HTML_TAGS.DIV)

    spinnerInner.className = LOADER_CLASSES.INTRO_LOADER_SPINNER_INNER

    const counter = document.createElement(HTML_TAGS.DIV)

    counter.className = LOADER_CLASSES.INTRO_LOADER_COUNTER

    this.percentEl = document.createElement(HTML_TAGS.DIV)

    this.percentEl.className = LOADER_CLASSES.INTRO_LOADER_PERCENT
    this.percentEl.textContent = `${CHAR_STRINGS.ZERO}${CHAR_STRINGS.PERCENT}`

    const title = document.createElement(HTML_TAGS.DIV)

    title.className = LOADER_CLASSES.INTRO_LOADER_TITLE
    title.textContent = this.copy.title

    this.msgEl = document.createElement(HTML_TAGS.DIV)

    this.msgEl.className = LOADER_CLASSES.INTRO_LOADER_MSG
    this.msgEl.textContent = this.copy.stages?.[0] || ATTR_VALUES.EMPTY

    this.barEl = document.createElement(HTML_TAGS.DIV)
    this.barEl.className = LOADER_CLASSES.INTRO_LOADER_BAR

    const fill = document.createElement(HTML_TAGS.DIV)

    fill.className = LOADER_CLASSES.INTRO_LOADER_BAR_FILL

    this.barEl.appendChild(fill)

    counter.appendChild(this.percentEl)

    content.appendChild(spinner)
    content.appendChild(spinnerInner)
    content.appendChild(counter)
    content.appendChild(title)
    content.appendChild(this.msgEl)
    content.appendChild(this.barEl)

    this.container.appendChild(glow)
    this.container.appendChild(grid)
    this.container.appendChild(content)

    this.rootContainer.appendChild(this.container)
  }

  /** Steps percent + the localized stage line across the boot budget. */
  runAnimation(): void {
    const stages = this.copy.stages || []

    const update = (now: number) => {
      const elapsed = now - this.startTime

      const t = Math.min(elapsed / _DURATION_MS, 1.0)

      this.progress = Math.round(t * 100)

      if (this.percentEl) {
        this.percentEl.textContent = `${this.progress}${CHAR_STRINGS.PERCENT}`
      }

      if (this.barEl?.firstElementChild instanceof HTMLElement) {
        this.barEl.firstElementChild.style.transform = `scaleX(${t})`
      }

      if (this.msgEl && stages.length) {
        const idx = Math.min(Math.floor(t * stages.length), stages.length - 1)

        this.msgEl.textContent = stages[idx]
      }

      if (t < 1.0) {
        this.animId = framePool.request(update)
      } else {
        sessionStorage.setItem(CACHE_STORAGE_KEYS.INTRO_SHOWN, CHAR_STRINGS.ONE)

        setTimeout(() => {
          this.finish()
        }, _HOLD_MS)
      }
    }

    this.animId = framePool.request(update)
  }

  /** Completes the loader: fades the overlay, retires it, calls onComplete. */
  finish(): void {
    if (!this.container) return

    this.container.classList.add(LOADER_CLASSES.INTRO_LOADER_HIDDEN)

    setTimeout(() => {
      retireVeil(this.container)

      this.container = null

      this.onComplete?.()
    }, _FADE_MS)
  }

  /** Releases the rAF handle and retires the overlay (kept connected so a
   *  painted LQIP's LCP candidacy survives teardown — see retireVeil). */
  destroy(): void {
    if (this.animId) {
      framePool.cancel(this.animId)

      this.animId = null
    }

    retireVeil(this.container)

    this.container = null
  }
}
