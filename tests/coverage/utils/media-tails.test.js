/**
 * @file media-tails.test.js
 * @description Split from coverage-tails-4.test.js — covers the "media tails" describe.
 */
import {
  isGravatarUrl,
  getOptimizedGravatar,
  buildMediaUrls,
  webpSibling,
  webmSibling,
} from '@core/utils/media.js'

import { TEST_URLS } from '@tests/fixtures/test-constants.js'
import '@website/components/feedback/CookieBanner.js'
import '@website/components/home/ContactSection.js'
import '@website/views/not-found/NotFound.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'

describe('media tails', () => {
  test('gravatar detection guards non-string input', () => {
    expect(isGravatarUrl(123)).toBe(false)
    expect(isGravatarUrl(null)).toBe(false)
    expect(typeof isGravatarUrl(TEST_URLS.IMG)).toBe(TYPE_STRINGS.BOOLEAN)
    expect(getOptimizedGravatar(TEST_URLS.IMG)).toBeTruthy()
  })

  test('buildMediaUrls composes CDN variants', () => {
    const urls = buildMediaUrls(TEST_URLS.CDN, 'folder/', { src: 'pic', isVideo: false })
    const vid = buildMediaUrls(TEST_URLS.CDN, 'folder/', { src: 'clip', isVideo: true })

    expect(urls).toBeTruthy()
    expect(vid).toBeTruthy()
  })

  test('webpSibling swaps the jpg extension and rejects non-jpg input', () => {
    const jpg = `${TEST_URLS.IMG}${MEDIA.EXT}`

    expect(webpSibling(jpg)).toBe(`${TEST_URLS.IMG}${MEDIA.WEBP_EXT}`)
    expect(webpSibling(TEST_URLS.IMG)).toBe(ATTR_VALUES.EMPTY)
    expect(webpSibling(ATTR_VALUES.EMPTY)).toBe(ATTR_VALUES.EMPTY)
  })

  test('webmSibling swaps the mp4 extension and rejects non-mp4 input', () => {
    const mp4 = `${TEST_URLS.IMG}${MEDIA.VIDEO_EXT}`

    expect(webmSibling(mp4)).toBe(`${TEST_URLS.IMG}${MEDIA.WEBM_EXT}`)
    expect(webmSibling(TEST_URLS.IMG)).toBe(ATTR_VALUES.EMPTY)
    expect(webmSibling(ATTR_VALUES.EMPTY)).toBe(ATTR_VALUES.EMPTY)
  })
})
