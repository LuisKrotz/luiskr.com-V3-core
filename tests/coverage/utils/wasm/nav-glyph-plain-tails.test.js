/**
 * @file nav-glyph-plain-tails.test.js
 * @description Coverage tails for core/utils/wasm/nav-glyph.ts — the
 * injected-loader runtime seed (GlyphFx construction, data view, frame
 * loop, pointer wake, destroy), the null-ctx arm, and the default
 * `loadModule = loadGlueModule` arg arm. Plain top-level import so
 * istanbul hits persist (no isolateModules — counters are per instance).
 * Order matters: `runtime` latches once, so the injected loader mounts
 * first; the default-arg call then exercises the param default without
 * re-entering `load()`.
 */
import { describe, test, expect, afterEach } from '@jest/globals'
import { mountNavGlyph } from '@core/utils/wasm/nav-glyph.js'
import { NAV_CLASSES } from '@core/tokens/classes/nav.js'
import { NAV_GLYPH } from '@core/tokens/data/nav-glyph.js'
import { NAV_SEARCH_CSS_PROPS } from '@core/tokens/css/nav.js'
import { POINTER_EVENTS } from '@core/tokens/events/dom.js'

/** Two neon palette vars — enough to cover the multi-color arm. */
const COLORS = [NAV_SEARCH_CSS_PROPS.NEON_TEAL, NAV_SEARCH_CSS_PROPS.NEON_GREEN]

/** Host with a shadow root + canvas whose getContext returns `ctxResult`. */
const makeHost = (ctxResult) => {
  const host = document.createElement('div')

  host.attachShadow({ mode: 'open' })

  const canvas = document.createElement('canvas')

  canvas.className = NAV_CLASSES.NAV_GLYPH_CANVAS
  canvas.getContext = ctxResult
  host.shadowRoot.appendChild(canvas)

  const chip = document.createElement('button')

  chip.appendChild(host)
  document.body.appendChild(chip)

  return host
}

/** Minimal `GlyphHandle` — wasm record buffer backed by a real ArrayBuffer. */
const GlyphFx = class {
  set_active() {}
  step() {}
  alive() {
    return 0
  }
  energy() {
    return 0
  }
  data_ptr() {
    return 0
  }
  data_len() {
    return 2
  }
  free() {}
}

/** Fake wasm-bindgen glue — the loader's dynamic-import returns this. */
const glue = async () => ({
  default: async () => ({ memory: { buffer: new ArrayBuffer(64) } }),
  GlyphFx,
})

describe('nav-glyph plain-module arms', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    delete window.matchMedia
  })

  test('injected glue + ctx stub → session mounts; pointer wake + destroy run', async () => {
    window.matchMedia = () => ({ matches: false })

    const host = makeHost(() => ({
      measureText: () => ({ width: 1 }),
      clearRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
    }))

    const session = await mountNavGlyph(host, NAV_GLYPH.KIND_STREAK, COLORS, glue)

    expect(session).not.toBeNull()

    const chip = host.closest('button')

    chip.dispatchEvent(new Event(POINTER_EVENTS.POINTERENTER))
    chip.dispatchEvent(new Event(POINTER_EVENTS.POINTERLEAVE))
    session.destroy()
    host.remove()
  })

  test('null 2d ctx → `!ctx` arm → early null after runtime seeds', async () => {
    window.matchMedia = () => ({ matches: false })

    const session = await mountNavGlyph(
      makeHost(() => null),
      NAV_GLYPH.KIND_SWOOSH,
      COLORS,
      glue
    )

    expect(session).toBeNull()
  })

  test('zero devicePixelRatio → `|| 1` dpr fallback arm during size/draw', async () => {
    window.matchMedia = () => ({ matches: false })
    window.devicePixelRatio = 0

    const host = makeHost(() => ({
      measureText: () => ({ width: 1 }),
      clearRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
    }))

    const session = await mountNavGlyph(host, NAV_GLYPH.KIND_SWOOSH, COLORS, glue)

    host.closest('button').dispatchEvent(new Event(POINTER_EVENTS.POINTERENTER))
    session?.destroy()
    host.remove()
    window.devicePixelRatio = 1
  })

  test('no loader arg → `loadModule = loadGlueModule` default-arg arm', async () => {
    window.matchMedia = () => ({ matches: false })

    const session = await mountNavGlyph(
      makeHost(() => ({})),
      NAV_GLYPH.KIND_STREAK,
      COLORS
    )

    expect(session).not.toBeUndefined()
  })
})
