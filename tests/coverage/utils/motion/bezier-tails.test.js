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

  test('zero tangent at the Newton seed — break arm, then bisection', () => {
    // x1 = 1, x2 = 2 → slope(s) = 3 − 6s² which is exactly 0 at
    // s = 1/√2. Seeding s = x = Math.SQRT1_2 makes the first Newton
    // iteration hit |d| < 1e-6 → break → bisection resolves the root.
    const ease = cubicBezier(1, 0, 2, 0)

    const y = ease(Math.SQRT1_2)

    expect(Number.isFinite(y)).toBe(true)
    expect(y).toBeGreaterThanOrEqual(0)
    expect(y).toBeLessThanOrEqual(1)
  })

  test('flat approach overshoots the Newton step above 1 — s>1 clamp arm', () => {
    // x1 = 0, x2 = 0.05 keeps the x-curve far below x at the seed while
    // the tangent stays shallow (d ≈ 0.32 at s = 0.3) so the Newton
    // step s − err/d overshoots to ~1.13 and the s > 1 clamp rescues it.
    const ease = cubicBezier(0, 0.5, 0.05, 0.5)

    const y = ease(0.3)

    expect(Number.isFinite(y)).toBe(true)
    expect(y).toBeGreaterThanOrEqual(0)
    expect(y).toBeLessThanOrEqual(1)
  })

  test('negative first control point pulls Newton below zero — s<0 clamp arm', () => {
    // x1 = −0.5, x2 = 1.5 → the tangent at small s is negative, so the
    // Newton step s − err/d flips negative and the clamp rescues it.
    const ease = cubicBezier(-0.5, 0.5, 1.5, 0.5)

    const y = ease(0.05)

    expect(Number.isFinite(y)).toBe(true)
    expect(y).toBeGreaterThanOrEqual(0)
    expect(y).toBeLessThanOrEqual(1)
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
