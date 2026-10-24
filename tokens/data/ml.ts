/**
 * @file tokens/data/ml.js
 * @description ONNX Runtime Web / WebNN engine tokens — sole declaration
 * site for the ML layer's model slugs, tensor names, execution-provider
 * order, and feature dimensions (zero-hardcoding rules 4–5).
 */

/**
 * Machine-learning runtime tokens — model registry, ONNX tensor names,
 * execution-provider preference strings, and the input-feature layouts
 * shared by the generator (`shared/scripts/build/gen-onnx-models.mjs`)
 * and the runtime feeders (`core/utils/ml/`). Object.freeze makes the
 * contract immutable; consumers never redeclare the literals.
 */
export const ML = Object.freeze({
  /** Execution-provider preference order — ORT picks the first live one. */
  EP_WEBNN: 'webnn',
  EP_WEBGPU: 'webgpu',
  EP_WASM: 'wasm',
  /** onnxruntime-web submodule specifier for the jsep (WebGPU+WebNN) bundle. */
  ORT_IMPORT_SPEC: 'onnxruntime-web/webgpu',
  /** ORT logLevel — devNoise off, real failures still surface. */
  ORT_LOG_LEVEL: 'warning',
  /** Tensor element type string ORT expects for float32 tensors. */
  TENSOR_FLOAT32: 'float32',
  /** Model file extension under the models prefix. */
  MODEL_EXT: '.onnx',
  /**
   * Model registry — slug → file under `/models/<slug>.onnx` emitted by
   * `gen-onnx-models.mjs`. Keep names stable: the manifest and the
   * runtime bind by slug.
   */
  MODEL_INTENT: 'intent',
  MODEL_FRAMETIME: 'frametime',
  MODEL_SUPERRES: 'superres-2x',
  MODEL_DIAGRAM: 'diagram-cost',
  /** Input tensor name shared by every generated model. */
  IN_FEATURES: 'features',
  /**
   * Super-res input cap — pixel marshaling runs on the main thread so
   * sources stay thumb-sized (≤512² px); larger media already has the
   * quality it needs.
   */
  SUPERRES_MAX_PIXELS: 262144,
  /** Super-resolution model's image tensor names + geometry. */
  IN_LR_IMAGE: 'lr',
  OUT_HR_IMAGE: 'hr',
  SUPERRES_SCALE: 2,
  /** Intent model feature layout: [hoverNorm, speedNorm, bias]. */
  INTENT_FEATURE_DIM: 3,
  /** Frametime model feature layout: 5-frame window + current quality. */
  FRAMETIME_FEATURE_DIM: 6,
  FRAMETIME_HISTORY: 5,
  /** Diagram-cost feature layout: [nodeCount, edgeCount, nesting, selfMsgs]. */
  DIAGRAM_FEATURE_DIM: 4,
  /** Output tensor names for the generated models. */
  OUT_PROBABILITY: 'prob',
  OUT_MS: 'ms',
  OUT_COST: 'cost',
  /**
   * Frame-time prediction normalization — inputs are clamped to
   * [0, FRAME_NORM_MS] then divided by it so the network sees 0–1.
   * 100ms covers a fully dropped long task without clipping real spikes.
   */
  FRAME_NORM_MS: 100,
  /** Inference cadence — one pass per N frames keeps ORT off the tick. */
  FRAMETIME_INFER_EVERY: 30,
  /** Predicted-ms thresholds (normalized /100) that move quality. */
  FRAME_BUDGET_HI: 0.17,
  FRAME_BUDGET_LO: 0.12,
  /** Quality bounds + step sizes — pixel-ratio multiplier 0.5–1.0. */
  QUALITY_MIN: 0.5,
  QUALITY_STEP_DOWN: 0.15,
  QUALITY_STEP_UP: 0.05,
  /** Diagram-cost: features normalized by these before inference. */
  DIAGRAM_NORM_NODES: 64,
  DIAGRAM_NORM_EDGES: 96,
  DIAGRAM_NORM_NEST: 4,
  DIAGRAM_NORM_SELF: 8,
  /** Render-time threshold (ms) above which a diagram defers to idle. */
  DIAGRAM_DEFER_MS: 24,
  /**
   * Minimum ES bundle tier for ML inference — the enhancements are
   * modern-browser-only progressive layers; the loader-stamped tier
   * (window.__LK_TIER) below this year never fetches the ORT chunk and
   * keeps the heuristic path. 'esnext' always qualifies.
   */
  MIN_ES_TIER: 2025,
  /** Tier-name prefix and the non-numeric newest tier name. */
  TIER_PREFIX: 'es',
  TIER_ESNEXT: 'esnext',
  /** Window property the ES5 browser-loader stamps with the picked tier name. */
  WINDOW_TIER: '__LK_TIER',
})

/**
 * Slugs pinned to the wasm EP — the interaction-path models (frametime
 * every 30 frames, diagram-cost mid-render). ORT's webgpu/webnn session
 * create issues synchronous pipeline-compile IPCs that can deadlock the
 * renderer main thread while the GPU process is busy (scene shader
 * compiles) — observed as a full-page freeze on docs routes with
 * mermaid blocks and on weak Android GPUs. These models are
 * single-layer MLPs: wasm answers in microseconds, so the accelerator
 * EPs buy nothing and only add contention. Larger/idle-time models
 * (intent, superres) keep the full webnn → webgpu → wasm chain.
 */
export const ML_WASM_EP_MODELS: ReadonlySet<string> = new Set([
  ML.MODEL_FRAMETIME,
  ML.MODEL_DIAGRAM,
])

/**
 * ORT session-option literal names — the `executionProviders` array and
 * `graphOptimizationLevel` enum value live here so no string is repeated
 * between the engine and its tests.
 */
export const ML_SESSION = Object.freeze({
  OPT_ALL: 'all',
  /** WebNN deviceType hint passed to the EP — matches npu-predict's probe. */
  WEBNN_DEVICE: 'npu',
})
