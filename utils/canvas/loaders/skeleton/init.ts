/**
 * @file skeleton-init.ts — bootstrap for the skeleton layer: canvas
 * creation inside the component's shadow root, WebGPU wasm mount
 * (first-loading artifact), shared-renderer fallback acquire
 * (failure → pure-CSS shimmer fallback), resize observation, pool
 * registration, and the idle-deferred loop start.
 */

import { SKELETON_CLASSES } from '@core/tokens/classes/skeleton.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { WINDOW_EVENTS } from '@core/tokens/events/dom.js'
import { STATE_STRINGS } from '@core/tokens/strings/state.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { WEBGL_STRINGS } from '@core/tokens/strings/webgl.js'
import { GPU_WIDGET_DRIVE, GPU_WIDGET_KINDS } from '@core/tokens/motion/gpu-widgets.js'
import { hasWebGpu, mountWebGpuWidget, warmWidgetArtifacts } from '../../../gpu/webgpu-widget.js'
import { webglPool } from '../../webgl-pool.js'
import { skeletonRenderer } from './renderer.js'
import type { SkeletonWebGL } from '../skeleton-webgl.js'
import { SKELETON_RENDER, SKELETON_WARN } from '@core/tokens/motion/skeleton.js'

/**
 * Attaches the shared lifecycle every accelerated path uses once its
 * renderer is live: resize listener, host ResizeObserver, the
 * skeleton-layer class, first measure+paint, pool registration, and
 * the idle-deferred loop start.
 * @param host The layer whose canvas just gained a working backend.
 */
function activate(host: SkeletonWebGL): void {
  host.useWebGL = true

  window.addEventListener(WINDOW_EVENTS.RESIZE, host._onResize, { passive: true })

  // Host resize re-measures; per-placeholder observation is owned by
  // measureSkeleton() so re-rendered nodes stay tracked.
  if (typeof ResizeObserver !== TYPE_STRINGS.UNDEFINED) {
    host._ro = new ResizeObserver(() => host._scheduleRefresh())

    host._ro.observe(host.host)
  }

  host.host.classList.add(SKELETON_CLASSES.HAS_SKELETON_LAYER)

  host.refresh()

  // Paint one static field now — the placeholders are already transparent,
  // so waiting for the idle-deferred loop would flash an empty area.
  host._render(0, 0)

  // Off-screen layers stop rendering; they resume when scrolled into view
  if (host.canvas) webglPool.register(host.canvas, host)

  // Let first paint and the critical path finish before the field starts moving
  const begin = () => {
    host._idleId = null

    if (host.useWebGL && !host.animId) host._loop()
  }

  host._idleId =
    typeof requestIdleCallback === TYPE_STRINGS.FUNCTION
      ? requestIdleCallback(begin, { timeout: SKELETON_RENDER.START_DELAY })
      : (setTimeout(begin, SKELETON_RENDER.START_DELAY) as unknown as number)
}

/**
 * Fallback bootstrap — the shared WebGL renderer blitting into the
 * host's 2D canvas. Runs when WebGPU or the wasm artifact is absent;
 * a failed acquire falls through to the pure-CSS shimmer (the canvas
 * is simply dropped).
 * @param host The layer to bring up on the 2D path.
 */
function init2d(host: SkeletonWebGL): void {
  host.renderer = skeletonRenderer.acquire()

  const canvas = host.canvas

  host.ctx = canvas ? canvas.getContext(WEBGL_STRINGS.CONTEXT_2D) : null

  if (!host.renderer || !host.ctx) {
    if (host.renderer) skeletonRenderer.release()

    host.renderer = null

    host.canvas = null

    return
  }

  activate(host)
}

/** Boot: builds the overlay canvas, prefers the wasm artifact (the FIRST-loading crate — this is the loading placeholder itself), falls back to the shared 2D renderer, then the CSS shimmer. */
export function init(host: SkeletonWebGL): void {
  if (typeof document === TYPE_STRINGS.UNDEFINED) return

  // The skeleton artifact is the only eager one — warming it here
  // overlaps the fetch/compile with the mount round-trip.
  warmWidgetArtifacts()

  host.canvas = document.createElement(HTML_TAGS.CANVAS)

  host.canvas.className = SKELETON_CLASSES.SKELETON_LAYER

  host.canvas.setAttribute(SKELETON_WARN.ARIA_HIDDEN, STATE_STRINGS.TRUE)

  const canvas = host.canvas

  // No WebGPU at all → synchronous 2D fallback (the mount would
  // resolve null a microtask later anyway — running init2d now keeps
  // the first-paint path synchronous for legacy browsers).
  if (!hasWebGpu()) {
    init2d(host)

    return
  }

  // MANUAL drive: this layer already owns a frame-skip loop and a
  // resolve-out clock — the bridge must not start a second rAF or a
  // second resize observer. While the artifact loads the CSS shimmer
  // (always on the placeholders) covers the gap.
  void mountWebGpuWidget(GPU_WIDGET_KINDS.SKELETON, canvas, undefined, {
    drive: GPU_WIDGET_DRIVE.MANUAL,
  }).then((handle) => {
    // Abandoned: content resolved or the layer was destroyed before
    // the artifact arrived — never activate over live content.
    if (host._abandoned || host.canvas !== canvas) return

    if (!handle) {
      init2d(host)

      return
    }

    host._wasm = handle

    activate(host)
  })
}
