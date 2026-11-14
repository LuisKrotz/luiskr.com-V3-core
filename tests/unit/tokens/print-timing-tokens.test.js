/**
 * @file print-timing-tokens.test.js
 * @description Coverage tail for core/tokens/motion/print.ts — asserts the
 * print-lifecycle timing tokens stay positive-millisecond integers and
 * the map stays frozen (the print adapter's debounce/settle/failsafe
 * cadences read these).
 */

import { PRINT_TIMING } from '@core/tokens/motion/print.js'

describe('PRINT_TIMING', () => {
  test('every member is a positive integer millisecond', () => {
    for (const ms of Object.values(PRINT_TIMING)) {
      expect(Number.isInteger(ms)).toBe(true)
      expect(ms).toBeGreaterThan(0)
    }
  })

  test('the documented cadences exist', () => {
    for (const key of [
      'MM_EXIT_DEBOUNCE',
      'PREP_CAP',
      'SETTLE_TICK',
      'SETTLE_QUIET_TICKS',
      'DIALOG_GRACE',
    ]) {
      expect(PRINT_TIMING[key]).toBeDefined()
    }
  })

  test('the map is frozen', () => {
    expect(Object.isFrozen(PRINT_TIMING)).toBe(true)
  })
})
