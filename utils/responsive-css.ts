/**
 * @file utils/responsive-css.ts
 * @description Runtime half of the breakpoint stylesheet split (?tiers).
 *
 * A `styles.scss?tiers` import compiles to { base, tiers }: `base` is the
 * embedded non-media rules adopted synchronously at mount, and `tiers`
 * keys width classes to lazy loaders whose cumulative media blocks are
 * fetched and adopted only when the viewport can apply them. A phone
 * therefore never downloads desktop/wide rules; on an upward cross the
 * wider cumulative tier replaces the served one.
 */

import {
  WIDTH_CLASS_GATES,
  WIDTH_CLASS_NAMES,
  WIDTH_CLASS_RANK,
  type WidthClass,
} from '@core/tokens/layout/css-classes.js'
import { FORM_EVENTS } from '@core/tokens/events/dom.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'

/** A lazily-imported tier module — resolves to the tier's css text. */
export type TierLoader = () => Promise<{ default: string } | string>

/**
 * The `?tiers` module shape: embedded base text plus cumulative tier
 * loaders keyed by the highest class they cover (sparse — the runtime
 * resolves the viewport class to the highest defined tier ≤ it). `print`
 * carries the sheet's `@media print`/`@page` blocks behind the same lazy
 * loader contract — adopted onto the shadow root during idle, inert on
 * screen, live for paper output only.
 */
export interface TieredStyles {
  base: string
  tiers: Partial<Record<WidthClass, TierLoader>>
  print?: TierLoader
}

/** Type guard for the `?tiers` module shape vs a plain `?inline` string. */
export const isTieredStyles = (v: unknown): v is TieredStyles =>
  typeof v === TYPE_STRINGS.OBJECT &&
  v !== null &&
  typeof (v as TieredStyles).base === TYPE_STRINGS.STRING &&
  typeof (v as TieredStyles).tiers === TYPE_STRINGS.OBJECT

/**
 * The viewport's width class — evaluated widest → narrowest so the first
 * satisfied gate names the smallest cumulative tier that still covers the
 * viewport. Engines without matchMedia (jsdom, bots) report `wide` — the
 * full-content tier — since nothing can be ruled out.
 */
export const currentWidthClass = (): WidthClass => {
  if (
    typeof window === TYPE_STRINGS.UNDEFINED ||
    typeof window.matchMedia !== TYPE_STRINGS.FUNCTION
  )
    return 'wide'

  for (let i = WIDTH_CLASS_NAMES.length - 1; i > 0; i--) {
    const cls = WIDTH_CLASS_NAMES[i]

    if (window.matchMedia(WIDTH_CLASS_GATES[cls]).matches) return cls
  }

  return 'mobile'
}

/**
 * Resolves which tier key to load for a viewport class: the highest
 * defined tier at or below it. Cumulative content means a higher key
 * would only add blocks the viewport cannot apply, so lower is correct —
 * e.g. tiers {mobile,desktop} on a tablet viewport resolves to `mobile`.
 * @returns the tier key, or undefined when nothing is defined.
 */
export const resolveTierKey = (
  tiers: TieredStyles['tiers'],
  cls: WidthClass
): WidthClass | undefined => {
  let picked: WidthClass | undefined

  for (const name of WIDTH_CLASS_NAMES) {
    if (WIDTH_CLASS_RANK[name] > WIDTH_CLASS_RANK[cls]) break
    if (tiers[name]) picked = name
  }

  return picked
}

/**
 * Highest width-class rank observed by the shared grow-watcher — seeded on
 * the first subscription so a late-mounting component only ever hears
 * about classes above the page's own baseline.
 */
let _watchRank = -1

/** Subscriber callbacks invoked once per upward class crossing. */
const _watchSubs = new Set<(_cls: WidthClass) => void>()

/** Disposer for the shared matchMedia listeners while subscribers exist. */
let _watchOff: (() => void) | null = null

/**
 * Shared upward-crossing watcher: at most three matchMedia listeners
 * (tablet/desktop/wide gates — mobile has no upward signal since every
 * crossing that changes the class passes one of those gates) serve every
 * subscriber, instead of each component instance installing its own set.
 * On any gate change the class is re-evaluated; subscribers fire only
 * when the class GREW — downward crosses never un-adopt a served
 * cumulative tier, whose higher blocks just stop matching.
 * @param cb invoked once per upward cross with the newly-matched class.
 * @returns unsubscribe function — also tears down the shared listeners
 *   when the last subscriber leaves.
 */
export const watchWidthClassGrow = (cb: (_cls: WidthClass) => void): (() => void) => {
  if (
    typeof window === TYPE_STRINGS.UNDEFINED ||
    typeof window.matchMedia !== TYPE_STRINGS.FUNCTION
  )
    return () => {}

  _watchSubs.add(cb)

  if (!_watchOff) {
    _watchRank = WIDTH_CLASS_RANK[currentWidthClass()]

    const offs: Array<() => void> = []

    for (const name of WIDTH_CLASS_NAMES) {
      if (WIDTH_CLASS_RANK[name] === WIDTH_CLASS_RANK.mobile) continue

      const mql = window.matchMedia(WIDTH_CLASS_GATES[name])

      const on = () => {
        const cls = currentWidthClass()
        const rank = WIDTH_CLASS_RANK[cls]

        if (rank <= _watchRank) return

        _watchRank = rank
        _watchSubs.forEach((fn) => fn(cls))
      }

      mql.addEventListener(FORM_EVENTS.CHANGE, on)
      offs.push(() => mql.removeEventListener(FORM_EVENTS.CHANGE, on))
    }

    _watchOff = () => offs.forEach((off) => off())
  }

  return () => {
    _watchSubs.delete(cb)

    if (_watchSubs.size === 0 && _watchOff) {
      _watchOff()
      _watchOff = null
      _watchRank = -1
    }
  }
}

/**
 * Merges several `?tiers` imports into one TieredStyles — the multi-sheet
 * equivalent of the old `` `${a}\n${b}` `` concat (MediaFigure). Bases are
 * joined in order; each merged tier resolves PER SHEET to the highest
 * defined tier at or below the class — the splitter omits a class whose
 * cumulative content equals the previous tier's ("the runtime falls back
 * to the highest defined lower tier"), so a sheet with only mobile/tablet
 * content must still contribute at desktop. Keying merged loaders by the
 * exact class alone orphaned those sheets — their narrower cumulative
 * rules would never be adopted once a wider tier existed on any sibling.
 */
export const mergeTiered = (...parts: Array<string | TieredStyles>): TieredStyles => {
  const base: string[] = []
  const tiered: TieredStyles[] = []

  for (const p of parts) {
    if (isTieredStyles(p)) {
      base.push(p.base)

      tiered.push(p)
    } else {
      base.push(p)
    }
  }

  const tiers: TieredStyles['tiers'] = {}

  // Same dedup the splitter applies: when every sheet resolves to the
  // same tier keys it resolved at the previous class, the merged text
  // would be byte-identical — omit the class so the runtime falls back
  // instead of fetching a duplicate sheet.
  let prevSig: string | undefined

  for (const name of WIDTH_CLASS_NAMES) {
    const loads: TierLoader[] = []

    let sig = ''

    for (const p of tiered) {
      const key = resolveTierKey(p.tiers, name)

      if (key) {
        loads.push(p.tiers[key] as TierLoader)

        sig += `${tiered.indexOf(p)}:${key}|`
      }
    }

    if (!loads.length || sig === prevSig) continue

    prevSig = sig

    tiers[name] = async () => {
      const mods = await Promise.all(loads.map((load) => load()))

      return mods
        .map((m) =>
          typeof m === TYPE_STRINGS.STRING ? (m as string) : (m as { default: string }).default
        )
        .join('\n')
    }
  }

  // Print loaders merge the same way — every part's paper rules resolve
  // and join in source order; parts without a print bucket contribute
  // nothing.
  const prints = tiered
    .map((p) => p.print)
    .filter((l): l is TierLoader => typeof l === TYPE_STRINGS.FUNCTION)

  const print = prints.length
    ? async () => {
        const mods = await Promise.all(prints.map((load) => load()))

        return mods
          .map((m) =>
            typeof m === TYPE_STRINGS.STRING ? (m as string) : (m as { default: string }).default
          )
          .join('\n')
      }
    : undefined

  return print ? { base: base.join('\n'), tiers, print } : { base: base.join('\n'), tiers }
}
