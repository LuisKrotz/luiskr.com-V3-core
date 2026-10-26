/**
 * @file playground-control-groups.test.js
 * @description Coverage tail for core/tokens/playground/control-groups.ts —
 * asserts the frozen control-panel schema keeps its group → control → action
 * shape and member-name keys (the wire strings live in params.ts/actions.ts;
 * this leaf must never hardcode them).
 */

import { SP_CONTROL_GROUPS } from '@core/tokens/playground/control-groups.js'

describe('SP_CONTROL_GROUPS', () => {
  test('is a frozen group list with stable labels', () => {
    expect(Object.isFrozen(SP_CONTROL_GROUPS)).toBe(true)
    expect(SP_CONTROL_GROUPS.map((g) => g.label)).toEqual([
      'engine',
      'terrain',
      'postFx',
      'camera',
      'earth',
      'color',
      'displayDebug',
    ])
  })

  test('every control row carries a member-name key plus a range or check shape', () => {
    for (const g of SP_CONTROL_GROUPS) {
      expect(typeof g.label).toBe('string')
      expect(typeof g.collapsed).toBe('boolean')

      for (const c of g.controls) {
        expect(typeof c.key).toBe('string')
        expect(typeof c.label).toBe('string')
        // Shape-derived input type: `checked` → checkbox, else a
        // min/max/step/def range row. No 'range'/'checkbox' literal field.
        if ('checked' in c) {
          expect(typeof c.checked).toBe('boolean')
        } else {
          expect(typeof c.min).toBe('number')
          expect(typeof c.max).toBe('number')
          expect(typeof c.step).toBe('number')
          expect(typeof c.def).toBe('number')
        }
      }

      for (const a of g.actions || []) {
        expect(typeof a.key).toBe('string')
        expect(typeof a.label).toBe('string')
      }
    }
  })
})
