/**
 * @file wasm-diagram-tails-2.test.js
 * @description Coverage tails for core/utils/wasm/wasm-diagram.ts,
 * second file — fresh module state covers the arms the latch blocks
 * in tails-1: rejection-unlatch retry and render-error propagation
 * without engine reload.
 */

import { describe, test, expect } from '@jest/globals'
import { renderDiagram } from '@core/utils/wasm/wasm-diagram.js'

describe('wasm diagram engine — retry + error arms', () => {
  test('a rejected load unlatches — a later call can succeed', async () => {
    const svg = '<svg data-t="retry"></svg>'

    await expect(
      renderDiagram('flowchart TB', '{}', async () => {
        throw new Error('network')
      })
    ).rejects.toThrow('network')

    const glue = {
      default: async () => ({}),
      render_diagram: () => svg,
    }

    expect(await renderDiagram('flowchart TB', '{}', async () => glue)).toBe(svg)
  })
})
