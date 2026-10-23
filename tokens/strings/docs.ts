/**
 * @file tokens/strings/docs.js
 * @description Docs-portal string tokens — English-only UI literals, the
 * content-asset path prefix and the CMS component keys.
 */

import { _B_DOCS } from '../base.js'

/**
 * Frozen docs string map — sole declaration site for these tokens;
 * consumers read members and never re-declare the strings
 * (zero-hardcoding rules 4–5). Object.freeze makes the token contract
 * immutable at runtime.
 */
export const DOCS_STRINGS = Object.freeze({
  /** Page + footer link title — English-only by product spec. */
  TITLE: 'In-depth project docs',
  /** English fallback for the CMS-provided description + toast copy. */
  DESC_FALLBACK: 'Available only in English',
  COPY_TOAST_FALLBACK:
    "This page doesn't allow copy, please refer to github to download the sourcecode or contact the page admin.",
  /** database.json component node: translations/<locale>/components/<key>. */
  CMS_COMPONENT: `${_B_DOCS}-portal`,
  /** URL prefix under which rendered file payloads are served/emitted. */
  ASSET_BASE: `/${_B_DOCS}-content/`,
  /** JSON suffix appended to every emitted content payload. */
  ASSET_EXT: '.json',
  /** Accessibility labels for the editable breadcrumb + copy feedback. */
  CRUMB_INPUT_LABEL: 'Edit path',
  CRUMB_INPUT_HINT: 'Type a docs path segment and press Enter',
  TREE_LABEL: 'Documentation tree',
  GRID_LABEL: 'Folders and files',
  /** aria-label on the docs content area — the shell already owns the
   *  sole <main> landmark, so the portal's content region is a named
   *  section (region landmark) rather than a second main. */
  MAIN_LABEL: 'Document content',
  NAV_TOGGLE: 'Browse the docs tree',
  VIEWER_BACK: 'Back',
  SOURCE_PROTECTED_LABEL: 'Copy protection active',
  MEDIA_UNAVAILABLE: 'Binary file too large to preview — download it from the GitHub repository.',
  NOT_FOUND_PATH: 'Not found in the documentation tree.',
  /** Keyboard key the print-screen guard reacts to. */
  KEY_PRINT_SCREEN: 'PrintScreen',
  /** Editable-breadcrumb input fallback when the URL path can't resolve. */
  CRUMB_PLACEHOLDER: 'docs/…',
  /** `name` attr for the editable-breadcrumb field (form-field audit). */
  CRUMB_INPUT_NAME: 'docs-path',
  /** Root-bucket folder exempt from index-file auto-open (source tree). */
  SRC_ROOT: 'src',
  /** Index filename that auto-opens when its folder is entered. */
  INDEX_FILE: 'index.html',
  /** Analytics event name for copy-guard attempts. */
  EVENT_COPY_ATTEMPT: 'docs_copy_attempt',
  /** JSON-LD description for the portal root/folder pages. */
  SCHEMA_DESCRIPTION:
    'Source code, documentation and quality reports for luiskr.com — browsable and indexable.',
  /** Boot-loader overlay copy — mirrors the space playground's system
   *  boot sequence with docs-context wording (English-only portal). */
  LOADER_TITLE: 'Docs system boot',
  LOADER_MSG_INIT: 'Opening the documentation archive',
  LOADER_MSG_MANIFEST: 'Indexing modules and reports',
  LOADER_MSG_SCENE: 'Mounting the architecture graph',
  LOADER_MSG_FILE: 'Loading the document payload',
  LOADER_MSG_READY: 'Portal online',
  /** In-place skeleton label while a mermaid diagram renders. */
  MERMAID_LOADING: 'Rendering diagram…',
  /** Visible chip captioning the backdrop scene so the interactive
   *  architecture map is obvious to a first-time viewer. */
  SCENE_HINT: 'Architecture map — drag to orbit, click a node to navigate',
  /** sr-only heading + landmark names for the complete document index —
   *  every manifest node rendered as a heading link so AT heading-jump
   *  and crawlers reach all docs without walking the tree. */
  INDEX_TITLE: 'All documents',
  INDEX_LABEL: 'Complete documentation index',
  /** Viewer heading shown when a file is open — labels the content region. */
  VIEWER_HEADING_PREFIX: 'Viewing',
})

/**
 * Staged boot-loader progress marks — the manifest is inlined at build
 * time so real fetch percentages don't exist; discrete stage numbers
 * keep the bar honest (manifest scanned → scene mounted → file fetched
 * → portal usable).
 */
export const DOCS_LOADER_PCT = Object.freeze({
  MANIFEST: 25,
  SCENE: 60,
  FILE: 80,
  READY: 100,
})

/** Unit tokens used by docs layout/scene math. */
export const DOCS_UNITS = Object.freeze({
  /** gl-strip thread-field drift — 1/16 real-time so lines barely move */
  GL_STRIP_TIME_SCALE: 0.0625,
  /** deterministic folder-art hash modulus */
  FOLDER_HASH_MOD: 9973,
  /** tap-vs-drag pick slop in px — taps move < this many CSS px */
  TAP_SLOP_PX: 10,
  /** label sprite canvas box (px) and font size (px) */
  LABEL_W: 256,
  LABEL_H: 64,
  LABEL_FONT_PX: 22,
  /** world-space sprite size + lift above the node sphere */
  LABEL_SCALE_X: 7,
  LABEL_SCALE_Y: 1.75,
  LABEL_LIFT_Y: 2.2,
  /** zoom reveal: labels fade in when controls distance drops under
   *  (LABEL_REVEAL_BASE − depth·LABEL_DEPTH_STEP), over LABEL_FADE px */
  LABEL_REVEAL_BASE: 44,
  LABEL_DEPTH_STEP: 7,
  LABEL_REVEAL_MIN: 16,
  LABEL_FADE: 12,
  /** radial-tree geometry shared with the wasm worker op */
  SCENE_BASE_RADIUS: 6,
  SCENE_DEPTH_STEP: 9,
  SCENE_Y_STEP: 4,
  SCENE_Y_WAVE: 1.5,
  /** slow backdrop motion — autorotate deg/frame-ish + node pulse.
   *  Speeds run far under OrbitControls' default (2.0) so the graph
   *  reads as a calm ambient layer, not a spinner. */
  SCENE_ROTATE_SPEED: 0.005,
  SCENE_PULSE_SPEED: 0.021875,
  SCENE_PULSE_AMP: 0.05,
  /** semantic-index streaming — elements appended per idle slice (~a few
   *  ms each, far under a frame budget), the rIC starvation bound per
   *  slice, and the setTimeout fallback delay where rIC is absent */
  INDEX_CHUNK: 400,
  INDEX_IDLE_TIMEOUT: 250,
  INDEX_FALLBACK_DELAY: 0,
  /** node sphere radii (chart units) — sized to read at the mid-zoom
   *  camera distance without smearing into blobs at near clip */
  SCENE_DIR_RADIUS: 1.15,
  SCENE_FILE_RADIUS: 0.55,
  /** node/edge alpha — faint enough to stay a backdrop layer, strong
   *  enough that the radial tree reads as a structure, not a smudge */
  SCENE_DIR_OPACITY: 0.5,
  SCENE_FILE_OPACITY: 0.28,
  SCENE_LINE_OPACITY: 0.22,
  /** scene3d edge ribbons — half-width of the cross-quad strips that
   *  stand in for 1px LineSegments under the engine (chart units) */
  SCENE_EDGE_HALF: 0.08,
  /** active-location highlight — the node matching the open docsPath pops
   *  to near-full alpha with a larger pulse; ancestor dirs along its path
   *  lift a notch above the base dir alpha so the branch reads. */
  SCENE_ACTIVE_OPACITY: 0.95,
  SCENE_ANCESTOR_OPACITY: 0.55,
  SCENE_ACTIVE_SCALE: 1.8,
  /** intro settle — a first (unrestored) mount eases the whole graph in
   *  from SCENE_INTRO_TURN radians over SCENE_INTRO_MS, then hands off to
   *  the ambient autorotate. Restored poses skip the intro entirely. */
  SCENE_INTRO_TURN: -Math.PI * 0.75,
  SCENE_INTRO_MS: 11000,
  /** Camera framing — distance = graphR·FIT and height = dist·LIFT.
   *  FIT is deliberately under the full-fit ratio: deep manifests push
   *  graphR past 100, and fitting the whole tree shrinks every ring to
   *  a speck — framing the inner rings keeps the navigable structure
   *  (root, buckets, first levels) legible while the outer rings bleed
   *  off-frame (orbit/zoom still reaches them). LIFT ≈ 40° elevation
   *  lets the concentric ring layout read as a map. */
  SCENE_CAMERA_FIT: 1.15,
  SCENE_CAMERA_LIFT: 0.8,
})
