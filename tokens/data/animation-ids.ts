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
  /** Card-stack project-name letter combustion → rebuild (Rust/WASM particles + 2D raster). */
  MOSAIC_BURN: 'mosaic-burn',
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
  /** Document ambient glow — slow radial drift behind content (CSS). */
  BODY_GLOW: 'body-glow',
  /** Route progress bar — scaleX crawl to ~70% while a navigation is in flight, then sweep-to-100 + fade (CSS transitions). */
  PROGRESS_BAR: 'progress-bar',
  /** Home project deck — deal-through card fan: drag/flick physics, inward
   *  rotateY faces, GL quadratic bend, hero scale boost (JS poses + three.js). */
  CARD_STACK: 'card-stack',
  /** About portrait halo — polar dot lattice displaced by a traveling
   *  radial wave + precessing guide lines (2D canvas rAF). */
  ABOUT_MESH: 'about-mesh',
  /** Nav strip chips — comet-tail ring-fill sweeping the search/gear chip
   *  outlines on hover (WebGPU ring-fill + CSS trail fallback). */
  NAV_ICON_AURA: 'nav-icon-aura',
  /** Route change — #view-outlet cross-fade between outgoing/incoming
   *  views (JS class swap + CSS opacity transition). */
  VIEW_TRANSITION: 'view-transition',
  /** Route-search field — loading state: spinning submit glyph + bouncing
   *  found-dots while the scoring dispatch is in flight (CSS). */
  ROUTE_SEARCH: 'route-search',
  /** Project-page carousels — autoplay progress dash, momentum scroll,
   *  arrow nav (JS + CSS — distinct surface from the awards carousel). */
  CUSTOM_CAROUSEL: 'custom-carousel',
  /** Contact mentions deck — swipeable stacked cards, drag-to-dismiss,
   *  autoplay cycle (JS gestures + CSS keyframes). */
  MENTIONS_DECK: 'mentions-deck',
  /** Expanded-media lightbox loading — shimmer wash + spinner while the
   *  full-size asset decodes (CSS). */
  EXPAND_MODAL_LOADING: 'expand-modal-loading',
  /** Awards footer feed — opacity wave rippling across the source-feed
   *  link row (CSS keyframes). */
  FOOTER_FEED_WAVE: 'footer-feed-wave',
})

/**
 * Long-description node id prefix — the helper injects one
 * `<span id="lk-anim-desc-<id>">` per animation id into each shadow
 * root / document that hosts a described element, and points the
 * element's `aria-describedby`/`longdesc` at it.
 */
export const ANIMATION_DESC_ID_PREFIX = 'lk-anim-desc-'

/**
 * Docs-manifest path roots shared by ANIMATION_DOCS values — declared
 * once so every record composes `<root><leaf>` without retyping the
 * prefix (zero-hardcoding). `docs/…` roots address generated
 * api/architecture pages under shared/docs; module roots (`core/…`,
 * `website/…`) address live source files. Kept module-local — the file
 * stays import-free for the plain-node locale-page generator.
 */
const _ANIM_DOC = 'docs/api/'

/** Docs root for canvas utility pages (`core/utils/canvas/…`). */
const _ANIM_DOC_CANVAS = `${_ANIM_DOC}core/utils/canvas/`

/** Docs root for website component pages (`website/components/…`). */
const _ANIM_DOC_COMPONENTS = `${_ANIM_DOC}website/components/`

/** Docs root for GPU utility pages (`core/utils/gpu/…`). */
const _ANIM_DOC_GPU = `${_ANIM_DOC}core/utils/gpu/`

/** Live-source root for website component files (`website/components/…`). */
const _ANIM_SRC_COMPONENTS = 'website/components/'

/** Live-source root for core stylesheet files (`core/sass/…`). */
const _ANIM_SRC_SASS = 'core/sass/'

/**
 * Frozen animation-id → docs-manifest node path map — one in-depth docs
 * page per animation record so the /animations listing deep-links into
 * the docs portal (api reference with signatures + comments, or the
 * module source for document-level CSS surfaces). Values are manifest
 * `node.path` strings (`<root>/<rel>`) as served by the docs portal —
 * `docs/…` roots address generated api/architecture pages under
 * shared/docs, module roots (`core/…`) address live source files.
 * Consumers prefix with ROUTE_PATHS.DOCS. Keys reuse ANIMATION_IDS
 * members directly so the file stays import-free (the static locale-page
 * generator loads it under plain-node type stripping) and no id string
 * is retyped (zero-hardcoding).
 */
export const ANIMATION_DOCS: Readonly<Record<string, string>> = Object.freeze({
  [ANIMATION_IDS.BURGER_BUTTON]: `${_ANIM_DOC_CANVAS}widgets/burger-button-webgl.md`,
  [ANIMATION_IDS.NAV_MENU_BACKGROUND]: `${_ANIM_DOC_CANVAS}loaders/menu-background-webgl.md`,
  [ANIMATION_IDS.NAV_MENU]: `${_ANIM_DOC_COMPONENTS}nav/menu.md`,
  [ANIMATION_IDS.NAV_FLAG]: `${_ANIM_DOC_CANVAS}widgets/flag-webgl.md`,
  [ANIMATION_IDS.SWITCH_SLIDER]: `${_ANIM_DOC_CANVAS}widgets/switch-slider.md`,
  [ANIMATION_IDS.THEME_SLIDER]: `${_ANIM_DOC_CANVAS}widgets/theme-slider.md`,
  [ANIMATION_IDS.CLOSE_BUTTON]: `${_ANIM_DOC_CANVAS}widgets/close-button.md`,
  [ANIMATION_IDS.SKELETON]: `${_ANIM_DOC_CANVAS}loaders/skeleton-webgl.md`,
  [ANIMATION_IDS.INTRO_LOADER]: `${_ANIM_DOC_CANVAS}loaders/intro-loader.md`,
  [ANIMATION_IDS.SITE_TOAST]: `${_ANIM_DOC_COMPONENTS}feedback/SiteToast.md`,
  [ANIMATION_IDS.MOSAIC_BURN]: `${_ANIM_SRC_COMPONENTS}home/cardstack/info.ts`,
  [ANIMATION_IDS.MEDIA_PROGRESSIVE]: `${_ANIM_DOC_COMPONENTS}media/MediaFigure.md`,
  [ANIMATION_IDS.GLITCH_PORTRAIT]: `${_ANIM_DOC_COMPONENTS}home/about/glitch/session.md`,
  [ANIMATION_IDS.DIVIDER_SHEEN]: `${_ANIM_DOC_GPU}divider-sheen.md`,
  [ANIMATION_IDS.TEXT_DRAW]: `${_ANIM_DOC_COMPONENTS}media/DrawText.md`,
  [ANIMATION_IDS.RING_SHEEN]: `${_ANIM_DOC_GPU}ring-sheen.md`,
  [ANIMATION_IDS.CORNER_BRACKETS]: `${_ANIM_DOC_GPU}corner-brackets.md`,
  [ANIMATION_IDS.SCENE_3D]: `${_ANIM_DOC_GPU}scene3d.md`,
  [ANIMATION_IDS.GENIE_MODAL]: `${_ANIM_DOC_COMPONENTS}media/expanded/genie.md`,
  [ANIMATION_IDS.CAROUSEL]: `${_ANIM_DOC_COMPONENTS}carousel/AwardsCarousel.md`,
  [ANIMATION_IDS.ABOUT_TEXT]: `${_ANIM_DOC_COMPONENTS}home/AboutSection.md`,
  [ANIMATION_IDS.RELATED_TILE]: `${_ANIM_DOC_COMPONENTS}portfolio/Related.md`,
  [ANIMATION_IDS.BODY_GLOW]: `${_ANIM_SRC_SASS}base/structure/_document.scss`,
  [ANIMATION_IDS.PROGRESS_BAR]: `${_ANIM_SRC_SASS}components/shell/app/_progress-bar.scss`,
  [ANIMATION_IDS.CARD_STACK]: `${_ANIM_SRC_COMPONENTS}home/cardstack/deck.ts`,
  [ANIMATION_IDS.ABOUT_MESH]: `${_ANIM_SRC_COMPONENTS}home/about/mesh.ts`,
  [ANIMATION_IDS.NAV_ICON_AURA]: `${_ANIM_DOC_COMPONENTS}nav/icon-aura.md`,
  [ANIMATION_IDS.VIEW_TRANSITION]: `${_ANIM_SRC_SASS}components/shell/app/_transitions.scss`,
  [ANIMATION_IDS.ROUTE_SEARCH]: `${_ANIM_DOC_COMPONENTS}search/RouteSearch.md`,
  [ANIMATION_IDS.CUSTOM_CAROUSEL]: `${_ANIM_DOC_COMPONENTS}carousel/CustomCarousel.md`,
  [ANIMATION_IDS.MENTIONS_DECK]: `${_ANIM_SRC_COMPONENTS}carousel/MentionsDeck.tsx`,
  [ANIMATION_IDS.EXPAND_MODAL_LOADING]: `${_ANIM_DOC_COMPONENTS}media/MediaExpanded.md`,
  [ANIMATION_IDS.FOOTER_FEED_WAVE]: `${_ANIM_SRC_SASS}components/home/awards-footer.scss`,
})

/**
 * Docs path for animation records missing from ANIMATION_DOCS — the
 * animations deep-dive README dir, which the docs portal auto-opens
 * into its index page.
 */
export const ANIMATION_DOCS_FALLBACK = 'docs/animations'
