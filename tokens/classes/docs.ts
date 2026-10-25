/**
 * @file tokens/classes/docs.js
 * @description Docs-portal class tokens — BEM block `docs` + modifiers.
 */

import { _B_DOCS } from '../base.js'

/**
 * Frozen docs class-name map — sole declaration site for these tokens;
 * consumers read members and never re-declare the strings
 * (zero-hardcoding rules 4–5). Object.freeze makes the token contract
 * immutable at runtime.
 */
export const DOCS_CLASSES = Object.freeze({
  DOCS: _B_DOCS,
  DOCS_HEADER: `${_B_DOCS}-header`,
  DOCS_TITLE: `${_B_DOCS}-title`,
  DOCS_UPDATED: `${_B_DOCS}-updated`,
  DOCS_GL: `${_B_DOCS}-gl`,
  DOCS_GL_FALLBACK: `${_B_DOCS}-gl-fallback`,
  DOCS_BODY: `${_B_DOCS}-body`,
  DOCS_NAV: `${_B_DOCS}-nav`,
  DOCS_TREE: `${_B_DOCS}-tree`,
  DOCS_TREE_ITEM: `${_B_DOCS}-tree-item`,
  DOCS_TREE_OPEN: `${_B_DOCS}-tree-open`,
  /** Section-group row modifier — the four disclosure rows (Source /
   *  Docs / Architecture / Reports) that parent the flat root buckets. */
  DOCS_TREE_GROUP: `${_B_DOCS}-tree-item--group`,
  DOCS_STACK: `${_B_DOCS}-stack`,
  DOCS_MAIN: `${_B_DOCS}-main`,
  DOCS_CRUMBS: `${_B_DOCS}-crumbs`,
  DOCS_CRUMB: `${_B_DOCS}-crumb`,
  DOCS_CRUMB_EDIT: `${_B_DOCS}-crumb-edit`,
  DOCS_GRID: `${_B_DOCS}-grid`,
  /** Portal-root section wrapper — one per disclosure group, each its
   *  own card grid under a real group heading. */
  DOCS_GRID_GROUP: `${_B_DOCS}-grid-group`,
  DOCS_GRID_GROUP_HEAD: `${_B_DOCS}-grid-group-head`,
  DOCS_CARD: `${_B_DOCS}-card`,
  DOCS_CARD_HEADING: `${_B_DOCS}-card-heading`,
  DOCS_CARD_LABEL: `${_B_DOCS}-card-label`,
  DOCS_CARD_ART: `${_B_DOCS}-card-art`,
  DOCS_VIEWER: `${_B_DOCS}-viewer`,
  DOCS_VIEWER_HEAD: `${_B_DOCS}-viewer-head`,
  DOCS_VIEWER_PATH: `${_B_DOCS}-viewer-path`,
  DOCS_VIEWER_BACK: `${_B_DOCS}-viewer-back`,
  DOCS_CONTENT: `${_B_DOCS}-content`,
  DOCS_FRAME: `${_B_DOCS}-frame`,
  DOCS_SCENE: `${_B_DOCS}-scene`,
  DOCS_SCENE_OFF: `${_B_DOCS}-scene-off`,
  DOCS_SCENE_HINT: `${_B_DOCS}-scene-hint`,
  // ── Architecture-map column + zoom modal ──────────────────────────────
  /** The right-hand map column — interactive alternative nav surface. */
  DOCS_MAP: `${_B_DOCS}-map`,
  /** Canvas seat inside the column OR the zoom dialog — the persistent
   *  scene node re-parents here on every render. */
  DOCS_MAP_STAGE: `${_B_DOCS}-map-stage`,
  /** Map header row — caption + zoom trigger. */
  DOCS_MAP_HEAD: `${_B_DOCS}-map-head`,
  /** Zoom trigger — opens the centered glass modal. */
  DOCS_MAP_ZOOM: `${_B_DOCS}-map-zoom`,
  /** The ⤢ glyph inside the zoom trigger — wrapped in a span so hover
   *  can transform it (bare text nodes take no transform). */
  DOCS_MAP_ZOOM_ICON: `${_B_DOCS}-map-zoom-icon`,
  /** Fullscreen overlay behind the zoom dialog — the glass backdrop. */
  DOCS_MAP_MODAL: `${_B_DOCS}-map-modal`,
  /** Fullscreen click-catcher between backdrop and dialog — the
   *  expand-modal close-area pattern. */
  DOCS_MAP_CLOSE_AREA: `${_B_DOCS}-map-close-area`,
  /** The centered glass dialog hosting the enlarged scene. */
  DOCS_MAP_DIALOG: `${_B_DOCS}-map-dialog`,
  /** Bottom close button under the dialog content — the expand-modal
   *  close-bottom pattern (labelled, corner-bracket styled). */
  DOCS_MAP_CLOSE_BOTTOM: `${_B_DOCS}-map-close-bottom`,
  DOCS_NAV_TOGGLE: `${_B_DOCS}-nav-toggle`,
  DOCS_NAV_OPEN: `${_B_DOCS}-nav-open`,
  /** Combobox dropdown container — the toggle's aria-controls target
   *  (merged crumbs row + treeview); the sticky left column ≥1281px. */
  DOCS_NAV_PANEL: `${_B_DOCS}-nav-panel`,
  /** Crumb row cloned inside the combobox dropdown — the merged
   *  tree+breadcrumb surface shown ≤1280px (the main crumb bar hides). */
  DOCS_NAV_CRUMBS: `${_B_DOCS}-nav-crumbs`,
  /** Per-row node icon — the animated SVG glyph (folder/file by ext). */
  DOCS_TREE_ICON: `${_B_DOCS}-tree-icon`,
  /** Per-row disclosure chevron — dir rows carry the arrow glyph,
   *  file rows an empty spacer so every icon column stays aligned. */
  DOCS_TREE_CHEVRON: `${_B_DOCS}-tree-chevron`,
  /** Paper sheet peeking out of a folder glyph — count ∝ children. */
  DOCS_TREE_PAPER: `${_B_DOCS}-tree-paper`,
  /** Per-sheet ink modifiers for the open folder's fanned papers —
   *  the reference pack colors each sheet differently
   *  (red/blue/green/purple), applied by index modulo the list. */
  DOCS_TREE_PAPER_TONES: Object.freeze([
    `${_B_DOCS}-tree-paper--0`,
    `${_B_DOCS}-tree-paper--1`,
    `${_B_DOCS}-tree-paper--2`,
    `${_B_DOCS}-tree-paper--3`,
  ]),
  /** Stroked icon part — inked with the kind's `--icon-ink`. */
  DOCS_ICON_LINE: `${_B_DOCS}-icon-line`,
  /** Filled icon part — inked with the kind's `--icon-ink`. */
  DOCS_ICON_FILL: `${_B_DOCS}-icon-fill`,
  /** Icon backdrop tile — a light kind-tinted wash behind the glyph. */
  DOCS_ICON_TILE: `${_B_DOCS}-icon-tile`,
  /** File page shell — the folded-corner document silhouette every file
   *  icon is drawn on; `-fold`/`-flap` parts hang off it. */
  DOCS_ICON_PAGE: `${_B_DOCS}-icon-page`,
  /** Letterform/detail drawn on a filled tile — reads paper-colored. */
  DOCS_ICON_ON: `${_B_DOCS}-icon-on`,
  /** Secondary-ink strokes — two-tone glyphs (the python tail). */
  DOCS_ICON_ALT: `${_B_DOCS}-icon-alt`,
  /** Wordmark text inside a page — the shield labels ("HTML"/"CSS"). */
  DOCS_ICON_TEXT: `${_B_DOCS}-icon-text`,
  /** Rim-light glint — the bright segment orbiting each icon's outline
   *  stroke (the reference pack's traveling shine), inked from the
   *  icon's `--icon-ink` lifted toward white. */
  DOCS_ICON_GLINT: `${_B_DOCS}-icon-glint`,
  /** File-kind names — `${DOCS_TREE_ICON}--${kind}` modifier classes
   *  pick each filetype's ink in the docs SCSS. */
  DOCS_ICON_KINDS: Object.freeze({
    /** Directory glyph — the `--folder` modifier pins the folder's gold
     *  currentColor as `--icon-ink` so shared pack parts (the sheen
     *  sweep) ink themselves correctly inside a folder svg. */
    FOLDER: 'folder',
    TS: 'ts',
    JS: 'js',
    PY: 'py',
    ATOM: 'atom',
    RS: 'rs',
    GO: 'go',
    JAVA: 'java',
    CPP: 'cpp',
    CS: 'cs',
    PHP: 'php',
    RB: 'rb',
    SQL: 'sql',
    JSON: 'json',
    SASS: 'sass',
    CSS: 'css',
    HTML: 'html',
    XML: 'xml',
    MD: 'md',
    IMG: 'img',
    PHOTO: 'photo',
    GIF: 'gif',
    VEC: 'vec',
    YML: 'yml',
    CONF: 'conf',
    LOCK: 'lock',
    FONT: 'font',
    WASM: 'wasm',
    TEST: 'test',
    CERT: 'cert',
    ARCHIVE: 'archive',
    SHELL: 'shell',
    EXE: 'exe',
    DMG: 'dmg',
    VIDEO: 'video',
    AUDIO: 'audio',
    NOTE: 'note',
    CAM: 'cam',
    CRATE: 'crate',
    WEB: 'web',
    TXT: 'txt',
    PDF: 'pdf',
    DOCX: 'docx',
    XLSX: 'xlsx',
    PPT: 'ppt',
    CSV: 'csv',
    DOC: 'doc',
  }),
  DOCS_PROTECTED: `${_B_DOCS}-protected`,
  DOCS_MERMAID: `${_B_DOCS}-mermaid`,
  DOCS_MERMAID_LOADING: `${_B_DOCS}-mermaid-loading`,
  DOCS_FOOTER_NOTE: `${_B_DOCS}-footer-note`,
  /** Boot loader overlay — stays up until the portal's first usable state. */
  DOCS_LOADER: `${_B_DOCS}-loader`,
  DOCS_LOADER_GLOW: `${_B_DOCS}-loader-glow`,
  DOCS_LOADER_GRID: `${_B_DOCS}-loader-grid`,
  DOCS_LOADER_CONTENT: `${_B_DOCS}-loader-content`,
  DOCS_LOADER_SPINNER_OUTER: `${_B_DOCS}-loader-spinner-outer`,
  DOCS_LOADER_SPINNER_INNER: `${_B_DOCS}-loader-spinner-inner`,
  DOCS_LOADER_COUNTER: `${_B_DOCS}-loader-counter`,
  DOCS_LOADER_PERCENT: `${_B_DOCS}-loader-percent`,
  DOCS_LOADER_VAL: `${_B_DOCS}-loader-val`,
  DOCS_LOADER_SYM: `${_B_DOCS}-loader-sym`,
  DOCS_LOADER_TITLE: `${_B_DOCS}-loader-title`,
  DOCS_LOADER_MSG: `${_B_DOCS}-loader-msg`,
  DOCS_LOADER_BAR: `${_B_DOCS}-loader-bar`,
  DOCS_LOADER_BAR_FILL: `${_B_DOCS}-loader-bar-fill`,
  /** Complete-document index nav — offscreen + content-visibility skipped. */
  DOCS_INDEX: `${_B_DOCS}-index`,
})
