/**
 * @file skeleton-loop.ts — the skeleton layer's render loop and resolve
 * sequence: frame-skipped RAF (the drift is slow by design), reduced-
 * motion static frames, and the resolve-out that tears the layer down
 * once content has arrived.
 */

import { SKELETON_CLASSES } from '@core/tokens/classes/skeleton.js'
import store from '@core/store.js'
import { framePool } from '../../../motion/frame.js'
import type { SkeletonWebGL } from '../skeleton-webgl.js'
import { SKELETON_RENDER, SKELETON_RESOLVE } from '@core/tokens/motion/skeleton.js'

/** Uploads the latest geometry + theme to shader uniforms. */
export function upload(host: SkeletonWebGL): void {
  host.rects.forEach((b, i) => {
    host.rectData.set(
      [
        (b.x - host.origin.x) * host.dpr,
        (b.y - host.origin.y) * host.dpr,
        b.w * host.dpr,
        b.h * host.dpr,
      ],
      i * 4
    )

    host.metaData.set([b.radius * host.dpr, b.cell * host.dpr, b.row * host.dpr, 0], i * 4)

    host.skelBaseData.set([b.base[0], b.base[1], b.base[2], 1], i * 4)

    host.skelInkData.set([b.ink[0], b.ink[1], b.ink[2], 1], i * 4)

    if (host._wasm) {
      // Wasm sheet: same four vec4 rows, interleaved 16 f32s per rect —
      // [rect, meta, sbase, sink] device-px geometry + palettes.
      const o = i * 16

      host.sheetData.set(host.rectData.subarray(i * 4, i * 4 + 4), o)

      host.sheetData.set(host.metaData.subarray(i * 4, i * 4 + 4), o + 4)

      host.sheetData.set(host.skelBaseData.subarray(i * 4, i * 4 + 4), o + 8)

      host.sheetData.set(host.skelInkData.subarray(i * 4, i * 4 + 4), o + 12)
    }
  })

  const w = host._wasm?.widget as { write_sheet?: (v: Float32Array) => void } | undefined

  w?.write_sheet?.(host.sheetData)
}

/** rAF callback — animates the shimmer until resolved. */
export function loop(host: SkeletonWebGL): void {
  if (!host.useWebGL) return

  host.animId = framePool.request(host._frameTick)

  // The field is slow by design: a reduced frame rate is invisible and cuts the cost
  host._frame += 1

  if (host._frame % SKELETON_RENDER.FRAME_SKIP && !host.resolveStart) return

  if (host._paused && !host.resolveStart) return

  const now = performance.now()

  const reduced = store.getters.getReducedMotion()

  const t = reduced ? 0 : (now - host.startTime) * 0.001

  const resolve = host.resolveStart
    ? Math.min(1, (now - host.resolveStart) / SKELETON_RESOLVE.RESOLVE_DURATION)
    : 0

  host._render(t, resolve)

  if (host.resolveStart && resolve >= 1) {
    host.destroy()

    return
  }

  // Static frame is enough under reduced motion; keep looping only while resolving
  if (reduced && !host.resolveStart) {
    framePool.cancel(host.animId)

    host.animId = null
  }
}

/** Renders a frame via the live backend — wasm widget or shared 2D renderer. */
export function render(host: SkeletonWebGL, t: number, resolve: number): void {
  if (!host.canvas?.width || !host.canvas.height || !host.rects.length) return

  if (host._wasm) {
    const w = host._wasm.widget as {
      set_state?: (r: number, a: number, c: number) => void
      frame?: (dt: number) => void
    }

    // dt = time since the last PAINTED frame — frame-skip means loop
    // ticks ≠ paints, and the crate accumulates its own clock.
    const dt = host._wasmT ? t - host._wasmT : t

    host._wasmT = t

    // resolve + ink alpha + live count → uniform; frame(dt) paints.
    w.set_state?.(resolve, host.inkAlpha, host.rects.length)

    w.frame?.(dt)

    return
  }

  if (!host.renderer?.gl) {
    host.destroy()

    return
  }

  host.renderer.draw(host, t, resolve)
}

/**
 * Content has arrived: fades the real content in, plays the shimmer
 * resolve-out animation, then tears down and releases the shared GL
 * context back to the pool.
 */
export function resolve(host: SkeletonWebGL): void {
  // Freshly-mounted content fades in even on the CSS-fallback path
  if (!host.resolveStart && host.content) {
    host.content.classList.add(SKELETON_CLASSES.SKELETON_CONTENT_IN)

    // One-shot helper animation — remove so later updates do not re-fade
    setTimeout(
      () => host.content?.classList.remove(SKELETON_CLASSES.SKELETON_CONTENT_IN),
      SKELETON_RESOLVE.RESOLVE_DURATION
    )
  }

  if (!host.useWebGL || host.resolveStart) {
    // Content resolved before an accelerated backend came up — latch
    // the layer dead so a late wasm mount can never activate over it.
    if (!host.useWebGL) host._abandoned = true

    return
  }

  host.resolveStart = performance.now()

  host.canvas?.classList.add(SKELETON_CLASSES.SKELETON_LAYER_RESOLVING)

  if (!host.animId) host._loop()
}
