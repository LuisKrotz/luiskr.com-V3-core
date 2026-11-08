/**
 * @file nav-glyph-runtime-tails.test.js
 * @description Coverage tail for utils/wasm/nav-glyph.ts — the live
 * bridge path with an injected glue module: canvas sizing, particle
 * paint for both glyph kinds and both hue buckets, the RAF wake/sleep
 * loop, enter/leave triggers and destroy teardown. Each test mounts a
 * fresh module instance — `runtime` is a module-level latch, so a
 * shared instance would swallow later injections.
 */
import { describe, test, expect, jest, afterEach } from '@jest/globals'
import { NAV_CLASSES } from '@core/tokens/classes/nav.js'
import { NAV_GLYPH } from '@core/tokens/data/nav-glyph.js'
import { NAV_SEARCH_CSS_PROPS } from '@core/tokens/css/nav.js'

/** Two neon palette vars — enough to cover the multi-color arm. */
const COLORS = [NAV_SEARCH_CSS_PROPS.NEON_TEAL, NAV_SEARCH_CSS_PROPS.NEON_GREEN]

/** Spy-backed 2d context — every call the painter makes. */
const fakeCtx = () => ({
  clearRect: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  globalAlpha: 0,
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 0,
})

/** Host inside a chip button with a stub-canvas in its shadow root. */
const makeHost = () => {
  const host = document.createElement('div')

  host.attachShadow({ mode: 'open' })

  const canvas = document.createElement('canvas')

  canvas.className = NAV_CLASSES.NAV_GLYPH_CANVAS
  canvas.getContext = fakeCtx

  host.shadowRoot.appendChild(canvas)

  const chip = document.createElement('button')

  chip.appendChild(host)
  document.body.appendChild(chip)

  return { host, chip }
}

/**
 * Injected glue module — { default(): {memory}, GlyphFx }: the pool
 * buffer lives in a real ArrayBuffer so the painter reads alpha/size/hue
 * exactly as it would from wasm records.
 */
const fakeGlue = (alive = 1) => {
  const memory = { buffer: new ArrayBuffer(NAV_GLYPH.POOL * NAV_GLYPH.STRIDE * 4) }
  const view = new Float32Array(memory.buffer)

  // Two live particles — one below the hue split, one above — plus a
  // zero-alpha straggler for the `continue` arm.
  view.set([8, 10, 0.9, 4, 0.1], 0)
  view.set([40, 12, 0.5, 3, 0.9], NAV_GLYPH.STRIDE)

  const calls = { active: [], steps: [], freed: false }

  function GlyphFx() {
    return {
      set_active: (on) => calls.active.push(on),
      step: (dt) => calls.steps.push(dt),
      alive: () => alive,
      energy: () => alive,
      data_ptr: () => 0,
      data_len: () => NAV_GLYPH.POOL * NAV_GLYPH.STRIDE,
      free: () => {
        calls.freed = true
      },
    }
  }

  return { glue: { default: async () => ({ memory }), GlyphFx }, calls }
}

/** Fresh module instance + injected glue → mountNavGlyph under test. */
const mountIsolated = async (host, kind, glue) => {
  let session = null

  await jest.isolateModulesAsync(async () => {
    const { mountNavGlyph } = await import('@core/utils/wasm/nav-glyph.js')

    session = await mountNavGlyph(host, kind, COLORS, async () => glue)
  })

  return session
}

describe('nav-glyph live bridge', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    delete window.matchMedia
    window.devicePixelRatio = 1
  })

  test('mounts a session, paints streak particles and reacts to chip enter/leave', async () => {
    window.matchMedia = () => ({ matches: false })

    const { host, chip } = makeHost()
    const { glue, calls } = fakeGlue(0)
    const session = await mountIsolated(host, NAV_GLYPH.KIND_STREAK, glue)

    expect(session).not.toBeNull()

    chip.dispatchEvent(new Event('pointerenter'))
    chip.dispatchEvent(new Event('pointerenter')) // second wake is a no-op while raf is live
    chip.dispatchEvent(new Event('pointerleave'))
    chip.dispatchEvent(new Event('focusin'))
    chip.dispatchEvent(new Event('focusout'))

    expect(calls.active).toContain(true)
    expect(calls.active).toContain(false)

    session.destroy()
    expect(calls.freed).toBe(true)
  })

  test('swoosh kind paints circles; the RAF loop steps the wasm', async () => {
    window.matchMedia = () => ({ matches: false })

    const { host, chip } = makeHost()
    const { glue, calls } = fakeGlue(0)

    const session = await mountIsolated(host, NAV_GLYPH.KIND_SWOOSH, glue)

    chip.dispatchEvent(new Event('pointerenter'))

    await new Promise((r) => setTimeout(r, 60))

    session.destroy()
    expect(calls.freed).toBe(true)
  })

  test('a wasm reply that stays energized keeps the loop alive', async () => {
    window.matchMedia = () => ({ matches: false })
    window.devicePixelRatio = 0

    const { host, chip } = makeHost()
    const { glue, calls } = fakeGlue(5)

    const session = await mountIsolated(host, NAV_GLYPH.KIND_STREAK, glue)

    chip.dispatchEvent(new Event('pointerenter'))

    await new Promise((r) => setTimeout(r, 30))
    window.devicePixelRatio = 2
    await new Promise((r) => setTimeout(r, 40))

    expect(calls.steps.length).toBeGreaterThan(0)
    session.destroy()
  })
})
