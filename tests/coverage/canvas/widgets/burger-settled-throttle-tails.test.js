/**
 * @file burger-settled-throttle-tails.test.js
 * @description Coverage tail for the burger icon's settled-state throttle —
 * once every eased scalar converges and no click shockwave is live, the
 * ambient loop repaints on alternating frames only (SETTLE_GRACE_FRAMES
 * runway, then the parity gate).
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { attachMockGL } from '@tests/fixtures/mock-webgl.js'
import store from '@core/store.js'
import { PREF_MUTATIONS } from '@core/tokens/events/mutations.js'

/** Imports the class under test (module-level import is fine — no mocks). */
const loadClass = async () =>
  (await import('@core/utils/canvas/widgets/burger-button-webgl.js')).BurgerButtonWebGL

/** A 34px-box canvas — getBoundingClientRect drives _checkResize. */
const makeCanvas = () => {
  const canvas = document.createElement(HTML_TAGS.CANVAS)

  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 34, height: 34 })

  return canvas
}

beforeEach(() => {
  store.commit(PREF_MUTATIONS.SET_REDUCED_MOTION, false)
})

describe('burger settled throttle', () => {
  test('a fully settled icon drops to the alternating-frame repaint path', async () => {
    const BurgerButtonWebGL = await loadClass()
    const canvas = makeCanvas()

    attachMockGL(canvas)
    document.body.appendChild(canvas)

    const burger = new BurgerButtonWebGL(canvas, jest.fn())

    const drawSpy = jest.spyOn(burger, '_drawFrame')

    // All eased scalars start converged on zero targets — 35 ticks walk
    // past the 30-frame grace runway, then _parity alternates draws.
    for (let i = 0; i < 35; i += 1) {
      burger._loop()
    }

    const drawn = drawSpy.mock.calls.length

    expect(burger._settleStreak).toBeGreaterThan(30)
    // Past the grace runway only odd parities draw — strictly fewer
    // draws than ticks.
    expect(drawn).toBeLessThan(35)

    burger.destroy()
    canvas.remove()
  })

  test('a live hover transition and a fresh click shockwave stay on the full-rate path', async () => {
    const BurgerButtonWebGL = await loadClass()
    const canvas = makeCanvas()

    attachMockGL(canvas)
    document.body.appendChild(canvas)

    const burger = new BurgerButtonWebGL(canvas, jest.fn())

    const drawSpy = jest.spyOn(burger, '_drawFrame')

    // Un-settled: hover target diverged mid-ease — every tick draws.
    burger._hoverTarget = 1
    burger._loop()

    expect(burger._settleStreak).toBe(0)

    // Fresh shockwave: _clickT inside the 0.5s window keeps the tick
    // un-settled even with converged scalars.
    burger._hoverTarget = 0

    burger._hover = 0
    burger._clickT = (performance.now() - burger.startTime) / 1000
    burger._loop()

    expect(burger._settleStreak).toBe(0)

    expect(drawSpy.mock.calls.length).toBe(2)

    burger.destroy()
    canvas.remove()
  })
})
