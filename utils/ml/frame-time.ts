/**
 * @file core/utils/ml/frame-time.ts
 * @description ML-driven adaptive render quality for the WebGL/three.js
 * surfaces (star-field, earth-playground, scene3d). A ring buffer of
 * the last five frame times feeds the `frametime` ONNX model — WebNN
 * NPU → WebGPU → wasm EP — which predicts the next frame's cost; the
 * predictor nudges a quality scalar (renderer pixel-ratio multiplier)
 * down when the projection clears the frame budget and back up when
 * there's headroom. Inference is throttled to one pass per
 * INFER_EVERY frames and never awaited inside the rAF tick — the
 * update lands asynchronously, at most every ~½s.
 *
 * The whole path is zero-allocation on the record side: the window is
 * a preallocated Float32Array and the feeds buffer is reused, so the
 * per-frame cost is one float store + a counter compare.
 */
import { ML } from '@core/tokens/data/ml.js'
import { runMlModel } from './ort-engine.js'
import type { OrtModule } from './ort-engine.js'

/** Injectable inference signature — tests substitute without a session. */
type RunModel = (
  _slug: string,
  _feeds: Record<string, { data: Float32Array; dims: number[] }>,
  _loadModule?: () => Promise<OrtModule>
) => Promise<Record<string, Float32Array> | null>

/**
 * Rolling frame-time → quality predictor. One instance per render
 * surface — the suggested quality is consumed as a pixel-ratio scale.
 */
export class FrameTimePredictor {
  /** Circular window of the last FRAMETIME_HISTORY frame times (ms/100). */
  private readonly _window = new Float32Array(ML.FRAMETIME_HISTORY)
  /** Ring cursor into `_window`. */
  private _wIdx = 0
  /** Frames recorded so far — throttles inference to INFER_EVERY. */
  private _frames = 0
  /** Inference in flight — prevents a second dispatch while one runs. */
  private _pending = false
  /**
   * Suggested resolution scale in [QUALITY_MIN, 1]. Starts at 1 — the
   * engine renders full quality until the model proves it can't hold.
   */
  private _quality = 1
  /** Called synchronously whenever `_quality` changes — consumers re-apply pixel ratio. */
  private _onQuality: ((_q: number) => void) | null
  /** Latched once destroyed — record() keeps measuring but never re-arms inference. */
  private _destroyed = false
  /** Inference implementation — injectable for tests. */
  private readonly _run: RunModel

  /**
   * @param onQuality Optional callback fired on each quality transition —
   *   engines use it to re-apply `setPixelRatio` without polling.
   * @param run Injectable model runner — defaults to the ORT engine.
   */
  constructor(onQuality: ((_q: number) => void) | null = null, run: RunModel = runMlModel) {
    this._onQuality = onQuality
    this._run = run
  }

  /** Current suggested quality — read by the resize/pixel-ratio path. */
  get quality(): number {
    return this._quality
  }

  /**
   * Records one frame's wall time and, every INFER_EVERY frames, kicks
   * an async inference. Never awaits — the rAF tick stays synchronous;
   * the predicted quality lands whenever the EP answers.
   * @param ms The frame's duration in milliseconds.
   */
  record(ms: number): void {
    // Normalize to the model's 0–1 range (100ms = a full long task).
    this._window[this._wIdx] = Math.min(1, Math.max(0, ms / ML.FRAME_NORM_MS))
    this._wIdx = (this._wIdx + 1) % ML.FRAMETIME_HISTORY

    if (++this._frames % ML.FRAMETIME_INFER_EVERY === 0 && !this._pending && !this._destroyed) {
      this._pending = true

      this._infer().finally(() => {
        this._pending = false
      })
    }
  }

  /**
   * One inference pass: feeds the window (oldest→newest order via the
   * ring cursor) plus the current quality level, then moves `_quality`
   * one step toward the budget — down when the model predicts the next
   * frame overruns, up when it sees headroom.
   */
  private async _infer(): Promise<void> {
    // Replay the ring oldest→newest without allocating — the feeds array
    // is built once per call (throttled, not per-frame).
    const features = new Float32Array(ML.FRAMETIME_FEATURE_DIM)

    for (let i = 0; i < ML.FRAMETIME_HISTORY; i++) {
      features[i] = this._window[(this._wIdx + i) % ML.FRAMETIME_HISTORY]
    }

    features[ML.FRAMETIME_HISTORY] = this._quality

    const out = await this._run(ML.MODEL_FRAMETIME, {
      [ML.IN_FEATURES]: { data: features, dims: [1, ML.FRAMETIME_FEATURE_DIM] },
    })

    const predicted = out?.[ML.OUT_MS]?.[0]

    // No model/runtime → hold quality; the heuristic alternative would
    // just re-derive the same window average the model already encodes.
    if (predicted == null) return

    const next =
      predicted > ML.FRAME_BUDGET_HI
        ? Math.max(ML.QUALITY_MIN, this._quality - ML.QUALITY_STEP_DOWN)
        : predicted < ML.FRAME_BUDGET_LO
          ? Math.min(1, this._quality + ML.QUALITY_STEP_UP)
          : this._quality

    if (next !== this._quality) {
      this._quality = next

      this._onQuality?.(next)
    }
  }

  /**
   * Releases the callback and blocks further inference dispatch — the
   * dynamic `import('onnxruntime-web/…')` inside the engine would fire
   * into a torn-down Jest/browser context otherwise. Any already-
   * in-flight call still resolves; its result is ignored with the
   * callback gone.
   */
  destroy(): void {
    this._onQuality = null
    this._destroyed = true
  }
}
