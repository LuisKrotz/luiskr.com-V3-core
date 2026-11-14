/**
 * @file utils/print/print.ts
 * @description Print-mode DOM adapter. `beforeprint` (and the matchMedia
 * print channel, which covers engines where the event never fires) flips the
 * document into its printable form: the prerendered reader article becomes
 * the visible surface (the print sheet hides the live app chrome), lazy
 * media upgrades to eager/high-priority at its highest proven quality so
 * everything resolves before the snapshot, videos stand in as their
 * poster stills, canvases swap for a captured PNG — engines that clear
 * their buffer answer the `printcapture` request event,
 * preserveDrawingBuffer surfaces answer `toDataURL` directly — and every
 * printed media surface earns a `.print-caption` source line (asset URL +
 * print date + author) while footer links gain `.print-qr-link` codes and
 * the back cover carries the single site scan code. Routes with no paper
 * content (the search surface, the 404) emit exactly one sheet — the
 * black cover with the site scan code and the home link.
 * `afterprint` walks the swap back down: injected stand-ins, captions and
 * QR links are removed and every mutated attribute is restored to its
 * recorded value.
 */

import store from '@core/store.js'
import router from '@core/router/router.js'
import { detectLangFromPath } from '@core/i18n.js'
import { portfolioWord } from '@core/locale/portfolio-word.js'
import { rightsText } from '@core/locale/ui-text.js'
import { devWarn } from '@core/devlog.js'
import { encodeMediaUrl, getOptimizedGravatar } from '@core/utils/media.js'
import {
  initMediaManifest,
  mediaKeyExists,
  mediaRungs,
  onMediaManifest,
} from '@core/utils/media/manifest.js'
import { smallMediaBox } from '@core/utils/media/policy.js'
import { qrSvg } from '@core/utils/print/qr.js'
import { installPrintWarm } from '@core/utils/print/warm-bridge.js'
import { A11Y_CLASSES } from '@core/tokens/classes/a11y.js'
import { ABOUT_CLASSES } from '@core/tokens/classes/about.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { LINK_ATTRS } from '@core/tokens/attrs/link.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { MEDIA_CLASSES } from '@core/tokens/classes/media.js'
import { PRINT_CLASSES } from '@core/tokens/classes/print.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'
import { READER_CLASSES } from '@core/tokens/classes/reader.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import {
  CLIPBOARD_EVENTS,
  FORM_EVENTS,
  KEYBOARD_EVENTS,
  PRINT_EVENTS,
  WINDOW_EVENTS,
} from '@core/tokens/events/dom.js'
import { APP_IDS } from '@core/tokens/ids/app.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { GRAVATAR_SIZES } from '@core/tokens/media/dimensions.js'
import { MEDIA_CREDIT_LABELS, MEDIA_CREDIT_SEPARATOR } from '@core/tokens/media/credits.js'
import { PREFETCH_CONFIG } from '@core/tokens/motion/prefetch.js'
import { PRINT_TIMING } from '@core/tokens/motion/print.js'
import { KEYS, MEDIA_QUERIES } from '@core/tokens/primitives.js'
import { BASE_TITLE } from '@core/tokens/routes.js'
import { ROUTE_NAMES } from '@core/tokens/routes/names.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { _B_EXPAND_MODAL, _B_SKELETON, _B_SKELETON_ABOUT } from '@core/tokens/base.js'
import { CARD_STACK_CLASSES } from '@core/tokens/classes/card-stack.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { NET_STRINGS } from '@core/tokens/strings/net.js'
import { NAV_TEXT } from '@core/tokens/strings/text.js'
import { WEBGL_STRINGS } from '@core/tokens/strings/webgl.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'

/** Elements whose attributes were mutated — restored verbatim on exit. */
const touched = new Map<Element, Map<string, string | null>>()

/** Live canvas/video/thumb elements marked `print-src` — class removed on exit. */
const marked: Element[] = []

/** Demo canvases whose walk-time fallback state was frozen into
 *  `print-fallback` — class removed on exit. */
const fallbackMarked: Element[] = []

/** Hero figures stamped `print-bleed`/`print-bleed--landscape` this pass — tags drop on exit. */
const bleedTagged: Element[] = []

/** Title h1s re-parented into their hero's bleed block this pass —
 *  each record restores element, parent and position on exit. */
const bleedHeads: { el: Element; parent: Node; next: Node | null }[] = []

/** Figures reparented into `.print-plate` wrappers — restored on exit. */
const bleedMoved: { el: Element; parent: Node; next: Node | null }[] = []

/** Videos neutralized for the committed DOM — paper only ever shows
 *  their still/copy, but Chromium's print pipeline walks every live
 *  HTMLMediaElement and a wall of player objects turns the snapshot
 *  into a multi-minute stall. Neutralizing in place (src + <source>
 *  children stripped, load() resets the pipeline) costs the same zero
 *  render work as detaching but keeps `previousElementSibling` honest
 *  for the src-less promotion checks that follow the element — an
 *  el.remove() mid-walk re-parents the "thumb sibling" relation onto
 *  whatever precedes the gap and a bare img after a parked video would
 *  promote off (then dedup-retire) an unrelated earlier layer. Element
 *  children re-seat on exit; the src attr rides `touched` like every
 *  recorded write. */
const videoParked: { el: HTMLVideoElement; kids: Node[] }[] = []

/** Hero plates queued for body-level seating after the covers exist. */
const hoistedPlates: Element[] = []

/** Injected `.print-copy` stand-ins, `.print-caption` lines and QR links
 *  — all removed on exit. */
const copies: Element[] = []

/** Imgs the committed pass already upgraded — refreshMedia must never
 *  re-decide them: the rung pick reads live box geometry, which changes
 *  under print CSS, so a second pass re-points a decoded layer at a
 *  colder rung and the snapshot prints the cold URL blank. Retired
 *  (`marked`) layers stay OUT of the set so the rescue arm can still
 *  un-retire one that wins a real src between passes. */
const imgDecided = new Set<Element>()

/**
 * Layer identity key — rung suffixes AND the emission extension fold, so
 * `X.jpg`, `X.webp` and `X-mozjpg-75-mobile.jpg` all key to `X`: stacked
 * renderers pick the codec per layer (thumb ships jpg, high may ship
 * webp), which made extension-sensitive keys treat one stack's layers as
 * different media and print both. `-thumb` stays part of the key — a
 * thumb file is its own emission (a video still, an LQIP serving a
 * different role), retired via its still's src rewrite; folding it would
 * let a later `X-thumb` retire the real `X`.
 */
const STEM_KEY = /(?:(?:-mozjpg[^/.]*)|-mobile)*\.(?:jpg|jpeg|png|webp|avif)$/i

/** One media's dedup key — rung-free, extension-free identity. */
const stemKey = (src: string): string => src.replace(STEM_KEY, ATTR_VALUES.EMPTY)

/** True while the printable form is applied — re-entry is a no-op. */
let printing = false

/** Theme class state captured on entry so exit can put it back. */
let darkWasOn = false

/** Module install guard — the boot path may run more than once in tests. */
let installed = false

/** Pending teardown for a matchMedia print-off edge — see the change
 *  listener in initPrintSupport; a re-armed true edge (or an afterprint)
 *  clears it before it can tear a live job down. */
let mmExitTimer: ReturnType<typeof setTimeout> | undefined

/** Pending self-heal check armed once nativePrint() returns — engines
 *  that swallow the call (headless shells, a throttled programmatic
 *  print, a blocked activation) fire no beforeprint and flip no media
 *  query, so no teardown owner ever arrives; the timer unwinds the
 *  committed DOM by hand instead of stranding the page in its print
 *  face. Cleared by exit() like mmExitTimer. */
let dialogGuardTimer: ReturnType<typeof setTimeout> | undefined

/** True once a real print channel engaged — beforeprint's enter() or
 *  the matchMedia true edge. The post-nativePrint guard reads it: a
 *  channel armed inside the grace owns the job's teardown; silence
 *  means the call was swallowed and the job unwinds by hand. */
let sawPrintChannel = false

/** Timestamp of the most recent beforeprint — that event precedes the
 *  media apply by an engine-internal beat (hundreds of ms observed in
 *  headless printToPDF), so a matchMedia false edge inside the gap can
 *  belong to a job that is already live rather than ended. The mm-exit
 *  recheck re-arms while the stamp is inside MM_APPLY_GRACE instead of
 *  erasing the committed DOM the second job is about to paginate. */
let pendingBeforeprintAt = 0

/** The gate veil node seated over the page for the gated job's whole
 *  settle+prep+barrier window AND the open dialog — it drops only in
 *  exit(), with the rest of the print face, so the mutated DOM never
 *  reaches the screen. */
let gateVeil: HTMLElement | null = null

/** Footer hrefs already emitted as `.print-qr-link` codes this pass — a
 *  link repeated across footer regions scans once, not once per copy. */
const emittedLinks = new Set<string>()

/** Marked `[data-print-link]` hrefs already emitted this pass — kept
 *  separate from the footer set so a directory row (sitemap) still shows
 *  its own code when a footer happens to link the same route. */
const emittedRegionLinks = new Set<string>()

/** Media URLs the browser is known to have fetched already — marked at
 *  each img's load resolution. The barrier-less beforeprint pass may
 *  only swap toward one of these: a cold swap trades a decoded screen
 *  src for a fetch that races the snapshot blank. */
const warmReady = new Set<string>()

/** Fetch/decode promises kicked by the prep pass — the gated entry
 *  (Ctrl/Cmd+P, window.print) awaits them before opening the dialog so
 *  the snapshot can't race a cold rung into a missing image. The
 *  beforeprint path never reads the list: menu-initiated jobs can't be
 *  deferred, so they hold decoded sources and floor-rung swaps instead. */
const pendingPrint: Promise<unknown>[] = []

/** Count of pendingPrint entries that settled — the barrier's progress
 *  signal. Promise state can't be polled, so each tracked entry stamps
 *  `done` on itself: the barrier keeps waiting while the count moves and
 *  bails only when nothing settles for a full PREP_CAP window. */
let pendingSettled = 0

/**
 * Queues a fetch/decode promise in the tracked barrier bag. The wrapped
 * entry stamps its own `done` flag on settle so awaitPendingJobs can see
 * per-entry progress (a raw promise's state is opaque). Undefined
 * decodes (detached imgs, missing APIs) simply don't enqueue.
 * @param job The fetch/decode promise to track.
 */
const trackPending = (job: Promise<unknown> | undefined): void => {
  if (!job) return

  const tracked = job.then(
    () => {
      ;(tracked as { done?: boolean }).done = true

      pendingSettled++
    },
    () => {
      ;(tracked as { done?: boolean }).done = true

      pendingSettled++
    }
  ) as Promise<unknown> & { done?: boolean }

  pendingPrint.push(tracked)
}

/** Media elements carrying screen-time inline styles. recordAttr saves
 *  the value in prep (non-destructive) while the removal waits for
 *  commit — stripping in prep would visibly un-pose carousels and
 *  re-flow media during the decode wait. */
const pendingStyleStrip: Element[] = []

/** True while a gated job sits in its decode wait — a second trigger
 *  during the wait joins silently instead of stacking dialogs. */
let jobRunning = false

/**
 * Routes with nothing a paper document can carry — the search surface and
 * the 404 are interactive chrome, not content. Printing on them still
 * runs, but the job emits exactly one sheet: the black cover with the
 * site scan code and the home link — nothing else.
 */
const PRINT_COVER_ONLY_ROUTES = new Set<string>([ROUTE_NAMES.SEARCH, ROUTE_NAMES.NOT_FOUND])

/**
 * The cover-only gate — true when the current route carries no paper
 * content; prepPrint answers it with the single-sheet document.
 */
const coverOnlyRoute = (): boolean =>
  PRINT_COVER_ONLY_ROUTES.has(router.currentRoute?.name ?? CHAR_STRINGS.EMPTY)

/**
 * The site-root URL every "home" surface points at — the back cover's
 * scan code and the cover-only sheet's QR + printed link share it.
 * @returns `${origin}/` — the unlocalized site root.
 */
const siteHomeUrl = (): string => `${window.location.origin}${ROUTE_PATHS.ROOT}`

/**
 * Trailing video-file grammar a src URL can carry — `X.mp4` plus the
 * `-scaledown-Nx` emission variants (and query/hash tails). Replacing
 * the match with `.mp4.jpg` lands on the poster still every emission
 * ships beside the video.
 */
const VIDEO_STILL = /\.mp4(?:-scaledown-\d+x)?(?:[?#].*)?$/

/**
 * Length of the `YYYY-MM-DD` prefix of an ISO-8601 timestamp — the
 * caption's print-date field reads `new Date().toISOString()` up to the
 * `T` separator.
 */
const ISO_DATE_LEN = 10

/**
 * Width/height ratio at which a bleed figure claims the landscape named
 * page — media wider than this reads better rotated 90° on a portrait
 * job than scaled into the shorter cross-axis.
 */
const BLEED_LANDSCAPE_RATIO = 1.3

/**
 * Counts pending-content stand-ins across the composed tree — every
 * skeleton contract class (`skeleton--shimmer` boxes, `skeleton-host` /
 * `skeleton-overlay` section placeholders) means a route's data or a
 * lazy mount hasn't landed yet. Shadow roots are walked recursively so
 * a pending view skeleton (view-project's host) counts the same as a
 * light-DOM one.
 * @returns Total skeleton stand-ins found.
 */
const countPendingContent = (): number => {
  let count = 0

  const walk = (root: Document | ShadowRoot): void => {
    count += root.querySelectorAll(
      `[class*="${_B_SKELETON}--"],[class*="${_B_SKELETON}-host"],[class*="${_B_SKELETON}-overlay"],[class*="${_B_SKELETON_ABOUT}"]`
    ).length

    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) walk(el.shadowRoot)
    }
  }

  walk(document)

  return count
}

/**
 * One animation-frame pause — the IO callback delivery + re-render beat
 * a scroll step needs before the next position counts.
 */
const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

/**
 * Drops the gate veil — idempotent; every teardown path calls it so the
 * node can never outlive its job.
 */
const dropGateVeil = (): void => {
  gateVeil?.remove()

  gateVeil = null
}

/**
 * Seats the gate veil over the page — the gated job's settle (scroll
 * sweep, figure climbs) and prep (plate reparents, src swaps, layer
 * retirements) all mutate the live tree across a seconds-long decode
 * barrier; watched raw, that build reads as the site glitching. The
 * veil covers the whole wait with the static sheet + orbital rings the
 * print face page carries, so the user sees intent instead of churn.
 * Screen chrome only — the print sheet hides it outright.
 */
const showGateVeil = (): void => {
  dropGateVeil()

  const veil = document.createElement(HTML_TAGS.DIV)

  veil.className = PRINT_CLASSES.VEIL

  const ringOuter = document.createElement(HTML_TAGS.SPAN)

  ringOuter.className = PRINT_CLASSES.VEIL_SPINNER

  const ringInner = document.createElement(HTML_TAGS.SPAN)

  ringInner.className = PRINT_CLASSES.VEIL_SPINNER_INNER

  veil.append(ringOuter, ringInner)

  document.body.appendChild(veil)

  gateVeil = veil
}

/**
 * One poll-tick pause for the settle loop.
 */
const settleTick = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, PRINT_TIMING.SETTLE_TICK))

/**
 * Kicks a figure's lazy high-layer climb directly — the IO observer only
 * arms it near the viewport, so below-fold figures reach print with no
 * layer mounted (the empty-mat failure). `loadHighRes` is the figure's
 * public mount+fetch; the returned promise lands when the rung the layer
 * can prove is painted. Video figures early-return — their print stills
 * come from swapVideo's derived thumbnail instead.
 * @param figure Media-figure host element.
 * @returns The climb promise, or null when the host can't climb.
 */
const kickFigureLoad = (figure: Element): Promise<unknown> | null => {
  const load = (figure as { loadHighRes?: () => Promise<unknown> }).loadHighRes

  if (typeof load !== TYPE_STRINGS.FUNCTION || !load) return null

  return load.call(figure).catch(() => undefined)
}

/**
 * Drives the document to its complete state for the gated print entry —
 * the "sometimes content is missing" race exists because lazy work is
 * viewport-gated: IntersectionObserver arms figure layers and deferred
 * sections only near the fold, and route data reveals on its own clock.
 * A print fired straight away snapshots whichever boxes happened to be
 * mounted. Three passes fix it deterministically:
 *
 * 1. Scroll sweep — steps the scroller through its full height so every
 *    IO callback fires (figure observers arm, draw-text reveals, lazy
 *    mounts enter the DOM), then restores the reader's position.
 * 2. Content poll — waits until no skeleton stand-ins remain for a few
 *    consecutive ticks (route data landed and re-rendered), capped so a
 *    permanently-pending box can't hold the job hostage.
 * 3. Figure climbs — `loadHighRes` on every media-figure forces the
 *    layers that printing actually paints; the climbs settle inside the
 *    caller's barrier cap.
 */
const settleForPrint = async (): Promise<void> => {
  const scroller = document.scrollingElement ?? document.documentElement

  const startY = scroller.scrollTop

  const step = Math.max(1, Math.floor(window.innerHeight * 0.6))

  let swept = false

  for (;;) {
    const bottom = Math.max(0, scroller.scrollHeight - window.innerHeight)

    if (scroller.scrollTop < bottom) {
      scroller.scrollTop = Math.min(bottom, scroller.scrollTop + step)

      swept = true

      await nextFrame()
    } else {
      break
    }
  }

  scroller.scrollTop = startY

  const climbs: Promise<unknown>[] = []

  for (const figure of walkFigures(document)) {
    const climb = kickFigureLoad(figure)

    if (climb) climbs.push(climb)
  }

  await Promise.allSettled(climbs)

  // The data-level signal: skeleton stand-ins disappear when the view's
  // fetch lands and the real tree mounts. The quiet window exists to
  // confirm a pending→clean transition settled (the fetch landed, the
  // re-render may lag a tick) — a document clean on first read that the
  // sweep never moved can't have a swap in flight and exits free rather
  // than paying tick-time for a settled page. The cap keeps a wedged
  // fetch from ever holding the print.
  let quiet = 0
  let sawPending = false

  const deadline = Date.now() + PRINT_TIMING.PREP_CAP

  while (Date.now() < deadline) {
    if (countPendingContent() === 0) {
      if (!sawPending && !swept) break

      if (++quiet >= (sawPending ? PRINT_TIMING.SETTLE_QUIET_TICKS : 1)) break
    } else {
      sawPending = true
      quiet = 0
    }

    await settleTick()
  }
}

/**
 * Records an element's current attribute value exactly once — the first
 * write wins so repeated entry passes can't overwrite the true original.
 * @param el Element being mutated.
 * @param name Attribute name.
 */
const recordAttr = (el: Element, name: string): void => {
  let bag = touched.get(el)

  if (!bag) {
    bag = new Map()

    touched.set(el, bag)
  }

  // Each (element, attribute) pair is written at most once per enter pass
  // — the `printing` flag is the real re-entry guard — so a first write
  // can always record the pristine value. A same-pass second write (an
  // upgraded layer later retiring out of the stack) must not clobber it
  // with the already-mutated value.
  if (!bag.has(name)) bag.set(name, el.getAttribute(name))
}

/**
 * Mutates an attribute while recording its original for restoration.
 * @param el Element being mutated.
 * @param name Attribute name.
 * @param value New attribute value.
 */
const writeAttr = (el: Element, name: string, value: string): void => {
  recordAttr(el, name)

  el.setAttribute(name, value)
}

/**
 * Depth-first generator over the light DOM and every nested shadow root —
 * canvas/video/img surfaces live inside component shadows (docs scenes,
 * menu chrome, widgets), and `querySelectorAll` cannot reach them. Recursion
 * per the traversal rule (rule 20); shadow links form a tree so no visited
 * set is needed.
 * @param root Document or shadow root to walk.
 * @yields Media elements in document order across the whole composed tree.
 */
function* walkMedia(root: Document | ShadowRoot): Generator<Element> {
  const media = root.querySelectorAll(
    `${HTML_TAGS.CANVAS},${HTML_TAGS.VIDEO},${HTML_TAGS.IMG},[${COMMON_ATTRS.STYLE}]`
  )

  for (const el of media) yield el

  const hosts = root.querySelectorAll('*')

  for (const el of hosts) {
    if (el.shadowRoot) yield* walkMedia(el.shadowRoot)
  }
}

/**
 * Depth-first generator yielding every `<media-figure>` host across the
 * composed tree — figures are light-DOM hosts but may nest inside deeper
 * component shadows, so the same recursion as walkMedia applies.
 * @param root Document or shadow root to walk.
 * @yields Media-figure host elements in document order.
 */
function* walkFigures(root: Document | ShadowRoot): Generator<Element> {
  for (const el of root.querySelectorAll(COMPONENT_TAGS.MEDIA_FIGURE)) yield el

  const hosts = root.querySelectorAll('*')

  for (const el of hosts) {
    if (el.shadowRoot) yield* walkFigures(el.shadowRoot)
  }
}

/**
 * Depth-first generator yielding every `<footer>` element across the
 * composed tree — the site footer lives inside `legal-footer`'s shadow
 * (and `awards-mentions` mounts its own), so the same shadow-piercing
 * recursion as walkMedia applies.
 * @param root Document or shadow root to walk.
 * @yields Footer elements in document order.
 */
function* walkFooters(root: Document | ShadowRoot): Generator<Element> {
  for (const el of root.querySelectorAll(HTML_TAGS.FOOTER)) yield el

  const hosts = root.querySelectorAll('*')

  for (const el of hosts) {
    if (el.shadowRoot) yield* walkFooters(el.shadowRoot)
  }
}

/**
 * Depth-first generator yielding every `[data-print-link]` anchor across
 * the composed tree — route indexes (sitemap) mark their primary route
 * anchors so each printed route earns a `.print-qr-link` code, the same
 * scan-code contract footers already get.
 * @param root Document or shadow root to walk.
 * @yields Marked anchor elements in document order.
 */
function* walkLinkRegions(root: Document | ShadowRoot): Generator<Element> {
  for (const el of root.querySelectorAll(`a[${DATA_ATTRS.PRINT_LINK}]`)) yield el

  const hosts = root.querySelectorAll('*')

  for (const el of hosts) {
    if (el.shadowRoot) yield* walkLinkRegions(el.shadowRoot)
  }
}

/**
 * Chrome hosts whose shadows never reach paper — the same set the print
 * sheet hides outright (nav shell, dialogs, toasts, HUD, decks). The TOC
 * walk skips recursing into them so their headings can't pollute the
 * contents list.
 */
const CHROME_HOST_TAGS = new Set([
  COMPONENT_TAGS.APP_NAV,
  COMPONENT_TAGS.SITE_TOAST,
  COMPONENT_TAGS.STATS_HUD,
  COMPONENT_TAGS.SEARCH_MODAL,
  COMPONENT_TAGS.PREFERENCES_MODAL,
  COMPONENT_TAGS.LANG_DIALOG,
  _B_EXPAND_MODAL,
  COMPONENT_TAGS.MEDIA_EXPANDED,
  // The related-projects conveyor is nav chrome — its card titles are
  // route links, not document sections.
  COMPONENT_TAGS.PORTFOLIO_RELATED,
])

/**
 * Depth-first generator yielding every `h2` across the composed tree —
 * section heads and card titles are the contents list's entries, and
 * both live inside component shadows the plain query can't reach.
 * Chrome-host shadows (modals, nav chrome) are skipped: their headings
 * are interactive chrome, not document sections.
 * @param root Document or shadow root to walk.
 * @yields Heading elements in document order across the composed tree.
 */
function* walkHeads(root: Document | ShadowRoot): Generator<Element> {
  for (const el of root.querySelectorAll(`${HTML_TAGS.H1},${HTML_TAGS.H2},${HTML_TAGS.H3}`)) {
    // a11y jump heads (sr-only) never print — the visible twin carries
    // the section's text; collecting both would double-list sections.
    if (el.classList.contains(A11Y_CLASSES.SR_ONLY)) continue

    // Screen-chrome subtrees — [hidden] and [inert] panels are out of
    // the contents contract (the card-stack's all-projects index overlay
    // mounts inert with the same items under a duplicate title). The
    // fan's parked cards carry aria-hidden as a position marker, NOT a
    // visibility state — their titles are the work index and must list.
    if (el.closest(`[${COMMON_ATTRS.HIDDEN}],[${COMMON_ATTRS.INERT}]`)) continue

    yield el
  }

  const hosts = root.querySelectorAll('*')

  for (const el of hosts) {
    if (el.shadowRoot && !CHROME_HOST_TAGS.has(el.tagName.toLowerCase())) {
      yield* walkHeads(el.shadowRoot)
    }
  }
}

/**
 * Emission-encoded extensionless media stem for a media element — a
 * `<media-figure>` host reads its own `src` attribute; an element inside
 * the figure's shadow reads the same attribute off its host — matching
 * figure/load.ts (`encodeMediaUrl(storage + fig.mediaSrc)`). '' for
 * light-DOM media with no figure stem to derive from.
 * @param el Figure host, or element possibly inside a figure shadow.
 * @returns Extensionless CDN stem, or ''.
 */
const mediaStem = (el: Element): string => {
  const isFigure = el.tagName.toLowerCase() === COMPONENT_TAGS.MEDIA_FIGURE
  const root = el.getRootNode()
  const host = isFigure ? el : root instanceof ShadowRoot ? root.host : null

  if (host?.tagName.toLowerCase() !== COMPONENT_TAGS.MEDIA_FIGURE) return ATTR_VALUES.EMPTY

  const src = host.getAttribute(MEDIA_ATTRS.SRC) ?? ATTR_VALUES.EMPTY

  return src ? encodeMediaUrl(store.getters.getStorage() + src) : ATTR_VALUES.EMPTY
}

/**
 * Highest-quality URL for one media stem — the manifest-proven top rung
 * (`mediaRungs` orders lowest→highest, every rung `mediaKeyExists`-gated
 * so the answer can never 404). '' when the manifest proves nothing —
 * covers and video stems emit no `-mozjpg-uncompressed` object, so a
 * grammar guess would trade a working image for a broken one; the
 * element keeps whatever src already stands (the original when the
 * manifest hasn't landed, per the originals-only render contract).
 * @param stem Extensionless emission-encoded stem.
 * @returns Proven full-quality .jpg URL, or ''.
 */
const stemTopUrl = (stem: string): string => {
  const rungs = mediaRungs(stem)
  const top = rungs[rungs.length - 1]

  return top ? top.jpg : ATTR_VALUES.EMPTY
}

/**
 * Smallest manifest-proven .jpg for one stem — the floor rung. The
 * un-gated print path can't wait on a fetch, so an undecoded img swaps
 * here instead of holding a multi-megabyte original: a ~100KB cold pull
 * clears the snapshot window a multi-megabyte one never does. '' when
 * the manifest proves nothing.
 * @param stem Extensionless emission-encoded stem.
 * @returns Proven floor .jpg URL, or ''.
 */
const stemFloorUrl = (stem: string): string => mediaRungs(stem)[0]?.jpg ?? ATTR_VALUES.EMPTY

/**
 * Rungs skipped below the top for a small box the `-mobile` ladder can't
 * serve — mirrors the screen climb's box term (`ladderCeiling` drops two
 * for ≤768px boxes: the raw original and uncompressed tiers). Rungs are
 * quality re-encodes at IDENTICAL pixel dimensions — a ~15–25MB
 * uncompressed full-page still resolves nothing a ~2MB q75 doesn't at
 * card size, so summoning it for a wall of tiles trades ~800MB of fetches
 * the barrier can't drain for paper-indistinguishable pixels.
 */
const PRINT_SMALL_BOX_RUNG_SKIP = 2

/**
 * Print-resolution URL for one media stem — the TOP rung of the
 * appropriate ladder. Paper resolves far more detail than a CSS pixel
 * does and the gated job waits for the pull, so print deliberately
 * ignores the screen budget's ceiling: every image lands at the best
 * tier the manifest proves. Small boxes (cards, tiles) take the
 * `-mobile` derivative ladder — its top rung is the highest resolution
 * that derivative exists at, which already oversamples a thumbnail on
 * paper — and when no mobile tier exists they still skip the full
 * ladder's multi-megabyte top rungs (see PRINT_SMALL_BOX_RUNG_SKIP).
 * Full-width and unmeasured media climbs to the uncompressed original.
 * Every returned URL is `mediaKeyExists`-proven — the pick can never
 * fabricate a 404.
 * @param stem Extensionless emission-encoded stem.
 * @param boxW Rendered width of the media box in CSS px (≤0 = unknown).
 * @returns Proven top-tier .jpg URL, or ''.
 */
const stemPrintUrl = (stem: string, boxW: number): string => {
  // A box at or under the small-media rung over-resolves nothing past the
  // 768px derivative — the mobile ladder holds the same ascending tiers at
  // a fraction of the bytes; when the manifest proves no mobile tier the
  // full ladder answers with its top rungs skipped rather than its apex.
  const mobile = smallMediaBox(boxW)
    ? mediaRungs(`${stem}${MEDIA.MOBILE_SUFFIX}`)
    : ([] as ReturnType<typeof mediaRungs>)

  const rungs = mobile.length ? mobile : mediaRungs(stem)

  const top =
    mobile.length || !smallMediaBox(boxW)
      ? rungs.length - 1
      : Math.max(0, rungs.length - 1 - PRINT_SMALL_BOX_RUNG_SKIP)

  const pick = rungs[top]

  return pick ? pick.jpg : ATTR_VALUES.EMPTY
}

/**
 * The img's laid-out box width — the rung pick's box term. During prep the
 * element still holds its screen geometry (print CSS applies at the
 * commit), which is the closest honest proxy for the printed tile size;
 * a 0/unknown box applies no small-media term.
 * @param img Image being resolved.
 * @returns Box width in CSS px, or 0 when unmeasurable.
 */
const printBoxWidth = (img: HTMLImageElement): number => img.getBoundingClientRect().width || 0

/**
 * Best printable URL for an image — the figure-stem ladder for shadow
 * media, or the uncompressed tier derived off the img's own mozjpg URL
 * for article/reader images. '' when neither applies, so callers keep
 * whatever src already stands.
 * @param img Image being upgraded.
 * @returns Full-quality URL, or ''.
 */
const printSourceUrl = (img: HTMLImageElement): string => {
  // Figure-shadow imgs never reach here — the collect pass skips
  // stem-carrying layers so the figure's own host caption cites the
  // media once, not once per stack layer. Every surviving img carries a
  // src: the src-less path retired to `print-src` in upgradeImage and
  // filtered out before the caption walk.
  const src = img.getAttribute(MEDIA_ATTRS.SRC) as string

  // `X.jpg-thumb.jpg` is by definition the thumbnail OF `X.jpg` — the
  // still ships beside every emitted thumb, so un-figured thumb layers
  // (if any render that grammar directly) climb to their own still.
  const stemmed = src.endsWith(MEDIA.THUMB_EXT) ? src.replace(MEDIA.THUMB_EXT, MEDIA.EXT) : src

  // Every runged/plain derivative — `X-mozjpg-*`, `X-mobile`, `X.webp`,
  // the bare `X.jpg` original — folds to one stem and climbs the proven
  // ladder, so paper always gets the manifest's best tier (uncompressed
  // when emitted). An unproven stem yields '' and the caller keeps
  // `stemmed` — the still for thumbs, the untouched src otherwise.
  return stemTopUrl(stemKey(stemmed)) || stemmed
}

/**
 * The fetch URL a printed image actually pulls — same derivation as
 * printSourceUrl but budget-aware: the rung comes from stemPrintUrl's
 * box/budget pick rather than the top of the ladder, so a wall of small
 * cards doesn't summon hundreds of uncompressed multi-megabyte pulls
 * that outrun the prepare cap and leave the tail of the job blank. The
 * caption still cites the canonical top URL via printSourceUrl — the
 * credit points at the full-quality file while the fetch stays sane.
 * @param img Image being upgraded.
 * @returns Proven print-resolution URL, or ''.
 */
const printImageUrl = (img: HTMLImageElement): string => {
  const stem = mediaStem(img)
  const src = img.getAttribute(MEDIA_ATTRS.SRC) ?? ATTR_VALUES.EMPTY
  const boxW = printBoxWidth(img)

  if (stem) {
    const host = (img.getRootNode() as ShadowRoot).host as Element
    const isVideo =
      host.hasAttribute(MEDIA_ATTRS.IS_VIDEO) &&
      host.getAttribute(MEDIA_ATTRS.IS_VIDEO) !== ATTR_VALUES.FALSE

    if (isVideo) {
      // A decoded live frame beats every emitted still — the pipeline's
      // `stem.mp4.jpg` poster captures t=0, which for screen recordings
      // that fade in from white IS a white page. The element holds the
      // real current frame once it has data.
      const video = (img.getRootNode() as ParentNode).querySelector(
        HTML_TAGS.VIDEO
      ) as HTMLVideoElement | null

      const frame = video ? captureVideoFrame(video) : ATTR_VALUES.EMPTY

      if (frame) return frame

      const still = `${stem}${MEDIA.VIDEO_EXT}${MEDIA.EXT}`

      // The still must be manifest-proven — an un-emitted `X.mp4.jpg`
      // (e.g. a scaledown-only source) is a 404, not a printable frame.
      // '' keeps whatever src the layer already stands.
      return mediaKeyExists(still) ? still : ATTR_VALUES.EMPTY
    }

    return stemPrintUrl(stem, boxW)
  }

  const stemmed = src.endsWith(MEDIA.THUMB_EXT) ? src.replace(MEDIA.THUMB_EXT, MEDIA.EXT) : src

  return stemPrintUrl(stemKey(stemmed), boxW) || stemmed
}

/**
 * Marks a resolved img's current URL as print-safe — `warmReady` is the
 * swap gate's "already fetched" proof, so it records what the browser
 * decoded rather than fetching anything itself. An idle pull of the
 * print rung is a page-speed tax a print pass may never repay: warming
 * only ever observes decoded bytes, never summons them. `currentSrc`
 * leads because it is the URL the network actually settled — the bare
 * attribute can still read a rung the loader swapped past.
 * @param img Image element that just finished loading on screen.
 */
const warmPrintSource = (img: HTMLImageElement): void => {
  const url = img.currentSrc || img.getAttribute(MEDIA_ATTRS.SRC) || ATTR_VALUES.EMPTY

  if (url.startsWith(ATTR_VALUES.HTTP)) warmReady.add(url)
}

/**
 * Idle mark sweep over the whole composed tree — every resolved img's
 * current URL joins `warmReady` so a later barrier-less print pass can
 * prove the swap target is already fetched. Runs after install and
 * again whenever the MutationObserver sees new nodes (route renders
 * mount fresh media long after the first sweep). Marks only — repeated
 * sweeps cost a DOM walk and nothing else, and no idle pass ever pulls
 * bytes the screen didn't already need.
 */
const sweepWarm = (): void => {
  // Deferred sweeps can outlive their DOM — module-level queues arm
  // before mount in node-eval contexts (the main.js warm-up suites run
  // with no document at all), and a queued tick firing there must no-op
  // instead of crashing the timer.
  if (printing || typeof document === TYPE_STRINGS.UNDEFINED) return

  for (const el of walkMedia(document)) {
    if (el.tagName === HTML_TAGS.IMG.toUpperCase()) {
      warmPrintSource(el as HTMLImageElement)
    }
  }
}

/** True while a sweep is queued for the next idle slice — coalesces bursts. */
let sweepQueued = false

/**
 * Defers one `sweepWarm` to the next idle slice — requestIdleCallback
 * with a bounded timeout when available, the short setTimeout fallback
 * otherwise (the same scheduler contract route-warmer uses). DOM growth
 * fires this per mutation batch; the `sweepQueued` flag collapses a
 * route render's many mutations into a single sweep.
 */
const queueSweep = (): void => {
  if (sweepQueued) return

  sweepQueued = true

  const run = (): void => {
    sweepQueued = false

    sweepWarm()
  }

  if (typeof window.requestIdleCallback === TYPE_STRINGS.FUNCTION) {
    window.requestIdleCallback(run, { timeout: PREFETCH_CONFIG.IDLE_TIMEOUT })
  } else {
    setTimeout(run, PREFETCH_CONFIG.FALLBACK_DELAY)
  }
}

/**
 * Builds one injected QR link — an `<a>` wrapping the `qrSvg` code so the
 * printed page deep-links into the full-size asset. Returns null when the
 * payload exceeds the encoder's capacity.
 * @param url URL the QR encodes and the anchor links to.
 * @param cls Print class tag (`print-qr` or `print-qr-page`).
 * @returns The anchor element, or null.
 */
const qrLink = (url: string, cls: string): HTMLAnchorElement | null => {
  const svg = qrSvg(url)

  if (!svg) return null

  const link = document.createElement(HTML_TAGS.A)

  link.className = cls
  link.setAttribute(LINK_ATTRS.HREF, url)
  link.setAttribute(ARIA_ATTRS.ARIA_LABEL, url)
  // Print-only node — the screen-hide no longer ships in the main sheet
  // (print css moved to its own media link), so the attr itself is the
  // screen contract; the print sheet's display rule wins on paper.
  link.setAttribute(COMMON_ATTRS.HIDDEN, ATTR_VALUES.EMPTY)
  link.appendChild(svg)

  return link
}

/**
 * Retires a printed img whose decode rejected — the asset is genuinely
 * broken (the gated entry awaited it and the fetch still failed), so a
 * blank box + orphaned credit line must not reach the paper. The img
 * drops to `.print-src`; when it was the LAST printable layer inside a
 * figure shadow, the emptied host collapses too and the caption/QR the
 * figure pass seated after it goes with it — a "Source:" line floating
 * alone reads as a bug, not a credit. Guarded on `printing`: a decode
 * that lands after teardown leaves the DOM untouched.
 * @param img The img whose fetch+decode failed.
 */
const retireFailedPrintImg = (img: HTMLImageElement): void => {
  if (!printing || img.classList.contains(PRINT_CLASSES.SRC)) return

  // A rejection landing while the img still has a fetch in flight (or
  // already holds decoded paint) is stale — its decode tracked a src
  // the element has since moved past. Only a fully-settled broken
  // image earns the retire; hiding a mid-flight layer would guarantee
  // blank where the snapshot might still have found paint.
  if (!img.complete || img.naturalWidth > 0) return

  img.classList.add(PRINT_CLASSES.SRC)

  marked.push(img)

  const root = img.getRootNode()

  if (root instanceof ShadowRoot) {
    const host = root.host as Element

    // A surviving sibling layer keeps the figure printable — only an
    // emptied well collapses (its mat would paint a white box).
    const surviving = [...root.querySelectorAll(HTML_TAGS.IMG)].some(
      (l) => !l.classList.contains(PRINT_CLASSES.SRC) && l.getAttribute(MEDIA_ATTRS.SRC)
    )

    if (!surviving && !host.nextElementSibling?.classList.contains(PRINT_CLASSES.COPY)) {
      host.classList.add(PRINT_CLASSES.SRC)

      marked.push(host)

      let sib = host.nextElementSibling

      while (
        sib &&
        (sib.classList.contains(PRINT_CLASSES.CAPTION) ||
          sib.classList.contains(PRINT_CLASSES.QR_LINK))
      ) {
        const dead = sib

        sib = sib.nextElementSibling

        dead.remove()
      }
    }

    return
  }

  // Light-DOM img — its caption seats as the anchor's immediate next
  // sibling (QRs seat after the caption); a retired image can't keep it.
  const anchor =
    (img.closest(`${HTML_TAGS.A}`) as Element | null) ??
    (img.closest(HTML_TAGS.PICTURE) as Element | null) ??
    img

  const orphan = anchor.nextElementSibling

  if (orphan?.classList.contains(PRINT_CLASSES.CAPTION)) orphan.remove()
}

/**
 * Decode-failure rescue for a printed img — `mediaKeyExists` proves an
 * object EXISTS on the bucket, not that its bytes decode (a truncated or
 * corrupt tier still lists). A rejected rung therefore steps DOWN the
 * stem's proven ladder before the layer may retire; every candidate is
 * manifest-gated, so the rescue can't fabricate a 404. Only a ladder
 * src can step — an upgraded img always lands on a proven rung (a kept
 * non-rung src, like a share capture or unproven stem, has no ladder to
 * descend and retires as before), and a src already at the floor does
 * too. The re-tracked decode is bounded by the ladder's depth, so the
 * chain always terminates.
 * @param img The img whose fetch+decode rejected.
 */
const demotePrintImg = (img: HTMLImageElement): void => {
  const current = img.getAttribute(MEDIA_ATTRS.SRC) ?? ATTR_VALUES.EMPTY

  const rungs = mediaRungs(stemKey(current))

  const idx = rungs.findIndex((rung) => rung.jpg === current)

  if (idx <= 0) {
    retireFailedPrintImg(img)

    return
  }

  writeAttr(img, MEDIA_ATTRS.SRC, rungs[idx - 1].jpg)

  trackPending(img.decode?.().catch(() => demotePrintImg(img)))
}

/**
 * Injects a `.print-caption` source line after a printed media surface —
 * "Source: <asset URL> · <print date> · <author>", so every listed
 * image/video attributes its file, the day the page was printed, and
 * Luis Krötz. The URL rides a real anchor so a digital PDF copy keeps
 * the link clickable; paper output reads the URL text itself.
 * @param anchor Element the caption follows (media surface or its copy).
 * @param url Asset URL the caption links to.
 * @param before Seats the caption before the anchor instead — a bleed
 *   figure's caption needs a static position inside the spread page, or
 *   the abs-positioned box lands on the next sheet's fragment.
 */
const addCaption = (anchor: Element, url: string, before = false): void => {
  // Only http(s) payloads produce a followable source link — data: URIs
  // (svg placeholders, canvas stills) and empty stems carry none.
  if (!url.startsWith(ATTR_VALUES.HTTP)) return

  const cap = document.createElement(HTML_TAGS.P)

  cap.className = PRINT_CLASSES.CAPTION
  cap.setAttribute(COMMON_ATTRS.HIDDEN, ATTR_VALUES.EMPTY)

  const link = document.createElement(HTML_TAGS.A)

  link.setAttribute(LINK_ATTRS.HREF, url)
  link.textContent = url

  cap.append(
    `${MEDIA_CREDIT_LABELS.SOURCE}: `,
    link,
    `${MEDIA_CREDIT_SEPARATOR}${new Date().toISOString().slice(0, ISO_DATE_LEN)}${MEDIA_CREDIT_SEPARATOR}${BASE_TITLE}`
  )

  if (before) anchor.before(cap)
  else anchor.after(cap)

  copies.push(cap)
}

/**
 * Injects a small `.print-qr-link` code under a link — paper readers
 * scan into that link's own destination (a footer URL, or a card's own
 * project route when the card media lives inside its anchor). One code
 * per unique href across the whole page — deck cards and index-overlay
 * twins share theirs, so the first emitter wins. `#`/empty hrefs carry
 * nothing to scan; the code seats as the anchor's next sibling.
 * @param anchor `a[href]` element (footer link or media card link).
 * @param emitted Dedup set for this emission domain — footers + media
 *   cards share `emittedLinks`; `[data-print-link]` directory rows use
 *   their own set so a route listed in both still scans on the row.
 */
const addLinkQr = (anchor: HTMLAnchorElement, emitted = emittedLinks): void => {
  // Both call sites only deliver `a[href]` anchors — the footer query
  // selects on the attribute and the card arm's http gate implies it —
  // so getAttribute can't come back null here.
  const href = anchor.getAttribute(LINK_ATTRS.HREF) as string

  // `#`-only fragments and empty hrefs have no scannable destination.
  if (!href || href.startsWith(CHAR_STRINGS.HASH)) return

  // `anchor.href` resolves relative hrefs against the document base —
  // mailto:/tel: pass through already-absolute.
  const url = anchor.href

  if (emitted.has(url)) return

  const link = qrLink(url, PRINT_CLASSES.QR_LINK)

  if (!link) return

  anchor.after(link)

  copies.push(link)

  emitted.add(url)
}

/**
 * Injects a `.print-link-url` line under a `[data-print-link]` anchor —
 * the real resolvable destination spelled out in type, so a paper reader
 * doesn't have to decode a QR or trust a rounded pill to know where the
 * row leads. Sibling of the `.print-qr-link` injection: the sitemap's
 * directory rows mark their title anchors with `data-print-link`, and
 * the row's print layout seats this line under the title while the QR
 * keeps the right edge. Every marked anchor gets its own line (no href
 * dedup — two rows pointing at one URL still each need the readable
 * destination under their own title).
 * @param anchor Marked title anchor (`a[href][data-print-link]`).
 */
const addLinkUrl = (anchor: HTMLAnchorElement): void => {
  const href = anchor.getAttribute(LINK_ATTRS.HREF)

  if (!href || href.startsWith(CHAR_STRINGS.HASH)) return

  const link = document.createElement(HTML_TAGS.A)

  link.className = PRINT_CLASSES.LINK_URL
  link.setAttribute(LINK_ATTRS.HREF, anchor.href)
  link.setAttribute(COMMON_ATTRS.HIDDEN, ATTR_VALUES.EMPTY)

  // The absolute URL reads as the line — on paper the anchor's own
  // text is the page title; the destination is the point.
  link.textContent = anchor.href

  anchor.after(link)

  copies.push(link)
}

/**
 * Printable source URL for a `<media-figure>` — the `.mp4` file for
 * video figures (paper readers scan into the real media, not the
 * poster), the manifest-proven top rung for image figures, falling back
 * to the live shadow img's own src when the stem proves nothing.
 * @param figure Media-figure host element.
 * @returns http(s) source URL, or ''.
 */
const figureSourceUrl = (figure: Element): string => {
  const stem = mediaStem(figure)

  const isVideo =
    figure.hasAttribute(MEDIA_ATTRS.IS_VIDEO) &&
    figure.getAttribute(MEDIA_ATTRS.IS_VIDEO) !== ATTR_VALUES.FALSE

  if (isVideo) return stem ? `${stem}${MEDIA.VIDEO_EXT}` : ATTR_VALUES.EMPTY

  const top = stem ? stemTopUrl(stem) : ATTR_VALUES.EMPTY

  if (top) return top

  const img = figure.shadowRoot?.querySelector(HTML_TAGS.IMG) as HTMLImageElement | null

  return img?.getAttribute(MEDIA_ATTRS.SRC) ?? ATTR_VALUES.EMPTY
}

/**
 * Seats a figure's `.print-caption` after the host — or after the
 * poster-still copy the video swap injected next to it, so the caption
 * lands under the visible media rather than between host and still.
 * @param figure Media-figure host element.
 */
const addFigureCaption = (figure: Element): void => {
  let anchor = figure

  while (anchor.nextElementSibling?.classList.contains(PRINT_CLASSES.COPY)) {
    anchor = anchor.nextElementSibling
  }

  // No caption for a figure that prints nothing — a host whose every
  // shadow layer was retired to `.print-src` (or never carried a real
  // src) collapses to a zero box, and a source line floating alone at
  // the top of the next sheet reads as a bug, not a credit.
  const layers = figure.shadowRoot?.querySelectorAll(HTML_TAGS.IMG) ?? []

  const visible = [...layers].some(
    (img) => !img.classList.contains(PRINT_CLASSES.SRC) && img.getAttribute(MEDIA_ATTRS.SRC)
  )

  if (!visible && anchor === figure) return

  addCaption(anchor, figureSourceUrl(figure), figure.classList.contains(PRINT_CLASSES.BLEED))
}

/**
 * Data-URL of a video's CURRENT decoded frame — the pipeline's
 * `stem.mp4.jpg` poster captures t=0, which for screen recordings that
 * fade in from a blank page IS the blank page, so a played element's
 * live frame is the honest still. The element carries
 * `crossorigin=anonymous` and the storage bucket answers ACAO:*, so the
 * drawImage read never taints. '' when no frame is decoded yet
 * (readyState below HAVE_CURRENT_DATA keeps videoWidth at 0) or the
 * read throws.
 * @param video Video element to read.
 * @returns PNG data URL, or ''.
 */
const captureVideoFrame = (video: HTMLVideoElement): string => {
  if (video.readyState < video.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
    return ATTR_VALUES.EMPTY
  }

  const canvas = document.createElement(HTML_TAGS.CANVAS)

  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  try {
    const ctx = canvas.getContext(WEBGL_STRINGS.CONTEXT_2D)

    if (!ctx) return ATTR_VALUES.EMPTY

    ctx.drawImage(video, 0, 0)

    const url = canvas.toDataURL(NET_STRINGS.IMAGE_PNG)

    return url.startsWith(NET_STRINGS.DATA_COLON) ? url : ATTR_VALUES.EMPTY
  } catch {
    return ATTR_VALUES.EMPTY
  }
}

/**
 * Asks the owning engine for a fresh frame, then falls back to reading the
 * preserved buffer. Engines that render-on-demand (docs arch-scene) listen
 * for `printcapture` and write detail.dataUrl after re-painting; engines
 * that keep the last frame (star-field, earth — preserveDrawingBuffer)
 * satisfy the direct toDataURL read.
 * @param canvas Canvas to read.
 * @returns PNG data URL, or '' when neither path produced pixels.
 */
const captureCanvas = (canvas: HTMLCanvasElement): string => {
  const detail: { dataUrl?: string; skip?: boolean } = {}

  canvas.dispatchEvent(new CustomEvent(PRINT_EVENTS.CAPTURE, { detail }))

  // The listener declined the read (e.g. the widget fell back to CSS
  // before capture ran) — the surface's own fallback owns the print
  // paint, so no still is stamped at all.
  if (detail.skip) return ATTR_VALUES.EMPTY

  if (detail.dataUrl) return detail.dataUrl

  // `data-print-capture` marks a driver-owned surface (anim-demo stages):
  // only its armed listener knows when the buffer is honest — a blind
  // toDataURL on an unmounted or unpainted widget canvas just serializes
  // transparency into a blank still. Declining hands the stage's CSS
  // fallback (or the plain stage box) the print slot instead.
  if (canvas.hasAttribute(DATA_ATTRS.PRINT_CAPTURE)) return ATTR_VALUES.EMPTY

  try {
    return canvas.toDataURL(NET_STRINGS.IMAGE_PNG)
  } catch (err) {
    devWarn('print: canvas capture failed', err)

    return ''
  }
}

/**
 * Places a stand-in where it will actually print. Stand-ins for surfaces
 * inside the reader article replace in place. When the article IS the
 * print surface (live mirror — children, no parked `> div` wrapper),
 * stand-ins for app-chrome surfaces move into it since the print sheet
 * hides #app. Otherwise the live app prints and the still seats at the
 * media's own slot: a shadow source anchors after the host of the shadow
 * it lives in — one boundary crossing, so the still keeps the record or
 * card its source belongs to (a component-level print contract like
 * `.print-copy`/`caption` in the host sheet still styles it — the same
 * way shadow-seated captions already print). Only `hoist` climbs past
 * further ancestors to the outermost host: landscape plates wrap the
 * copy in a light-DOM `.print-plate` that the document sheet owns.
 * @param src Live element being replaced.
 * @param copy Injected stand-in element.
 * @param hoist Climb to the outermost host instead of the immediate one.
 */
const placeCopy = (src: Element, copy: HTMLElement, hoist: boolean): void => {
  const article = document.querySelector(`${HTML_TAGS.ARTICLE}.${READER_CLASSES.CONTENT}`)

  if (article?.contains(src)) {
    src.after(copy)

    return
  }

  const mirror =
    article !== null &&
    article.children.length > 0 &&
    !Array.from(article.children).some((child) => child.tagName === HTML_TAGS.DIV.toUpperCase())

  if (mirror) {
    article.appendChild(copy)

    return
  }

  // The outermost-host climb exists for the scene plate: a landscape
  // still must land where the document-level plate rules can wrap it —
  // inside a nested view shadow those light-DOM rules never reach
  // (view-space-playground sits inside app-root's shadow).
  if (hoist) {
    const outerHost = (el: Element): Element => {
      const r = el.getRootNode()

      return r instanceof ShadowRoot ? outerHost(r.host as Element) : el
    }

    outerHost(src).after(copy)

    return
  }

  const root = src.getRootNode()

  // Shadow source → seat the still as its host's next sibling: the
  // host's own sheet styles `.print-copy` (shadow-seated captions prove
  // the pattern), and the still stays glued to the record/card it
  // belongs to instead of drifting to the document tail. Multi-canvas
  // stages (the flag row) emit one still per surface — walking past the
  // already-seated copies keeps them in source order.
  if (root instanceof ShadowRoot) {
    let anchor = root.host as Element

    while (anchor.nextElementSibling?.classList.contains(PRINT_CLASSES.COPY)) {
      anchor = anchor.nextElementSibling
    }

    anchor.after(copy)

    return
  }

  src.after(copy)
}

/**
 * Injects a `.print-copy` stand-in after/alongside `src` and tags `src` so
 * the print sheet hides the live version.
 * @param src Live element (canvas or video).
 * @param url Image URL the stand-in renders.
 * @param hoist Seat the still after the outermost host (landscape plates
 *   only — ordinary stills keep their immediate shadow host).
 * @returns The injected stand-in img.
 */
const swapInCopy = (src: Element, url: string, hoist = false): HTMLImageElement => {
  const img = document.createElement(HTML_TAGS.IMG)

  img.className = PRINT_CLASSES.COPY
  img.setAttribute(COMMON_ATTRS.HIDDEN, ATTR_VALUES.EMPTY)
  img.alt = ''
  img.src = url
  writeAttr(img, MEDIA_ATTRS.DECODING, MEDIA_ATTRS.DECODING_SYNC)

  // The gated entry awaits this — a data-URL still decodes fast, and
  // awaiting it guarantees the plate pixels are in hand at snapshot.
  trackPending(img.decode?.())

  placeCopy(src, img, hoist)

  copies.push(img)

  src.classList.add(PRINT_CLASSES.SRC)

  marked.push(src)

  return img
}

/**
 * Upgrades a lazy/deferred image so it actually resolves at full quality
 * before the print snapshot: src-less layers inherit their sibling's URL,
 * then everything moves to the highest proven rung (uncompressed) through
 * the figure stem or the img's own mozjpg grammar; srcset ladders are
 * dropped so the chosen src can't be overridden, and loading/decoding go
 * eager/high/sync. When the upgrade lands on a media-figure high layer,
 * its LQIP/thumb siblings are tagged `print-src` so paper shows only the
 * sharp copy.
 * @param img Image element (light DOM or inside a media-figure shadow).
 */
const upgradeImage = (img: HTMLImageElement): void => {
  // A layer retired src-less by an earlier pass can win its src back —
  // the figure's kicked climb mounts it between beforeprint passes
  // (menu prints snapshot the walk's own DOM; refreshMedia rides the
  // second beforeprint). Un-mark it and let the rest of the pass treat
  // it as fresh media.
  const rescued = img.getAttribute(MEDIA_ATTRS.SRC) ?? ATTR_VALUES.EMPTY

  if (
    img.classList.contains(PRINT_CLASSES.SRC) &&
    rescued &&
    !rescued.startsWith(NET_STRINGS.DATA_COLON)
  ) {
    img.classList.remove(PRINT_CLASSES.SRC)
  }

  // The svg placeholder only boxes the on-screen ratio — paper prints
  // the real layer, so placeholder-class imgs and any inline data-URI
  // surface retire outright instead of painting the gray box.
  const src = img.getAttribute(MEDIA_ATTRS.SRC) ?? ATTR_VALUES.EMPTY

  if (
    img.classList.contains(MEDIA_CLASSES.RENDER_PLACEHOLDER) ||
    src.startsWith(NET_STRINGS.DATA_COLON)
  ) {
    img.classList.add(PRINT_CLASSES.SRC)

    marked.push(img)

    return
  }

  const prev = img.previousElementSibling

  // Src-less high layers (the lazy loader leaves `src=""` until the
  // figure enters the viewport) promote from the rendered thumb sibling
  // — the proven top rung lands first (the bare `X.jpg` original often
  // isn't even emitted), with `X.jpg` itself as the manifest-gated
  // fallback so the swap never fabricates a 404. Print quality wins over
  // preview latency here: the engine waits on the fetch the swap kicks,
  // so a cold top rung still resolves before the snapshot renders.
  if (!img.getAttribute(MEDIA_ATTRS.SRC) && prev?.hasAttribute(MEDIA_ATTRS.SRC)) {
    const thumbSrc = prev.getAttribute(MEDIA_ATTRS.SRC) as string
    const original = thumbSrc.replace(`${MEDIA.MOZ}${MEDIA.THUMB_SUFFIX}`, ATTR_VALUES.EMPTY)
    // Prefer the figure stem — it carries the storage base printImageUrl
    // derives `best` from, so a relative-thumb promotion lands on the same
    // absolute URL and the swap guard below reads them as one rung.
    const promoted = stemPrintUrl(mediaStem(img) || stemKey(original), printBoxWidth(img))

    if (promoted) writeAttr(img, MEDIA_ATTRS.SRC, promoted)
    else if (mediaKeyExists(original) && original === thumbSrc) {
      writeAttr(img, MEDIA_ATTRS.SRC, original)
    }
  }

  const best = printImageUrl(img)
  const current = img.getAttribute(MEDIA_ATTRS.SRC) ?? ATTR_VALUES.EMPTY

  // The proven top rung lands only under the gated job (the decode
  // barrier waits on it). Every barrier-less arm refuses to touch a
  // src that can already paint — assigning a different URL, even a
  // cache-warm one, resets the img's decode state inside the snapshot
  // window and prints blank where the standing src was ready: the
  // "sometimes no image" failure, and the reason refreshMedia on a
  // committed job must never re-swap. A dead src takes whatever cold
  // pull can win pixels back (floor rung first, top tier when the
  // floor IS the dead URL); a merely-undecoded one prefers the top
  // rung when its bytes already sit in cache (warmReady marks resolved
  // currentSrcs — never prefetched, page speed stays clean) and
  // otherwise trades its multi-megabyte original for the floor rung
  // the snapshot window can still honour. A decoded src always stands
  // — screen-rung quality beats a blank mat. Only manifest-proven
  // candidates are ever written, so the swap can't fabricate a 404;
  // when `best` comes back '' the element keeps whatever src already
  // stands. The source caption still cites the canonical top URL
  // (printSourceUrl re-derives it off the same stem), so the credit
  // stays honest.
  if (best && best !== current) {
    const undecoded = !(img.complete && img.naturalWidth > 0)
    const currentDead = !current || (img.complete && img.naturalWidth === 0)

    if (jobRunning) {
      writeAttr(img, MEDIA_ATTRS.SRC, best)
    } else if (currentDead) {
      // Nothing to lose — the standing src can't paint, so any cold
      // pull only wins pixels back; the floor rung clears the snapshot
      // window more often than the top tier does. A floor equal to the
      // dead src counts as no rescue — fall to `best`.
      const floor = stemFloorUrl(stemKey(current))

      writeAttr(img, MEDIA_ATTRS.SRC, floor && floor !== current ? floor : best)
    } else if (undecoded) {
      // Still cold and not broken — the lazy fetch never ran (below
      // fold, native beforeprint). Holding the original means a
      // multi-megabyte pull the snapshot always beats; a warm top rung
      // costs nothing when its bytes already sit in cache, else the
      // floor rung is the largest pull the window can still honour.
      // A src this pass already wrote (recorded in `touched` by
      // writeAttr) is an in-flight upgrade, not a lazy original —
      // re-pointing it at the floor rung churns the URL inside the
      // snapshot window (the downgrade race: blurry mozjpg-50 mats or
      // blank frames where the climbing fetch was about to land), so a
      // touched src always stands.
      const own = touched.get(img)?.has(MEDIA_ATTRS.SRC) === true

      if (!own) {
        const floor = stemFloorUrl(stemKey(current))
        const pick = warmReady.has(best) ? best : floor

        if (pick && pick !== current) writeAttr(img, MEDIA_ATTRS.SRC, pick)
      }
    }
  }

  // A layer that still has no printable src paints the browser's broken
  // glyph + alt text — retire it so the sibling stack layer is the
  // printed form instead.
  if (!img.getAttribute(MEDIA_ATTRS.SRC)) {
    img.classList.add(PRINT_CLASSES.SRC)

    marked.push(img)

    return
  }

  if (img.hasAttribute(MEDIA_ATTRS.SRCSET)) {
    recordAttr(img, MEDIA_ATTRS.SRCSET)

    img.removeAttribute(MEDIA_ATTRS.SRCSET)
  }

  // <picture> wrappers keep their <source> ladders live in print — a webp
  // or media-gated rung would still win over the img's upgraded src, so
  // every sibling ladder is unplugged for the snapshot.
  const picture = img.closest(HTML_TAGS.PICTURE)

  if (picture) {
    for (const source of picture.querySelectorAll(HTML_TAGS.SOURCE)) {
      if (source.hasAttribute(MEDIA_ATTRS.SRCSET)) {
        recordAttr(source, MEDIA_ATTRS.SRCSET)

        source.removeAttribute(MEDIA_ATTRS.SRCSET)
      }
    }
  }

  // Layered stacks (figure render-media, home-mosaic, card-stack) paint
  // the newest layer over LQIP/thumb siblings — once a printable src
  // stands, every earlier layer OF THE SAME MEDIA in the same well would
  // ghost through on paper. Layers share the filename stem — only the
  // rung suffix and codec differ (`foo-mozjpg-50.jpg` vs `foo.webp`) —
  // so the stem check hides true stack layers while independent sibling
  // images (article galleries, mosaic items) keep printing.
  //
  // The scope is the media well: the <picture>'s parent for wrapped
  // layers (card-stack -card-media, mosaic tile well), the direct parent
  // otherwise (figure layers, related cards, bare children of a shadow
  // root where parentNode IS the root). Scoping to the whole shadow root
  // let a DIFFERENT surface carrying the same stem — card-stack's index
  // overlay thumbs — retire a card's printed layer, and dedup must not
  // wait on a proven upgrade: an un-upgraded surviving layer is still the
  // stack's printed form.
  const scope = (
    picture ? (picture.parentElement ?? picture.parentNode) : (img.parentElement ?? img.parentNode)
  ) as ParentNode
  // `best` landed either as the existing src or as the written upgrade,
  // and the no-src retire path already returned — src is always non-null
  // here.
  const stem = stemKey(img.getAttribute(MEDIA_ATTRS.SRC) as string)

  for (const sib of scope.querySelectorAll(HTML_TAGS.IMG)) {
    if (sib === img) break

    const sibSrc = sib.getAttribute(MEDIA_ATTRS.SRC) ?? ATTR_VALUES.EMPTY

    if (sibSrc !== ATTR_VALUES.EMPTY && stemKey(sibSrc) === stem) {
      sib.classList.add(PRINT_CLASSES.SRC)

      marked.push(sib)

      // Retired layers keep no src — a hidden duplicate rung would still
      // burn a multi-megabyte fetch before the snapshot, doubling the
      // pull every printed figure needs.
      recordAttr(sib, MEDIA_ATTRS.SRC)
      sib.removeAttribute(MEDIA_ATTRS.SRC)
    }
  }

  writeAttr(img, MEDIA_ATTRS.LOADING, MEDIA_ATTRS.LOADING_EAGER)
  writeAttr(img, MEDIA_ATTRS.FETCH_PRIORITY, MEDIA_ATTRS.FETCH_PRIORITY_HIGH)
  writeAttr(img, MEDIA_ATTRS.DECODING, MEDIA_ATTRS.DECODING_SYNC)

  // Kick the fetch+decode pipeline now — an upgraded `-mozjpg-uncompressed`
  // rung is a multi-megabyte pull. The gated entry (Ctrl/Cmd+P,
  // window.print) awaits this promise before opening the dialog, so the
  // snapshot always finds the pixels decoded in hand instead of racing
  // the fetch. Menu-initiated jobs can't defer — for them the kick still
  // starts the work as early as beforeprint allows. A reject walks the
  // src DOWN the stem's proven ladder first (demotePrintImg) — the
  // manifest proves object existence, not byte integrity, so a corrupt
  // tier yields to its sibling before the surface may retire; only a
  // genuinely broken asset leaves a blank mat + orphaned caption off
  // the paper.
  trackPending(img.decode?.().catch(() => demotePrintImg(img)))
}

/**
 * Runs the committed pass's full upgrade on one img and records the
 * decision — refreshMedia skips every img in `imgDecided` so a second
 * beforeprint never re-points an already-decided layer at a colder rung
 * (the rung pick reads live box geometry, which print CSS just changed).
 * Layers upgradeImage retired to `print-src` stay undecided so the
 * rescue arm can still un-retire them if a real src lands between
 * passes.
 * @param img Image element to process.
 */
const decideImage = (img: HTMLImageElement): void => {
  upgradeImage(img)

  if (!marked.includes(img) && !imgDecided.has(img)) imgDecided.add(img)
}

/**
 * The source URL a printed video points back to — the element's own
 * loaded/src/source chain, falling back to the poster attribute.
 * '' when nothing resolves. Only un-figured videos reach this helper:
 * figure-shadow videos are described by their host's `.mp4` caption and
 * the swap only derives a still off this chain when no figure stem
 * exists, so a stem can never present here.
 * @param video Video element (light DOM — never inside a figure shadow).
 * @returns http(s) video URL, or ''.
 */
const videoSourceUrl = (video: HTMLVideoElement): string =>
  video.currentSrc ||
  video.getAttribute(MEDIA_ATTRS.SRC) ||
  (video.querySelector(HTML_TAGS.SOURCE)?.getAttribute(MEDIA_ATTRS.SRC) ??
    video.getAttribute(MEDIA_ATTRS.POSTER) ??
    ATTR_VALUES.EMPTY)

/**
 * Swaps a video for its poster still — printers rasterize neither the
 * element nor its first frame, so the emitted `stem.mp4.jpg` still (or
 * the poster attribute / src-derived still for un-figured videos) is
 * the printable representation the pipeline ships. Inside a figure
 * shadow an already-rendered non-placeholder img layer IS that still
 * (the img pass upgrades it to `stem.mp4.jpg`), so the video just tags
 * out; otherwise the still is injected as a `.print-copy`. A video with
 * no derivable still retires instead of printing a dead player box.
 * @param video Video element (light DOM or inside a media-figure shadow).
 * @returns The injected `.print-copy` img when one was placed, else null.
 */
/**
 * Tags a video out of the printed form — no derivable still exists, so
 * the `print-src` marker hides the dead player box on paper and the
 * `marked` entry lifts it again on afterprint.
 * @param video Video element retiring out of the snapshot.
 * @returns Always null — the retire path injects no stand-in.
 */
const retireVideo = (video: HTMLVideoElement): null => {
  video.classList.add(PRINT_CLASSES.SRC)

  marked.push(video)

  return null
}

const swapVideo = (video: HTMLVideoElement): HTMLImageElement | null => {
  const stem = mediaStem(video)

  // The live frame is the best printable surface any path can pick: a
  // played video's current frame shows real content where the pipeline's
  // t=0 still can be a blank fade-in page. Every fallback below still
  // applies when nothing decoded (readyState < HAVE_CURRENT_DATA).
  const frame = captureVideoFrame(video)

  if (stem) {
    // Figure-shadow video: a real img layer under it (anything that
    // isn't the svg placeholder) upgrades in the img pass — to the live
    // frame when one decoded, else the proven `stem.mp4.jpg` still — so
    // the video only tags out. A placeholder-only shadow has no
    // printable frame of its own, so the still/frame copy comes in as a
    // `.print-copy` after the host instead.
    const shadow = video.getRootNode() as ParentNode
    const hasStill = [...shadow.querySelectorAll(HTML_TAGS.IMG)].some(
      (im) => !im.classList.contains(MEDIA_CLASSES.RENDER_PLACEHOLDER)
    )

    if (hasStill) return retireVideo(video)

    const still = `${stem}${MEDIA.VIDEO_EXT}${MEDIA.EXT}`
    const printable = frame || (mediaKeyExists(still) ? still : ATTR_VALUES.EMPTY)

    return printable ? swapInCopy(video, printable) : retireVideo(video)
  }

  // Un-figured video: live frame first, then the poster attribute, then
  // the still derived off its own source chain (`X.mp4` → `X.mp4.jpg`,
  // scaledown variants fold to the same still) — gated on mediaKeyExists
  // so an un-emitted derivative can't print a dead well. Nothing
  // printable → the element would render a dead player box, so it
  // retires like a swapped surface.
  const poster = video.getAttribute(MEDIA_ATTRS.POSTER)
  const derived = (videoSourceUrl(video) || ATTR_VALUES.EMPTY).replace(
    VIDEO_STILL,
    `${MEDIA.VIDEO_EXT}${MEDIA.EXT}`
  )

  const candidate = frame || poster || (mediaKeyExists(derived) ? derived : ATTR_VALUES.EMPTY)

  const printable =
    candidate.startsWith(ATTR_VALUES.HTTP) || candidate.startsWith(NET_STRINGS.DATA_COLON)

  return printable ? swapInCopy(video, candidate) : retireVideo(video)
}

/**
 * Caption work collected during the media walk and emitted once it
 * finishes — a queued entry reads its element's FINAL state, so a layer
 * the dedup arm retires mid-pass (same-stem siblings) never keeps a
 * caption under a hidden image.
 */
interface PendingCaption {
  /** Element the caption seats after (img, picture or anchor wrapper). */
  anchor: Element
  /** Element whose final src/state the caption reads. */
  media: Element
}

/**
 * The sibling a move record must anchor on — the first following node
 * that is NOT a print-injected still, caption or QR code. Injected
 * nodes are all removed before the records restore, so an anchor left
 * on one re-parents against a detached reference and throws, aborting
 * the whole exit pass (theme and attribute restores included). This is
 * not theoretical: a figure-shadow video/canvas swap seats its
 * `.print-copy` immediately after the figure host.
 * @param el Element whose re-seat point is being recorded.
 * @returns The first surviving sibling, or null at the parent tail.
 */
const nextStaticSibling = (el: Element): Node | null => {
  let sib = el.nextSibling

  while (
    sib instanceof Element &&
    (sib.classList.contains(PRINT_CLASSES.COPY) ||
      sib.classList.contains(PRINT_CLASSES.CAPTION) ||
      sib.classList.contains(PRINT_CLASSES.QR_LINK))
  ) {
    sib = sib.nextSibling
  }

  return sib
}

/**
 * Stamps internal-hero figures as full-bleed editorial spreads: each
 * figure moves inside a light-DOM `.print-plate` on the margin-zero
 * named page so the media paints edge-to-edge, and a figure wider than
 * tall additionally gets the `--landscape` arm — a quarter-turned
 * light-DOM still inside the portrait sheet, the magazine "turn the
 * page sideways" spread.
 *
 * Orientation prefers the surviving layer's natural pixel ratio; an
 * unloaded layer falls back to the figure's laid-out box.
 */
const tagBleedFigures = (): void => {
  // Every internal-main figure is its own plate — sequential figures
  // become consecutive full-bleed spreads, each on its own sheet. The
  // figure moves INSIDE a light-DOM `.print-plate` node (the margin-zero
  // named-page wrapper the scene stills already use): a shadow-nested
  // abs/transformed box inside a margined fragmentainer paints clipped
  // in Chromium — the earlier in-place bleed only ever covered ~2/3 of
  // the sheet — while the top-level plate contract paints edge-to-edge.
  const plated = new Set<Element>()

  for (const figure of walkFigures(document)) {
    const main = figure.closest(`.${INTERNAL_CLASSES.INTERNAL_MAIN}`)

    if (!main) continue

    const img = figure.shadowRoot?.querySelector(HTML_TAGS.IMG) as HTMLImageElement | null
    const box = figure.getBoundingClientRect()
    const ratio = img?.naturalWidth
      ? img.naturalWidth / img.naturalHeight
      : box.height
        ? box.width / box.height
        : 0

    figure.classList.add(PRINT_CLASSES.BLEED)
    bleedTagged.push(figure)

    const landscape = ratio >= BLEED_LANDSCAPE_RATIO

    if (landscape) figure.classList.add(PRINT_CLASSES.BLEED_LANDSCAPE)

    const plate = document.createElement(HTML_TAGS.DIV)

    plate.className = landscape
      ? `${PRINT_CLASSES.PLATE} ${PRINT_CLASSES.PLATE_LANDSCAPE}`
      : PRINT_CLASSES.PLATE

    bleedMoved.push({
      el: figure,
      parent: figure.parentNode as Node,
      next: nextStaticSibling(figure),
    })
    plate.appendChild(figure)

    // Landscape spreads rotate a LIGHT-DOM copy of the still — the
    // scene-plate contract paints a transformed img edge-to-edge, while
    // the host's transformed shadow content rasters clipped in Chromium
    // even on the margin-0 page. The copy rides after the host so it
    // paints on top; if its decode fails the host's (clipped) spread
    // still shows through instead of a blank sheet.
    if (landscape) {
      const still =
        (figure.shadowRoot?.querySelector(
          `${HTML_TAGS.IMG}.${MEDIA_CLASSES.RENDER_MEDIA_HIGH}[${MEDIA_ATTRS.SRC}]`
        ) as HTMLImageElement | null) ??
        (figure.shadowRoot?.querySelector(
          `${HTML_TAGS.IMG}.${MEDIA_CLASSES.RENDER_MEDIA_THUMB}[${MEDIA_ATTRS.SRC}]`
        ) as HTMLImageElement | null)
      const url = still?.getAttribute(MEDIA_ATTRS.SRC)

      if (url) {
        const copy = document.createElement(HTML_TAGS.IMG)

        copy.className = PRINT_CLASSES.COPY
        copy.setAttribute(COMMON_ATTRS.HIDDEN, ATTR_VALUES.EMPTY)
        copy.alt = ''
        copy.src = url
        writeAttr(copy, MEDIA_ATTRS.DECODING, MEDIA_ATTRS.DECODING_SYNC)
        trackPending(copy.decode?.())
        plate.appendChild(copy)
        copies.push(copy)
      }
    }

    // Injected video/canvas stills seated next to the host ride the
    // plate too — a still left behind prints its own page under the
    // spread.
    for (const sib of [...main.children]) {
      if (sib.classList.contains(PRINT_CLASSES.COPY)) plate.appendChild(sib)
    }

    // The masthead rides the first plate — the named-page swap ahead of
    // the hero forces a break no matter what, so a title left in the
    // flow above would strand alone on a content sheet. Reparenting the
    // block's own title h1 inside the plate lets the sheet overlay it
    // on the spread (recorded for exit restore).
    if (!plated.has(main)) {
      plated.add(main)

      const head = main.previousElementSibling

      if (
        head?.tagName === HTML_TAGS.H1.toUpperCase() &&
        head.classList.contains(INTERNAL_CLASSES.INTERNAL_TITLE) &&
        !head.classList.contains(PRINT_CLASSES.BLEED_HEAD)
      ) {
        bleedHeads.push({
          el: head,
          parent: head.parentNode as Node,
          next: nextStaticSibling(head),
        })
        plate.insertBefore(head, plate.firstChild)
        head.classList.add(PRINT_CLASSES.BLEED_HEAD)
      }
    }

    // Seating: when nothing printable precedes the block (the hero opens
    // the article), the plate hoists right after the cover sheets at
    // body level — an in-place seat would strand a blank default sheet
    // at the page-name transition (the empty preceding region still
    // emits). The covers don't exist yet at this point in prep, so the
    // hoist queues: seatPlates() drops the plates right after the last
    // cover node once front matter lands. Mid-article plates seat in
    // place: the pending default page ahead of them already carries
    // real content.
    if (bleedAtStart(main)) {
      // Hoisted plates claim the internal variant — it shares the
      // margin-zero named page (the only context where media paint
      // reaches the trim) but keeps its own hooks for overlays.
      plate.classList.add(PRINT_CLASSES.PLATE_INTERNAL)
      hoistedPlates.push(plate)
    } else {
      main.before(plate)
    }

    copies.push(plate)
  }
}

/**
 * Seats the queued hero plates immediately after the front matter —
 * cover, face, and (when present) the contents sheet — so the page-name
 * sequence stays cover → face → plate → article with no default-context
 * node between them to strand an empty sheet.
 */
const seatPlates = (): void => {
  for (const plate of hoistedPlates) coverTail().after(plate)

  hoistedPlates.length = 0
}

/** Print-only `display:none` selectors harvested from the live sheets —
 *  refilled every prep (the adopted set can swap sheets between jobs). */
const printHideSelectors: string[] = []

/**
 * Harvests every `display:none` selector declared inside `@media print`
 * across the document AND every shadow root's adopted sheets. The print
 * sheet hides chrome that is still display-visible on screen (the nav
 * shell, dialogs, the loader veil) — bleedAtStart's "is there content
 * ahead" test must answer for paper, not pixels, or an in-flow hero
 * plate strands an empty default sheet at the named-page transition.
 * Reading the live rules means the oracle can never drift from the
 * stylesheet. Pseudo-element selectors drop (they can't match a sibling).
 */
const collectPrintHides = (): void => {
  printHideSelectors.length = 0

  // No CSSOM globals (non-DOM test envs) → the oracle reports nothing,
  // matching the pre-oracle behaviour.
  if (typeof CSSRule === TYPE_STRINGS.UNDEFINED) return

  const seen = new Set<CSSStyleSheet>()

  const readRules = (rules: CSSRuleList, inPrint: boolean): void => {
    for (const rule of rules) {
      // Numeric rule.type keeps the probe working where the CSSRule
      // subclass constructors (happy-dom) never landed.
      if (rule.type === CSSRule.MEDIA_RULE) {
        const media = (rule as CSSMediaRule).media.mediaText

        // A nested gate (@media (orientation…)) under a print block
        // stays print; `not print` inverts away from the channel.
        readRules(
          (rule as CSSMediaRule).cssRules,
          inPrint || (media.includes(MEDIA_QUERIES.PRINT) && !media.includes('not'))
        )
      } else if ('cssRules' in rule && rule.type !== CSSRule.STYLE_RULE) {
        readRules((rule as CSSGroupingRule).cssRules, inPrint)
      } else if (
        inPrint &&
        rule.type === CSSRule.STYLE_RULE &&
        (rule as CSSStyleRule).style.display === ATTR_VALUES.NONE &&
        !(rule as CSSStyleRule).selectorText.includes(CHAR_STRINGS.COLON + CHAR_STRINGS.COLON)
      ) {
        printHideSelectors.push((rule as CSSStyleRule).selectorText)
      }
    }
  }

  const readRoot = (root: Document | ShadowRoot): void => {
    const sheets = [
      ...('styleSheets' in root ? [...root.styleSheets] : []),
      ...(root.adoptedStyleSheets ?? []),
    ]

    for (const sheet of sheets) {
      if (seen.has(sheet)) continue
      seen.add(sheet)

      try {
        readRules(sheet.cssRules, false)
      } catch {
        // Cross-origin sheet — cssRules throws SecurityError.
      }
    }

    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) readRoot(el.shadowRoot)
    }
  }

  readRoot(document)
}

/**
 * Whether `el` is display:none under print media — judged against the
 * harvested @media print selector set, so a sibling that only hides on
 * paper (nav chrome, dialogs, the loader) counts as no content ahead.
 * @param el Element to test against the print-hide selector set.
 * @returns Whether any collected print-hide selector matches the node.
 */
const printHidden = (el: Element): boolean => {
  for (const selector of printHideSelectors) {
    try {
      if (el.matches(selector)) return true
    } catch {
      // A selector the engine can't parse for matches() — skip it.
    }
  }

  return false
}

/**
 * True when `el` has no printable flow content ahead of it in the
 * flattened tree — walked ancestor-by-ancestor across shadow roots, so a
 * hero block buried inside view shells still detects the head-of-doc
 * case. A preceding element sibling that is neither a named-cover node
 * nor print-hidden ends the run.
 * @param el Element whose flow-start status is under test.
 * @returns Whether every preceding sibling up to `<body>` is a cover
 *   sheet, an already-hoisted plate, or display:none chrome.
 */
const bleedAtStart = (el: Element): boolean => {
  let probe: Element | null = el

  while (probe && probe !== document.body) {
    let sib = probe.previousElementSibling

    while (sib) {
      const coverish =
        sib.classList.contains(PRINT_CLASSES.COVER) ||
        sib.classList.contains(PRINT_CLASSES.FACE) ||
        sib.classList.contains(PRINT_CLASSES.TOC) ||
        sib.classList.contains(PRINT_CLASSES.PLATE)

      // A sibling only counts as "content ahead" when it actually paints
      // a region on the pending page — display:none chrome emits nothing
      // (screen media here, and the print-only hides are checked through
      // the harvested selector set), and a collapsed box (sr-only
      // helpers, a nav whose children all hide) has no ink to land on it
      // either.
      const rect = sib.getBoundingClientRect()

      if (
        !coverish &&
        getComputedStyle(sib).display !== ATTR_VALUES.NONE &&
        !printHidden(sib) &&
        rect.width > 2 &&
        rect.height > 2
      ) {
        return false
      }

      sib = sib.previousElementSibling
    }

    probe =
      probe.parentElement ??
      (probe.getRootNode() instanceof ShadowRoot
        ? ((probe.getRootNode() as ShadowRoot).host as Element)
        : null)
  }

  return probe === document.body
}

/**
 * The last contiguous cover-sheet node at the top of `<body>` — cover,
 * face, contents, and any plates already hoisted ahead of this pass —
 * so a new hoisted plate seats immediately after them.
 * @returns The trailing cover node; `<body>`'s first child as the
 *   never-expected fallback so the caller's `.after()` still lands.
 */
const coverTail = (): Element => {
  let tail: Element = document.body.firstElementChild as Element

  for (const child of document.body.children) {
    if (
      !child.classList.contains(PRINT_CLASSES.COVER) &&
      !child.classList.contains(PRINT_CLASSES.FACE) &&
      !child.classList.contains(PRINT_CLASSES.TOC) &&
      !child.classList.contains(PRINT_CLASSES.PLATE)
    )
      break

    tail = child
  }

  return tail
}

/**
 * Re-entry pass for a second beforeprint fired inside an already-entered
 * job — a manifest-land (or any) re-render after the first pass swaps in
 * fresh, untagged media layers, and doing nothing would print the whole
 * stack. Only the img branch re-runs: canvas captures and video stills
 * inject a stand-in per call and would duplicate, while upgradeImage is
 * idempotent for layers already processed (recordAttr is first-write-wins
 * and the stem dedup no-ops on retired siblings). Fresh clones get the
 * full upgrade, restoring the one-layer-per-well contract mid-flight.
 */
const refreshMedia = (): void => {
  const article = document.querySelector(`${HTML_TAGS.ARTICLE}.${READER_CLASSES.CONTENT}`)

  for (const el of walkMedia(document)) {
    // Elements the committed pass already decided keep their print
    // roles: decided imgs stand on the rung the commit picked (a fresh
    // pick would measure print-geometry boxes and re-point them cold),
    // injected `.print-copy` stills keep painting, while `marked`
    // retirees fall through on purpose — the rescue arm inside
    // upgradeImage un-retires one that won a real src mid-job.
    if (imgDecided.has(el) || copies.includes(el)) continue

    if (
      el.tagName === HTML_TAGS.IMG.toUpperCase() &&
      (article?.contains(el) ||
        el.getRootNode() !== document ||
        document.getElementById(APP_IDS.APP)?.contains(el) === true)
    ) {
      // Re-entry means the job is already committed — fresh clones get
      // their screen styles stripped now, not queued for a commit that
      // already ran.
      if (el.hasAttribute(COMMON_ATTRS.STYLE)) {
        recordAttr(el, COMMON_ATTRS.STYLE)

        el.removeAttribute(COMMON_ATTRS.STYLE)
      }

      decideImage(el as HTMLImageElement)
    }
  }
}

/**
 * The printable form, preparation phase — everything that leaves the
 * on-screen render untouched: fires `printprepare` so views can sync
 * their generated DOM (docs rendered diagrams) into the reader mirror,
 * stamps the doc classes (print-media selectors only), walks every
 * media surface — canvases become captured stills, poster-carrying
 * videos become images, lazy images upgrade to eager/high at full
 * quality with decode kicks queued in pendingPrint. Every printed
 * surface then gets its source/date/author caption, footer links gain
 * their scan codes, and the document ends with the covers/TOC/back
 * sheets — all injected nodes carry `hidden`, so a gated job can sit
 * in this state awaiting decodes with the screen undisturbed. Cover-only
 * routes (search, 404) short-circuit all of it: the app host is stamped
 * out and the single injected cover sheet is the whole document.
 */
const prepPrint = (announce = true): void => {
  // Callers only reach here on a fresh job — a second full pass on a
  // committed DOM rides refreshMedia() instead, so re-entry never
  // appends a duplicate of every injected sheet.
  printing = true

  emittedLinks.clear()

  emittedRegionLinks.clear()

  if (announce) window.dispatchEvent(new Event(PRINT_EVENTS.PREPARE))

  const html = document.documentElement

  darkWasOn = html.classList.contains(STATE_CLASSES.DARK_MODE)

  // Cover-only routes carry no paper content — prep ends at the single
  // injected sheet once the app host is stamped out of the job.
  if (coverOnlyRoute()) {
    prepCoverOnly()

    return
  }

  const article = document.querySelector(`${HTML_TAGS.ARTICLE}.${READER_CLASSES.CONTENT}`)

  // A populated mirror IS the print document when a route prepared it
  // (data-print-doc) or it carries no wrapper div (the prerendered
  // `> div` contract). html.print-doc drives the sheet's #app/mirror
  // swap — a class, not a :has() gate, so emulated-print engines with
  // flaky has-invalidation still honour it.
  if (
    article?.childElementCount &&
    (article.hasAttribute(DATA_ATTRS.PRINT_DOC) ||
      ![...article.children].some((c) => c.tagName === HTML_TAGS.DIV.toUpperCase()))
  ) {
    html.classList.add(PRINT_CLASSES.DOC)
  }

  const captions: PendingCaption[] = []

  // Below-fold figures carry no mounted layer — kick every climb now so
  // the fetches at least warm the HTTP cache before the snapshot (the
  // gated entry already awaited them; the synchronous beforeprint path
  // can only fire-and-forget). Loaded figures early-return, so the
  // gated re-entry is free.
  for (const figure of walkFigures(document)) kickFigureLoad(figure)

  // Canvas stills repaint through the capture handshake, and widget
  // uniforms read the live theme classes at paint time — leaving the
  // dark theme on would bake ink-on-dark pixels into transparent-alpha
  // stills that read blank on paper. The class drops for the walk only:
  // this block is synchronous so no frame can flash the swap on screen,
  // and commitPrint's real strip still lands at the job's tail.
  html.classList.remove(STATE_CLASSES.DARK_MODE)

  for (const el of walkMedia(document)) {
    if (el.hasAttribute(COMMON_ATTRS.STYLE)) {
      recordAttr(el, COMMON_ATTRS.STYLE)

      // Removal waits for commitPrint — an inline poser/transform
      // vanishing mid-prep would visibly snap the carousel behind the
      // (still-open) page while the gated entry waits on decodes.
      pendingStyleStrip.push(el)
    }

    if (el.tagName === HTML_TAGS.CANVAS.toUpperCase()) {
      // `data-print-skip` retires the canvas outright (docs background
      // scene); `data-print-capture` opts aria-hidden/role-button demo
      // canvases into the still capture they would otherwise miss;
      // `data-print-landscape` (the Earth scene is wider than tall)
      // plates the still rotated inside the portrait sheet — a named
      // `size: landscape` page swap strands empty transition sheets in
      // Chromium and crops the content to portrait, so the page never
      // changes size: the plate quarter-turns instead.
      if (el.hasAttribute(DATA_ATTRS.PRINT_SKIP)) {
        el.classList.add(PRINT_CLASSES.SRC)

        marked.push(el)
      } else if (el.classList.contains(STATE_CLASSES.IS_FALLBACK)) {
        // The widget declared its surface unpaintable (GL unavailable,
        // reduced variant, or an async init still in flight) — the
        // stage's authored CSS fallback owns the print paint. A capture
        // here would stamp a blank buffer over it, and tagging print-src
        // would hide the stage that carries the fallback. `print-fallback`
        // freezes the decision: a widget finishing its async init AFTER
        // the walk removes the screen class, but the print twin keeps
        // the authored fallback painted through the committed job.
        el.classList.add(PRINT_CLASSES.FALLBACK)

        fallbackMarked.push(el)
      } else if (
        el.hasAttribute(DATA_ATTRS.PRINT_CAPTURE) ||
        (el.getAttribute(ARIA_ATTRS.ARIA_HIDDEN) !== ATTR_VALUES.TRUE &&
          el.getAttribute(ARIA_ATTRS.ROLE) !== ARIA_ATTRS.ROLE_BUTTON)
      ) {
        const url = captureCanvas(el as HTMLCanvasElement)
        const hoist = el.hasAttribute(DATA_ATTRS.PRINT_LANDSCAPE)

        if (url) {
          const copy = swapInCopy(el, url, hoist)

          // A landscape still wraps in the rotated plate — same "turn
          // the magazine" contract the internal bleed spreads use.
          if (hoist) {
            const plate = document.createElement(HTML_TAGS.DIV)

            plate.className = `${PRINT_CLASSES.PLATE} ${PRINT_CLASSES.PLATE_LANDSCAPE}`

            // The scene view's own chrome is screen furniture — stamp
            // the doc so the sheet can hide #app's other children;
            // their empty default-flow boxes would otherwise strand a
            // sheet between the named cover and plate pages.
            html.classList.add(PRINT_CLASSES.PLATE_DOC)

            copy.after(plate)
            plate.appendChild(copy)

            copies.push(plate)
          }

          // The still's only openable address is the page it was painted
          // on — a data: URI can't round-trip a paper reader anywhere.
          captions.push({ anchor: copy, media: el })
        } else if (el.hasAttribute(DATA_ATTRS.PRINT_CAPTURE)) {
          // The driver-owned surface declined the still (unpainted async
          // mount, listener-less marker) — the stage's authored fallback
          // (CSS art, flag img twins) owns the print paint instead of a
          // blank box. The print-owned twin class survives a widget's
          // late `is-fallback` removal when its async init lands.
          el.classList.add(PRINT_CLASSES.FALLBACK)

          fallbackMarked.push(el)
        }
      }
    } else if (el.tagName === HTML_TAGS.VIDEO.toUpperCase()) {
      const copy = swapVideo(el as HTMLVideoElement)

      // A copy was injected (the video's own shadow had no still layer):
      // caption it unless a figure stem claims it — figure-shadow videos
      // are described by their host's caption below.
      if (copy && !mediaStem(el)) captions.push({ anchor: copy, media: el })

      // The element itself is dead weight on paper — its still/copy owns
      // the paint — yet Chromium's print pipeline walks every live
      // HTMLMediaElement in the tree, and hundreds of parked player
      // objects turn a media-index snapshot into a multi-minute stall.
      // It queues for in-place neutralization once prep finishes walking:
      // videoSourceUrl reads the <source> chain at caption-emit time, so
      // stripping it here would starve the credit line it just queued.
      videoParked.push({ el: el as HTMLVideoElement, kids: [...el.childNodes] })
    } else if (
      el.tagName === HTML_TAGS.IMG.toUpperCase() &&
      (article?.contains(el) ||
        el.getRootNode() !== document ||
        document.getElementById(APP_IDS.APP)?.contains(el) === true)
    ) {
      const img = el as HTMLImageElement

      decideImage(img)

      // Figure-shadow imgs are described by their host's caption (one
      // source line per media, not per stack layer); `data-print-no-caption`
      // opts a surface out of credit lines entirely (the about portrait).
      // Outside figures the caption seats after the nearest
      // interactive/picture wrapper so the <p> never nests inside an
      // anchor or a picture element.
      if (!mediaStem(img) && !img.hasAttribute(DATA_ATTRS.PRINT_NO_CAPTION)) {
        const anchor =
          (img.closest(`${HTML_TAGS.A}`) as Element | null) ??
          (img.closest(HTML_TAGS.PICTURE) as Element | null) ??
          img

        captions.push({ anchor, media: img })

        // Card media inside an anchor also earns a QR into the card's own
        // route — the printed project card scans to its page. The deck
        // card and its index-overlay twin share the href and dedupe, so
        // only the first img inside the anchor emits. Non-http(s)
        // destinations (mailto:, tel:, '#') carry nothing a paper reader
        // can open — the source caption still seats for the media.
        if (
          anchor.tagName === HTML_TAGS.A.toUpperCase() &&
          (anchor as HTMLAnchorElement).href.startsWith(ATTR_VALUES.HTTP)
        ) {
          addLinkQr(anchor as HTMLAnchorElement)
        }
      }
    }
  }

  if (darkWasOn) html.classList.add(STATE_CLASSES.DARK_MODE)

  for (const { anchor, media } of captions) {
    const isImg = media.tagName === HTML_TAGS.IMG.toUpperCase()

    // Imgs the dedup arm retired mid-pass print nothing — their caption
    // would orphan under a hidden layer. Canvases/videos queue only when
    // a copy already prints in their place, so they always emit.
    if (isImg && media.classList.contains(PRINT_CLASSES.SRC)) continue

    // A surviving img always carries a src — the src-less path retired
    // to `print-src` in upgradeImage and filtered out just above. The
    // caption cites the canonical top-rung URL, not whatever rung stayed
    // painted: when the warm missed, upgradeImage keeps a loaded mid-rung
    // so the snapshot can't race a cold fetch — the credit still points
    // paper readers at the full-quality file.
    const url = isImg
      ? printSourceUrl(media as HTMLImageElement)
      : media.tagName === HTML_TAGS.VIDEO.toUpperCase()
        ? videoSourceUrl(media as HTMLVideoElement)
        : window.location.href

    addCaption(anchor, url)
  }

  // Neutralize every walked video for the committed window (no src, no
  // <source> children, load() drops the pipeline) — same zero render
  // work as a detach while the sibling chain stays put. Deferred past
  // caption emission because videoSourceUrl resolves off the live
  // src/source chain the neutralization strips.
  for (const { el: video, kids } of videoParked) {
    for (const kid of kids) video.removeChild(kid)

    recordAttr(video, MEDIA_ATTRS.SRC)
    video.removeAttribute(MEDIA_ATTRS.SRC)
    video.load()
  }

  // The print-hide oracle lands before any seating decision — hero
  // plates only hoist when the flow ahead of them is empty ON PAPER,
  // and screen-visible chrome the sheet hides (nav, dialogs, loader)
  // must not veto the hoist or it strands an empty transition sheet.
  collectPrintHides()

  // Bleed tags land before figure captions so a bleed figure's caption
  // can seat BEFORE the figure — an abs-positioned caption keeps the
  // fragment of its static position, so after-figure placement would
  // push it past the 100vh spread onto the next sheet.
  tagBleedFigures()

  for (const footer of walkFooters(document)) {
    for (const anchor of footer.querySelectorAll(`${HTML_TAGS.A}[${LINK_ATTRS.HREF}]`)) {
      addLinkQr(anchor as HTMLAnchorElement)
    }
  }

  for (const anchor of walkLinkRegions(document)) {
    addLinkQr(anchor as HTMLAnchorElement, emittedRegionLinks)
    addLinkUrl(anchor as HTMLAnchorElement)
  }

  // Front matter: title cover, loader face page, then the contents page
  // — the magazine's answer to the nav chrome the job discards. The TOC
  // is collected from live heads before the covers inject theirs (its
  // own h2 masthead would otherwise self-list).
  const toc = buildToc()

  // Cover sheets frame the whole job — title cover + loader face page at
  // the head, the black back cover with the site scan code at the tail.
  const [cover, face, back] = buildCovers()

  document.body.prepend(cover, face)

  if (toc) {
    face.after(toc)

    copies.push(toc)
  }

  // Hero plates hoist right after the front matter — they couldn't
  // seat during tagBleedFigures because these cover nodes didn't exist
  // yet. Figure captions come AFTER the seating: a figure riding a
  // queued hoisted plate is detached until seatPlates() drops it into
  // the document, so walking figures any earlier skips its caption
  // entirely.
  seatPlates()

  for (const figure of walkFigures(document)) {
    if (!figure.hasAttribute(DATA_ATTRS.PRINT_NO_CAPTION)) addFigureCaption(figure)
  }

  document.body.appendChild(back)

  copies.push(cover, face, back)
}

/**
 * The printable form, commit phase — the screen-visible mutations held
 * back until the job is moments from the dialog: the dark theme drops
 * for ink-friendly light tokens and every media element's inline
 * style attribute (poser transforms, marquee offsets) strips to its
 * print geometry. Menu-initiated jobs run it straight after prep —
 * same single synchronous pass enter() always was; the gated entry
 * runs it only after the decode barrier settles, so the page never
 * flashes its print state while the user is still looking at it.
 */
const commitPrint = (): void => {
  if (darkWasOn) document.documentElement.classList.remove(STATE_CLASSES.DARK_MODE)

  for (const el of pendingStyleStrip) el.removeAttribute(COMMON_ATTRS.STYLE)

  pendingStyleStrip.length = 0

  // The print DOM is final from here — headless captures and external
  // tooling wait on this event instead of polling: on the gated job it
  // lands after the decode barrier (every upgrade resolved), on the
  // synchronous beforeprint path right behind prep.
  window.dispatchEvent(new Event(PRINT_EVENTS.COMMIT))
}

/**
 * The gated job's pending-work barrier — waits for every tracked job in
 * the bag to settle, then drops them so a later wait only sees work
 * queued since. Progress-aware: the gate stays open while entries keep
 * settling (a media index can legitimately queue hundreds of CDN
 * decodes — a flat cap would release it half-loaded) and releases when
 * nothing settles for a full PREP_CAP window (a wedged request must not
 * hold the dialog hostage) or when the PREP_CAP_HARD wall lands. A
 * failed decode still counts — a rejected entry prints whatever the
 * network served rather than holding the job.
 */
const awaitPendingJobs = async (): Promise<void> => {
  const covered = new Set(pendingPrint)

  if (!covered.size) return

  const deadline = Date.now() + PRINT_TIMING.PREP_CAP_HARD

  let last = pendingSettled
  let quietAt = Date.now()

  for (;;) {
    let outstanding = 0

    for (const job of covered) {
      if (!(job as { done?: boolean }).done) outstanding++
    }

    if (!outstanding || Date.now() >= deadline) break

    if (pendingSettled !== last) {
      last = pendingSettled

      quietAt = Date.now()
    } else if (Date.now() - quietAt >= PRINT_TIMING.PREP_CAP) {
      break
    }

    // Race the combined settle against the tick — allSettled resolves the
    // turn the last covered job lands (an already-queued decode releases
    // the barrier on microtasks, not a 150ms nap), while the tick caps
    // the nap so stragglers still re-poll the done flags. Each turn
    // rebuilds the combined promise, so covered entries pushed mid-wait
    // join the race on their next iteration.
    await Promise.race([
      Promise.allSettled([...covered]),
      new Promise((resolve) => setTimeout(resolve, PRINT_TIMING.SETTLE_TICK)),
    ])
  }

  for (let i = pendingPrint.length - 1; i >= 0; i--) {
    if (covered.has(pendingPrint[i])) pendingPrint.splice(i, 1)
  }
}

/**
 * The print entry for triggers the page can intercept — the Ctrl/Cmd+P
 * chord and programmatic window.print. Runs the prep pass, then HOLDS
 * the dialog behind a decode barrier: every image fetch/decode kicked
 * during prep plus the pending font loads must settle before the real
 * print starts, so the preview finds every asset painted instead of
 * racing whichever rungs resolve mid-render (the "sometimes images are
 * missing" flakiness). A failsafe cap releases a wedged fetch rather
 * than freezing the feature. Menu-initiated jobs can't be deferred —
 * they keep the synchronous beforeprint path.
 * @param nativePrint The original window.print, invoked once the
 *   barrier settles.
 */
const runPrintJob = async (nativePrint: () => void): Promise<void> => {
  // A second trigger while the first job sits on the barrier joins
  // silently — the in-flight wait already covers every asset.
  if (jobRunning) return

  // A job already live (dialog open, DOM committed — e.g. a menu print
  // answered through beforeprint) only needs the re-rendered media
  // refreshed — a second dialog can't stack.
  if (printing) {
    refreshMedia()

    return
  }

  jobRunning = true

  // From here to the dialog the job builds its print DOM on the live
  // page — the settle sweep, layer climbs, plate reparents and src
  // swaps would all read as a glitch watched raw, so the veil covers
  // the whole wait. The channel flag resets per job: the guard below
  // re-checks it once nativePrint() has had its grace.
  sawPrintChannel = false

  showGateVeil()

  try {
    // Cover-only routes carry no media to settle — the single injected
    // sheet builds synchronously, so the manifest wait, the scroll
    // settle and the compose event would only delay the dialog.
    const coverOnly = coverOnlyRoute()

    if (!coverOnly) {
      // The manifest is the upgrade gate — a print fired while its fetch
      // is still in flight finds no stem proven and retires every lazy
      // surface (the cold-start "all images missing" failure). The gated
      // path waits for it before the walk; the beforeprint path can't
      // defer and keeps the conservative proven-only behavior.
      await initMediaManifest()

      // The compose event fires BEFORE the settle — listeners start their
      // async print DOM (dossier fetches, generated mirrors) now and
      // register it via trackPrintJob so it lands ahead of the walk.
      window.dispatchEvent(new Event(PRINT_EVENTS.PREPARE))

      // Force the document complete before the walk — the media walk only
      // sees mounted elements, so viewport-gated layers/sections and an
      // in-flight route fetch would print as empty mats. The scroll sweep
      // arms every IO, climbs force every figure's high layer, and the
      // skeleton poll waits out the route's own data reveal.
      await settleForPrint()

      // Component composition lands here — tracked jobs resolve only
      // after their injected DOM is seated, so the walk sees it whole.
      // Entries covered by the wait drop out of the bag so the decode
      // barrier below doesn't re-wait the same work.
      await awaitPendingJobs()
    }

    // A synchronous enter() can interleave inside the async settles
    // above — a queued matchMedia edge or a menu beforeprint can't
    // await this gate, so it preps on its own timeline. Re-prepping
    // here would double every injected node (covers, TOC, QR links,
    // captions); the committed DOM only needs its media refreshed.
    if (printing) {
      refreshMedia()
    } else {
      prepPrint(false)
    }

    // The barrier — progress-aware: a tracked decode that fails still
    // counts as settled (it prints whatever the network served), a bag
    // that keeps making progress keeps the gate open (a media index can
    // legitimately queue hundreds of CDN rungs), and a stall of a full
    // PREP_CAP — or the PREP_CAP_HARD wall — releases the job with
    // whatever is seated rather than holding the dialog hostage. On a
    // cover-only job the bag is empty and the wait collapses to the
    // font load the sheet's printed link needs.
    await awaitPendingJobs()

    await Promise.race([
      // Serif metrics decide the pagination — printing before the
      // press face lands would re-break every column mid-preview.
      document.fonts?.ready,
      new Promise((resolve) => setTimeout(resolve, PRINT_TIMING.PREP_CAP)),
    ])
  } catch (err) {
    // A job that dies before the dialog must unwind, not commit — a
    // finally-armed commitPrint still dropped the theme and stripped
    // the styles while no afterprint ever arrived to undo it, stranding
    // the page in its half-printed light-mode face (and leaving this
    // latch stuck for every later trigger).
    devWarn('print: job failed', err)

    jobRunning = false

    exit()

    return
  }

  commitPrint()

  jobRunning = false

  // A nativePrint that throws opens no dialog and fires no afterprint —
  // unwind by hand or the committed print state sticks on screen.
  try {
    nativePrint()
  } catch (err) {
    devWarn('print: native print failed', err)

    exit()
  }

  // A silent return can still mean a swallowed call — headless engines,
  // a throttled programmatic print, or a blocked activation fire no
  // beforeprint and flip no media query, so no teardown owner ever
  // arrives and the committed DOM would sit on screen forever. One
  // grace beat for a real channel to engage; silence restores by hand.
  dialogGuardTimer = setTimeout(() => {
    dialogGuardTimer = undefined

    if (printing && !sawPrintChannel) {
      devWarn('print: dialog never engaged — restoring')

      exit()
    }
  }, PRINT_TIMING.DIALOG_GRACE)
}

/**
 * The printable form's synchronous entry — the beforeprint/matchMedia
 * path. Menu-initiated dialogs can't be held, so prep and commit run
 * back-to-back exactly as the pre-gate pipeline did; the warmed HTTP
 * cache and the kicks inside prep are the only asset insurance there.
 */
const enter = (): void => {
  // Any enter() means a real print channel engaged — a native
  // beforeprint or the matchMedia true edge — so the post-nativePrint
  // guard knows the job's teardown has an owner.
  sawPrintChannel = true

  // A second beforeprint inside an already-entered job still matters —
  // see refreshMedia above; the bare early return would print every
  // re-rendered stack layer.
  if (printing) {
    refreshMedia()

    return
  }

  try {
    prepPrint()
  } catch (err) {
    // Menu-initiated jobs can't retry — a prep that dies mid-pass would
    // reach the dialog half-built, so unwind what landed and let the
    // snapshot print the unprepared page instead.
    devWarn('print: prep failed', err)

    exit()

    return
  }

  commitPrint()
}

/**
 * Minimum entries a contents page needs to justify itself — a route
 * with fewer collected heads prints without the leaf rather than
 * shipping a nearly-empty sheet.
 */
const TOC_MIN_ITEMS = 3

/**
 * Builds the contents page seated between the face page and the first
 * content sheet — the magazine's answer to the discarded web nav. Every
 * h2 across the composed tree becomes an entry in document order:
 * section heads read as numbered items, card titles indent as
 * sub-entries under their section. Heads inside hidden subtrees
 * (collapsed, parked or aria-clipped content) and duplicates of a
 * title already listed are skipped; the page drops entirely when a
 * route collects fewer than TOC_MIN_ITEMS heads.
 * @returns The `.print-toc` element, or null.
 */
const buildToc = (): HTMLElement | null => {
  // The contents page belongs to the front-of-book magazine — the home
  // route's section map (Selected work → About → Contact). Single-article
  // routes (project internals, legal, docs) carry one story: a contents
  // page there only ever lists the article's own head plus related-rail
  // links — no contents, no leaf.
  if (router.currentRoute?.name !== ROUTE_NAMES.HOME) return null

  const items: { text: string; sub: boolean }[] = []
  const seen = new Set<string>()

  for (const h of walkHeads(document)) {
    // DrawText heads carry their real text on aria-label — textContent
    // concatenates char spans with no spaces ("Selectedwork") and stays
    // empty until the viewport trigger reveals it, so the label leads
    // and textContent is only the fallback.
    const text =
      (h.getAttribute(ARIA_ATTRS.ARIA_LABEL) ?? ATTR_VALUES.EMPTY).trim() ||
      (h.textContent || ATTR_VALUES.EMPTY).trim()

    if (!text || seen.has(text)) continue

    seen.add(text)
    items.push({
      text,
      sub: h.closest(`.${CARD_STACK_CLASSES.CARD_STACK_CARD}`) !== null,
    })
  }

  if (items.length < TOC_MIN_ITEMS) return null

  const toc = document.createElement(HTML_TAGS.DIV)

  toc.className = PRINT_CLASSES.TOC
  toc.setAttribute(COMMON_ATTRS.HIDDEN, ATTR_VALUES.EMPTY)

  const head = document.createElement(HTML_TAGS.H2)

  head.className = PRINT_CLASSES.TOC_HEAD
  head.textContent = NAV_TEXT.CONTENTS

  toc.appendChild(head)

  // Section heads keep a running number; card-title sub-entries indent
  // unnumbered under their section — the two-level contents list a
  // feature index reads as.
  let section = 0

  for (const { text, sub } of items) {
    const row = document.createElement(HTML_TAGS.DIV)

    row.className = sub ? PRINT_CLASSES.TOC_ITEM_SUB : PRINT_CLASSES.TOC_ITEM

    const num = document.createElement(HTML_TAGS.SPAN)

    num.className = PRINT_CLASSES.TOC_NUM
    num.textContent = sub ? CHAR_STRINGS.EMPTY : `${++section}`

    const label = document.createElement(HTML_TAGS.SPAN)

    label.className = PRINT_CLASSES.TOC_TEXT
    label.textContent = text

    row.append(num, label)
    toc.appendChild(row)
  }

  return toc
}

/**
 * Finds the about portrait's Gravatar URL in the live composed tree and
 * returns the cover-star <img> re-requesting it at the cover rung — the
 * same CMS picture the about section shows fronts the printed issue,
 * seated over the masthead's lower half (the magazine "name behind the
 * cover star" move). The node is built fresh rather than cloned so it
 * drops with the cover on exit; eager/high-priority attrs plus a decode
 * kick make the preview hold on the in-flight fetch the way upgraded
 * media does. Routes without the about section (project internals,
 * legal, docs) simply print the masthead cover without the portrait.
 * @returns The `.print-cover-photo` img, or null when no portrait exists.
 */
const coverPortrait = (): HTMLImageElement | null => {
  // The cover star for this issue, in priority order:
  // 1. The feature still — a plate's injected `.print-copy` (a scene's
  //    captured frame, or a landscape hero's light-DOM copy) is the
  //    exact frame the spread inside shows. Plates seat inside view
  //    shadow roots, so the search walks the composed tree.
  let src: string = ATTR_VALUES.EMPTY

  for (const el of walkMedia(document)) {
    if (
      el.tagName !== HTML_TAGS.IMG.toUpperCase() ||
      !el.classList.contains(PRINT_CLASSES.COPY) ||
      !el.closest(`.${PRINT_CLASSES.PLATE}`)
    ) {
      continue
    }

    src = (el as HTMLImageElement).src || ATTR_VALUES.EMPTY

    break
  }

  // The hoisted hero plates are still detached here — seatPlates() only
  // drops them after the covers build, so a queued plate's injected
  // `.print-copy` (a video hero's swapped still) isn't document-walkable
  // yet. The queue is read directly for the same pick.
  if (!src) {
    for (const plate of hoistedPlates) {
      const copy = plate.querySelector(
        `${HTML_TAGS.IMG}.${PRINT_CLASSES.COPY}`
      ) as HTMLImageElement | null

      if (copy?.src) {
        src = copy.src

        break
      }
    }
  }

  // 2. The internal hero figure's own media — the same cover asset the
  //    home card shows for the project, upgraded to its top proven rung.
  //    A figure riding a queued plate is already out of `.internal-main`
  //    when this runs (the hoist moves it), so the plate variant counts
  //    as the same context. A video hero has no mozjpg ladder: its
  //    printable frame is the live decoded frame when one stands, else
  //    the manifest-proven `stem.mp4.jpg` still — unproven falls
  //    through to the portrait.
  if (!src) {
    // Figures inside a queued plate aren't document-walkable either, so
    // the hero scan covers the live tree plus every queued plate.
    const heroFigures = function* (): Generator<Element> {
      yield* walkFigures(document)

      for (const plate of hoistedPlates) {
        yield* plate.querySelectorAll(COMPONENT_TAGS.MEDIA_FIGURE)
      }
    }

    for (const figure of heroFigures()) {
      if (
        !figure.closest(`.${INTERNAL_CLASSES.INTERNAL_MAIN}`) &&
        !figure.closest(`.${PRINT_CLASSES.PLATE_INTERNAL}`)
      ) {
        continue
      }

      const stem = mediaStem(figure)

      if (stem) {
        src = stemTopUrl(stem)

        if (
          !src &&
          figure.hasAttribute(MEDIA_ATTRS.IS_VIDEO) &&
          figure.getAttribute(MEDIA_ATTRS.IS_VIDEO) !== ATTR_VALUES.FALSE
        ) {
          const video = figure.shadowRoot?.querySelector(HTML_TAGS.VIDEO) as HTMLVideoElement | null

          if (video) src = captureVideoFrame(video)

          if (!src) {
            const still = `${stem}${MEDIA.VIDEO_EXT}${MEDIA.EXT}`

            if (mediaKeyExists(still)) src = still
          }
        }
      }

      break
    }
  }

  // 3. The about portrait — the issue's own cover star (home, legal,
  //    docs and any route with no feature media of its own).
  let url = src

  if (!url) {
    for (const el of walkMedia(document)) {
      if (
        el.tagName !== HTML_TAGS.IMG.toUpperCase() ||
        !el.classList.contains(ABOUT_CLASSES.ABOUT_PROFILE_PICTURE_IMG)
      ) {
        continue
      }

      const grav = (el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src

      if (!grav) return null

      url = getOptimizedGravatar(grav, GRAVATAR_SIZES.GRAVATAR_COVER)

      break
    }
  }

  if (!url) return null

  const img = document.createElement(HTML_TAGS.IMG)

  img.className = PRINT_CLASSES.COVER_PHOTO
  img.src = url
  img.alt = BASE_TITLE
  img.setAttribute(MEDIA_ATTRS.LOADING, MEDIA_ATTRS.LOADING_EAGER)
  img.setAttribute(MEDIA_ATTRS.FETCH_PRIORITY, MEDIA_ATTRS.FETCH_PRIORITY_HIGH)
  img.setAttribute(MEDIA_ATTRS.DECODING, MEDIA_ATTRS.DECODING_SYNC)

  // Same contract as upgradeImage — start the multi-hundred-KB pull
  // now; the gated entry awaits it before the dialog so the cover
  // star always lands on the sheet.
  trackPending(img.decode?.())

  // A dead fetch drops the plate rather than printing a broken-image
  // box — the masthead/word/issue furniture still reads as a cover.
  img.addEventListener(WINDOW_EVENTS.ERROR, () => img.remove(), { once: true })

  return img
}

/**
 * The issue's feature title — the non-brand half of `document.title`
 * ("Luis Krötz | Transa" → "Transa", "Star Field - Earth | Luis Krötz"
 * → "Star Field - Earth"). Routes that title the tab with the brand
 * alone (home) yield nothing so the localized Portfolio word stands.
 * @returns The feature title, or ''.
 */
const featureTitle = (): string =>
  document.title
    .split(CHAR_STRINGS.PIPE_SEP)
    .map((part) => part.trim())
    .find((part) => part && part.toLowerCase() !== BASE_TITLE.toLowerCase()) ?? ATTR_VALUES.EMPTY

/**
 * Builds the three cover sheets framing the printed document: the black
 * title cover (silver `Luis Krötz` masthead with the Gravatar portrait
 * seated over its lower half, the localized "Portfolio" word and the
 * print-date issue stamp), the face page echoing the intro loader's
 * orbital rings and brand line without the percent counter, and the
 * black back cover with a scan code to the site root centred and the
 * localized copyright line pinned to the sheet's foot. All three carry
 * `hidden` — the screen-hide contract now lives on the attr since print
 * css moved to its own media link — and they drop with the rest of the
 * injected DOM on afterprint.
 * @returns [cover, face, back] in document order.
 */
const buildCovers = (): [HTMLElement, HTMLElement, HTMLElement] => {
  const cover = document.createElement(HTML_TAGS.DIV)

  cover.className = PRINT_CLASSES.COVER
  cover.setAttribute(COMMON_ATTRS.HIDDEN, ATTR_VALUES.EMPTY)

  // Masthead first so the portrait (appended after) paints over its
  // lower half — the name reads behind the cover star.
  const coverTitle = document.createElement(HTML_TAGS.H1)

  coverTitle.className = PRINT_CLASSES.COVER_TITLE
  coverTitle.textContent = BASE_TITLE

  cover.appendChild(coverTitle)

  const portrait = coverPortrait()

  if (portrait) cover.appendChild(portrait)

  const coverSub = document.createElement(HTML_TAGS.SPAN)

  coverSub.className = PRINT_CLASSES.COVER_SUB
  coverSub.textContent =
    featureTitle() || portfolioWord(detectLangFromPath(window.location.pathname))

  // Issue furniture — the print date reads as the edition stamp, the
  // barcode slot a physical magazine covers with.
  const issue = document.createElement(HTML_TAGS.SPAN)

  issue.className = PRINT_CLASSES.COVER_ISSUE
  issue.textContent = new Date().toISOString().slice(0, ISO_DATE_LEN)

  cover.append(coverSub, issue)

  const face = document.createElement(HTML_TAGS.DIV)

  face.className = PRINT_CLASSES.FACE
  face.setAttribute(COMMON_ATTRS.HIDDEN, ATTR_VALUES.EMPTY)

  // The loader's full layered stack: blue radial glow, blueprint grid,
  // the two orbital rings (static), and the brand line at the hub.
  const faceGlow = document.createElement(HTML_TAGS.SPAN)

  faceGlow.className = PRINT_CLASSES.FACE_GLOW

  const faceGrid = document.createElement(HTML_TAGS.SPAN)

  faceGrid.className = PRINT_CLASSES.FACE_GRID

  const ringOuter = document.createElement(HTML_TAGS.SPAN)

  ringOuter.className = PRINT_CLASSES.FACE_SPINNER

  const ringInner = document.createElement(HTML_TAGS.SPAN)

  ringInner.className = PRINT_CLASSES.FACE_SPINNER_INNER

  const faceTitle = document.createElement(HTML_TAGS.SPAN)

  faceTitle.className = PRINT_CLASSES.FACE_TITLE
  faceTitle.textContent = BASE_TITLE

  face.append(faceGlow, faceGrid, ringOuter, ringInner, faceTitle)

  const back = document.createElement(HTML_TAGS.DIV)

  back.className = PRINT_CLASSES.BACK
  back.setAttribute(COMMON_ATTRS.HIDDEN, ATTR_VALUES.EMPTY)

  // Site-root scan code — the paper reader's way back to the website.
  const qr = qrLink(siteHomeUrl(), PRINT_CLASSES.BACK_QR)

  if (qr) back.appendChild(qr)

  const copy = document.createElement(HTML_TAGS.P)

  copy.className = PRINT_CLASSES.BACK_COPY
  copy.textContent = rightsText()

  back.appendChild(copy)

  return [cover, face, back]
}

/**
 * The single sheet a cover-only route emits — the back-cover layout
 * (black margin-zero page) carrying just the centred site scan code and
 * the printed home link at the sheet's foot: a QR and a way back home,
 * nothing else. Carries `hidden` like every injected node — the print
 * sheet's `.print-back` rules paint it on paper.
 * @returns The `.print-back` cover sheet element.
 */
const buildCoverOnlySheet = (): HTMLElement => {
  const home = siteHomeUrl()

  const cover = document.createElement(HTML_TAGS.DIV)

  cover.className = PRINT_CLASSES.BACK
  cover.setAttribute(COMMON_ATTRS.HIDDEN, ATTR_VALUES.EMPTY)

  const qr = qrLink(home, PRINT_CLASSES.BACK_QR)

  if (qr) cover.appendChild(qr)

  const link = document.createElement(HTML_TAGS.A)

  link.className = PRINT_CLASSES.BACK_HOME
  link.setAttribute(LINK_ATTRS.HREF, home)
  link.textContent = window.location.host

  cover.appendChild(link)

  return cover
}

/**
 * The cover-only prep — stamps `print-cover-only` on <html> so the print
 * sheet hides the app host (view chrome and the parked reader mirror
 * both live inside it), then seats the single sheet at the head of
 * <body>. The job's whole document is that one sheet.
 */
const prepCoverOnly = (): void => {
  document.documentElement.classList.add(PRINT_CLASSES.COVER_ONLY)

  const cover = buildCoverOnlySheet()

  document.body.prepend(cover)

  copies.push(cover)
}

/**
 * Tears the printable form down: stand-ins are removed, `print-src` tags
 * drop, every mutated attribute restores its recorded value (or removal),
 * and the dark theme returns if it was on.
 */
const exit = (): void => {
  // A pending matchMedia teardown dies with any exit — the job is ending
  // regardless of which channel signalled first.
  if (mmExitTimer !== undefined) {
    clearTimeout(mmExitTimer)
    mmExitTimer = undefined
  }

  // The dialog guard dies too — either it already fired (and this IS its
  // unwind) or a real channel owned the job after all.
  if (dialogGuardTimer !== undefined) {
    clearTimeout(dialogGuardTimer)
    dialogGuardTimer = undefined
  }

  // Veil and channel flag drop before the printing latch read — a job
  // that died before prep (printing still false) still leaves both. The
  // veil rode the whole dialog, so the mutated DOM below never once
  // reached the screen.
  dropGateVeil()

  sawPrintChannel = false

  pendingBeforeprintAt = 0

  if (!printing) return

  printing = false

  // The screen-visible state restores FIRST — recorded attributes, the
  // html doc classes and the dark theme are what the user actually sees,
  // so a stale move anchor in the tree rebuild below can never strand
  // the page in its print face.
  for (const [el, bag] of touched) {
    for (const [name, value] of bag) {
      if (value === null) el.removeAttribute(name)
      else el.setAttribute(name, value)
    }
  }

  touched.clear()

  document.documentElement.classList.remove(PRINT_CLASSES.DOC)

  document.documentElement.classList.remove(PRINT_CLASSES.COVER_ONLY)

  document.documentElement.classList.remove(PRINT_CLASSES.LANDSCAPE)

  document.documentElement.classList.remove(PRINT_CLASSES.PLATE_DOC)

  if (darkWasOn) document.documentElement.classList.add(STATE_CLASSES.DARK_MODE)

  darkWasOn = false

  for (const copy of copies) copy.remove()

  copies.length = 0

  for (const el of marked) el.classList.remove(PRINT_CLASSES.SRC)

  marked.length = 0

  imgDecided.clear()

  for (const el of fallbackMarked) el.classList.remove(PRINT_CLASSES.FALLBACK)

  fallbackMarked.length = 0

  for (const el of bleedTagged) {
    el.classList.remove(PRINT_CLASSES.BLEED, PRINT_CLASSES.BLEED_LANDSCAPE)
  }

  bleedTagged.length = 0

  // The recorded anchors are re-validated at restore time — a `next`
  // the live DOM re-parented mid-job falls back to the parent's tail
  // rather than throwing the whole teardown away.
  for (const { el, parent, next } of bleedHeads) {
    el.classList.remove(PRINT_CLASSES.BLEED_HEAD)

    parent.insertBefore(el, next?.parentNode === parent ? next : null)
  }

  bleedHeads.length = 0

  // Plate removal already ran via `copies` — the figures it swallowed go
  // back to their recorded seats.
  for (const { el, parent, next } of bleedMoved) {
    parent.insertBefore(el, next?.parentNode === parent ? next : null)
  }

  bleedMoved.length = 0

  // Neutralized videos get their element children back and reload so
  // the screen pipeline re-arms exactly where it stood — the src attr
  // itself already restored with the rest of `touched`.
  for (const { el, kids } of videoParked) {
    el.append(...kids)
    el.load()
  }

  videoParked.length = 0

  // Any plate queued but never seated (a job interrupted mid-prep) drops
  // with the copy pass above; the queue clears either way.
  hoistedPlates.length = 0

  emittedLinks.clear()

  emittedRegionLinks.clear()

  // Dying decode promises and any strip queue a cancelled commit left
  // behind — the next job rebuilds both from scratch.
  pendingPrint.length = 0

  pendingStyleStrip.length = 0

  jobRunning = false
}

/**
 * Registers async print-composition work fired by a `printprepare`
 * listener — dossier fetches, generated mirror syncs, injected-DOM
 * builds whose nodes the walk must see whole. The promise is tracked in
 * the same bag the gated entry awaits before committing; its failures
 * are swallowed so one bad fetch can't take the job down.
 * @param job Composition promise resolving after the listener's print
 *   DOM is seated.
 */
export const trackPrintJob = (job: Promise<unknown>): void => {
  trackPending(job.catch(() => undefined))
}

/**
 * Registers a listener-injected print node for the exit teardown — same
 * fate as the adapter's own copies and covers: the node is removed when
 * the job ends so screen state restores clean.
 * @param el Root element the listener injected for print.
 */
export const trackPrintNode = (el: Element): void => {
  copies.push(el)
}

/**
 * True while a print job owns the document — set at prepPrint's stamp
 * and held through exit's restore. Screen-time DOM publishers (figure
 * ladder publishes, deferred layer mounts) must freeze inside this
 * window: a clone landing mid-snapshot stomps the print-upgraded src
 * with a cold screen rung and the page prints a blank frame where the
 * media should be.
 * @returns Whether the print DOM is currently being prepped/committed.
 */
export const printJobActive = (): boolean => printing

/**
 * Installs the print hooks once: the native before/afterprint pair plus the
 * matchMedia('print') change channel — some engines skip the events but
 * always flip the media query, so both paths feed the same enter/exit.
 * A capture-phase `load` listener rides every img that resolves on screen
 * (load doesn't bubble — capture reaches it) and marks its resolved URL
 * in `warmReady`, so the beforeprint swap gate can prove a rung's bytes
 * already sit in cache instead of gambling on a cold multi-megabyte pull
 * at snapshot time. Marks only — the warm pass never summons a fetch the
 * screen didn't already need; lazy/late-mounted layers are covered the
 * moment their own load lands — no polling, no observer.
 */
export const initPrintSupport = (): void => {
  if (installed) return

  installed = true

  // The manifest decides every print source — while it is in flight the
  // rendered imgs still hold their svgPlaceholder srcs and the rung
  // ladders don't exist, so a print landing inside that window retires
  // every media surface outright. Boot defers the fetch to idle, which
  // starves under the continuous rAF load this site keeps; kicking it
  // here collapses the gap to one small JSON's network latency, and the
  // on-land re-sweep warms the real srcs the manifest-gated re-render
  // swaps into the wells.
  void initMediaManifest()

  onMediaManifest(queueSweep)

  const nativePrint = window.print?.bind(window)

  // Every interceptable trigger routes through the gated job — the
  // Ctrl/Cmd+P chord is cancelled at the window root before the browser
  // can open the dialog on unprepared DOM, and window.print is wrapped
  // for programmatic callers. runPrintJob holds the real dialog until
  // every image decode + font settles — the preview renders identical
  // output every time instead of racing in-flight fetches; cover-only
  // routes run the same channel but skip the waits and emit just the
  // injected sheet. Menu-initiated jobs can't be intercepted: enter()
  // keeps the sync beforeprint path for them (and is the only entry on
  // engines shipping no wrappable window.print).
  if (nativePrint) {
    window.addEventListener(
      KEYBOARD_EVENTS.KEYDOWN,
      (e) => {
        const k = e as KeyboardEvent

        if ((k.ctrlKey || k.metaKey) && k.key.toLowerCase() === KEYS.KEY_P) {
          k.preventDefault()
          k.stopImmediatePropagation()

          void runPrintJob(nativePrint)
        }
      },
      true
    )

    window.print = () => {
      void runPrintJob(nativePrint)
    }
  }

  window.addEventListener(CLIPBOARD_EVENTS.BEFORE_PRINT, () => {
    // The event precedes its media apply by an engine-internal beat —
    // stamp it so the matchMedia false-edge teardown can tell "the query
    // is still false because the apply hasn't landed" from a real job
    // end, and waits the apply out instead of erasing a live job's DOM.
    pendingBeforeprintAt = Date.now()

    enter()
  })
  window.addEventListener(CLIPBOARD_EVENTS.AFTER_PRINT, exit)

  const mql = window.matchMedia(MEDIA_QUERIES.PRINT)

  mql.addEventListener(FORM_EVENTS.CHANGE, (e) => {
    // The true edge enters (or refreshes) the printable form and cancels
    // any teardown a false edge just armed — Chromium's print pipeline
    // flickers the query off mid-job before re-applying it for the real
    // render, and a synchronous exit() on that edge would erase the
    // prepared DOM while pagination is still snapshotting it.
    if (e.matches) {
      if (mmExitTimer !== undefined) {
        clearTimeout(mmExitTimer)
        mmExitTimer = undefined
      }

      enter()

      return
    }

    // The false edge defers past the flicker window and re-checks the
    // live query: a genuine job end (or an mm-only engine's print→screen
    // transition) still finds it false and tears down — a mid-job flicker
    // has already flipped it true, so the check no-ops even if the timer
    // somehow outlived the re-arm. A false query can also be honest for
    // a second reason: the next job's beforeprint fired but its media
    // apply hasn't landed yet (headless printToPDF fires the event long
    // before it flips the query). While that beforeprint is inside the
    // apply grace the teardown re-arms rather than erasing the committed
    // DOM the live job is about to paginate.
    const armMmExit = (): void => {
      mmExitTimer = setTimeout(() => {
        mmExitTimer = undefined

        if (!printing || mql.matches) return

        if (Date.now() - pendingBeforeprintAt < PRINT_TIMING.MM_APPLY_GRACE) {
          armMmExit()

          return
        }

        exit()
      }, PRINT_TIMING.MM_EXIT_DEBOUNCE)
    }

    armMmExit()
  })

  // SSR/document-less evals (the boot defers past import in headless
  // probes) — the load warm-up has no document to capture, so skip it.
  if (typeof document === TYPE_STRINGS.UNDEFINED) return

  // Shadow-boundary version of the document capture below — the bridge
  // hands back every root registered before this module loaded; their
  // already-settled imgs warm directly since their load events fired
  // before a listener could exist.
  for (const root of installPrintWarm(warmPrintSource)) {
    for (const el of walkMedia(root)) {
      if (el.tagName === HTML_TAGS.IMG.toUpperCase()) {
        warmPrintSource(el as HTMLImageElement)
      }
    }
  }

  document.addEventListener(
    WINDOW_EVENTS.LOAD,
    (e) => {
      const el = e.target as Element | null

      if (el?.tagName === HTML_TAGS.IMG.toUpperCase()) {
        warmPrintSource(el as HTMLImageElement)
      }
    },
    true
  )

  // Proactive mark coverage: the load listener only fires for imgs that
  // RESOLVE on screen after it installs — route-mounted media lands long
  // after boot, so the observer re-arms a sweep that marks every
  // already-decoded src. Attribute mutations and text churn are
  // filtered out — only node growth schedules work.
  queueSweep()

  if (typeof MutationObserver === TYPE_STRINGS.FUNCTION) {
    new MutationObserver(queueSweep).observe(document.documentElement, {
      childList: true,
      subtree: true,
    })
  }
}
