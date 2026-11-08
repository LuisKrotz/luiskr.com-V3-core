/**
 * @file orphan-seps.ts
 * @description Footer-nav orphan-separator suppression. Dot+item pairs are
 * atomic (nowrap), so a wrapped line opens on "· item" — the separator
 * reads as an orphan leading glyph. This watcher marks each pair that
 * leads a wrapped line (`--lead` modifier); the stylesheet hides that
 * pair's separator via visibility so the line starts on the label. The
 * marker pass keeps every pair's box identical (hidden, not removed), so
 * marking can never reflow the row it just measured — no oscillation.
 */

import { TYPE_STRINGS } from '@core/tokens/strings/types.js'

/**
 * One pass over a nav's pair elements: toggles `leadCls` on every pair
 * whose box-top differs from the previous pair's — i.e. the first pair
 * of each wrapped line. Runs from the ResizeObserver callback and once
 * synchronously so the initial layout is classified before first paint
 * settles (fonts may still shift it — the observer re-fires).
 * @param nav The footer nav element containing the pairs.
 * @param pairCls The pair class (dot+item atomic unit).
 * @param leadCls The modifier toggled on wrap-leading pairs.
 */
function markWrapLeaders(nav: Element, pairCls: string, leadCls: string): void {
  const pairs = nav.querySelectorAll(`.${pairCls}`)

  let prevTop: number | null = null

  for (const pair of pairs) {
    const top = pair.getBoundingClientRect().top

    pair.classList.toggle(leadCls, prevTop !== null && top !== prevTop)

    prevTop = top
  }
}

/**
 * Watches a footer nav and keeps every wrap-leading pair marked so its
 * leading separator can be hidden. A ResizeObserver on the nav refires
 * whenever the row re-wraps (viewport resize, font load, locale switch);
 * the synchronous first pass covers the mount layout. Returns a teardown
 * that disconnects the observer.
 * @param nav The footer nav element (query root for the pairs).
 * @param pairCls The pair class (dot+item atomic unit).
 * @param leadCls The modifier toggled on wrap-leading pairs.
 * @returns Cleanup function disconnecting the observer.
 */
export function watchOrphanSeps(nav: Element, pairCls: string, leadCls: string): () => void {
  if (typeof ResizeObserver === TYPE_STRINGS.UNDEFINED) return () => undefined

  const sync = () => markWrapLeaders(nav, pairCls, leadCls)

  sync()

  const ro = new ResizeObserver(sync)

  ro.observe(nav)

  return () => ro.disconnect()
}
