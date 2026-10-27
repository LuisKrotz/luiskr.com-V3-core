/**
 * @file utils/motion/frame.ts
 * @description Shared frame scheduler — one requestAnimationFrame pump
 * serves every animation loop on the page instead of each widget arming
 * its own handle. Callers use `request(cb)`/`cancel(id)` exactly like
 * the native pair: `request` returns a numeric id that remains valid
 * until its callback runs or is cancelled, so existing `animId: number
 * | null` fields migrate without a type change.
 *
 * Semantics preserved from rAF:
 * - A callback that re-requests inside the pump lands on the NEXT frame
 *   (the pump drains a snapshot — self-rearming loops cannot recurse
 *   inside one frame).
 * - Cancelling a callback that has not yet run in the current drain
 *   skips it; cancelling a future-frame entry removes it before the
 *   next pump.
 * - The pump stops entirely when the queue empties — an idle page holds
 *   no armed rAF, and a hidden tab suspends naturally because the
 *   browser stops firing rAF.
 *
 * The hot path is zero-allocation: two parallel arrays (`ids`/`cbs`)
 * with in-place compaction each pump; `cancel` null-marks the slot so
 * it is safe mid-drain and the compactor drops it. No per-request
 * objects are created.
 */

import { isScrolling } from './scroll-state.js'

/** A per-frame callback — receives the pump's DOMHighResTimeStamp. */
export type FrameCallback = (now: number) => void

/**
 * Reports a frame-callback failure the way native rAF would — as an
 * uncaught error — but asynchronously, from a fresh task, so the throw
 * cannot abort the pump's own drain. Native rAF invokes every callback
 * in isolation: one failing loop kills only itself, never the frame or
 * its siblings. The pool must preserve that contract: a pooled
 * scheduler that lets an exception escape its drain would leak the
 * whole queue (the thrower's slot is never compacted, every revival
 * re-runs and re-dies on it, and re-arming widgets pile up behind it —
 * observed in production as rhythmic second-long main-thread stalls).
 * @param err The failure the callback raised.
 */
const rethrowAsync = (err: unknown): void => {
  setTimeout(() => {
    throw err
  })
}

/** Virtual id sequence — monotonic so a stale id can never alias a live slot. */
let seq = 0

/** Parallel arrays: virtual ids and their callbacks (null = cancelled, pending compaction). */
const ids: number[] = []

const cbs: Array<FrameCallback | null> = []

/** The single armed rAF handle — 0 when the pump is idle or mid-drain. */
let rafId = 0

/**
 * Arms the single underlying requestAnimationFrame if the pump is not
 * already scheduled. Called from `request` and from the drain when
 * callbacks remain for the next frame.
 */
const arm = (): void => {
  if (!rafId) rafId = requestAnimationFrame(pump)
}

/**
 * One pump: invokes every callback queued for this frame with the same
 * timestamp, then compacts. The drain snapshots the length — callbacks
 * pushed during the pass (self-rearming loops) land in the tail and
 * survive to the next pump, never re-entering this frame. The consumed
 * head slice is dropped wholesale: cancel-marks inside it are already
 * irrelevant (the slot either ran or was skipped), so the only
 * compaction needed is the tail copy — which also drops tail entries
 * cancelled mid-drain.
 * @param now The rAF timestamp shared by every callback this frame.
 */
const pump = (now: number): void => {
  rafId = 0

  // Scroll gestures own the frame budget: freeze every queued tick
  // until the gesture settles. Callbacks keep their queue slots, so
  // loops resume seamlessly on the first settled pump — the same
  // position the media/carousel deferrals take (nothing decodes,
  // mounts, or animates against an active fling).
  if (isScrolling()) {
    arm()

    return
  }

  const n = cbs.length

  try {
    for (let i = 0; i < n; i++) {
      const cb = cbs[i]

      if (cb === null) continue

      // Consume before invoking — a throwing callback is spent either
      // way (native parity: its loop dies with it) and must not be
      // re-run by a later revival. The head slice is dropped wholesale
      // by the compactor below, so this write is the only marker needed.
      cbs[i] = null

      try {
        cb(now)
      } catch (err) {
        rethrowAsync(err)
      }
    }
  } finally {
    // Compaction and re-arm are unconditional — the scheduler is a
    // shared resource; it must survive any state the drain leaves.
    let w = 0

    for (let i = n; i < cbs.length; i++) {
      const cb = cbs[i]

      if (cb !== null) {
        ids[w] = ids[i]
        cbs[w] = cb
        w++
      }
    }

    ids.length = w
    cbs.length = w

    if (w) arm()
  }
}

/**
 * Shared frame scheduler — the single rAF pump every animation loop
 * registers with. Mirrors the requestAnimationFrame/cancelAnimationFrame
 * contract so call sites migrate one-for-one (`animId` stays a number).
 */
export const framePool = {
  /**
   * Queues `cb` to run on the next frame pump, arming the underlying
   * rAF if the pool was idle.
   * @param cb The frame callback — receives the shared pump timestamp.
   * @returns A virtual frame id usable with `framePool.cancel`.
   */
  request(cb: FrameCallback): number {
    ids.push(++seq)
    cbs.push(cb)

    arm()

    return seq
  },

  /**
   * Cancels a queued callback by its virtual id. Null-marks the slot so
   * cancellation is safe from inside a running pump; the compactor
   * reclaims it on the next pass. Cancelling a stale or already-run id
   * is a no-op.
   * @param id The id returned by `framePool.request`.
   */
  cancel(id: number): void {
    const i = ids.indexOf(id)

    if (i >= 0) cbs[i] = null
  },

  /**
   * Current queue depth — live plus null-marked slots awaiting
   * compaction. Exported for scheduler diagnostics/tests; the number of
   * armed rAFs is always 0 or 1 regardless of this value.
   * @returns Pending callback count.
   */
  size(): number {
    return cbs.length
  },

  /**
   * Runs one pump pass synchronously when the pool is armed or callbacks
   * are queued — a test hook for environments whose rAF never ticks, or
   * where a fake rAF queue must take over a pump armed before the fake
   * installed. Harmless when the real pump fires later: draining an
   * empty queue is a no-op.
   * @param now The frame timestamp handed to the drained callbacks.
   */
  flush(now: number): void {
    if (rafId || cbs.length) pump(now)
  },
}
