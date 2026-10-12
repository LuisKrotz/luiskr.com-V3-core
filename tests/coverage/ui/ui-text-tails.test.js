/**
 * @file ui-text-tails.test.js
 * @description Split from coverage-tails-4.test.js — covers the "ui-text tails" describe.
 */
import store from '@core/store.js'

import {
  appText,
  componentText,
  rightsParts,
  rightsText,
  routeSlugs,
} from '@core/locale/ui-text.js'

import { TEST_TEXT } from '@tests/fixtures/test-constants.js'
import '@website/components/feedback/CookieBanner.js'
import '@website/components/home/ContactSection.js'
import '@website/views/not-found/NotFound.js'
import { LANG_MUTATIONS } from '@core/tokens/events/mutations.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { SECTION_UI_KEYS } from '@core/tokens/data/ui-keys.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'

describe('ui-text tails', () => {
  test('componentText falls through to the fallback snapshot', () => {
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, {})

    expect(componentText(TEST_TEXT.MISSING_KEY)).toBeUndefined()
    expect(
      typeof appText(SECTION_UI_KEYS.TITLE) === TYPE_STRINGS.STRING ||
        appText(TEST_TEXT.MISSING_KEY) === undefined
    ).toBe(true)

    const slugs = routeSlugs({})

    expect(slugs).toBeTruthy()
  })

  test('rightsText substitutes the live year into the rights template', () => {
    const text = rightsText()

    expect(text).toContain(`Luis Krötz, ${new Date().getFullYear()}`)
    expect(text).not.toContain('{year}')
  })

  test('rightsParts segments the © glyph and year for emphasis markup', () => {
    const r = rightsParts()

    expect(`${r.pre}${r.copy}${r.mid}${r.year}${r.post}`).toBe(rightsText())
    expect(r.copy).toBe(CHAR_STRINGS.COPYRIGHT)
    expect(r.year).toBe(String(new Date().getFullYear()))
    expect(r.mid).toContain('Luis Krötz')

    // Missing-© arm — a rights string without the glyph renders unsegmented.
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, {
      'source-code': { rights: 'Reserved Luis Krötz, {year}' },
    })

    const noCopy = rightsParts()

    expect(noCopy.pre).toBe(rightsText())
    expect(noCopy.copy).toBe(CHAR_STRINGS.EMPTY)

    // Missing-year arm — © present but no {year} placeholder lands in pre too.
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, {
      'source-code': { rights: 'Reserved © Luis Krötz' },
    })

    const noYear = rightsParts()

    expect(noYear.pre).toBe(`Reserved ${CHAR_STRINGS.COPYRIGHT} Luis Krötz`)
    expect(noYear.year).toBe(CHAR_STRINGS.EMPTY)

    // Restore the bundled dictionaries for downstream suites.
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, {})
  })
})
