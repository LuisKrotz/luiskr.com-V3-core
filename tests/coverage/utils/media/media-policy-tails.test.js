/**
 * @file media-policy-tails.test.js
 * @description Coverage for core/utils/media/policy.ts — the connection- and
 * box-aware media budget. Covers every branch of the Network Information API
 * read (absent navigator/connection, saveData, each effectiveType tier), the
 * autoplay gate, the ladder ceiling terms (budget drop, small-box drop, the
 * clamp at rung 0, degenerate ladders), and the scaled-video preference
 * (explicit box, viewport fallback, absent window, DPR fallback).
 */
import {
  mediaBudget,
  videoAutoplayAllowed,
  ladderCeiling,
  prefersScaledVideo,
} from '@core/utils/media/policy.js'
import { NET_STRINGS } from '@core/tokens/strings/net.js'
import { IMAGE_DIMENSIONS } from '@core/tokens/media/dimensions.js'
import { MEDIA_BUDGET } from '@core/tokens/media/budget.js'

describe('media-policy tails', () => {
  let origNav
  let origWin

  beforeEach(() => {
    origNav = globalThis.navigator
    origWin = globalThis.window
  })

  afterEach(() => {
    globalThis.navigator = origNav
    globalThis.window = origWin
  })

  /** Replaces navigator with a connection-shaped stub (or a bare object). */
  const stubNav = (connection) => {
    globalThis.navigator = connection === undefined ? {} : { connection }
  }

  test('no navigator and no connection resolve the full budget', () => {
    globalThis.navigator = undefined

    expect(mediaBudget()).toBe(MEDIA_BUDGET.FULL)

    stubNav()

    expect(mediaBudget()).toBe(MEDIA_BUDGET.FULL)
  })

  test('saveData and ≤2g resolve low; 3g medium; 4g/other full', () => {
    stubNav({ saveData: true, effectiveType: NET_STRINGS.EFFECTIVE_3G })
    expect(mediaBudget()).toBe(MEDIA_BUDGET.LOW)

    stubNav({ effectiveType: NET_STRINGS.EFFECTIVE_SLOW_2G })
    expect(mediaBudget()).toBe(MEDIA_BUDGET.LOW)

    stubNav({ effectiveType: NET_STRINGS.EFFECTIVE_2G })
    expect(mediaBudget()).toBe(MEDIA_BUDGET.LOW)

    stubNav({ effectiveType: NET_STRINGS.EFFECTIVE_3G })
    expect(mediaBudget()).toBe(MEDIA_BUDGET.MEDIUM)

    stubNav({ effectiveType: NET_STRINGS.EFFECTIVE_4G })
    expect(mediaBudget()).toBe(MEDIA_BUDGET.FULL)
  })

  test('autoplay is gated on the low tier only', () => {
    stubNav({ saveData: true })
    expect(videoAutoplayAllowed()).toBe(false)

    stubNav({ effectiveType: NET_STRINGS.EFFECTIVE_3G })
    expect(videoAutoplayAllowed()).toBe(true)
  })

  test('degenerate ladders return the last index; low clamps to rung 0', () => {
    expect(ladderCeiling(1, 0)).toBe(0)
    expect(ladderCeiling(0, 0)).toBe(-1)

    stubNav({ effectiveType: NET_STRINGS.EFFECTIVE_2G })

    expect(ladderCeiling(4, 0)).toBe(0)
  })

  test('medium drops one rung; small boxes drop two; terms stack and clamp', () => {
    stubNav({ effectiveType: NET_STRINGS.EFFECTIVE_3G })

    // 4 rungs (0..3): medium → last-1 = 2.
    expect(ladderCeiling(4, 0)).toBe(2)

    // Medium + small box → last-3 → clamps at 0.
    expect(ladderCeiling(4, IMAGE_DIMENSIONS.SMALL_BOX_PX)).toBe(0)

    stubNav({ effectiveType: NET_STRINGS.EFFECTIVE_4G })

    // Full budget + small box → last-2 = 1.
    expect(ladderCeiling(4, IMAGE_DIMENSIONS.SMALL_BOX_PX)).toBe(1)

    // Box above the small threshold and unknown boxes apply no drop.
    expect(ladderCeiling(4, IMAGE_DIMENSIONS.SMALL_BOX_PX + 1)).toBe(3)
    expect(ladderCeiling(4, 0)).toBe(3)
  })

  test('prefersScaledVideo — explicit box, viewport fallback, zero guards', () => {
    // 810px box at 1x against a 1920px source: 810 ≤ 960 → scaled first.
    expect(prefersScaledVideo(1920, 810)).toBe(true)

    // 810px box at 2x: 1620 > 960 → full stream. A falsy dpr (0)
    // exercises the `|| 1` arm on the way back.
    const origDpr = window.devicePixelRatio

    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true })
    expect(prefersScaledVideo(1920, 810)).toBe(false)

    Object.defineProperty(window, 'devicePixelRatio', { value: 0, configurable: true })
    expect(prefersScaledVideo(1920, 810)).toBe(true)

    Object.defineProperty(window, 'devicePixelRatio', { value: origDpr, configurable: true })

    // Unknown media width short-circuits to false.
    expect(prefersScaledVideo(0, 810)).toBe(false)

    globalThis.window = undefined

    // An explicit box never consults window — only dpr, which falls
    // back to 1 → still scaled-first.
    expect(prefersScaledVideo(1920, 810)).toBe(true)

    // No box + no window: both fallbacks exhaust to 0 → false.
    expect(prefersScaledVideo(1920, 0)).toBe(false)
  })

  test('prefersScaledVideo — pre-layout box falls back to the viewport', () => {
    // Box 0 → window.innerWidth (1024 in happy-dom) substitutes: over
    // the 960px half-res threshold for 1920px sources → full stream;
    // under it for a 4096px source → scaled first.
    expect(prefersScaledVideo(1920, 0)).toBe(false)
    expect(prefersScaledVideo(4096, 0)).toBe(true)
  })
})
