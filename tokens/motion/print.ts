/**
 * @file tokens/motion/print.js
 * @description Print-lifecycle timing tokens.
 */

/**
 * Print-lifecycle timing tokens. Sole declaration site — consumers import
 * members from this frozen map rather than re-declaring the literals
 * (zero-hardcoding rule).
 */
export const PRINT_TIMING = Object.freeze({
  /**
   * Debounce (ms) for the matchMedia('print') → false teardown. Chromium's
   * print pipeline toggles the query off mid-job for a beat (~150ms
   * observed between the false and re-armed true edges) before re-applying
   * it for the real render — a synchronous exit() on that edge erases the
   * prepared DOM while pagination is still snapshotting it, collapsing the
   * job to its first sheet. The window must outlast the flicker; a genuine
   * job end leaves the query false so the deferred check still tears down,
   * and engines that fire afterprint never wait on it at all.
   */
  MM_EXIT_DEBOUNCE: 500,

  /**
   * Failsafe (ms) on the gated print entry's decode barrier. Ctrl/Cmd+P
   * and window.print are intercepted so the dialog opens only after
   * every kicked image fetch/decode and pending font load settles —
   * that is what makes the preview identical every time instead of
   * racing whichever multi-megabyte rungs happen to land first. The
   * wait is deliberately generous (the user accepted a slow preview for
   * guaranteed assets) but capped: a wedged network request must not
   * freeze the feature forever, it just degrades that one image to
   * whatever the fetch managed. The window doubles as the barrier's
   * no-progress quiet: a media index pulling a hundred cold originals
   * through a throttled edge can legitimately spend a minute on its
   * first six connection slots before the tail queue starts landing —
   * "still" only honestly means "stalled" past this.
   */
  PREP_CAP: 90000,

  /**
   * Hard ceiling (ms) on the gated entry's pending-job barrier. PREP_CAP
   * is the no-progress bail (a wedged fetch releases the job), while the
   * barrier keeps waiting as long as tracked work keeps settling — a
   * media index legitimately queues hundreds of CDN decodes, and a flat
   * cap would release it half-loaded. PREP_CAP_HARD is the outer wall so
   * a slow-but-steady bag still can't hold the dialog forever — five
   * minutes covers the sitemap's ~500MB cold-original wall on a degraded
   * edge; anything beyond is a wedge the quiet bail already caught.
   */
  PREP_CAP_HARD: 300000,

  /**
   * Poll tick (ms) for the gated entry's settle loop — the interval
   * between composed-tree sweeps that decide whether lazy content has
   * finished mounting (skeleton hosts gone, figure layers resolved).
   */
  SETTLE_TICK: 150,

  /**
   * Consecutive quiet ticks the settle loop requires before it trusts
   * the DOM — a single still sweep can fall between a data land and its
   * re-render, so the quiet streak must survive a few frames.
   */
  SETTLE_QUIET_TICKS: 4,

  /**
   * Grace (ms) after nativePrint() for a real print channel to engage —
   * the beforeprint listener or the matchMedia true edge. Engines can
   * swallow the call outright (headless shells, throttled programmatic
   * print, a blocked activation): nothing then ever dispatches the
   * afterprint the committed DOM needs to unwind, so the job restores
   * the page by hand instead of stranding it in its print face.
   */
  DIALOG_GRACE: 2000,

  /**
   * Grace (ms) a pending beforeprint may wait for its media apply before
   * the matchMedia false-edge teardown may fire. Chromium's headless
   * print jobs fire beforeprint well ahead of flipping matchMedia('print')
   * — the wrapped window.print's own instant teardown emits a false edge
   * inside that gap, and a recheck that only reads the live query finds
   * it legitimately false while a second job (CDP printToPDF) is already
   * in flight. Re-arming the debounce while the beforeprint is this fresh
   * waits the apply out; past the grace nothing ever applied, so the
   * job end is real and teardown proceeds.
   */
  MM_APPLY_GRACE: 4000,
})
