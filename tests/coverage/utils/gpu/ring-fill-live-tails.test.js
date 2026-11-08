/**
 * @file ring-fill-live-tails.test.js
 * @description Coverage tails for utils/gpu/ring-fill.ts — the live
 * session arms: resheet geometry + color push (fallback parses, circle
 * vs rrect shape, NaN hairline), the manual RAF clock's ease/clamp
 * arms, and destroy teardown. The widget mount is stubbed so the
 * bridge runs without a GPU surface.
 */
import { describe, test, expect, jest } from '@jest/globals'
import { NAV_SEARCH_CSS_PROPS } from '@core/tokens/css/nav.js'

/** Fake wasm widget — jest fns record every forwarded session call. */
const widget = {
  resize: jest.fn(),
  set_tiles: jest.fn(),
  set_colors: jest.fn(),
  frame: jest.fn(() => true),
}
/** Mount-handle the widget mock returns — canvas/widget/destroy surface. */
const handle = { canvas: null, widget, destroy: jest.fn() }

jest.unstable_mockModule('@core/utils/gpu/webgpu-widget.js', () => ({
  hasWebGpu: () => true,
  mountWebGpuWidget: jest.fn(async () => handle),
}))

const { mountRingFill } = await import('@core/utils/gpu/ring-fill.js')
const { NAV_GLYPH } = await import('@core/tokens/data/nav-glyph.js')

/** Glyph-id token the nav-glyph tile spec keys on. */
const TILES = 'button'

/** Host + two tiles (one square → circle shape arm, one wide → rrect arm). */
const makeHost = () => {
  const host = document.createElement('div')
  const a = document.createElement('button')
  const b = document.createElement('button')

  host.appendChild(a)
  host.appendChild(b)
  document.body.appendChild(host)

  return host
}

/** Generous flush — live-session rAF steps need real timers. */
const flush = (ms = 80) => new Promise((r) => setTimeout(r, ms))

describe('ring-fill live session', () => {
  test('mount resheets once and the session drives progress/refresh/destroy', async () => {
    const host = makeHost()
    const session = mountRingFill(host, TILES, 'rf-canvas')

    await flush() // mount() promise + initial frame

    expect(session).not.toBeNull()
    expect(widget.set_tiles).toHaveBeenCalled()

    session.setProgress(0, 1)
    session.setProgress(1, -0.5) // target below zero → the down-ease arm
    session.setProgress(1, 0) // settled tile → the p===t continue arm
    session.setProgress(-1, 1) // out-of-range index → early return
    session.setProgress(9, 1)
    session.refresh() // markDirty → next tick resheets

    await flush(120) // a few ticks — easing arms run

    session.setProgress(0, 0)
    await flush(120)

    session.destroy()
    session.destroy() // dead-guard second call

    expect(handle.destroy).toHaveBeenCalled()
    document.body.innerHTML = ''
  })
})

void NAV_GLYPH
void NAV_SEARCH_CSS_PROPS
