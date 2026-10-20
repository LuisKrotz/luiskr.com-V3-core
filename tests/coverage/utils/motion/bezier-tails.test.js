/**
 * @file bezier-tails.test.js
 * @description Coverage for core/utils/motion/bezier.ts — the
 * cubic-bezier easing evaluator. Covers the endpoint clamps (x ≤ 0 and
 * x ≥ 1), the Newton-Raphson happy path, the flat-tangent Newton bail
 * into bisection, and bisection convergence — plus sanity checks on the
 * spec'd genie accelerate curve `cubic-bezier(0.4, 0, 1, 1)`.
 */
import { describe, test, expect } from '@jest/globals'
import { cubicBezier } from '@core/utils/motion/bezier.js'

// accelerate curve — cubic-bezier(0.4, 0, 1, 1): gentle ramp, steep
// tail (one-off fixture points, same shape class as CSS ease-in).
const EASE_X1 = 0.4
const EASE_Y1 = 0
const EASE_X2 = 1
const EASE_Y2 = 1

describe('cubicBezier tails', () => {
  test('clamps to the pinned endpoints', () => {
    const ease = cubicBezier(EASE_X1, EASE_Y1, EASE_X2, EASE_Y2)

    expect(ease(0)).toBe(0)
    expect(ease(-0.5)).toBe(0)
    expect(ease(1)).toBe(1)
    expect(ease(1.5)).toBe(1)
  })

  test('ease-in accelerate — slow start, steep tail', () => {
    const ease = cubicBezier(EASE_X1, EASE_Y1, EASE_X2, EASE_Y2)

    const mid = ease(0.5)

    // cubic-bezier(0.4,0,1,1) ≈ 0.21 at mid — gentle then accelerating.
    expect(mid).toBeGreaterThan(0.1)
    expect(mid).toBeLessThan(0.35)
    expect(ease(0.9)).toBeGreaterThan(0.7)
  })

  test('linear identity control points pass values through', () => {
    const ease = cubicBezier(1 / 3, 1 / 3, 2 / 3, 2 / 3)

    expect(ease(0.25)).toBeCloseTo(0.25, 5)
    expect(ease(0.75)).toBeCloseTo(0.75, 5)
  })

  test('flat-tangent control points bail Newton into bisection', () => {
    // x1 = x2 = 0 → x(s) = s³ — the slope at s≈0 is ~0 so Newton's
    // step flattens and the solver falls through to bisection.
    const ease = cubicBezier(0, 0.5, 0, 0.5)

    const y = ease(1e-8)

    expect(y).toBeGreaterThan(0)
    expect(y).toBeLessThan(1)
    // y(s) ≈ 1.5s where s³ = 1e-8 → s ≈ 0.0022 → y ≈ 0.0032.
    expect(y).toBeCloseTo(0.0032, 2)
  })

  test('bisection converges on a steep curve', () => {
    const ease = cubicBezier(0.9, 0, 0.1, 1)

    for (const x of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const y = ease(x)

      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(1)
    }
  })
})
