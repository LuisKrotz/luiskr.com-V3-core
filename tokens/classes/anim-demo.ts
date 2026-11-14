/**
 * @file tokens/classes/anim-demo.js
 * @description Animations-demo stage class tokens — grouped subset of
 * CLASSES for the `<anim-demo>` component mounted per record on the
 * /animations route: the stage chrome plus every staged-DOM demo's
 * element/state classes (menu items, loader rings, toast pill, title-burn
 * card, tiles, divider, bracketed button, carousel strip, glow, progress
 * bar, genie backdrop/dialog).
 */

import { _B_ANIM_DEMO } from '../base.js'

/**
 * Frozen anim-demo class-name map — sole declaration site for these
 * tokens; consumers read members and never re-declare the strings
 * (zero-hardcoding rules 4–5). Object.freeze makes the token contract
 * immutable at runtime.
 */
export const ANIM_DEMO_CLASSES = Object.freeze({
  /** Stage root — the framed box the demo renders inside. */
  ANIM_DEMO: _B_ANIM_DEMO,
  /** Full-stage canvas (shader/2D surfaces). */
  CANVAS: `${_B_ANIM_DEMO}-canvas`,
  /** Centered icon canvas (burger / close-button widgets). */
  ICON: `${_B_ANIM_DEMO}-icon`,
  /** Sized parent the icon canvas fills — the close widget's resize
   *  observer watches parentElement (in production that IS the button
   *  box), so the canvas can't sit directly on the full-width stage. */
  ICON_WRAP: `${_B_ANIM_DEMO}-icon-wrap`,
  /** Generic inner scene wrapper for DOM-staged demos. */
  SCENE: `${_B_ANIM_DEMO}-scene`,

  /* ── Nav menu stagger demo ── */
  /** Menu column the items stagger inside. */
  MENU: `${_B_ANIM_DEMO}-menu`,
  /** One menu item bar. */
  MENU_ITEM: `${_B_ANIM_DEMO}-menu-item`,
  /** Menu open modifier — items rise/fade in staggered while set. */
  MENU_OPEN: `${_B_ANIM_DEMO}-menu--open`,

  /* ── Intro loader demo ── */
  /** Mini loader overlay. */
  LOADER: `${_B_ANIM_DEMO}-loader`,
  /** Counter-rotating outer ring. */
  LOADER_RING: `${_B_ANIM_DEMO}-loader-ring`,
  /** Counter-rotating inner ring. */
  LOADER_RING_INNER: `${_B_ANIM_DEMO}-loader-ring-inner`,
  /** Percent counter readout. */
  LOADER_COUNTER: `${_B_ANIM_DEMO}-loader-counter`,
  /** Progress track under the counter. */
  LOADER_BAR: `${_B_ANIM_DEMO}-loader-bar`,
  /** ScaleX fill inside the progress track. */
  LOADER_FILL: `${_B_ANIM_DEMO}-loader-fill`,

  /* ── Site toast demo ── */
  /** Toast stack container. */
  TOAST: `${_B_ANIM_DEMO}-toast`,
  /** One toast pill. */
  TOAST_ITEM: `${_B_ANIM_DEMO}-toast-item`,
  /** Slide/fade entrance state. */
  TOAST_IN: `${_B_ANIM_DEMO}-toast-item--in`,
  /** Slide/fade exit state. */
  TOAST_OUT: `${_B_ANIM_DEMO}-toast-item--out`,

  /* ── Mosaic burn demo (satisfies utils/burn BurnClasses) ── */
  /** Demo card the burn session mounts against (carries data-index). */
  CARD: `${_B_ANIM_DEMO}-card`,
  /** Modifier toggled on the card while the canvas owns the hover. */
  CARD_BURNING: `${_B_ANIM_DEMO}-card--burning`,
  /** Gradient panel the title + burn canvas live inside. */
  OVERLAY: `${_B_ANIM_DEMO}-overlay`,
  /** The title heading whose ink the canvas replaces. */
  TITLE: `${_B_ANIM_DEMO}-title`,
  /** Ink-hidden state on the title. */
  TITLE_BURNING: `${_B_ANIM_DEMO}-title--burning`,
  /** The combustion canvas element. */
  TITLE_BURN: `${_B_ANIM_DEMO}-title-burn`,
  /** Rewrite slot inserted above the details' first child. */
  TITLE_SLOT: `${_B_ANIM_DEMO}-title-slot`,
  /** Invisible spacer keeping the rewrite slot's layout box. */
  TITLE_DUP: `${_B_ANIM_DEMO}-title-dup`,
  /** The <draw-text> clone replaying the title in the slot. */
  TITLE_REWRITE: `${_B_ANIM_DEMO}-title-rewrite`,
  /** Details container the rewrite slot prepends into. */
  DETAILS: `${_B_ANIM_DEMO}-details`,

  /* ── Tile demos (ring-sheen / related) ── */
  /** Tile row container the ring-sheen canvas overlays. */
  TILES: `${_B_ANIM_DEMO}-tiles`,
  /** One demo tile. */
  TILE: `${_B_ANIM_DEMO}-tile`,
  /** Hover-state modifier driving the lift/zoom spring. */
  TILE_HOVER: `${_B_ANIM_DEMO}-tile--hover`,

  /* ── Divider sheen demo ── */
  /** The <hr> the sheen travels. */
  DIVIDER: `${_B_ANIM_DEMO}-divider`,

  /* ── Corner brackets demo ── */
  /** The bracketed action button. */
  BUTTON: `${_B_ANIM_DEMO}-button`,
  /** Hover-state modifier expanding the corner brackets. */
  BUTTON_HOVER: `${_B_ANIM_DEMO}-button--hover`,

  /* ── Carousel demo ── */
  /** Clip viewport the track scrolls inside. */
  STRIP: `${_B_ANIM_DEMO}-strip`,
  /** Translating slide track. */
  TRACK: `${_B_ANIM_DEMO}-track`,
  /** One slide card. */
  SLIDE: `${_B_ANIM_DEMO}-slide`,
  /** Progress rail under the strip. */
  PROGRESS: `${_B_ANIM_DEMO}-progress`,
  /** ScaleX fill inside the rail. */
  PROGRESS_FILL: `${_B_ANIM_DEMO}-progress-fill`,

  /* ── Body glow demo ── */
  /** Surface whose ::before drifts the ambient glow wash. */
  GLOW: `${_B_ANIM_DEMO}-glow`,

  /* ── Route progress bar demo ── */
  /** The bar element. */
  BAR: `${_B_ANIM_DEMO}-bar`,
  /** In-flight crawl state (scaleX → ~70%). */
  BAR_ACTIVE: `${_B_ANIM_DEMO}-bar--active`,
  /** Completion state (sweep to 100% + fade). */
  BAR_DONE: `${_B_ANIM_DEMO}-bar--done`,

  /* ── Genie lightbox-warp demo (the real expanded/genie 2D renderer) ── */
  /** The origin card the funnel flies out of / sucks back into — the
   *  clicked-figure twin on the page chrome. */
  GENIE_FIGURE: `${_B_ANIM_DEMO}-genie-figure`,
  /** The mini lightbox content — also carries the real
   *  `expand-modal-content` token (buildGenieSheet resolves it); this
   *  class only frames the box on the stage. */
  GENIE_MODAL: `${_B_ANIM_DEMO}-genie-modal`,
  /** The media box inside the mini lightbox — the sheet's warp rect. */
  GENIE_MODAL_FIGURE: `${_B_ANIM_DEMO}-genie-modal-figure`,

  /* ── Skeleton demo ── */
  /** Content block holding the skeleton placeholders. */
  SKEL: `${_B_ANIM_DEMO}-skel`,

  /* ── Widget canvas variants ── */
  /** Flag widget canvas (waving flag, natural aspect). */
  FLAG: `${_B_ANIM_DEMO}-flag`,
  /** Flex row listing every locale's flag — the record's "list them all"
   *  contract (one `.anim-demo-flag` canvas per LANG_OPTIONS entry). */
  FLAGS: `${_B_ANIM_DEMO}-flags`,
  /** One flag slot — pairs the canvas with its `flag-img`/`flag-split`
   *  <img> fallback twin (the lang dialog's own no-GL contract, so a
   *  dead surface still lists every flag). */
  FLAG_CELL: `${_B_ANIM_DEMO}-flag-cell`,
  /** Switch slider widget canvas (54×28 pill). */
  SWITCH: `${_B_ANIM_DEMO}-switch`,
  /** Theme slider widget canvas (280×64 track). */
  THEME: `${_B_ANIM_DEMO}-theme`,
  /** Menu-background canvas variant — distinguishes the fullscreen
   *  contour field from the scene-3d canvas pair when `:has()` scopes
   *  the CSS fallback paint. */
  MENUBG: `${_B_ANIM_DEMO}-menubg`,
  /** Burger icon canvas mark — scopes the CSS-drawn fallback squares
   *  on the shared icon wrapper. */
  ICON_BURGER: `${_B_ANIM_DEMO}-icon--burger`,
  /** Close icon canvas mark — scopes the CSS-drawn fallback X on the
   *  shared icon wrapper. */
  ICON_CLOSE: `${_B_ANIM_DEMO}-icon--close`,

  /* ── Tile inner content ── */
  /** Inner face of a demo tile (the sheen masks sit on the tile itself). */
  TILE_INNER: `${_B_ANIM_DEMO}-tile-inner`,

  /* ── DrawText demo ── */
  /** The <draw-text> replay element inside a demo stage. */
  DRAW: `${_B_ANIM_DEMO}-draw`,

  /* ── Media progressive demo ── */
  /** The <media-figure> sizing wrapper. */
  FIGURE: `${_B_ANIM_DEMO}-figure`,

  /* ── Card-stack demo ── */
  /** Perspective scene the fanned cards deal through. */
  FAN: `${_B_ANIM_DEMO}-fan`,
  /** One fanned card — slot comes from data-index (-2…2). */
  FAN_CARD: `${_B_ANIM_DEMO}-fan-card`,

  /* ── Nav icon-aura demo ── */
  /** Chip row the aura sweeps across. */
  CHIPS: `${_B_ANIM_DEMO}-chips`,
  /** One chip tile carrying the ring-fill trail. */
  CHIP: `${_B_ANIM_DEMO}-chip`,
  /** Armed modifier — the comet trail sweeps while set. */
  CHIP_ARMED: `${_B_ANIM_DEMO}-chip--armed`,

  /* ── View-transition demo ── */
  /** Stacked mini "pages" that cross-fade. */
  PANES: `${_B_ANIM_DEMO}-panes`,
  /** One page pane. */
  PANE: `${_B_ANIM_DEMO}-pane`,
  /** Hidden modifier — the outgoing page fades to 0. */
  PANE_GONE: `${_B_ANIM_DEMO}-pane--gone`,

  /* ── Route-search demo ── */
  /** The search field bar. */
  SEARCH: `${_B_ANIM_DEMO}-search`,
  /** The submit glyph — spins while loading. */
  SEARCH_ICON: `${_B_ANIM_DEMO}-search-icon`,
  /** The typed-query text bar inside the field. */
  SEARCH_TEXT: `${_B_ANIM_DEMO}-search-text`,
  /** Found-dots row — bounces while loading. */
  SEARCH_DOTS: `${_B_ANIM_DEMO}-search-dots`,
  /** One found dot. */
  SEARCH_DOT: `${_B_ANIM_DEMO}-search-dot`,
  /** Loading modifier on the field. */
  SEARCH_LOADING: `${_B_ANIM_DEMO}-search--loading`,

  /* ── Custom-carousel demo ── */
  /** Project-carousel variant of the strip — wider, taller slides. */
  STRIP_PROJECT: `${_B_ANIM_DEMO}-strip--project`,

  /* ── Mentions-deck demo ── */
  /** The stacked deck. */
  DECK: `${_B_ANIM_DEMO}-deck`,
  /** One deck card — stack slot comes from data-index (0 = front). */
  DECK_CARD: `${_B_ANIM_DEMO}-deck-card`,
  /** Swipe-away modifier — the front card flies out before re-seating. */
  DECK_GONE: `${_B_ANIM_DEMO}-deck-card--gone`,

  /* ── Expand-modal loading demo ── */
  /** The lightbox panel. */
  MODAL: `${_B_ANIM_DEMO}-modal`,
  /** The spinner disc. */
  MODAL_SPIN: `${_B_ANIM_DEMO}-modal-spin`,
  /** The shimmer wash sweeping the panel. */
  MODAL_SHEEN: `${_B_ANIM_DEMO}-modal-sheen`,
  /** Ready modifier — loading visuals hand off to the sheen. */
  MODAL_READY: `${_B_ANIM_DEMO}-modal--ready`,

  /* ── Footer feed-wave demo ── */
  /** The staged feed anchor — carries the real feedGlyph the driver
      prepends; the wave arcs pulse in CSS. */
  FEED: `${_B_ANIM_DEMO}-feed`,

  /* ── Real-element demos ── */
  /** Host class on a mounted production element (card-stack,
   *  mentions-deck, awards-carousel, custom-carousel, about-section) —
   *  the element owns its internals; the class only frames the host
   *  box inside the stage. */
  ELEMENT: `${_B_ANIM_DEMO}-element`,
})
