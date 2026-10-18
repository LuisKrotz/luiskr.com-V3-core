/**
 * @file locale/cyrillic-font.ts
 * @description Cyrillic font plumbing — Russian (`ru`) renders in Fira
 * Sans instead of the site's default Raleway (which is latin-first).
 * `syncCyrillicFont` toggles the documentElement state class that flips
 * `--font-primary`, lazy-injects the Fira Sans Google Fonts stylesheet
 * exactly once, and mirrors the locale onto `<html lang>` (the SPA never
 * rewrote it, so the attribute used to stay 'en' on every route).
 *
 * The inverse holds too: leaving `ru` removes the class so Fira Sans
 * never ships to non-cyrillic surfaces, and on `ru` no Raleway file is
 * ever fetched — @font-face downloads happen only for families actually
 * matched by `--font-primary`.
 */

import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { DOM_STRINGS } from '@core/tokens/strings/dom.js'
import { LINK_ATTRS } from '@core/tokens/attrs/link.js'
import { LOCALE_TAGS, LOCALES } from '@core/tokens/locales.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'

/** Google Fonts css2 endpoint — Fira Sans in the weights the site sets. */
const FIRA_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=Fira+Sans:wght@100;200;300;400;500;600;700&display=swap'

/** Marker id so the stylesheet injects at most once per document. */
const FIRA_LINK_ID = 'fira-sans-font'

/**
 * Syncs the cyrillic font surface to the active locale: on `ru` the
 * `cyrillic-font` class flips `--font-primary` to Fira Sans and its
 * stylesheet is appended to <head>; off `ru` the class is removed so
 * Fira Sans is never requested. `<html lang>` follows the locale's
 * BCP-47 tag so assistive tech + crawlers see the real document language.
 * @param lang Active locale code (`en`, `br`, `ru`, …).
 */
export const syncCyrillicFont = (lang: string): void => {
  const root = document.documentElement
  const isCyrillic = lang === LOCALES.RU

  root.classList.toggle(STATE_CLASSES.CYRILLIC_FONT, isCyrillic)

  const bcp = LOCALE_TAGS[lang]?.bcp

  if (bcp && root.getAttribute(COMMON_ATTRS.LANG) !== bcp) root.setAttribute(COMMON_ATTRS.LANG, bcp)

  if (isCyrillic && !document.getElementById(FIRA_LINK_ID)) {
    const link = document.createElement(HTML_TAGS.LINK)

    link.setAttribute(DOM_STRINGS.ID, FIRA_LINK_ID)
    link.setAttribute(LINK_ATTRS.REL, DOM_STRINGS.REL_STYLESHEET)
    link.setAttribute(LINK_ATTRS.HREF, FIRA_STYLESHEET)

    document.head.appendChild(link)
  }
}
