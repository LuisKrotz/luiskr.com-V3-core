/**
 * @file tokens/data/animation-ids.js
 * @description Animation registry — one stable id per distinct animated
 * element/surface on the site. The ids key the translated description
 * records (`translations/<loc>/components.animations.<id>`) and compose
 * the in-DOM long-description node ids (`lk-anim-desc-<id>`). Sole
 * declaration site — consumers import members, never redeclare
 * (zero-hardcoding rule).
 */

/**
 * Frozen animated-surface id map — every element that moves on the
 * site maps to exactly one id; several live elements may share an id
 * (every media figure shares `MEDIA_PROGRESSIVE`).
 *
 * Each record in the translations node carries two fields:
 *   `alt`      — one-sentence label (img alt / aria-label source).
 *   `longdesc` — the full description: element, animation name,
 *                behavior, triggers, tech stack and purpose — the
 *                text AI agents, SEO crawlers and assistive tech read.
 */
export const ANIMATION_IDS = Object.freeze({
  /** Nav burger → ✕ liquid morph widget (WebGL/canvas + CSS lines fallback). */
  BURGER_BUTTON: 'burger-button',
  /** Fullscreen nav backdrop — fbm contour field (GPU worker canvas + CSS plasma). */
  NAV_MENU_BACKGROUND: 'nav-menu-background',
  /** Nav menu overlay — items staggered rise/fade entrance (CSS keyframes). */
  NAV_MENU: 'nav-menu',
  /** Locale flag — waving canvas flag + pop-in entrance (canvas + CSS). */
  NAV_FLAG: 'nav-flag',
  /** Preference switch — liquid thumb slide (WebGL/canvas + CSS). */
  SWITCH_SLIDER: 'switch-slider',
  /** Theme toggle — orbital day/night slide (WebGL/canvas + CSS). */
  THEME_SLIDER: 'theme-slider',
  /** Modal close ✕ — liquid fill + rotating strokes (WebGL/canvas). */
  CLOSE_BUTTON: 'close-button',
  /** Loading skeleton — morphing glyph cells + traveling shimmer (canvas + CSS). */
  SKELETON: 'skeleton',
  /** Boot intro loader — counter-rotating rings + progress (CSS). */
  INTRO_LOADER: 'intro-loader',
  /** Notification toast — slide/fade entrance + exit (CSS). */
  SITE_TOAST: 'site-toast',
  /** Mosaic title letter combustion → rebuild (Rust/WASM particles + 2D raster). */
  MOSAIC_BURN: 'mosaic-burn',
  /** Mosaic tile — spring displacement + traveling border sheen (JS spring + canvas). */
  MOSAIC_TILE: 'mosaic-tile',
  /** Media figure — low→high-quality morph on progressive load (canvas + WASM decode + CSS). */
  MEDIA_PROGRESSIVE: 'media-progressive',
  /** About portrait — VHS glitch corruption passes (WebGL/canvas). */
  GLITCH_PORTRAIT: 'glitch-portrait',
  /** Footer divider — hairline with traveling light band (canvas). */
  DIVIDER_SHEEN: 'divider-sheen',
  /** Section titles/links — per-character pen-stroke write-on (instanced canvas + CSS). */
  TEXT_DRAW: 'text-draw',
  /** Tile border — traveling ring sheen loop (canvas). */
  RING_SHEEN: 'ring-sheen',
  /** Action buttons — corner brackets expand on hover (canvas). */
  CORNER_BRACKETS: 'corner-brackets',
  /** Star-field / earth playground — full 3D scene (three.js WebGL/WebGPU). */
  SCENE_3D: 'scene-3d',
  /** Expand modal — genie liquid warp + vapor particles open/close (WebGPU/Rust + 2D + CSS). */
  GENIE_MODAL: 'genie-modal',
  /** Awards carousel — momentum scroll, progress fill, autoplay dash (scroll + CSS + JS). */
  CAROUSEL: 'carousel',
  /** About paragraphs — character-by-character reveal on scroll (JS-sequenced spans). */
  ABOUT_TEXT: 'about-text',
  /** Related project tiles — hover lift/zoom spring + border sheen (CSS linear() springs). */
  RELATED_TILE: 'related-tile',
  /** Internals note marker — soft pulse (CSS). */
  NOTE_DOT: 'note-dot',
  /** Document ambient glow — slow radial drift behind content (CSS). */
  BODY_GLOW: 'body-glow',
  /** Route progress bar — scaleX crawl to ~70% while a navigation is in flight, then sweep-to-100 + fade (CSS transitions). */
  PROGRESS_BAR: 'progress-bar',
})

/**
 * Long-description node id prefix — the helper injects one
 * `<span id="lk-anim-desc-<id>">` per animation id into each shadow
 * root / document that hosts a described element, and points the
 * element's `aria-describedby`/`longdesc` at it.
 */
export const ANIMATION_DESC_ID_PREFIX = 'lk-anim-desc-'
