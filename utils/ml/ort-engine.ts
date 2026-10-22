/**
 * @file core/utils/ml/ort-engine.ts
 * @description Lazy ONNX Runtime Web engine — the single entry point
 * for all ML inference on the site. Loads `onnxruntime-web/webgpu` via
 * dynamic import so the ~1MB JS bundle and its wasm binaries stay off
 * the critical path until the first real prediction, then caches one
 * InferenceSession per model slug.
 *
 * Execution-provider chain: WebNN NPU → WebGPU → WASM SIMD — ORT picks
 * the first live target; when `navigator.ml`/`navigator.gpu` are absent
 * those EPs are never requested, so unsupported browsers take the wasm
 * path with no failed-probe cost. wasm binaries are served from
 * `/ort/` (public dir, immutable-cacheable) via `env.wasm.wasmPaths`.
 *
 * Everything resolves `null` on failure — callers keep their heuristic
 * fallbacks and never need try/catch around inference itself.
 */
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { ASSET_PATHS } from '@core/tokens/routes/paths.js'
import { ML, ML_SESSION } from '@core/tokens/data/ml.js'
import { devWarn } from '@core/devlog.js'

/** Minimal ORT tensor surface this engine creates and reads back. */
interface OrtTensorLike {
  /** Backing buffer — float32 for every model this project ships. */
  data: Float32Array
}

/** Minimal InferenceSession surface used by the engine. */
interface OrtSessionLike {
  /** Executes one inference pass; resolves the output-name → tensor map. */
  run: (_feeds: Record<string, unknown>) => Promise<Record<string, OrtTensorLike>>
}

/** Minimal ORT module surface — the parts of `onnxruntime-web` in use. */
export interface OrtModule {
  /** Session factory. */
  InferenceSession: {
    create: (
      _uri: string,
      _opts: { executionProviders: string[]; graphOptimizationLevel: string }
    ) => Promise<OrtSessionLike>
  }
  /** Tensor constructor — (type, data, dims). */
  Tensor: new (_type: string, _data: Float32Array, _dims: number[]) => unknown
  /** Runtime env — wasmPaths points ORT at `/ort/`. */
  env: {
    wasm: { wasmPaths: string; numThreads: number }
    logLevel: string
  }
}

/** WebNN probe surface — `navigator.ml` presence gates the 'webnn' EP. */
interface MlNavigator {
  ml?: unknown
  gpu?: unknown
}

/** Loader-stamped ES tier surface — `browser-loader.js` writes `window.__LK_TIER`. */
interface TieredWindow {
  [key: string]: string | undefined
}

/** Feeds entry — raw data + dims; the engine wraps it in an ort Tensor. */
export interface MlFeed {
  data: Float32Array
  dims: number[]
}

/** Named output buffers from one inference pass (or null on failure). */
export type MlOutputs = Record<string, Float32Array> | null

/** Cached runtime module promise — one dynamic import for the session. */
let ortModule: Promise<OrtModule | null> | null = null

/** Model slug → live session promise; sessions are created at most once. */
const sessionCache = new Map<string, Promise<OrtSessionLike | null>>()

/**
 * Default ORT loader — dynamic-imports the jsep bundle (`webgpu` +
 * `webnn` + `wasm` EPs). Vite code-splits it into a lazy chunk; the
 * specifier is a token-level constant for jest module mocking.
 * @returns The onnxruntime-web module namespace.
 */
const defaultOrtLoader = async (): Promise<OrtModule> =>
  (await import('onnxruntime-web/webgpu')) as unknown as OrtModule

/**
 * Modern-tier gate — ML inference is a progressive enhancement reserved
 * for es2025+ bundles. The loader stamps `window.__LK_TIER` with the
 * picked tier name ('esnext' always qualifies; `es<year>` qualifies at
 * `ML.MIN_ES_TIER` and up). When the stamp is absent (dev server,
 * prerender, tests) ML stays allowed — the EP capability probes remain
 * the real gate. A stamped older tier returns false so the ~1MB ORT
 * chunk is never fetched and callers keep their heuristic paths with
 * zero polyfills.
 * @returns true when ML inference may run on this browser tier.
 */
const mlTierAllowed = (): boolean => {
  // ensureOrt already proves `window` exists before calling — no re-guard.
  const tier = (window as unknown as TieredWindow)[ML.WINDOW_TIER]

  if (!tier || tier === ML.TIER_ESNEXT) return true

  const year = Number(tier.replace(ML.TIER_PREFIX, CHAR_STRINGS.EMPTY))

  return Number.isFinite(year) && year >= ML.MIN_ES_TIER
}

/**
 * Lazily imports and configures the ORT runtime — wasm binary paths,
 * single wasm thread (the models are tiny; the proxy worker isn't worth
 * a thread slot), and warning-level logging. Concurrent callers share
 * the first attempt; a rejected load clears the latch so a transient
 * failure doesn't permanently disable ML for the session.
 * @param loadModule Injectable loader — tests substitute a stub module.
 * @returns The configured ORT module, or null when unavailable.
 */
export const ensureOrt = async (
  loadModule: () => Promise<OrtModule> = defaultOrtLoader
): Promise<OrtModule | null> => {
  if (typeof window === TYPE_STRINGS.UNDEFINED || !mlTierAllowed()) return null

  ortModule ??= loadModule().then((ort) => {
    ort.env.wasm.wasmPaths = ASSET_PATHS.ORT_WASM_PREFIX

    ort.env.wasm.numThreads = 1

    ort.env.logLevel = ML.ORT_LOG_LEVEL

    return ort
  })

  let ort: OrtModule | null

  try {
    ort = await ortModule
  } catch (err) {
    ortModule = null

    devWarn('ort engine: runtime import failed', err)

    return null
  }

  return ort
}

/**
 * Builds the execution-provider list for this device: `webnn` only when
 * `navigator.ml` exists, `webgpu` only when `navigator.gpu` exists, and
 * `wasm` always last so an unsupported accelerator can't block a session.
 * @returns EP names in preference order.
 */
const executionProviders = (): string[] => {
  const nav = (typeof navigator !== TYPE_STRINGS.UNDEFINED ? navigator : undefined) as
    (Navigator & MlNavigator) | undefined

  const eps: string[] = []

  if (nav?.ml) eps.push(ML.EP_WEBNN)
  if (nav?.gpu) eps.push(ML.EP_WEBGPU)

  eps.push(ML.EP_WASM)

  return eps
}

/**
 * Creates (and caches) the InferenceSession for a model slug. First
 * tries the full EP chain; if the accelerator session throws (e.g. a
 * WebNN driver rejects the graph) it retries wasm-only before giving
 * up — a broken NPU path must not take the model down with it.
 * @param slug Model slug from `ML.MODEL_*` — resolves to `/models/<slug>.onnx`.
 * @param loadModule Injectable ORT loader (forwarded to ensureOrt).
 * @returns The session, or null when every EP failed.
 */
export const mlSession = async (
  slug: string,
  loadModule?: () => Promise<OrtModule>
): Promise<OrtSessionLike | null> => {
  const cached = sessionCache.get(slug)

  if (cached) return cached

  const pending = (async () => {
    const ort = await ensureOrt(loadModule)

    if (!ort) return null

    const uri = `${ASSET_PATHS.ML_MODELS_PREFIX}${slug}${ML.MODEL_EXT}`

    const opts = {
      executionProviders: executionProviders(),
      graphOptimizationLevel: ML_SESSION.OPT_ALL,
    }

    try {
      return await ort.InferenceSession.create(uri, opts)
    } catch (err) {
      devWarn(`ort engine: accelerated session failed for ${slug}`, err)
    }

    try {
      return await ort.InferenceSession.create(uri, {
        ...opts,
        executionProviders: [ML.EP_WASM],
      })
    } catch (err) {
      devWarn(`ort engine: wasm session failed for ${slug}`, err)

      return null
    }
  })()

  sessionCache.set(slug, pending)

  return pending
}

/**
 * Runs one inference pass: wraps each feed in an ORT tensor, executes
 * the session, and unwraps the outputs into plain Float32Arrays.
 * @param slug Model slug — session is lazily created on first use.
 * @param feeds Input-name → {data,dims} map.
 * @param loadModule Injectable ORT loader — tests substitute a stub.
 * @returns Output-name → Float32Array, or null on any failure.
 */
export const runMlModel = async (
  slug: string,
  feeds: Record<string, MlFeed>,
  loadModule?: () => Promise<OrtModule>
): Promise<MlOutputs> => {
  const ort = await ensureOrt(loadModule)

  if (!ort) return null

  const session = await mlSession(slug, loadModule)

  if (!session) return null

  const tensors: Record<string, unknown> = {}

  for (const name of Object.keys(feeds)) {
    tensors[name] = new ort.Tensor(ML.TENSOR_FLOAT32, feeds[name].data, feeds[name].dims)
  }

  try {
    const results = await session.run(tensors)

    const out: Record<string, Float32Array> = {}

    for (const name of Object.keys(results)) out[name] = results[name].data

    return out
  } catch (err) {
    devWarn(`ort engine: inference failed for ${slug}`, err)

    return null
  }
}

/**
 * Test/HMR teardown — drops cached sessions and the module latch so a
 * fresh realm re-probes hardware instead of inheriting stale sessions.
 */
export const resetMlEngine = (): void => {
  ortModule = null

  sessionCache.clear()
}
