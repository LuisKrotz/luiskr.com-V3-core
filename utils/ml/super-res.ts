/**
 * @file core/utils/ml/super-res.ts
 * @description ML super-resolution — when the manifest's highest proven
 * quality rung is still below the render box, `upscaleImage2x` runs the
 * `superres-2x` ONNX model (Conv+DepthToSpace bicubic-class filter,
 * WebNN → WebGPU → wasm EP) and returns a 2× ImageBitmap that uploads
 * to the GPU texture layer zero-copy. Strictly an enhancement layer:
 * every failure resolves null and the caller keeps the confirmed rung.
 *
 * The pixel marshaling is honest about cost — the readback/pack/unpack
 * loops run on the main thread, so inputs are hard-capped at
 * SUPERRES_MAX_PIXELS (thumbs/q50 territory, exactly where enhancement
 * matters); anything larger skips straight to null.
 */
import { ML } from '@core/tokens/data/ml.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { devWarn } from '@core/devlog.js'
import { runMlModel } from './ort-engine.js'
import type { OrtModule } from './ort-engine.js'

/** Injectable inference signature — tests substitute without a session. */
type RunModel = (
  _slug: string,
  _feeds: Record<string, { data: Float32Array; dims: number[] }>,
  _loadModule?: () => Promise<OrtModule>
) => Promise<Record<string, Float32Array> | null>

/** Anything with drawable dimensions — Image, ImageBitmap, video frame. */
type Drawable = HTMLImageElement | ImageBitmap | HTMLVideoElement | HTMLCanvasElement

/** Scratch canvas reused across calls — no per-upscale element churn. */
let scratch: HTMLCanvasElement | null = null

/** Reads the drawable's intrinsic pixel size across element kinds. */
const dimsOf = (img: Drawable): { w: number; h: number } => {
  const el = img as HTMLImageElement & HTMLVideoElement & { width?: number; height?: number }

  return {
    w: el.naturalWidth ?? el.videoWidth ?? el.width ?? 0,
    h: el.naturalHeight ?? el.videoHeight ?? el.height ?? 0,
  }
}

/**
 * Runs the 2× super-resolution model over a confirmed-but-low-quality
 * source. Pixel flow: scratch canvas → RGBA readback → NCHW float32
 * (0–1) → ORT inference → ImageData at 2× → ImageBitmap ready for
 * `gpuAccel.processBitmapGPU`. Resolves null on every failure arm —
 * missing canvas/2d, oversized input, no runtime, bad output length —
 * so the caller's confirmed rung is never at risk.
 * @param img The best confirmed source element.
 * @param run Injectable model runner — defaults to the ORT engine.
 * @returns The 2× bitmap, or null when enhancement isn't possible.
 */
export const upscaleImage2x = async (
  img: Drawable | null,
  run: RunModel = runMlModel
): Promise<ImageBitmap | null> => {
  if (!img || typeof document === TYPE_STRINGS.UNDEFINED) return null
  if (typeof createImageBitmap !== TYPE_STRINGS.FUNCTION) return null

  const { w, h } = dimsOf(img)

  if (!w || !h || w * h > ML.SUPERRES_MAX_PIXELS) return null

  scratch ??= document.createElement('canvas')

  scratch.width = w
  scratch.height = h

  const ctx = scratch.getContext('2d', { willReadFrequently: true })

  if (!ctx) return null

  try {
    ctx.drawImage(img, 0, 0)
  } catch (err) {
    devWarn('super-res: drawImage failed', err)

    return null
  }

  const src = ctx.getImageData(0, 0, w, h).data

  // RGBA → planar float32 NCHW, normalized 0–1 — the layout the model's
  // Conv consumes ([1,3,H,W]).
  const px = w * h
  const nchw = new Float32Array(px * 3)

  for (let i = 0; i < px; i++) {
    nchw[i] = src[i * 4] / 255
    nchw[px + i] = src[i * 4 + 1] / 255
    nchw[px * 2 + i] = src[i * 4 + 2] / 255
  }

  const out = await run(ML.MODEL_SUPERRES, {
    [ML.IN_LR_IMAGE]: { data: nchw, dims: [1, 3, h, w] },
  })

  const hr = out?.[ML.OUT_HR_IMAGE]
  const w2 = w * ML.SUPERRES_SCALE
  const h2 = h * ML.SUPERRES_SCALE
  const px2 = w2 * h2

  if (!hr || hr.length !== px2 * 3) return null

  // Planar float32 → interleaved RGBA8 with clamping.
  const rgba = new Uint8ClampedArray(px2 * 4)

  for (let i = 0; i < px2; i++) {
    rgba[i * 4] = hr[i] * 255
    rgba[i * 4 + 1] = hr[px2 + i] * 255
    rgba[i * 4 + 2] = hr[px2 * 2 + i] * 255
    rgba[i * 4 + 3] = 255
  }

  scratch.width = w2
  scratch.height = h2
  ctx.putImageData(new ImageData(rgba, w2, h2), 0, 0)

  try {
    return await createImageBitmap(scratch)
  } catch (err) {
    devWarn('super-res: bitmap creation failed', err)

    return null
  }
}
