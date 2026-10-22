/**
 * @file ort-engine.test.js
 * @description Coverage for core/utils/ml/ort-engine.ts — lazy runtime
 * import, EP probing (webnn/webgpu/wasm), session cache + wasm retry,
 * feed wrapping, and every null-degradation arm.
 */

import { describe, test, expect, beforeEach } from '@jest/globals'
import { ensureOrt, mlSession, runMlModel, resetMlEngine } from '@core/utils/ml/ort-engine.js'
import { ML, ML_SESSION } from '@core/tokens/data/ml.js'
import { ASSET_PATHS } from '@core/tokens/routes/paths.js'

/** Builds a recording ORT stub — no jest mapper needed. */
const makeOrt = ({ failCreate = 0, failRun = false, outputs } = {}) => {
  const state = { creates: [], runs: [], tensors: [] }

  const ort = {
    env: { wasm: {}, logLevel: '' },
    Tensor: class {
      constructor(type, data, dims) {
        state.tensors.push({ type, data, dims })
        this.data = data
      }
    },
    InferenceSession: {
      create: async (uri, opts) => {
        state.creates.push({ uri, opts })

        if (failCreate === Infinity || state.creates.length <= failCreate)
          throw new Error('create')

        return {
          run: async (feeds) => {
            state.runs.push(feeds)

            if (failRun) throw new Error('run')

            return outputs ?? { out: { data: new Float32Array([0.5]) } }
          },
        }
      },
    },
  }

  return { ort, state }
}

const loaderOf = (mod) => async () => mod

describe('ort-engine', () => {
  beforeEach(() => resetMlEngine())

  test('window-less realm resolves null without importing', async () => {
    const saved = globalThis.window

    delete globalThis.window
    expect(await ensureOrt(loaderOf(makeOrt().ort))).toBeNull()
    globalThis.window = saved
  })

  test('stamped tiers below the es2025 floor never import the ORT chunk', async () => {
    let called = false
    const loader = async () => {
      called = true

      return makeOrt().ort
    }

    window[ML.WINDOW_TIER] = `${ML.TIER_PREFIX}2020`
    expect(await ensureOrt(loader)).toBeNull()

    window[ML.WINDOW_TIER] = 'ie'
    expect(await ensureOrt(loader)).toBeNull()
    expect(called).toBe(false)

    delete window[ML.WINDOW_TIER]
  })

  test('esnext and the es2025 floor tier still allow ML', async () => {
    const { ort } = makeOrt()

    window[ML.WINDOW_TIER] = ML.TIER_ESNEXT
    expect(await ensureOrt(loaderOf(ort))).toBe(ort)

    resetMlEngine()
    window[ML.WINDOW_TIER] = `${ML.TIER_PREFIX}${ML.MIN_ES_TIER}`
    expect(await ensureOrt(loaderOf(ort))).toBe(ort)

    delete window[ML.WINDOW_TIER]
  })

  test('ensureOrt configures wasmPaths, single thread, warn log level', async () => {
    const { ort } = makeOrt()

    expect(await ensureOrt(loaderOf(ort))).toBe(ort)
    expect(ort.env.wasm.wasmPaths).toBe(ASSET_PATHS.ORT_WASM_PREFIX)
    expect(ort.env.wasm.numThreads).toBe(1)
    expect(ort.env.logLevel).toBe(ML.ORT_LOG_LEVEL)
  })

  test('a failed import clears the latch so the next call retries', async () => {
    const { ort } = makeOrt()

    let first = true
    const flaky = async () => {
      if (first) {
        first = false

        throw new Error('network')
      }

      return ort
    }

    expect(await ensureOrt(flaky)).toBeNull()
    expect(await ensureOrt(flaky)).toBe(ort)
  })

  test('session caches by slug and requests the probed EP chain', async () => {
    const { ort, state } = makeOrt()

    const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator')

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { ml: {}, gpu: {} },
    })

    const s1 = await mlSession('intent', loaderOf(ort))
    const s2 = await mlSession('intent', loaderOf(ort))

    expect(s1).toBe(s2)
    expect(state.creates).toHaveLength(1)
    expect(state.creates[0].uri).toBe(
      `${ASSET_PATHS.ML_MODELS_PREFIX}intent${ML.MODEL_EXT}`
    )
    expect(state.creates[0].opts.executionProviders).toEqual([
      ML.EP_WEBNN,
      ML.EP_WEBGPU,
      ML.EP_WASM,
    ])
    expect(state.creates[0].opts.graphOptimizationLevel).toBe(ML_SESSION.OPT_ALL)

    if (nav) Object.defineProperty(globalThis, 'navigator', nav)
  })

  test('EP list omits webnn/webgpu when navigator lacks them', async () => {
    const { ort, state } = makeOrt()
    const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator')

    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} })

    await mlSession('frametime', loaderOf(ort))

    expect(state.creates[0].opts.executionProviders).toEqual([ML.EP_WASM])

    if (nav) Object.defineProperty(globalThis, 'navigator', nav)
  })

  test('EP list resolves wasm-only when navigator itself is absent', async () => {
    const { ort, state } = makeOrt()
    const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator')

    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: undefined })

    await mlSession('frametime', loaderOf(ort))

    expect(state.creates[0].opts.executionProviders).toEqual([ML.EP_WASM])

    if (nav) Object.defineProperty(globalThis, 'navigator', nav)
  })

  test('accelerated create failure retries wasm-only', async () => {
    const { ort, state } = makeOrt({ failCreate: 1 })

    expect(await mlSession('superres-2x', loaderOf(ort))).not.toBeNull()
    expect(state.creates).toHaveLength(2)
    expect(state.creates[1].opts.executionProviders).toEqual([ML.EP_WASM])
  })

  test('both create attempts failing resolves null', async () => {
    const { ort } = makeOrt({ failCreate: Infinity })

    expect(await mlSession('intent', loaderOf(ort))).toBeNull()
  })

  test('mlSession returns null when the runtime itself is unavailable', async () => {
    expect(await mlSession('intent', async () => null)).toBeNull()
    expect(await mlSession('intent', async () => {
      throw new Error('no chunk')
    })).toBeNull()
  })

  test('runMlModel wraps feeds in tensors and unwraps outputs', async () => {
    const outputs = { prob: { data: new Float32Array([0.83]) } }
    const { ort, state } = makeOrt({ outputs })

    const out = await runMlModel(
      ML.MODEL_INTENT,
      { [ML.IN_FEATURES]: { data: new Float32Array([1, 0, 1]), dims: [1, 3] } },
      loaderOf(ort)
    )

    expect(out.prob[0]).toBeCloseTo(0.83)
    expect(state.tensors[0].type).toBe(ML.TENSOR_FLOAT32)
    expect(state.tensors[0].dims).toEqual([1, 3])
  })

  test('runMlModel resolves null without runtime or session', async () => {
    const { ort } = makeOrt({ failCreate: Infinity })

    expect(await runMlModel(ML.MODEL_INTENT, {}, async () => null)).toBeNull()

    resetMlEngine()
    expect(await runMlModel(ML.MODEL_INTENT, {}, loaderOf(ort))).toBeNull()
  })

  test('runMlModel resolves null when session.run throws', async () => {
    const { ort } = makeOrt({ failRun: true })

    expect(
      await runMlModel(
        ML.MODEL_INTENT,
        { [ML.IN_FEATURES]: { data: new Float32Array([0, 0, 1]), dims: [1, 3] } },
        loaderOf(ort)
      )
    ).toBeNull()
  })

  test('default loader resolves through the module mapper stub', async () => {
    const ort = await ensureOrt()

    expect(ort?.InferenceSession?.create).toBeInstanceOf(Function)
    expect(ort?.env.wasm.wasmPaths).toBe(ASSET_PATHS.ORT_WASM_PREFIX)
  })

  test('resetMlEngine clears sessions so new probes re-create', async () => {
    const { ort, state } = makeOrt()

    await mlSession('diagram-cost', loaderOf(ort))
    resetMlEngine()
    await mlSession('diagram-cost', loaderOf(ort))

    expect(state.creates).toHaveLength(2)
  })
})
