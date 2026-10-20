/**
 * @file tokens/motion/carousel.js
 * @description Carousel timing/geometry tokens — grouped subsets of
 * CAROUSEL.
 */

/**
 * Carousel timing/geometry tokens. Sole declaration site — consumers import members
 * from this frozen map rather than re-declaring the literals
 * (zero-hardcoding rule).
 */
export const CAROUSEL_TIMING = Object.freeze({
  /** Autoplay interval in milliseconds before advancing to next slide */
  AUTOPLAY_DURATION: 5000,
  /**
   * Clone→real teleport watchdog (ms). The scroll spring's settle
   * callback normally fires the invisible clone→twin jump; this timer
   * only covers rAF starvation (hidden tab) — sized past the spring's
   * typical settle so a slow frame cadence can't pop mid-flight.
   */
  TELEPORT_DELAY: 1100,
  /** Watchdog (ms) for the isNavigating suppression window — releases if the spring's settle callback somehow never runs */
  NAVIGATION_SETTLE_DELAY: 1400,
  /** Scroll-event debounce (ms) before the clone-teleport detector runs — scroll fires per pixel, the check only matters at rest */
  SCROLL_DEBOUNCE_MS: 150,
  /** ringProgress drained per RAF frame when autoplay stops (0–1 scale) — ~25 frames ≈ 0.4s unwind */
  RING_REGRESS_STEP: 0.04,
})

/**
 * Px-space chase-spring for the programmatic slide scroll — the organic,
 * slightly elastic slide travel that replaced the browser's fixed
 * `behavior:'smooth'` ease (which can't overshoot and ignores velocity
 * on retarget). Integrated by `springStep` in `core/utils/motion` with
 * px-space epsilons — same integrator the slider knobs run.
 *
 *   ωn = √96 ≈ 9.8 rad/s, ζ = 20/(2·√96) ≈ 1.02
 *
 * ζ≈1.02 is the critical-damping boundary — the slide travels fast and
 * parks on the target with no visible swing-back (a measurable
 * under-damped overshoot read as bounce on full-slide travel); the
 * ~0.6s settle keeps single-step navs snappy while multi-slide dot
 * jumps land without a hard stop.
 */
export const CAROUSEL_SPRING = Object.freeze({
  /** Spring stiffness — ωn² in px-space. */
  K: 96,
  /** Spring damping — 2ζωn with ζ≈1.02 (critically damped, no bounce). */
  C: 20,
  /**
   * Settle epsilon (px) — gap under this with velocity under VEL_EPS
   * snaps to the target so the spring never micro-rings sub-pixel.
   */
  SETTLE_PX: 0.5,
  /** Velocity settle epsilon (px/s) — see SETTLE_PX. */
  VEL_EPS: 24,
  /** Per-frame integration step cap (s) — suspended-tab resume safety. */
  DT_MAX_S: 0.05,
  /** First-frame step (s) — the loop's initial tick assumes 60Hz. */
  DT_INIT_S: 1 / 60,
  /**
   * Watchdog (ms) — force-settles the scroll when rAF starves (hidden
   * tab) so isNavigating/pending teleports can never latch.
   */
  MAX_MS: 1400,
  /** Travel floor (px) — sub-2px moves write instantly, no frames burnt. */
  MIN_TRAVEL_PX: 2,
})

/**
 * Frozen carousel map — sole declaration site for these tokens; consumers read members and
 * never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes the token
 * contract immutable at runtime.
 */
export const CAROUSEL_LAYOUT = Object.freeze({
  /** SVG countdown ring circumference: 2π × r (r=19) */
  CIRCUMFERENCE: 2 * Math.PI * 19,
  /** Viewport width below which mobile behaviour applies */
  MOBILE_BREAKPOINT: 768,
  /** Minimum viewport width for the ≤2-item side-by-side (non-carousel) layout */
  SIDE_BY_SIDE_BREAKPOINT: 960,
  /** Minimum swipe distance (px) required to trigger a slide change */
  SWIPE_THRESHOLD: 40,
  /** Slide height cap as a fraction of the viewport height */
  MAX_HEIGHT_VH: 70,
  /** Skeleton sections reserve the same capped height so content loads without shifting */
  SKELETON_ITEM_HEIGHT: '70vh',
  /** px tolerance for "slide center ≈ track center" in the clone-teleport detector — loose enough for sub-pixel scroll stops, tight enough not to fire mid-swipe */
  CENTER_EPS_PX: 10,
  /** IntersectionObserver ratio that counts as "visible enough" to autoplay (15%) */
  VISIBILITY_RATIO: 0.15,
  /** px delta below which ResizeObserver width reports are ignored — sub-pixel RO noise must not trigger a re-fit storm */
  FIT_EPS_PX: 4,
  /** Approx flex gap (px) added per item in the side-by-side width projection */
  ITEM_GAP_PX: 32,
  /** Minimum slide media width (px) — tall media floor so a fixed strip height never yields slivers; mirrors min-width in media-figure.scss */
  MEDIA_MIN_WIDTH: 320,
  /** Viewport width below which the media min-width floor is dropped — on sub-375px screens the floor would push media past the edges */
  MEDIA_MIN_WIDTH_VW: 375,
  /** Outer margin (px) applied to each slide item on desktop — media keeps padding + this margin of clearance on each side */
  ITEM_MARGIN_PX: 24,
  /** Viewport width at which the slide side margin kicks in — mirrors layout-1024 in carousel-host.scss / internals.scss */
  ITEM_MARGIN_VW: 1024,
  /** Strip height ladder (px) — mirrors --mf-h breakpoints in carousel-host.scss: below 1024 it is 70dvh minus a breakpoint pad, at/above these widths it is a fixed $space-* value */
  STRIP_H_1024: 377,
  STRIP_H_1440: 610,
  STRIP_H_2560: 987,
  /** px subtracted from 70dvh for the sub-1024 strip heights — mirrors --mf-h's calc() at <768 / ≥768 */
  STRIP_SUB_MOBILE: 42,
  STRIP_SUB_TABLET: 68,
  /** Horizontal item padding (both sides, px) per breakpoint — mirrors .internal-extra-item padding-inline ladder */
  ITEM_PAD_DEFAULT: 26,
  ITEM_PAD_768: 42,
  ITEM_PAD_1440: 68,
  ITEM_PAD_1920: 110,
  /** px subtracted from the viewport for the regular-item desktop width cap — mirrors the --mf-max-w gutter fallback (2×space-3xl + 2×margin) */
  REG_CAP_SUB: 158,
  /** px subtracted from the viewport for landscape-item width caps — mirrors the landscape --mf-max-w ladder */
  LAND_CAP_SUB_1024: 55,
  LAND_CAP_SUB_1280: 89,
  LAND_CAP_SUB_1440: 377,
  LAND_CAP_SUB_1920: 233,
  /** Max slide height (px) used when window.innerHeight is unavailable (SSR/tests) */
  MAX_HEIGHT_FALLBACK: 600,
  /** Numeric 16:9 aspect ratio */
  RATIO_16_9: 16 / 9,
  /** Numeric 21:9 aspect ratio */
  RATIO_21_9: 21 / 9,
  /** Numeric 32:9 aspect ratio */
  RATIO_32_9: 32 / 9,
  /** String token key for 16:9 */
  ASPECT_RATIO_16_9: '16:9',
  /** String token key for 21:9 */
  ASPECT_RATIO_21_9: '21:9',
  /** String token key for 32:9 */
  ASPECT_RATIO_32_9: '32:9',
})

/**
 * Frozen carousel map — sole declaration site for these tokens; consumers read members and
 * never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes the token
 * contract immutable at runtime.
 */
export const CAROUSEL_LOADING = Object.freeze({
  /** Carousels rendered synchronously with the page (the ones that can be in the first viewport) */
  EAGER_COUNT: 2,
  /** Below-the-fold carousels are rendered this many at a time in idle periods */
  BATCH_SIZE: 2,
  /** Upper bound before a deferred batch runs anyway (ms) */
  DEFERRED_TIMEOUT: 250,
})
