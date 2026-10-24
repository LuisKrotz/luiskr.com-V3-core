/**
 * @file tokens/classes/print.js
 * @description Print-mode class tokens — injected by core/utils/print/print.ts
 * and styled by core/sass/base/structure/_print.scss. Sole declaration site —
 * consumers import members rather than re-declaring the literals
 * (zero-hardcoding rules 4–5).
 */

/**
 * Frozen print class-name map — the runtime swaps non-printable surfaces
 * (canvases, videos) for static <img> stand-ins on beforeprint and tags both
 * sides so the print sheet can flip them.
 */
export const PRINT_CLASSES = Object.freeze({
  /** Static <img> stand-in injected next to a canvas/video for print. */
  COPY: 'print-copy',
  /** Marks the live canvas/video the copy replaces — hidden only on paper. */
  SRC: 'print-src',
})
