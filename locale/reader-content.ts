/**
 * @file locale/reader-content.ts
 * @description Keeps the reader-content <article> in sync with SPA
 * navigation. Browser reader modes (Firefox/Safari Readability) cannot
 * pierce the app's shadow DOM, so the prerendered article is the only
 * surface they can extract. main.ts hoists the emitted article out of
 * #app and parks it offscreen on mount; on every route change this module
 * fetches the destination's prerendered page and swaps the article's
 * markup — the emitted files stay the single source of truth, so reader
 * mode always sees the current route's copy without duplicating any
 * content builders client-side. Routes with no prerendered article
 * (cms, unmatched) leave the holder empty.
 */

import { READER_CLASSES } from '@core/tokens/classes/reader.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { READER_STRINGS } from '@core/tokens/strings/reader.js'

/** Extracted article inner markup per path — pages rarely exceed ~30 KB. */
const cache = new Map<string, string>()

/** The hoisted <article> element (may hold stale content between navs). */
let holder: HTMLElement | null = null

/** Monotonic counter so a slow earlier fetch never overwrites a newer one. */
let generation = 0

/**
 * Locates or creates the offscreen article holder. Emitted pages hoist
 * theirs via main.ts; when none exists (first paint on a non-emitted
 * route) an empty one is appended so later navigations can fill it.
 */
const ensureHolder = (): HTMLElement => {
  if (holder?.isConnected) return holder

  const parked = document.querySelector<HTMLElement>(`article.${READER_CLASSES.CONTENT}`)

  if (parked) {
    holder = parked

    return holder
  }

  holder = document.createElement(HTML_TAGS.ARTICLE)
  holder.classList.add(READER_CLASSES.CONTENT, READER_CLASSES.OFFSCREEN)

  // The parked article mirrors page copy for Readability/crawlers — it is
  // NOT a second AT surface, so it stays out of the a11y tree and focus
  // order. role=region + label make it a self-contained landmark (IBM's
  // DOM-level aria_content_in_landmark checks containment regardless of
  // hidden state); aria-hidden + inert remove it from AT/tab order so
  // focusable descendants can't trip aria_hidden_nontabbable. Mirrors the
  // emitted markup in shared/scripts/build/build-locale-pages.mjs.
  holder.setAttribute(ARIA_ATTRS.ROLE, ARIA_ATTRS.ROLE_REGION)
  holder.setAttribute(ARIA_ATTRS.ARIA_LABEL, READER_STRINGS.STATIC_COPY_LABEL)
  holder.setAttribute(ARIA_ATTRS.ARIA_HIDDEN, ATTR_VALUES.TRUE)
  holder.setAttribute(COMMON_ATTRS.INERT, ATTR_VALUES.EMPTY)
  document.body.appendChild(holder)

  return holder
}

/**
 * Replaces the reader article's markup with the prerendered article of
 * `path`'s static page. Responses are cached per path; fetches race
 * safely via the generation counter. A page without a reader article
 * clears the holder (reader mode then correctly finds nothing to offer).
 * @param path URL path to mirror (e.g. window.location.pathname).
 */
export const updateReaderContent = async (path: string): Promise<void> => {
  const el = ensureHolder()

  const gen = ++generation

  try {
    let markup = cache.get(path)

    if (markup === undefined) {
      const res = await fetch(path, { credentials: 'same-origin' })

      markup = ''

      if (res.ok) {
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html')

        markup =
          doc.querySelector(`article.${READER_CLASSES.CONTENT}`)?.innerHTML ?? ATTR_VALUES.EMPTY
      }

      cache.set(path, markup)
    }

    if (gen === generation) el.innerHTML = markup
  } catch {
    // Offline/failed fetch — keep whatever content is already parked.
  }
}
