/**
 * @file media-utils-tails.test.js
 * @description Split from coverage-tails.test.js — covers the "media utils tails" describe.
 */
import { jest } from '@jest/globals'
import '@core/utils/data/sanitize.js'

import {
  isGravatarUrl,
  getGravatarSrcset,
  getOptimizedGravatar,
  buildMediaUrls,
  encodeMediaUrl,
  webpSibling,
  coverLadderStep,
} from '@core/utils/media.js'

import '@website/components/feedback/CookieBanner.js'
import '@website/components/home/ContactSection.js'
import '@website/views/not-found/NotFound.js'

import { TEST_TEXT, TEST_PROJECTS } from '@tests/fixtures/test-constants.js'
import { NET_STRINGS } from '@core/tokens/strings/net.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { CDN_URLS } from '@core/tokens/media/urls.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { HOME_MOSAIC_CLASSES } from '@core/tokens/classes/mosaic.js'

jest.unstable_mockModule('@core/firebase.js', () => ({
  signInWithGoogle: jest.fn(async () => ({ user: { uid: 'u1' } })),
  onAuthChange: jest.fn(async (cb) => {
    cb(null)
    return () => {}
  }),
  logoutUser: jest.fn(async () => {}),
  fetchFirebaseDb: jest.fn(async () => ({ exists: () => false, val: () => null })),
  getDbInstance: jest.fn(async () => ({})),
}))

describe('media utils tails', () => {
  test('isGravatarUrl classifies host variants and bad input', () => {
    expect(isGravatarUrl(42)).toBe(false)
    expect(isGravatarUrl(NET_STRINGS.GRAVATAR_BASE + TEST_TEXT.SECOND)).toBe(true)
    expect(isGravatarUrl(`https://en${NET_STRINGS.GRAVATAR_HOSTNAME_SUFFIX}/x`)).toBe(true)
    expect(isGravatarUrl(`${NET_STRINGS.SITE_URL}/img.png`)).toBe(false)
  })

  test('gravatar srcset + optimized variants', () => {
    const srcset = getGravatarSrcset(NET_STRINGS.GRAVATAR_BASE + TEST_TEXT.SECOND)
    getOptimizedGravatar(NET_STRINGS.GRAVATAR_BASE + TEST_TEXT.SECOND, 400)
    const passthrough = getOptimizedGravatar(`${NET_STRINGS.SITE_URL}/img.png`)

    expect(srcset === null || typeof srcset === TYPE_STRINGS.STRING).toBe(true)
    expect(passthrough === null || typeof passthrough === TYPE_STRINGS.STRING).toBe(true)
  })

  test('buildMediaUrls composes image + video URLs', () => {
    const img = buildMediaUrls(CDN_URLS.CDN_BASE, `${TEST_PROJECTS.CICB}/`, {
      src: TEST_TEXT.SECOND,
      isVideo: false,
    })
    const vid = buildMediaUrls(CDN_URLS.CDN_BASE, `${TEST_PROJECTS.CICB}/`, {
      src: TEST_TEXT.SECOND,
      isVideo: true,
    })

    expect(img.source).toContain(TEST_TEXT.SECOND)
    expect(vid.isVideo).toBe(true)
  })

  test('isGravatarUrl uses the localhost origin without window and returns false on URL errors', () => {
    const saved = globalThis.window

    delete globalThis.window

    try {
      expect(isGravatarUrl(`${NET_STRINGS.GRAVATAR_BASE}${TEST_TEXT.HELLO}`)).toBe(true)
    } finally {
      globalThis.window = saved
    }

    expect(isGravatarUrl('http://exa mple.com/x')).toBe(false)
  })

  test('buildMediaUrls defaults isVideo/folder/src when absent', () => {
    const out = buildMediaUrls(CDN_URLS.CDN_BASE, CHAR_STRINGS.EMPTY, {})

    expect(out.isVideo).toBe(false)
    expect(out.source).toContain(CDN_URLS.CDN_BASE)
  })

  test('encodeMediaUrl encodes spaces/unicode, escapes bare %, stays idempotent', () => {
    const spaced = 'brazilian leather/portal/shot'
    const clean = `${CDN_URLS.CDN_BASE}covers/${TEST_PROJECTS.CICB}.jpg`

    expect(encodeMediaUrl(CHAR_STRINGS.EMPTY)).toBe(CHAR_STRINGS.EMPTY)
    expect(encodeMediaUrl(clean)).toBe(clean)
    expect(encodeMediaUrl(`${CDN_URLS.CDN_BASE}${spaced}.jpg`)).toBe(
      `${CDN_URLS.CDN_BASE}${spaced.replace(/ /g, '%20')}.jpg`
    )
    // Bare '%' that is not a valid escape gets encoded; an existing %20
    // must not double-encode to %2520 (idempotent).
    expect(encodeMediaUrl(`${CDN_URLS.CDN_BASE}a%zz.jpg`)).toContain('a%25zz.jpg')
    expect(encodeMediaUrl(`${CDN_URLS.CDN_BASE}a%20b.jpg`)).toBe(`${CDN_URLS.CDN_BASE}a%20b.jpg`)
  })

  test('webpSibling swaps only the .jpg extension', () => {
    expect(webpSibling(`${CDN_URLS.CDN_BASE}x${MEDIA.EXT}`)).toBe(
      `${CDN_URLS.CDN_BASE}x${MEDIA.WEBP_EXT}`
    )
    // Non-.jpg input can't claim a webp sibling → empty string.
    expect(webpSibling(`${CDN_URLS.CDN_BASE}x.png`)).toBe(ATTR_VALUES.EMPTY)
    expect(webpSibling(ATTR_VALUES.EMPTY)).toBe(ATTR_VALUES.EMPTY)
  })

  test('buildMediaUrls encodes spaced bucket keys in its outputs', () => {
    const spaced = 'brazilian leather'
    const img = buildMediaUrls(CDN_URLS.CDN_BASE, `${spaced}/`, {
      src: 'shot',
      isVideo: false,
    })
    const vid = buildMediaUrls(CDN_URLS.CDN_BASE, `${spaced}/`, { src: 'shot', isVideo: true })

    expect(img.source).toContain('brazilian%20leather')
    expect(img.source).not.toContain(' ')
    expect(vid.source).not.toContain(' ')
    expect(vid.thumb).not.toContain(' ')
  })

  test('coverLadderStep marks the painted rung and climbs via detached probe', () => {
    const registry = new Map()
    const pic = document.createElement(HTML_TAGS.PICTURE)
    const source = document.createElement(HTML_TAGS.SOURCE)
    const img = document.createElement(HTML_TAGS.IMG)

    pic.append(source, img)
    document.body.append(pic)

    const key = `${CDN_URLS.CDN_BASE}covers/${TEST_PROJECTS.CICB}${MEDIA.EXT}`
    const q50 = `${CDN_URLS.CDN_BASE}covers/${TEST_PROJECTS.CICB}${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`
    const q75 = `${CDN_URLS.CDN_BASE}covers/${TEST_PROJECTS.CICB}${MEDIA.MOZ}${MEDIA.Q75}${MEDIA.EXT}`
    const q75Webp = `${CDN_URLS.CDN_BASE}covers/${TEST_PROJECTS.CICB}${MEDIA.MOZ}${MEDIA.Q75}${MEDIA.WEBP_EXT}`
    const rungs = [
      { jpg: q50, webp: CHAR_STRINGS.EMPTY },
      { jpg: q75, webp: q75Webp },
      { jpg: key, webp: CHAR_STRINGS.EMPTY },
    ]
    const loaded = HOME_MOSAIC_CLASSES.HOME_MOSAIC_IMG_LOADED

    // Guard arms: a null img and an empty ladder both return untouched.
    coverLadderStep(registry, key, null, rungs, loaded)
    coverLadderStep(registry, key, img, [], loaded)

    expect(registry.size).toBe(0)

    const origImage = window.Image
    const origGlobalImage = globalThis.Image
    let inst = null

    window.Image = class {
      constructor() {
        inst = this
      }
    }

    try {
      // Painted rung 0 — marks the registry, publishes the loaded class,
      // then probes the next rung's webp sibling first.
      img.src = q50

      coverLadderStep(registry, key, img, rungs, loaded)

      expect(registry.get(key)).toBe(q50)
      expect(img.classList.contains(loaded)).toBe(true)
      expect(inst.src).toBe(q75Webp)

      // Confirmed webp publishes to the painted img and retires rung-0's
      // <source> so img.src becomes authoritative from here on.
      inst.onload()

      expect(img.src).toBe(q75Webp)
      expect(registry.get(key)).toBe(q75Webp)
      expect(pic.querySelector(HTML_TAGS.SOURCE)).toBe(null)

      // Next step — the original rung has no webp, so the jpg is probed.
      coverLadderStep(registry, key, img, rungs, loaded)

      expect(registry.get(key)).toBe(q75Webp)
      expect(inst.src).toBe(key)

      inst.onload()

      expect(img.src).toBe(key)

      // Top rung reached — the ladder stops spawning probes.
      inst = null

      coverLadderStep(registry, key, img, rungs, loaded)

      expect(inst).toBe(null)

      // An unknown painted URL marks the registry but never climbs.
      const stray = document.createElement(HTML_TAGS.IMG)
      const strayKey = `${CDN_URLS.CDN_BASE}covers/stray${MEDIA.EXT}`

      stray.src = strayKey

      coverLadderStep(registry, strayKey, stray, rungs, loaded)

      expect(registry.get(strayKey)).toBe(strayKey)
      expect(inst).toBe(null)

      // webp bytes fail → the probe retries the rung's jpg once; a dead
      // jpg is terminal and leaves the painted rung standing.
      img.src = q50

      coverLadderStep(registry, key, img, rungs, loaded)
      inst.onerror()

      expect(inst.src).toBe(q75)

      inst.onerror()

      expect(inst.src).toBe(q75)

      // Bare hosts without a registry still get the class + the climb —
      // the reached tier simply cannot persist across re-renders.
      const orphan = document.createElement(HTML_TAGS.IMG)

      orphan.src = q50

      coverLadderStep(undefined, key, orphan, rungs, loaded)

      expect(orphan.classList.contains(loaded)).toBe(true)

      inst.onload()

      expect(orphan.src).toBe(q75Webp)

      // A <source>-selected paint reports through currentSrc — the rung
      // match must read it ahead of the jpg fallback src.
      const srcPicked = document.createElement(HTML_TAGS.IMG)

      Object.defineProperty(srcPicked, 'currentSrc', { value: q50, configurable: true })

      coverLadderStep(registry, strayKey, srcPicked, rungs, loaded)

      expect(inst.src).toBe(q75Webp)

      // Nothing painted at all — happy-dom mirrors src into currentSrc,
      // so an unset src is the only way down the `|| img.src` arm.
      const unpainted = document.createElement(HTML_TAGS.IMG)

      coverLadderStep(
        registry,
        `${CDN_URLS.CDN_BASE}covers/blank${MEDIA.EXT}`,
        unpainted,
        rungs,
        loaded
      )

      expect(unpainted.classList.contains(loaded)).toBe(true)
    } finally {
      window.Image = origImage
      globalThis.Image = origGlobalImage
    }

    // No Image constructor — the jpg tier is assigned directly; an img
    // outside a <picture> takes the optional-chain no-op arm.
    const bare = document.createElement(HTML_TAGS.IMG)
    const bareKey = `${CDN_URLS.CDN_BASE}covers/bare${MEDIA.EXT}`

    document.body.append(bare)
    bare.src = q50

    window.Image = null
    delete globalThis.Image

    try {
      coverLadderStep(registry, bareKey, bare, rungs, loaded)

      expect(bare.src).toBe(q75)
      expect(registry.get(bareKey)).toBe(q75)
    } finally {
      window.Image = origImage
      globalThis.Image = origGlobalImage
      pic.remove()
      bare.remove()
    }

    // No window at all — the ctor resolution falls through to the global
    // Image binding (loadHighRes's SSR/legacy guard shape).
    const noWin = document.createElement(HTML_TAGS.IMG)
    const savedWindow = globalThis.window
    let winInst = null

    noWin.src = q50
    delete globalThis.window
    globalThis.Image = class {
      constructor() {
        winInst = this
      }
    }

    try {
      coverLadderStep(registry, bareKey, noWin, rungs, loaded)

      winInst.onload()

      expect(noWin.getAttribute(MEDIA_ATTRS.SRC)).toBe(q75Webp)
    } finally {
      globalThis.window = savedWindow
      window.Image = origImage
      globalThis.Image = origGlobalImage
      noWin.remove()
    }
  })
})
