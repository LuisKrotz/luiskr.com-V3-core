/**
 * @file legal-links-tails.test.js
 * @description Coverage tails for utils/data/legal-links.ts —
 * getFallbackLegalLinks's default-arg arm, the LANG_SLUGS[locale] ||
 * en fallback for unknown locales, and the non-English base-prefix arm.
 */
import { getFallbackLegalLinks } from '@core/utils/data/legal-links.js'
import { LANG_SLUGS } from '@core/i18n.js'
import { LOCALES } from '@core/tokens/locales.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { TEST_TEXT } from '@tests/fixtures/test-constants.js'

describe('legal-links fallback tails', () => {
  test('no-arg call uses the EN default + unprefixed base', () => {
    const links = getFallbackLegalLinks()

    expect(links.length).toBeGreaterThan(1)
    expect(links[1].link).toBe(`${ROUTE_PATHS.ROOT}${LANG_SLUGS.en.privacy}`)
  })

  test('a locale absent from LANG_SLUGS falls back to the EN slug map with a prefixed base', () => {
    const links = getFallbackLegalLinks(TEST_TEXT.SECOND)

    // Unknown locale → LANG_SLUGS.en slugs, but the base still carries
    // the locale prefix (the non-EN arm).
    expect(links[1].link).toBe(
      `${ROUTE_PATHS.ROOT}${TEST_TEXT.SECOND}${ROUTE_PATHS.ROOT}${LANG_SLUGS[LOCALES.EN].privacy}`
    )
  })
})
