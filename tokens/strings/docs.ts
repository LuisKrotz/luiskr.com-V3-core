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
   *  file cloud is obvious to a first-time viewer. */
  SCENE_HINT: 'Interactive file cloud — drag to orbit, click a node to navigate',
  /** Landmark label for the right-hand map column and its zoom dialog. */
  MAP_LABEL: 'Interactive file cloud',
  /** Zoom trigger aria-label — opens the enlarged modal scene. */
  MAP_ZOOM: 'Expand the interactive file cloud',
  /** Close control aria-label inside the map zoom dialog. */
  MAP_CLOSE: 'Close the interactive file cloud',
  /** Instanced-attribute names on the scene's node geometries — the
   *  names are part of the patched GLSL program (attribute decls read
   *  them too), so a rename must land in both streams at once. */
  SCENE_ATTR_ALPHA: 'aAlpha',
  SCENE_ATTR_ACTIVE: 'aActive',
  /** Glyph instanced attributes — per-instance world offset,
   *  per-kind ink color, bob phase, and orbit-proportional scale. Same
   *  name-contract as the alpha/active pair: rename in GLSL + buffers
   *  together. */
  SCENE_ATTR_OFFSET: 'aOffset',
  SCENE_ATTR_COLOR: 'aColor',
  SCENE_ATTR_PHASE: 'aPhase',
  SCENE_ATTR_SCALE: 'aScale',
  /** `--icon-ink` custom property — the icon pack's per-kind themed
   *  color; the map probes it off `docs-tree-icon--<kind>` elements so
   *  scene nodes wear the exact palette the treeview icons do. */
  SCENE_ICON_INK_PROP: '--icon-ink',
  /** `+N` aggregate-leaf name prefix — surplus file leaves collapsed
   *  by the scene leaf cap; the scene colors them with the dir ink. */
  AGGREGATE_MARK: '+',
  /** sr-only heading + landmark names for the complete document index —
   *  every manifest node rendered as a heading link so AT heading-jump
   *  and crawlers reach all docs without walking the tree. */
  INDEX_TITLE: 'All documents',
  INDEX_LABEL: 'Complete documentation index',
  /** Viewer heading shown when a file is open — labels the content region. */
  VIEWER_HEADING_PREFIX: 'Viewing',
  /** Portal section labels — the flat root buckets re-seat under four
   *  disclosure groups in the treeview and sectioned portal grid. */
  GROUP_DOCS_LABEL: 'Documentation',
  GROUP_ARCH_LABEL: 'Architecture Docs',
  GROUP_SOURCE_LABEL: 'Source Code',
  GROUP_REPORTS_LABEL: 'Reports',
  /** Synthetic path prefix for the section-group rows — ids under it are
   *  view-only (a section has no manifest path), so tree bookkeeping
   *  ('group/docs'…) can never collide with a real docs route. */
  GROUP_PATH_PREFIX: 'group/',
  /** The docs-root child promoted into its own Architecture section. */
  ARCH_DIR: 'architecture',
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
  LABEL_W: 384,
  LABEL_H: 96,
  LABEL_FONT_PX: 34,
  /** world-space sprite size + lift above the node sphere */
  LABEL_SCALE_X: 7,
  LABEL_SCALE_Y: 1.75,
  LABEL_LIFT_Y: 2.2,
  /** zoom reveal — fractions of the full-graph camera distance, not
   *  absolute units, so names stay readable at the overview framing of
   *  any manifest size: a label fades in once the orbit distance drops
   *  under (LABEL_REVEAL_BASE − depth·LABEL_DEPTH_STEP)·camDist, over a
   *  LABEL_FADE·camDist window. BASE > √(1+LIFT²) ≈ 1.28 keeps the root
   *  and bucket names already inked at the default view; deeper rings
   *  reveal as the camera closes in. */
  LABEL_REVEAL_BASE: 1.5,
  LABEL_DEPTH_STEP: 0.15,
  LABEL_REVEAL_MIN: 0.5,
  LABEL_FADE: 0.25,
  /** deepest ring that gets a sprite label — each label is a canvas
   *  texture (~147kB VRAM at 384×96), so an unlabeled deep tier keeps
   *  the scene inside low-power GPU memory; deep dirs stay navigable
   *  via the treeview and the dots themselves. */
  SCENE_LABEL_MAX_DEPTH: 3,
  /** hierarchical-sphere layout (the procedural-directory reference):
   *  every node's children orbit it on a Fibonacci sphere at the
   *  parent's cluster radius — shared with the wasm worker op. Cluster
   *  radii come from subtree-extent packing: MIN_ORBIT floors a cluster
   *  so a lone child never collapses onto its parent glyph; MIN_SEP is
   *  the guaranteed clear-space gap between sibling subtree clouds —
   *  2 glyph diameters so filled icons never read as one mass and every
   *  link keeps a visible run between the cards it joins. */
  SCENE_MIN_ORBIT: 6,
  SCENE_MIN_SEP: 12,
  /** reference shrink ratio — a dir's child orbit is never smaller
   *  than this fraction of the orbit the dir itself sits on (looser
   *  than the procedural-directory map's 12→5 ≈ 0.42 taper), so nested
   *  clouds compress geometrically instead of summing subtree extents
   *  while keeping real air between rings. */
  SCENE_CHILD_SCALE: 0.72,
  /** Largest rendered glyph radius in chart units — the scale cap for
   *  the orbit-proportional glyph size AND the sibling-clearance term
   *  (orbits are sized so two max-size glyphs keep MIN_SEP between
   *  their glyph faces). */
  SCENE_GLYPH_MAX: 3,
  /** Pairwise relax iterations after placement — sibling-chord sizing
   *  covers siblings, but deep subtree clouds can interpenetrate
   *  cross-branch; enough Jacobi passes to push the wider MIN_SEP
   *  clearances through chained collisions (each pass moves a pair by
   *  the full deficit — layout-time O(n²·iters) on the capped scene
   *  tree). */
  SCENE_RELAX_ITERS: 30,
  /** orbit clamp — also the camera's minimum distance token (reused
   *  as SCENE_BASE_RADIUS's successor on the scene3d arm). */
  SCENE_BASE_RADIUS: 3,
  /** golden angle (π(3−√5) ≈ 2.399963 rad) — the Fibonacci-sphere
   *  azimuth step AND the decorrelation hash for bob phases. */
  SCENE_Y_HASH: 2.399963,
  /** Ambient node motion — the map never rotates (no autorotate, no
   *  intro turn, glyphs billboard to the camera): nodes only breathe
   *  (PULSE scale) and float ±BOB_AMP chart units at BOB_SPEED rad/s
   *  off a decorrelated phase so links stay glued. SPIN_HASH walks the
   *  node index through a golden-angle-ish sequence — the Fibonacci
   *  azimuth decorrelator and the coincident-pair push direction. */
  SCENE_PULSE_SPEED: 0.021875,
  SCENE_PULSE_AMP: 0.05,
  SCENE_BOB_SPEED: 1.5,
  SCENE_BOB_AMP: 0.35,
  SCENE_SPIN_HASH: 4.208,
  /** Exponential fog — density = FOG_DENSITY / graphR, so the far rim
   *  fades into the page backdrop (light or dark) like the reference's
   *  dark-slate depth cue, scaled to whatever radius the manifest
   *  actually spans. Kept low enough that the cloud's center mass stays
   *  inked — on light surfaces pastel inks washed >80% toward the fog
   *  color disappear entirely. */
  SCENE_FOG_DENSITY: 0.65,
  /** semantic-index streaming — elements appended per idle slice (~a few
   *  ms each, far under a frame budget), the rIC starvation bound per
   *  slice, and the setTimeout fallback delay where rIC is absent */
  INDEX_CHUNK: 400,
  INDEX_IDLE_TIMEOUT: 250,
  INDEX_FALLBACK_DELAY: 0,
  /** folder paper-stack caps — closed folders peek at most this many
   *  page tops above the tab; open folders fan up to this many colored
   *  sheets, so the pile stops growing before it walls off the glyph */
  TREE_SHEET_CAP_CLOSED: 4,
  TREE_SHEET_CAP_OPEN: 4,
  /** node sphere radii (chart units) — base glyph sizes before the
   *  per-node proportional scale. SCENE_GLYPH_FIT = the reference's
   *  icon-to-orbit ratio: a node's rendered glyph inflates to this
   *  fraction of the orbit it sits on, so every icon stays readable
   *  and proportional to its local spacing at any depth — the big
   *  center hub + shrinking satellites look. */
  SCENE_DIR_RADIUS: 1.15,
  SCENE_FILE_RADIUS: 0.55,
  SCENE_GLYPH_FIT: 0.14,
  /** File leaves drawn per dir before the rest collapse into a `+N`
   *  aggregate — the cap that keeps 300-file dirs from combing out. It
   *  shrinks by SCENE_FILE_CAP_STEP per ring: buckets get the full cap,
   *  deep dirs aggregate everything. */
  SCENE_FILE_CAP: 10,
  SCENE_FILE_CAP_STEP: 3,
  /** Dir fan-out + depth budgets — the raw manifest is ~4.4k nodes,
   *  which no guaranteed-separation layout can render readably, so dir
   *  children past SCENE_DIR_CAP (shrinking by _STEP per ring down to
   *  _MIN) and whole subtrees past SCENE_DEPTH_CAP collapse into the
   *  same `+N` aggregate leaf the file cap uses. The aggregate keeps
   *  its parent dir's path — picking it still opens that dir's page. */
  SCENE_DIR_CAP: 6,
  SCENE_DIR_CAP_STEP: 2,
  SCENE_DIR_CAP_MIN: 2,
  SCENE_DEPTH_CAP: 5,
  /** node/edge alpha — filled faces carry far more ink than hairlines,
   *  so glyphs hold high alpha for a solid read and edges stay a notch
   *  fainter so links never outshine the icons they connect. */
  SCENE_DIR_OPACITY: 0.9,
  SCENE_FILE_OPACITY: 0.85,
  SCENE_LINE_OPACITY: 0.55,
  /** Leaf-link dim factor — file→parent edges are the majority of the
   *  link web and read as clutter at full ink, so they draw at this
   *  fraction of SCENE_LINE_OPACITY while the dir skeleton stays lit. */
  SCENE_EDGE_LEAF: 0.3,
  /** Clear space kept between a link's trimmed end and the glyph face it
   *  aims at — edges clip at radius+gap on BOTH ends so lines never
   *  enter an icon's filled faces. A hair of clearance: the opaque card
   *  covers the trim, so links read as attached to their icons rather
   *  than floating mid-air between them. */
  SCENE_EDGE_GAP: 0.5,
  /** Filled-glyph seam pass — the detail strokes printed over the solid
   *  icon (outline, fold crease, text rules, shelf line). SEAM_GROW
   *  expands the outline strokes past the silhouette so they key the
   *  edge instead of z-fighting it; SEAM_LIFT (× the card half-
   *  thickness) floats face details just proud of the panel; SEAM_SHADE
   *  dims the icon ink as the seam fallback when the themed fog color
   *  can't resolve. */
  SCENE_SEAM_GROW: 1.04,
  SCENE_SEAM_LIFT: 1.4,
  SCENE_SEAM_SHADE: 0.35,
  /** scene3d edge ribbons — half-width of the cross-quad strips that
   *  stand in for 1px LineSegments under the engine (chart units) */
  SCENE_EDGE_HALF: 0.08,
  /** active-location highlight — the node matching the open docsPath pops
   *  to near-full alpha with a larger pulse; ancestor dirs along its path
   *  lift a notch above the base dir alpha so the branch reads. */
  SCENE_ACTIVE_OPACITY: 0.95,
  SCENE_ANCESTOR_OPACITY: 0.9,
  SCENE_ACTIVE_SCALE: 1.8,
  /** scene3d/WebGPU mount deadline — adapter+device+artifact acquisition
   *  can wedge on a wedged GPU process; past this bound the canvas mounts
   *  the proven three.js arm instead of waiting forever on a blank map. */
  SCENE3D_MOUNT_TIMEOUT: 4000,
  /** Camera framing — distance = graphR·FIT and height = dist·LIFT.
   *  FIT is deliberately under the full-fit ratio: deep manifests push
   *  graphR past 100, and fitting the whole tree shrinks every ring to
   *  a speck — framing the inner rings keeps the navigable structure
   *  (root, buckets, first levels) legible while the outer rings bleed
   *  off-frame (orbit/zoom still reaches them). LIFT ≈ 40° elevation
   *  lets the concentric ring layout read as a map. */
  SCENE_CAMERA_FIT: 1.15,
  SCENE_CAMERA_LIFT: 0.8,
  /** location-driven focus — when the docs location changes the map
   *  glides its orbit target onto the active node and dollies to a
   *  depth-scaled distance so the current branch fills the frame.
   *  DAMP is the per-frame lerp share toward the goal, MIN/STEP shape
   *  the focus distance (base + depth·step, capped at camDist so the
   *  root overview never zooms), EPS is the settle epsilon that ends
   *  the glide. */
  SCENE_FOCUS_DAMP: 0.07,
  SCENE_FOCUS_MIN: 16,
  SCENE_FOCUS_STEP: 7,
  SCENE_FOCUS_EPS: 0.02,
  /** vertical framing bias — the orbit target rides this far below the
   *  focused point so the graph renders in the TOP half of the map
   *  panel instead of dead-center (content top-anchored by design).
   *  Sized against the fov-55 half-frame (~0.52·dist): ~20% up-shift at
   *  the full-graph distance, ~30% at node-focus distances. */
  SCENE_FOCUS_Y_BIAS: -6,
})
