/**
 * @file cyrillic-font-tails.test.js
 * @description Covers core/locale/cyrillic-font.ts — the ru→Fira Sans
 * class/head-link toggle, idempotent injection, `<html lang>` sync, and
 * the non-cyrillic/unknown-locale arms where the class comes off and no
 * font is requested.
 */
import { syncCyrillicFont } from '@core/locale/cyrillic-font.js'

import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { DOM_STRINGS } from '@core/tokens/strings/dom.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { LINK_ATTRS } from '@core/tokens/attrs/link.js'
import { LOCALE_TAGS, LOCALES } from '@core/tokens/locales.js'
import { TEST_TEXT } from '@tests/fixtures/test-constants.js'

/** Injected Fira Sans stylesheet links currently in <head>. */
const firaLinks = () =>
  [...document.head.querySelectorAll(HTML_TAGS.LINK)].filter((l) =>
    (l.getAttribute(LINK_ATTRS.HREF) || '').includes('Fira+Sans')
  )

describe('cyrillic-font tails', () => {
  const root = document.documentElement

  afterEach(() => {
    root.classList.remove(STATE_CLASSES.CYRILLIC_FONT)
    firaLinks().forEach((l) => l.remove())
  })

  test('ru flips the state class, injects the stylesheet once, and sets lang', () => {
    syncCyrillicFont(LOCALES.RU)
    syncCyrillicFont(LOCALES.RU)

    expect(root.classList.contains(STATE_CLASSES.CYRILLIC_FONT)).toBe(true)
    expect(root.getAttribute(COMMON_ATTRS.LANG)).toBe(LOCALE_TAGS[LOCALES.RU].bcp)
    expect(firaLinks().length).toBe(1)
    expect(firaLinks()[0].getAttribute(LINK_ATTRS.REL)).toBe(DOM_STRINGS.REL_STYLESHEET)
  })

  test('leaving ru removes the class and never re-requests the font', () => {
    syncCyrillicFont(LOCALES.RU)
    syncCyrillicFont(LOCALES.EN)

    expect(root.classList.contains(STATE_CLASSES.CYRILLIC_FONT)).toBe(false)
    expect(root.getAttribute(COMMON_ATTRS.LANG)).toBe(LOCALE_TAGS[LOCALES.EN].bcp)
    expect(firaLinks().length).toBe(1)
  })

  test('unknown locale clears the class and leaves lang untouched', () => {
    syncCyrillicFont(LOCALES.EN)
    syncCyrillicFont(TEST_TEXT.MISSING_KEY)

    expect(root.classList.contains(STATE_CLASSES.CYRILLIC_FONT)).toBe(false)
    expect(root.getAttribute(COMMON_ATTRS.LANG)).toBe(LOCALE_TAGS[LOCALES.EN].bcp)
    expect(firaLinks().length).toBe(0)
  })
})
