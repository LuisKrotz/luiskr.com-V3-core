/**
 * @file tokens/classes/gpu.js
 * @description WebGPU overlay class tokens — the dual-layer render canvas
 * from `rust/overlay` and its state modifiers. Grouped token group.
 */

import { _B_GPU_OVERLAY } from '../base.js'

/**
 * Frozen gpu-overlay class-name map — sole declaration site for these
 * tokens; consumers read members and never re-declare the strings
 * (zero-hardcoding rules 4–5). Object.freeze makes the token contract
 * immutable at runtime.
 */
export const GPU_OVERLAY_CLASSES = Object.freeze({
  /** Full-screen WebGPU canvas — painted layer of the dual-layer split. */
  GPU_OVERLAY: _B_GPU_OVERLAY,
  /** Present while the wasm module is live — gates pointer routing. */
  GPU_OVERLAY_ACTIVE: `${_B_GPU_OVERLAY}--active`,
})
