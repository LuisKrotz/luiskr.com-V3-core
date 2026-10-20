/**
 * @file tokens/motion/genie.ts
 * @description Expand-modal genie-warp tunables — the macOS-style liquid
 * collapse/expansion the media figure plays when the lightbox opens and
 * closes. Sole declaration site (zero-hardcoding rule): the 2D strip
 * renderer, the WebGPU widget uniforms, and the wasm crate's matching
 * constants all read the same numbers.
 *
 * Field model (shared verbatim by every backend — the per-row staggered
 * lerp the ui-layouts mac-genie reference implements): the field always
 * warps the MODAL rect (S) toward the FIGURE rect (D); the open
 * transition plays the identical funnel in reverse. Rows are indexed in
 * "down-space" — ty runs 0 at the sheet's far edge to 1 at the
 * figure-facing edge — and each row owns TWO staggered eased clocks:
 *   xs = (1−ty)·STAGGER_X   xe = easeInOutCubic(clamp((p−xs)/(1−xs)))
 *   ys = (1−ty)·STAGGER_Y   ye = easeInQuad(    clamp((p−ys)/(1−ys)))
 *     xL(ty) = lerp(S.x,     D.x,     xe)
 *     xR(ty) = lerp(S.x+S.w, D.x+D.w, xe)
 *     y(ty)  = farY + sgn·lerp(ty·S.h, iYfar + ty·iH, ye)
 * where iYfar is the far-edge → figure-far-edge distance and iH the
 * figure thickness — every row lands on its proportional row inside the
 * card at p=1 (the canonical 0-height mouth only suits a dock icon, so
 * the warped sheet converges exactly onto the card it hands off to).
 * The stagger is the whole effect: leading rows move first while far
 * rows wait out their delay, so the funnel's S-curved walls and the
 * "window flows through the neck" look emerge from the easing alone —
 * no sine bow, no shear term. Rows stay horizontal (y depends only on
 * ty), which is exactly what the strip renderer consumes. The last
 * quarter of the run paints a soft white radial flash at the figure's
 * center — the dock-impact punctation the reference ships.
 */

/**
 * Genie-warp shape constants. Frozen; consumers import members, never
 * redeclare the literals.
 */
export const GENIE_WARP = Object.freeze({
  /**
   * Strip tessellation cap — the scratch arrays size to STRIPS+1. The
   * per-frame band count is adaptive: sheet height ÷ STRIP_TARGET_PX,
   * floored at MIN_STRIPS and capped here. 256 bounds the buffers and
   * the worst-case draw cost; typical viewports land near 180 bands.
   */
  STRIPS: 256,
  /**
   * Target band height (CSS px) — the strip pitch. ≈5px per band keeps
   * the funnel's sloped walls raster-smooth on a 900px sheet (180
   * parallelogram draws ≈ 3.2ms of setTransform+drawImage on mid-range
   * hardware — inside the 4.16ms desktop frame slice); the previous
   * fixed 96 strips stair-stepped the walls at ~9px pitch.
   */
  STRIP_TARGET_PX: 5,
  /**
   * Floor band count — very small sheets still get enough rows for the
   * staggered field to read as a continuous funnel instead of a
   * handful of sliding bands.
   */
  MIN_STRIPS: 48,
  /**
   * Horizontal stagger — each row's x-clock starts at
   * (1−ty)·STAGGER_X of the run, so the figure-facing edge leads and
   * the far edge trails. 0.65 is the reference value: deep enough for
   * the walls to read as a liquid S-curve, shallow enough that the
   * trailing edge never feels abandoned.
   */
  STAGGER_X: 0.65,
  /**
   * Vertical stagger — same trick on the y-clock. Kept small (0.2 in
   * the reference): the collapse stays mostly uniform vertically while
   * the leading edge dips into the card first.
   */
  STAGGER_Y: 0.2,
  /**
   * Dock-flash window — the radial white burst at the figure's center
   * starts when funnel progress passes 0.75 and eases out (1−(1−t)²)
   * to GLOW_ALPHA as the sheet lands. Matches the reference's last
   * quarter accent.
   */
  GLOW_START: 0.75,
  /** Dock-flash peak alpha — subtle white bloom, never a hard flash. */
  GLOW_ALPHA: 0.3,
  /**
   * Dock-flash radius as a fraction of the figure's short edge — the
   * reference uses a fixed 55px around a 50px icon; scaling by the
   * card keeps the bloom proportional on large media figures.
   */
  GLOW_RADIUS_FRAC: 0.5,
  /**
   * Minimum drawn band height (CSS px). Contiguous bands can collapse
   * to zero/negative height where the funnel neck inverts the strip
   * order mid-flight; bands under it skip the draw (a sub-pixel sliver
   * is invisible anyway).
   */
  MIN_BAND_PX: 0.1,
  /**
   * Per-band overdraw (CSS px) on the parallelogram strip pass — each
   * band's quad is extended by this on its right wall and floor so the
   * antialiased seams between neighbours never open sub-pixel cracks
   * along the funnel's diagonal walls (opaque texture, so the double
   * paint is invisible).
   */
  EDGE_OVERDRAW_PX: 0.75,
  /**
   * Sheet-texture long-edge cap (device px) — the composited modal
   * surface bakes at min(dpr, TEX_MAX_PX / longest edge). 2560 keeps a
   * 1440p sheet at ~1.8× (crisp through the 700ms warp) without an
   * unbounded framebuffer on dpr-3 mobile.
   */
  TEX_MAX_PX: 2560,
})

/**
 * Progress driver — a duration clock over linear time. `p = opening ?
 * 1−raw : raw`: the close runs 0→1 (modal → figure) and the open
 * evaluates the identical field in time-reverse — the literal reverse
 * animation macOS plays on restore — so both directions share one
 * liquid surface. No global easing curve: the reference is linear-time
 * by design — the motion character lives entirely in the per-row
 * staggered eases (x rows ease-in-out, y rows ease-in so the suck
 * accelerates into the card).
 */
export const GENIE_TIMING = Object.freeze({
  /** Open run duration (ms). */
  OPEN_MS: 640,
  /** Close run duration (ms) — slightly longer, the suck needs runway. */
  CLOSE_MS: 700,
  /**
   * Per-frame integration step cap (seconds) — a suspended tab resumes
   * with a finite dt so the driver's frame ticks never lurch.
   */
  DT_MAX_S: 0.05,
  /**
   * Async GPU-mount budget (ms) — the WebGPU/Rust backend mounts
   * off-tick (wasm instantiate + shader compile); under throttle that
   * can outlast the whole transition and the watchdog would settle
   * before the first frame — the "blink" failure mode. The 2D backend
   * runs the identical field and attaches instantly, so the mount is
   * raced: GPU wins when it resolves inside this window, otherwise 2D
   * owns the run and the late renderer is disposed.
   */
  MOUNT_MS: 400,
  /**
   * Hard cap on the run (ms) — a wedged rAF or a pathological clock
   * can never latch the overlay; past this the session force-settles
   * and hands control back to the modal.
   */
  MAX_MS: 1400,
})

/**
 * Timing fallbacks — the degraded paths when the canvas route cannot
 * run (reduced motion, missing 2D context, widget mount failure).
 */
export const GENIE_FALLBACK = Object.freeze({
  /**
   * Open veil duration (ms) when the genie cannot play — matches the
   * legacy `modal-zoom-in` keyframe time so the fallback keeps the old
   * rhythm.
   */
  OPEN_MS: 450,
  /**
   * Close duration (ms) — matches the legacy `modal-zoom-out` keyframe
   * and the existing teardown delay in expanded/close.ts.
   */
  CLOSE_MS: 320,
})
