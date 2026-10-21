/**
 * @file frame-time.test.js
 * @description Coverage for core/utils/ml/frame-time.ts — the ring
 * window, throttled inference, budget-band quality steps, the in-flight
 * latch, null-output hold, and callback/destroy lifecycle.
 */

import { describe, test, expect } from '@jest/globals'
import { FrameTimePredictor } from '@core/utils/ml/frame-time.js'
import { ML } from '@core/tokens/data/ml.js'

/** Flushes pending microtasks so fire-and-forget inference settles. */
const flushAsync = () => new Promise((r) => setTimeout(r))

/** Runs one full inference cycle — INFER_EVERY records + settle. */
const cycle = async (p, ms = 16) => {
  for (let i = 0; i < ML.FRAMETIME_INFER_EVERY; i++) p.record(ms)

  await flushAsync()
}

describe('frame-time predictor', () => {
  test('starts at full quality and records without inference until the cadence', async () => {
    const run = async () => ({ ms: new Float32Array([0.5]) })
    const p = new FrameTimePredictor(null, run)

    expect(p.quality).toBe(1)

    for (let i = 0; i < ML.FRAMETIME_INFER_EVERY - 1; i++) p.record(16)

    expect(p.quality).toBe(1)
  })

  test('predicted overrun steps quality down to the floor', async () => {
    const calls = []
    const run = async () => ({ ms: new Float32Array([0.9]) })
    const p = new FrameTimePredictor((q) => calls.push(q), run)

    for (let i = 0; i < 10; i++) await cycle(p, 40)

    expect(p.quality).toBe(ML.QUALITY_MIN)
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.at(-1)).toBe(ML.QUALITY_MIN)
  })

  test('predicted headroom steps quality up and stops at 1', async () => {
    const run = async () => ({ ms: new Float32Array([0.05]) })
    const p = new FrameTimePredictor(null, run)

    // Force a degraded start so the up-step arm runs.
    p._quality = ML.QUALITY_MIN

    await cycle(p)

    expect(p.quality).toBeCloseTo(ML.QUALITY_MIN + ML.QUALITY_STEP_UP)

    for (let i = 0; i < 20; i++) await cycle(p)

    expect(p.quality).toBe(1)
  })

  test('in-band prediction and null output both hold quality', async () => {
    const run = async () => ({ ms: new Float32Array([0.15]) })
    const p = new FrameTimePredictor(null, run)

    p._quality = 0.75

    await cycle(p)

    expect(p.quality).toBe(0.75)

    p._run = async () => null
    p._pending = false

    await cycle(p)

    expect(p.quality).toBe(0.75)
  })

  test('the in-flight latch blocks a second dispatch until the first settles', async () => {
    let release
    const gate = new Promise((r) => (release = r))
    let calls = 0
    const run = async () => {
      calls++

      await gate

      return { ms: new Float32Array([0.2]) }
    }
    const p = new FrameTimePredictor(null, run)

    p.record(16)
    p._frames = ML.FRAMETIME_INFER_EVERY - 1
    p.record(16) // dispatches — pending latched
    p._frames = ML.FRAMETIME_INFER_EVERY - 1
    p.record(16) // blocked by the latch

    expect(calls).toBe(1)

    release()
    await flushAsync()

    expect(calls).toBe(1)
    expect(p._pending).toBe(false)
  })

  test('the ring window wraps and feeds oldest→newest order', async () => {
    let seen
    const run = async (_slug, feeds) => {
      seen = Array.from(feeds[ML.IN_FEATURES].data)

      return { ms: new Float32Array([0.5]) }
    }
    const p = new FrameTimePredictor(null, run)

    for (let i = 0; i < ML.FRAMETIME_HISTORY + 2; i++) p.record((i + 1) * 10)

    p._frames = ML.FRAMETIME_INFER_EVERY - 1
    p.record(90)
    await flushAsync()

    // Last-5 window replayed in chronological order + quality tail —
    // records were 10..70ms then 90ms → normalized /100.
    ;[0.4, 0.5, 0.6, 0.7, 0.9].forEach((v, i) => expect(seen[i]).toBeCloseTo(v, 5))
    expect(seen[ML.FRAMETIME_HISTORY]).toBe(1)
  })

  test('clamps frame input into the 0–1 model range', async () => {
    let seen
    const run = async (_s, feeds) => {
      seen = feeds[ML.IN_FEATURES].data

      return null
    }
    const p = new FrameTimePredictor(null, run)

    // Over-range then negative records clamp into 0–1 before the trigger.
    for (const ms of [450, 950, 1450, 1950, -50]) p.record(ms)

    p._frames = ML.FRAMETIME_INFER_EVERY - 1
    p.record(16)
    await flushAsync()

    expect(seen[0]).toBe(1)
    expect(seen[ML.FRAMETIME_HISTORY - 2]).toBe(0)
    expect(seen[ML.FRAMETIME_HISTORY - 1]).toBeCloseTo(0.16, 5)
  })

  test('destroy drops the quality callback', async () => {
    const calls = []
    const run = async () => ({ ms: new Float32Array([0.9]) })
    const p = new FrameTimePredictor((q) => calls.push(q), run)

    p.destroy()
    await cycle(p)

    expect(calls).toHaveLength(0)
  })

  test('destroy latches inference — record() no longer dispatches the model', async () => {
    let dispatches = 0
    const run = async () => {
      dispatches++
      return { ms: new Float32Array([0.9]) }
    }
    const p = new FrameTimePredictor(null, run)

    p.destroy()
    await cycle(p)

    // The post-teardown rAF case: record() still measures but must never
    // re-arm the ORT import after the engine has been torn down.
    expect(dispatches).toBe(0)
  })

  test('default runner delegates to the ORT engine', async () => {
    const p = new FrameTimePredictor()

    for (let i = 0; i < ML.FRAMETIME_INFER_EVERY; i++) p.record(16)

    await flushAsync()

    expect(p.quality).toBe(1) // stub output `out` has no `ms` key → hold
  })
})
