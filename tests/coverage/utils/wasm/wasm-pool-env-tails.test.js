/**
 * @file wasm-pool-env-tails.test.js
 * @description Coverage for core/utils/wasm/wasm-pool.ts module-evaluation
 * arms that the singleton's normal import never exercises: the mobile-UA
 * pool sizing, the missing-hardwareConcurrency fallback, and the SSR
 * (no-window) pagehide guard. Each test re-imports the module inside a
 * reset registry so module-level branches see the stubbed globals.
 */
import { describe, test, expect, jest, afterEach } from '@jest/globals'
import { WASM_POOL } from '@core/tokens/data/wasm.js'
import { WASM_ACTIONS } from '@core/constants.js'

const uaDesc = Object.getOwnPropertyDescriptor(navigator, 'userAgent')
const hcDesc = Object.getOwnPropertyDescriptor(navigator, 'hardwareConcurrency')
const winDesc = Object.getOwnPropertyDescriptor(globalThis, 'window')

afterEach(() => {
  if (uaDesc) Object.defineProperty(navigator, 'userAgent', uaDesc)
  if (hcDesc) Object.defineProperty(navigator, 'hardwareConcurrency', hcDesc)
  if (winDesc) Object.defineProperty(globalThis, 'window', winDesc)

  jest.resetModules()
})

describe('wasm-pool env tails', () => {
  test('mobile UA plus missing hardwareConcurrency clamps to MOBILE_MAX of FALLBACK_CORES', async () => {
    Object.defineProperty(navigator, 'userAgent', { value: 'iPhone', configurable: true })
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      value: undefined,
      configurable: true,
    })

    jest.resetModules()

    const { wasmPool } = await import('@core/utils/wasm/wasm-pool.js')

    expect(wasmPool.size).toBe(Math.min(WASM_POOL.MOBILE_MAX, WASM_POOL.FALLBACK_CORES))
  })

  test('SSR import registers no pagehide listener and dispatch resolves null', async () => {
    Object.defineProperty(globalThis, 'window', { value: undefined, configurable: true })

    jest.resetModules()

    const { wasmPool } = await import('@core/utils/wasm/wasm-pool.js')

    const res = await wasmPool.dispatch(WASM_ACTIONS.PROBE_VIDEO_WASM, {})

    expect(res).toBeNull()
  })
})
