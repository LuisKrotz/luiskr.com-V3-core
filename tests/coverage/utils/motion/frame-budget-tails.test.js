/**
 * @file frame-budget-tails.test.js
 * @description Coverage tails for core/tokens/motion/frame-budget.ts —
 * asserts the declared 120Hz mobile / 240Hz desktop ceilings resolve to
 * their millisecond budgets. The governance runtime gate
 * (shared/tests/governance/animation-frame-budget.test.js) enforces the
 * same constants against live rAF durations.
 */
import { describe, test, expect } from '@jest/globals'
import { FRAME_BUDGET } from '@core/tokens/motion/frame-budget.js'

describe('frame-budget tails', () => {
  test('the 120Hz/240Hz refresh floors resolve to ms budgets', () => {
    expect(FRAME_BUDGET.MOBILE_HZ).toBe(120)
    expect(FRAME_BUDGET.DESKTOP_HZ).toBe(240)
    expect(FRAME_BUDGET.MOBILE_MS).toBeCloseTo(8.333, 2)
    expect(FRAME_BUDGET.DESKTOP_MS).toBeCloseTo(4.167, 2)
  })

  test('budgets stay internally consistent — ms ≈ 1000/Hz', () => {
    expect(FRAME_BUDGET.MOBILE_MS).toBe(1000 / FRAME_BUDGET.MOBILE_HZ)
    expect(FRAME_BUDGET.DESKTOP_MS).toBe(1000 / FRAME_BUDGET.DESKTOP_HZ)
  })
})
