/**
 * @file wasm-diagram-tails.test.js
 * @description Coverage tails for core/utils/wasm/wasm-diagram.ts —
 * the mermaid-replacement engine loader: default-loader failure (no
 * artifact under jest), success via injected glue, and the latched-
 * engine reuse contract.
 *
 * ORDER SENSITIVE: `engine` is a module-level latch — the default-
 * loader test runs FIRST so its rejection clears to null and later
 * tests can inject. See wasm-diagram-tails-2 for the remaining arms.
 */

import { describe, test, expect } from '@jest/globals'
import { renderDiagram } from '@core/utils/wasm/wasm-diagram.js'

describe('wasm diagram engine', () => {
  test('default loader fails without the artifact → caller rejects', async () => {
    // No injected loader — exercises loadDiagramModule itself; the
    // dynamic import of /wasm/diagram/… can't resolve under jest.
    await expect(renderDiagram('flowchart TB', '{}')).rejects.toThrow()
  })

  test('renders through an injected glue module', async () => {
    let seen = null
    const glue = {
      default: async () => ({}),
      render_diagram: (src, theme) => {
        seen = [src, theme]

        return '<svg data-t="1"></svg>'
      },
    }

    const out = await renderDiagram('flowchart TB', '{"a":1}', async () => glue)

    expect(out).toContain('<svg')
    expect(seen).toEqual(['flowchart TB', '{"a":1}'])
  })

  test('a later call reuses the latched engine — loader not re-invoked', async () => {
    let loads = 0

    const out = await renderDiagram('flowchart LR', '{}', async () => {
      loads++

      throw new Error('should never run — engine already latched')
    })

    expect(out).toContain('<svg')
    expect(loads).toBe(0)
  })
})
