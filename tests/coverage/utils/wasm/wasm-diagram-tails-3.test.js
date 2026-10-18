/**
 * @file wasm-diagram-tails-3.test.js
 * @description Coverage tails for core/utils/wasm/wasm-diagram.ts,
 * third file — fresh module state covers the render-error arm:
 * a `render_diagram` throw propagates AND the engine stays latched
 * (render failures are source errors, not load failures — no reload).
 */

import { describe, test, expect } from '@jest/globals'
import { renderDiagram } from '@core/utils/wasm/wasm-diagram.js'

describe('wasm diagram engine — render-error arm', () => {
  test('render errors propagate with the engine still cached', async () => {
    let loads = 0
    const glue = {
      default: async () => ({}),
      render_diagram: () => {
        throw new Error('unsupported diagram type')
      },
    }
    const loader = async () => {
      loads++

      return glue
    }

    await expect(renderDiagram('pie', '{}', loader)).rejects.toThrow('unsupported')
    // Engine stayed latched — render (not load) failures don't reload.
    await expect(renderDiagram('pie', '{}', loader)).rejects.toThrow('unsupported')
    expect(loads).toBe(1)
  })
})
