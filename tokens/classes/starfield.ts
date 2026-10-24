/**
 * @file tokens/classes/starfield.js
 * @description Star-field experiment class tokens (`sf-*` block) —
 * token group.
 */

import { _B_SF } from '../base.js'

/**
 * Frozen sf class-name map — sole declaration site for these tokens; consumers read members
 * and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes the
 * token contract immutable at runtime.
 */
export const SF_CLASSES = Object.freeze({
  // ── Loader overlay (mirrors the sp-loader contract) ──────────────────────
  SF_LOADER: `${_B_SF}-loader`,
  SF_LOADER_GLOW: `${_B_SF}-loader-glow`,
  SF_LOADER_GRID: `${_B_SF}-loader-grid`,
  SF_LOADER_CONTENT: `${_B_SF}-loader-content`,
  SF_LOADER_SPINNER_OUTER: `${_B_SF}-loader-spinner-outer`,
  SF_LOADER_SPINNER_INNER: `${_B_SF}-loader-spinner-inner`,
  SF_LOADER_COUNTER: `${_B_SF}-loader-counter`,
  SF_LOADER_TITLE: `${_B_SF}-loader-title`,
  SF_LOADER_MSG: `${_B_SF}-loader-msg`,
  SF_LOADER_BAR: `${_B_SF}-loader-bar`,
  SF_LOADER_BAR_FILL: `${_B_SF}-loader-bar-fill`,
  SF_LOADER_PERCENT: `${_B_SF}-loader-percent`,
  SF_LOADER_VAL: `${_B_SF}-loader-val`,
  SF_LOADER_SYM: `${_B_SF}-loader-sym`,

  // ── Stage + HUD ──────────────────────────────────────────────────────────
  SF_CANVAS: `${_B_SF}-canvas`,
  SF_FALLBACK: `${_B_SF}-fallback`,
  SF_HUD: `${_B_SF}-hud`,
  SF_HINT: `${_B_SF}-hint`,
  SF_LIVE: `${_B_SF}-live`,
  /** Bottom-edge scale disclaimer strip (localized per locale node). */
  SF_DISCLAIMER: `${_B_SF}-disclaimer`,

  // ── Hover tooltip (leader line + name/distance label) ────────────────────
  SF_TIP: `${_B_SF}-tip`,
  SF_TIP_LINE: `${_B_SF}-tip-line`,
  SF_TIP_LABEL: `${_B_SF}-tip-label`,
  /** Edge-hint mode — marker clamped to the canvas edge; line rotates to point. */
  SF_TIP_EDGE: `${_B_SF}-tip--edge`,
  /** Label flips left of the marker — right-edge clamps keep it readable. */
  SF_TIP_FLIPX: `${_B_SF}-tip--flipx`,
  /** Label drops below the marker — top-edge clamps keep it on-canvas. */
  SF_TIP_FLIPY: `${_B_SF}-tip--flipy`,

  // ── Body navigator drawer (the keyboard/AT access path) ──────────────────
  SF_NAV: `${_B_SF}-nav`,
  SF_NAV_OPEN: `${_B_SF}-nav--open`,
  SF_NAV_TOGGLE: `${_B_SF}-nav-toggle`,
  SF_NAV_PANEL: `${_B_SF}-nav-panel`,
  /** Sticky pinned strip inside the scrolling panel (head + search). */
  SF_NAV_PIN: `${_B_SF}-nav-pin`,
  SF_NAV_HEAD: `${_B_SF}-nav-head`,
  SF_NAV_HEADING: `${_B_SF}-nav-heading`,
  SF_NAV_CLOSE: `${_B_SF}-nav-close`,
  SF_NAV_GROUP: `${_B_SF}-nav-group`,
  SF_NAV_GROUP_TITLE: `${_B_SF}-nav-group-title`,
  SF_NAV_LIST: `${_B_SF}-nav-list`,
  SF_NAV_ITEM: `${_B_SF}-nav-item`,
  SF_NAV_ITEM_ACTIVE: `${_B_SF}-nav-item--active`,
  SF_NAV_ITEM_HEADING: `${_B_SF}-nav-item-heading`,
  SF_NAV_ITEM_META: `${_B_SF}-nav-item-meta`,
  SF_NAV_MORE: `${_B_SF}-nav-more`,
  SF_NAV_SEARCH: `${_B_SF}-nav-search`,
  /** In-drawer scale disclaimer — mobile home for the honesty note. */
  SF_NAV_DISCLAIMER: `${_B_SF}-nav-disclaimer`,

  // ── Info panel (lazy-loaded body dossier) ────────────────────────────────
  SF_PANEL: `${_B_SF}-panel`,
  SF_PANEL_OPEN: `${_B_SF}-panel--open`,
  SF_PANEL_HEAD: `${_B_SF}-panel-head`,
  SF_PANEL_TITLE: `${_B_SF}-panel-title`,
  SF_PANEL_TAG: `${_B_SF}-panel-tag`,
  SF_PANEL_CLOSE: `${_B_SF}-panel-close`,
  SF_PANEL_BODY: `${_B_SF}-panel-body`,
  SF_PANEL_TAGLINE: `${_B_SF}-panel-tagline`,
  SF_PANEL_HISTORY: `${_B_SF}-panel-history`,
  SF_FACTS: `${_B_SF}-facts`,
  SF_FACT: `${_B_SF}-fact`,
  SF_FACT_KEY: `${_B_SF}-fact-key`,
  SF_FACT_VAL: `${_B_SF}-fact-val`,
  SF_PANEL_SOURCE: `${_B_SF}-panel-source`,
  SF_PANEL_LOADING: `${_B_SF}-panel-loading`,
  SF_PANEL_SECTIONS: `${_B_SF}-panel-sections`,
  SF_PANEL_SEC: `${_B_SF}-panel-sec`,
  SF_PANEL_SEC_TITLE: `${_B_SF}-panel-sec-title`,
  SF_PANEL_SEC_BODY: `${_B_SF}-panel-sec-body`,
  SF_PANEL_SIG: `${_B_SF}-panel-sig`,

  // ── Dossier media gallery (images / video / audio) ───────────────────────
  SF_MEDIA: `${_B_SF}-media`,
  SF_MEDIA_FIG: `${_B_SF}-media-fig`,
  SF_MEDIA_IMG: `${_B_SF}-media-img`,
  SF_MEDIA_CAP: `${_B_SF}-media-cap`,
  SF_MEDIA_VIDEO: `${_B_SF}-media-video`,
  SF_MEDIA_AUDIO: `${_B_SF}-media-audio`,

  // ── Actions ──────────────────────────────────────────────────────────────
  SF_ACTIONS: `${_B_SF}-actions`,
  SF_BTN: `${_B_SF}-btn`,

  // ── Instructions modal (mobile informative texts) ────────────────────────
  SF_INSTRUCTIONS_BTN: `${_B_SF}-instructions-btn`,
  SF_INSTRUCTIONS_MODAL: `${_B_SF}-instructions-modal`,
  SF_INSTRUCTIONS_MODAL_OPEN: `${_B_SF}-instructions-modal--open`,
  SF_INSTRUCTIONS_HEAD: `${_B_SF}-instructions-head`,
  SF_INSTRUCTIONS_TITLE: `${_B_SF}-instructions-title`,
  SF_INSTRUCTIONS_CLOSE: `${_B_SF}-instructions-close`,
  SF_INSTRUCTIONS_BODY: `${_B_SF}-instructions-body`,
  SF_INSTRUCTIONS_HINT: `${_B_SF}-instructions-hint`,
  SF_INSTRUCTIONS_DISCLAIMER: `${_B_SF}-instructions-disclaimer`,
  /** Keyboard-shortcut definition list inside the instructions modal. */
  SF_INSTRUCTIONS_KEYS: `${_B_SF}-instructions-keys`,
  /** One shortcut row — <kbd> keycap + action description. */
  SF_INSTRUCTIONS_KEY: `${_B_SF}-instructions-key`,
  /** The <kbd> keycap itself. */
  SF_INSTRUCTIONS_KEYCAP: `${_B_SF}-instructions-keycap`,

  // ── Showcase badge ("Featured on Three.js Resources") ────────────────────
  /** The glass chip anchor pinned under the site logo. */
  SF_BADGE: `${_B_SF}-badge`,
  /** Provider mark inside the chip (inverted under the dark theme). */
  SF_BADGE_LOGO: `${_B_SF}-badge-logo`,
  /** Two-line text stack — eyebrow over the provider name. */
  SF_BADGE_COPY: `${_B_SF}-badge-copy`,
  /** "Featured on" eyebrow line. */
  SF_BADGE_EYEBROW: `${_B_SF}-badge-eyebrow`,
  /** Provider-name line. */
  SF_BADGE_NAME: `${_B_SF}-badge-name`,

  // ── Ambient playlist (bottom-left glass card above the nav toggle) ───
  /** The playlist card — track list plus the persistent native audio. */
  SF_MUSIC: `${_B_SF}-music`,
  /** The <ul> track list — one button per track. */
  SF_MUSIC_LIST: `${_B_SF}-music-list`,
  /** One track button — loads + plays that track on click. */
  SF_MUSIC_TRACK: `${_B_SF}-music-track`,
  /** Active-track marker — the row currently loaded in the player. */
  SF_MUSIC_TRACK_ACTIVE: `${_B_SF}-music-track--active`,
  /** The persistent native <audio> element (survives render rebuilds). */
  SF_MUSIC_AUDIO: `${_B_SF}-music-audio`,
})
