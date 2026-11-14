/**
 * @file print-wrapup-tails.test.js
 * @description Coverage tail for core/utils/print/print.ts — the wrap-up
 * branches the earlier tails never reached: the gated scroll sweep and
 * skeleton settle, the interleaved-beforeprint media refresh, the
 * warmReady mark-only load bookkeeping, the MutationObserver idle
 * sweep (plus its setTimeout fallback), decode-rejection retirements
 * (light-DOM anchors, emptied shadow hosts, orphaned captions), the
 * print-hide stylesheet harvest across shadow adoptedStyleSheets, the
 * bleed plate seating arms (in-place, hoist through shadow boundaries,
 * landscape still copies, masthead reparents), figure caption URL
 * fallbacks, canvas capture declines, copy placement (hoisted outermost
 * host, sibling anchor walks), the upgrade swap guards, the HOME-route
 * contents page, the cover portrait arms, trackPrintJob/trackPrintNode,
 * the matchMedia edge/debounce dances, and a non-print keydown's
 * ignore path.
 */
import { jest } from '@jest/globals'
import { initPrintSupport, trackPrintJob, trackPrintNode } from '@core/utils/print/print.js'
import { initMediaManifest } from '@core/utils/media/manifest.js'
import router from '@core/router/router.js'
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
import { CARD_STACK_CLASSES } from '@core/tokens/classes/card-stack.js'
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
import { _B_SKELETON } from '@core/tokens/base.js'
import { PRINT_TIMING } from '@core/tokens/motion/print.js'
import { PREFETCH_CONFIG } from '@core/tokens/motion/prefetch.js'
import { ROUTE_NAMES } from '@core/tokens/routes/names.js'
import { KEYS } from '@core/tokens/primitives.js'
import { BASE_TITLE } from '@core/tokens/routes.js'
import { NAV_TEXT } from '@core/tokens/strings/text.js'
import { TEST_TEXT } from '@tests/fixtures/test-constants.js'

/** Opaque fixture CDN base — matches the literal hosts the sibling tails use. */
const CDN = 'https://cdn.example'

/** A `print:`-media rule's CSSRule.type — the happy-dom CSSOM never defines it. */
const RULE_MEDIA = 4

/** A style rule's CSSRule.type inside the fake sheet fixture. */
const RULE_STYLE = 1

/** A non-media/non-style grouping rule (supports/layer grammar). */
const RULE_GROUP = 12

/**
 * Bucket keys the stubbed manifest claims exist. `proj/*` stems feed the
 * figure fixtures; `photo` carries the full four-rung ladder (q50 → q75 →
 * original → uncompressed); `mob` proves only its `-mobile` derivative so
 * small boxes pick the mobile stem; `warm` exists to prove the warmReady
 * swap gate writes proven rungs the cache already fetched.
 */
const MANIFEST_KEYS = [
  `proj/pic${MEDIA.EXT}`,
  `proj/pic${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`,
  `proj/hero${MEDIA.EXT}`,
  `proj/hero${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`,
  `${CDN}/photo${MEDIA.EXT}`,
  `${CDN}/photo${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`,
  `${CDN}/photo${MEDIA.MOZ}${MEDIA.Q75}${MEDIA.EXT}`,
  `${CDN}/photo${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`,
  `${CDN}/warm${MEDIA.EXT}`,
  `${CDN}/warm${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`,
  `${CDN}/mob${MEDIA.EXT}`,
  `${CDN}/mob${MEDIA.MOBILE_SUFFIX}${MEDIA.EXT}`,
  `${CDN}/loose${MEDIA.WEBP_EXT}`,
  `${CDN}/cold${MEDIA.EXT}`,
  `${CDN}/cold${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`,
  `${CDN}/dead${MEDIA.EXT}`,
  `${CDN}/dead${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`,
  `${CDN}/top${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`,
  `${CDN}/alt${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`,
  `${CDN}/alt${MEDIA.MOZ}${MEDIA.Q75}${MEDIA.EXT}`,
  `${CDN}/alt${MEDIA.EXT}`,
  `${CDN}/alt${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`,
  // Emitted video-poster stills — a print swap only lands on a
  // manifest-proven `X.mp4.jpg`, so each fixture video's still is
  // claimed here.
  `proj/pic${MEDIA.VIDEO_EXT}${MEDIA.EXT}`,
  `${CDN}/v${MEDIA.VIDEO_EXT}${MEDIA.EXT}`,
]

/** The print-class selector a fake @media print rule hides on paper. */
const HIDE_SELECTOR = '.prt-hide'

/** Dispatches the native beforeprint event the module listens for. */
const fireBeforePrint = () => window.dispatchEvent(new window.Event(CLIPBOARD_EVENTS.BEFORE_PRINT))

/** Dispatches the native afterprint event the module listens for. */
const fireAfterPrint = () => window.dispatchEvent(new window.Event(CLIPBOARD_EVENTS.AFTER_PRINT))

/**
 * Waits `ms` real milliseconds — settle ticks, debounces and dialog grace
 * all run wall-clock in the tails suite.
 * @param {number} ms Milliseconds to wait.
 * @returns Promise resolving after the delay.
 */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Creates a `<media-figure>` host — `src` is the figure grammar's
 * extensionless bucket stem attribute.
 * @param {string} [src] Figure src attribute value.
 * @returns The figure element.
 */
const mkFigure = (src) => {
  const figure = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

  if (src !== undefined) figure.setAttribute(MEDIA_ATTRS.SRC, src)

  return figure
}

/**
 * Creates an img with the decode/loading props a retire/upgrade test
 * needs — complete/naturalWidth are defineProperty stubs because
 * happy-dom never loads real bytes (it reports complete=true/0 forever).
 * @param {object} opts Fixture knobs.
 * @param {string} opts.src The src attribute.
 * @param {boolean} [opts.complete] complete flag stub.
 * @param {number} [opts.naturalWidth] naturalWidth stub.
 * @param {string} [opts.decode] 'resolve' | 'reject' | 'hold' decode stub.
 * @returns The img element plus a release() for 'hold' decodes.
 */
const mkImg = ({ src, complete = true, naturalWidth = 0, decode } = {}) => {
  const img = document.createElement(HTML_TAGS.IMG)
  const out = { img, release: null }

  if (src !== undefined) img.setAttribute(MEDIA_ATTRS.SRC, src)

  Object.defineProperty(img, 'complete', { value: complete, configurable: true })
  Object.defineProperty(img, 'naturalWidth', { value: naturalWidth, configurable: true })

  if (decode === 'resolve') img.decode = () => Promise.resolve()
  else if (decode === 'reject') img.decode = () => Promise.reject(new Error('img decode failed'))
  else if (decode === 'hold') {
    img.decode = () =>
      new Promise((resolve, reject) => {
        out.release = reject
      })
  }

  return out
}

/**
 * Assert-free zero-rect helper — a sibling with no measurable box never
 * counts as content ahead in bleedAtStart.
 * @param {HTMLElement} el Element to stub.
 */
const zeroRect = (el) => {
  el.getBoundingClientRect = () => ({
    width: 0,
    height: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })
}

/**
 * Stubs a painted sibling box so bleedAtStart's flow check reads it as
 * real content ahead of the plate.
 * @param {HTMLElement} el Element to stub.
 */
const paintedRect = (el) => {
  el.getBoundingClientRect = () => ({
    width: 100,
    height: 50,
    top: 0,
    left: 0,
    right: 100,
    bottom: 50,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })
}

describe('print wrapup tails', () => {
  let mqlListener = null
  let mqlMatches = false
  let nativePrint = null
  let moCallback = null
  let moObserved = null
  let origMatchMedia
  let origPrint
  let origMutationObserver
  let origCssRule
  let origImage

  /** Recording MutationObserver — the idle sweep's callback is fired by hand. */
  class SpyMutationObserver {
    /**
     * @param {MutationCallback} cb The observer callback to capture.
     */
    constructor(cb) {
      moCallback = cb
    }
    /**
     * Records the observe() call.
     * @param {Node} target Observation root.
     * @param {MutationObserverInit} options Observation options.
     */
    observe(target, options) {
      moObserved = { target, options }
    }
    /** No-op disconnect. */
    disconnect() {}
    /**
     * Empty record queue.
     * @returns Empty record list.
     */
    takeRecords() {
      return []
    }
  }

  beforeAll(async () => {
    origMatchMedia = window.matchMedia
    origPrint = window.print
    origMutationObserver = globalThis.MutationObserver
    origCssRule = globalThis.CSSRule
    origImage = window.Image

    // The CSSOM globals the harvest probes — absent in happy-dom.
    globalThis.CSSRule = { MEDIA_RULE: RULE_MEDIA, STYLE_RULE: RULE_STYLE }

    globalThis.MutationObserver = SpyMutationObserver
    window.MutationObserver = SpyMutationObserver

    // Live `matches` getter — tests move the query under armed timers.
    window.matchMedia = (query) => ({
      get matches() {
        return mqlMatches
      },
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: (ev, fn) => {
        if (ev === FORM_EVENTS.CHANGE) mqlListener = fn
      },
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })

    const realFetch = globalThis.fetch

    globalThis.fetch = () =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(MANIFEST_KEYS) })

    await initMediaManifest()

    globalThis.fetch = realFetch

    // window.print must exist before init so the wrapper binds it as the
    // nativePrint the gated job calls.
    nativePrint = jest.fn()
    window.print = nativePrint

    initPrintSupport()
  })

  afterAll(() => {
    window.matchMedia = origMatchMedia
    window.print = origPrint
    globalThis.MutationObserver = origMutationObserver
    window.MutationObserver = origMutationObserver
    globalThis.CSSRule = origCssRule
    window.Image = origImage
  })

  afterEach(() => {
    fireAfterPrint()

    mqlMatches = false
    nativePrint.mockClear()
    router.currentRoute = null

    document.body.replaceChildren()
    document.head.replaceChildren()
    document.documentElement.classList.remove(STATE_CLASSES.DARK_MODE)
    document.documentElement.scrollTop = 0
    document.title = ATTR_VALUES.EMPTY

    delete document.scrollingElement
    delete document.documentElement.scrollHeight
    delete navigator.connection

    window.Image = origImage
  })

  test('gated print sweeps a tall document, waits out skeletons and refreshes an interleaved beforeprint', async () => {
    // A document taller than the viewport arms the scroll sweep.
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 1600,
      configurable: true,
    })
    Object.defineProperty(document.documentElement, 'scrollTop', {
      value: 0,
      writable: true,
      configurable: true,
    })

    // A skeleton inside a shadow root — the pending walk recurses roots.
    const host = document.createElement(HTML_TAGS.DIV)
    const shadow = host.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const skel = document.createElement(HTML_TAGS.DIV)

    skel.className = `${_B_SKELETON}--box`

    shadow.appendChild(skel)

    // A figure with a climb method earns a pendingPrint entry.
    const figure = mkFigure()

    figure.loadHighRes = () => Promise.resolve()

    // An app-shell img whose proven upgrade lands mid-job — the
    // interleaved beforeprint's upgrade runs while jobRunning is set.
    const app = document.createElement(HTML_TAGS.DIV)

    app.id = APP_IDS.APP

    const jobImg = document.createElement(HTML_TAGS.IMG)

    jobImg.setAttribute(MEDIA_ATTRS.SRC, `${CDN}/photo${MEDIA.EXT}`)
    app.appendChild(jobImg)

    document.body.append(host, figure, app)

    window.print()

    // The native channel interleaves inside the manifest wait — the job
    // refreshes the already-committed DOM rather than re-prepping it.
    fireBeforePrint()

    await wait(350)

    // Pending content clears — the quiet window then releases the job.
    skel.remove()

    await wait(PRINT_TIMING.SETTLE_TICK * (PRINT_TIMING.SETTLE_QUIET_TICKS + 2))

    expect(nativePrint).toHaveBeenCalledTimes(1)

    // The interleaved prep swapped the cold img straight to its top rung.
    expect(jobImg.getAttribute(MEDIA_ATTRS.SRC)).toBe(
      `${CDN}/photo${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`
    )

    fireAfterPrint()

    // scrollingElement null → the documentElement fallback scroller; a
    // swept-but-clean document breaks on the single quiet tick.
    Object.defineProperty(document, 'scrollingElement', { value: null, configurable: true })

    window.print()

    await wait(400)

    expect(nativePrint).toHaveBeenCalledTimes(2)
  })

  test('load-warmed rungs arm the top-tier swap; unwarmed stems hold the floor', () => {
    const app = document.createElement(HTML_TAGS.DIV)

    app.id = APP_IDS.APP

    // An img already resolved at the proven top rung — its load marks the
    // URL warmReady cites as "bytes already in cache". It lives in its own
    // well so the same-stem dedup can't reach the cold layer below.
    const markBox = document.createElement(HTML_TAGS.DIV)
    const markImg = mkImg({
      src: `${CDN}/photo${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`,
      naturalWidth: 50,
      decode: 'resolve',
    }).img

    markBox.appendChild(markImg)

    // In-flight (undecoded, not dead) mid-rung layer — the swap gate reads
    // warmReady for the top rung and, finding it marked, writes best.
    const coldBox = document.createElement(HTML_TAGS.DIV)
    const coldImg = mkImg({
      src: `${CDN}/photo${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`,
      complete: false,
      decode: 'resolve',
    }).img

    coldBox.appendChild(coldImg)

    // Same in-flight shape, different stem — nothing ever marked its top
    // rung, so the arm holds the floor (its current src) instead.
    const floorBox = document.createElement(HTML_TAGS.DIV)
    const floorImg = mkImg({
      src: `${CDN}/alt${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`,
      complete: false,
      decode: 'resolve',
    }).img

    floorBox.appendChild(floorImg)

    // Loads that can never be a cache proof — a src-less img and a data:
    // URI — mark nothing without throwing.
    const bareImg = mkImg({ complete: false }).img
    const dataImg = mkImg({
      src: 'data:image/png;base64,AA==',
      decode: 'resolve',
    }).img

    app.append(markBox, coldBox, floorBox, bareImg, dataImg)
    document.body.appendChild(app)

    markImg.dispatchEvent(new window.Event(WINDOW_EVENTS.LOAD))
    markImg.dispatchEvent(new window.Event(WINDOW_EVENTS.LOAD))
    bareImg.dispatchEvent(new window.Event(WINDOW_EVENTS.LOAD))
    dataImg.dispatchEvent(new window.Event(WINDOW_EVENTS.LOAD))

    fireBeforePrint()

    // warmReady.has(best) armed the swap — the top rung's bytes were
    // already proven fetched, so the undecoded arm writes it.
    expect(coldImg.getAttribute(MEDIA_ATTRS.SRC)).toBe(
      `${CDN}/photo${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`
    )

    // Unwarmed stem → the arm keeps the floor rung standing.
    expect(floorImg.getAttribute(MEDIA_ATTRS.SRC)).toBe(
      `${CDN}/alt${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`
    )

    // The already-loaded layer stands — a decoded src is never touched.
    expect(markImg.getAttribute(MEDIA_ATTRS.SRC)).toBe(
      `${CDN}/photo${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`
    )

    // data: surfaces retire outright — they were never openable.
    expect(dataImg.classList.contains(PRINT_CLASSES.SRC)).toBe(true)

    fireAfterPrint()
  })

  test('print ignores the screen connection budget — the proven top rung wins', () => {
    Object.defineProperty(navigator, 'connection', {
      value: { saveData: true },
      configurable: true,
    })

    const app = document.createElement(HTML_TAGS.DIV)

    app.id = APP_IDS.APP

    const saveDataImg = mkImg({
      src: `${CDN}/photo${MEDIA.EXT}`,
      complete: false,
      decode: 'resolve',
    }).img

    app.append(saveDataImg)
    document.body.appendChild(app)

    fireBeforePrint()

    // Save-data never downgrades paper — the swap pick always climbs to
    // the manifest's proven top rung (uncompressed here), which the
    // decoded-marker path already warmed.
    expect(saveDataImg.getAttribute(MEDIA_ATTRS.SRC)).toBe(
      `${CDN}/photo${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`
    )

    fireAfterPrint()
  })

  test('menu beforeprint harvests print sheets, plates figures and captions across the tree', async () => {
    // ── Print-hide sheets on shadow adoptedStyleSheets ──
    // A @media print rule's children join the hide set only under the
    // print media: `not print`/`screen` keep screen rules out, grouping
    // rules inherit the parent's flag, and pseudo/other-display rules
    // exercise every operand of the harvest predicate.
    const style = (sel, display = ATTR_VALUES.NONE) => ({
      type: RULE_STYLE,
      style: { display },
      selectorText: sel,
    })
    const sheet = {
      cssRules: [
        {
          type: RULE_MEDIA,
          media: { mediaText: 'print' },
          cssRules: [
            style(HIDE_SELECTOR),
            style('.prt::before'),
            style('.prt-show', 'block'),
            style('???'),
            { ...style('.prt-weird'), cssRules: [] },
            { type: 6 },
            {
              type: RULE_MEDIA,
              media: { mediaText: '(min-width: 1px)' },
              cssRules: [style('.prt-nested')],
            },
            { type: RULE_GROUP, cssRules: [style('.prt-grouped')] },
          ],
        },
        { type: RULE_MEDIA, media: { mediaText: 'not print' }, cssRules: [style('.prt-nope')] },
        { type: RULE_MEDIA, media: { mediaText: 'screen' }, cssRules: [style('.prt-scr')] },
        style('.prt-top'),
        { type: RULE_GROUP, cssRules: [style('.prt-outer')] },
      ],
    }
    const badSheet = {
      get cssRules() {
        throw new Error('cross-origin sheet')
      },
    }

    const sheetHost = document.createElement(HTML_TAGS.DIV)
    const dupHost = document.createElement(HTML_TAGS.DIV)
    const nullHost = document.createElement(HTML_TAGS.DIV)
    const sheetShadow = sheetHost.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const dupShadow = dupHost.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const nullShadow = nullHost.attachShadow({ mode: COMMON_ATTRS.OPEN })

    // A throwing sheet first, then the real sheet — the catch skips only
    // the unreadable one. The dup shadow proves the seen-set dedupe; the
    // null adopted list proves the ?? fallback.
    Object.defineProperty(sheetShadow, 'adoptedStyleSheets', {
      value: [badSheet, sheet],
      configurable: true,
    })
    Object.defineProperty(dupShadow, 'adoptedStyleSheets', {
      value: [sheet],
      configurable: true,
    })
    Object.defineProperty(nullShadow, 'adoptedStyleSheets', {
      value: null,
      configurable: true,
    })

    // ── Bleed figures: hoist, in-place, head-climb and restore arms ──
    // hoistHost is the first body child — its internal-main figure climbs
    // the shadow boundary to <body> and hoists after the cover sheets.
    const hoistHost = document.createElement(HTML_TAGS.DIV)
    const hoistShadow = hoistHost.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const hoistMain = document.createElement(HTML_TAGS.DIV)

    hoistMain.className = INTERNAL_CLASSES.INTERNAL_MAIN

    const hoistFigure = mkFigure('proj/pic')

    hoistFigure.attachShadow({ mode: COMMON_ATTRS.OPEN })
    hoistFigure.shadowRoot.appendChild(mkImg({ src: 'x' }).img)
    hoistMain.appendChild(hoistFigure)
    hoistShadow.appendChild(hoistMain)

    // Siblings in document order — every coverish/display/hidden/size
    // operand of the "content ahead" predicate gets evaluated.
    const coverDiv = document.createElement(HTML_TAGS.DIV)
    const faceDiv = document.createElement(HTML_TAGS.DIV)
    const tocDiv = document.createElement(HTML_TAGS.DIV)
    const plateDiv = document.createElement(HTML_TAGS.DIV)

    coverDiv.className = PRINT_CLASSES.COVER
    faceDiv.className = PRINT_CLASSES.FACE
    tocDiv.className = PRINT_CLASSES.TOC
    plateDiv.className = PRINT_CLASSES.PLATE

    const hideDiv = document.createElement(HTML_TAGS.DIV)
    const noneDiv = document.createElement(HTML_TAGS.DIV)
    const zeroDiv = document.createElement(HTML_TAGS.DIV)
    const visDiv = document.createElement(HTML_TAGS.DIV)

    hideDiv.className = HIDE_SELECTOR.slice(1)
    noneDiv.setAttribute(COMMON_ATTRS.STYLE, 'display:none')

    zeroRect(zeroDiv)
    zeroRect(hideDiv)
    paintedRect(visDiv)

    // The reader article's internal-main carries the in-place seat: a
    // visible flow sibling ahead vetoes the hoist, the canvas still seats
    // a copy INSIDE main (article placement), the masthead reparents, and
    // two figures prove the plated-set dedupe plus the stale-next restore.
    const article = document.createElement(HTML_TAGS.ARTICLE)

    article.className = READER_CLASSES.CONTENT

    const ahead = document.createElement(HTML_TAGS.DIV)

    paintedRect(ahead)

    const head = document.createElement(HTML_TAGS.H1)

    head.className = INTERNAL_CLASSES.INTERNAL_TITLE

    const main = document.createElement(HTML_TAGS.DIV)

    main.className = INTERNAL_CLASSES.INTERNAL_MAIN

    // Landscape figure — a real high layer whose ratio is wide.
    const landFigure = mkFigure('proj/pic')
    const landShadow = landFigure.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const landImg = document.createElement(HTML_TAGS.IMG)

    landImg.className = MEDIA_CLASSES.RENDER_MEDIA_HIGH
    landImg.setAttribute(MEDIA_ATTRS.SRC, `${CDN}/hero${MEDIA.EXT}`)

    Object.defineProperty(landImg, 'naturalWidth', { value: 2000, configurable: true })
    Object.defineProperty(landImg, 'naturalHeight', { value: 1000, configurable: true })
    landShadow.appendChild(landImg)

    // Second figure in the same main — the plated-set skips its own
    // head move and its next-sibling record anchors the reparented arm.
    const twinFigure = mkFigure('proj/hero')

    twinFigure.attachShadow({ mode: COMMON_ATTRS.OPEN })
    twinFigure.shadowRoot.appendChild(mkImg({ src: 'y' }).img)

    const canvas = document.createElement(HTML_TAGS.CANVAS)

    canvas.toDataURL = () => 'data:image/png;base64,CV=='

    main.append(landFigure, twinFigure, canvas)
    article.append(ahead, head, main)

    // A figure inside <head>'s shadow — the climb runs out of elements
    // above <html> and lands on the document (non-shadow) null arm.
    const headHost = document.createElement(HTML_TAGS.DIV)
    const headShadow = headHost.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const headMain = document.createElement(HTML_TAGS.DIV)

    headMain.className = INTERNAL_CLASSES.INTERNAL_MAIN

    const headFigure = mkFigure('proj/pic')

    headFigure.attachShadow({ mode: COMMON_ATTRS.OPEN })
    headFigure.shadowRoot.appendChild(mkImg({ src: 'z' }).img)
    headMain.appendChild(headFigure)
    headShadow.appendChild(headMain)
    document.head.appendChild(headHost)

    // Landscape figures covering the still-selector arms: thumb-only,
    // no src'd layer, and no shadow at all (box-ratio fallback).
    const thumbMain = document.createElement(HTML_TAGS.DIV)

    thumbMain.className = INTERNAL_CLASSES.INTERNAL_MAIN

    const thumbFigure = mkFigure('proj/pic')
    const thumbShadow = thumbFigure.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const thumbImg = document.createElement(HTML_TAGS.IMG)

    thumbImg.className = MEDIA_CLASSES.RENDER_MEDIA_THUMB
    thumbImg.setAttribute(MEDIA_ATTRS.SRC, `${CDN}/thumb${MEDIA.EXT}`)

    Object.defineProperty(thumbImg, 'naturalWidth', { value: 2000, configurable: true })
    Object.defineProperty(thumbImg, 'naturalHeight', { value: 1000, configurable: true })
    thumbShadow.appendChild(thumbImg)

    const noStillFigure = mkFigure('proj/pic')
    const noStillShadow = noStillFigure.attachShadow({ mode: COMMON_ATTRS.OPEN })

    Object.defineProperty(noStillFigure, 'getBoundingClientRect', {
      value: () => ({ width: 1600, height: 1000 }),
      configurable: true,
    })
    noStillShadow.appendChild(document.createElement(HTML_TAGS.IMG))

    const bareFigure = mkFigure('proj/pic')

    Object.defineProperty(bareFigure, 'getBoundingClientRect', {
      value: () => ({ width: 1600, height: 1000 }),
      configurable: true,
    })
    thumbMain.append(thumbFigure, noStillFigure, bareFigure)
    article.appendChild(thumbMain)

    // Head-move operands: an h1 that already carries the bleed tag stops
    // the reparent (`!BLEED_HEAD`), a plain h1 stops at the title-class
    // check, and an injected caption/QR pair after a figure proves the
    // move-record's static-sibling walk skips injected nodes.
    const head3 = document.createElement(HTML_TAGS.H1)

    head3.className = `${INTERNAL_CLASSES.INTERNAL_TITLE} ${PRINT_CLASSES.BLEED_HEAD}`

    const main3 = document.createElement(HTML_TAGS.DIV)

    main3.className = INTERNAL_CLASSES.INTERNAL_MAIN

    const figure3 = mkFigure('proj/pic')

    figure3.attachShadow({ mode: COMMON_ATTRS.OPEN })
    figure3.shadowRoot.appendChild(mkImg({ src: 'f3' }).img)
    main3.appendChild(figure3)

    const head4 = document.createElement(HTML_TAGS.H1)
    const main4 = document.createElement(HTML_TAGS.DIV)

    main4.className = INTERNAL_CLASSES.INTERNAL_MAIN

    const figure4 = mkFigure('proj/pic')

    figure4.attachShadow({ mode: COMMON_ATTRS.OPEN })
    figure4.shadowRoot.appendChild(mkImg({ src: 'f4' }).img)
    main4.appendChild(figure4)

    const main5 = document.createElement(HTML_TAGS.DIV)

    main5.className = INTERNAL_CLASSES.INTERNAL_MAIN

    const figure5 = mkFigure('proj/pic')

    figure5.attachShadow({ mode: COMMON_ATTRS.OPEN })
    figure5.shadowRoot.appendChild(mkImg({ src: 'f5' }).img)

    const fakeCap = document.createElement(HTML_TAGS.P)

    fakeCap.className = PRINT_CLASSES.CAPTION

    const fakeQrNode = document.createElement(HTML_TAGS.DIV)

    fakeQrNode.className = PRINT_CLASSES.QR_LINK
    main5.append(figure5, fakeCap, fakeQrNode)

    // A figure-shadow video whose shadow has no img layer swaps its still
    // copy right after the host — the caption cites the figure's `.mp4`.
    const vidMain = document.createElement(HTML_TAGS.DIV)

    vidMain.className = INTERNAL_CLASSES.INTERNAL_MAIN

    const vidMainFigure = mkFigure('proj/pic')

    vidMainFigure.setAttribute(MEDIA_ATTRS.IS_VIDEO, ATTR_VALUES.TRUE)

    const vidMainShadow = vidMainFigure.attachShadow({ mode: COMMON_ATTRS.OPEN })

    vidMainShadow.appendChild(document.createElement(HTML_TAGS.VIDEO))
    vidMain.appendChild(vidMainFigure)

    // Same stem'd figure with a rendered still layer already under the
    // video — the video only tags out; the img prints the poster.
    const vidMain2 = document.createElement(HTML_TAGS.DIV)

    vidMain2.className = INTERNAL_CLASSES.INTERNAL_MAIN

    const vidStillFigure = mkFigure('proj/pic')

    vidStillFigure.setAttribute(MEDIA_ATTRS.IS_VIDEO, ATTR_VALUES.TRUE)

    const vidStillShadow = vidStillFigure.attachShadow({ mode: COMMON_ATTRS.OPEN })

    vidStillShadow.append(
      document.createElement(HTML_TAGS.VIDEO),
      mkImg({ src: `${CDN}/fvs.jpg` }).img
    )
    vidMain2.appendChild(vidStillFigure)

    // A print-hidden sibling ahead of a main isn't "content" — the
    // bleed probe skips it through the harvested @media print set.
    const hideAhead = document.createElement(HTML_TAGS.DIV)

    hideAhead.className = HIDE_SELECTOR.slice(1)

    article.append(head3, main3, head4, main4, hideAhead, main5, vidMain, vidMain2)

    // ── Figure caption URL arms ──
    // A video figure with no stem → EMPTY; an image figure with no stem →
    // EMPTY top then the live shadow img's src; a stem-proven figure →
    // the canonical top rung.
    const vidFigure = mkFigure()

    vidFigure.setAttribute(MEDIA_ATTRS.IS_VIDEO, ATTR_VALUES.TRUE)

    const vidShadow = vidFigure.attachShadow({ mode: COMMON_ATTRS.OPEN })

    // A source-less video inside an unstem'd figure retires outright —
    // no poster, no derivable still, no printable form.
    vidShadow.append(
      document.createElement(HTML_TAGS.VIDEO),
      mkImg({ src: `${CDN}/vstill.jpg`, decode: 'resolve' }).img
    )

    // No stem + a src-less first layer → the caption read hits the
    // `getAttribute(SRC) ?? EMPTY` arm and prints nothing.
    const noStemFigure = mkFigure()
    const noStemShadow = noStemFigure.attachShadow({ mode: COMMON_ATTRS.OPEN })

    noStemShadow.appendChild(mkImg({}).img)
    noStemShadow.appendChild(mkImg({ src: `${CDN}/other.jpg`, decode: 'resolve' }).img)

    // No stem but the first shadow layer carries a live src → the credit
    // cites that layer directly.
    const liveFigure = mkFigure()
    const liveShadow = liveFigure.attachShadow({ mode: COMMON_ATTRS.OPEN })

    liveShadow.appendChild(mkImg({ src: `${CDN}/live.jpg`, decode: 'resolve' }).img)

    const stemFigure = mkFigure('proj/pic')
    const stemShadow = stemFigure.attachShadow({ mode: COMMON_ATTRS.OPEN })

    stemShadow.appendChild(mkImg({ src: 's', decode: 'resolve' }).img)

    // ── Canvas arms: capture-decline, is-fallback, two copies one host ──
    const skipCanvas = document.createElement(HTML_TAGS.CANVAS)

    skipCanvas.addEventListener(PRINT_EVENTS.CAPTURE, (e) => {
      e.detail.skip = true
    })

    const declineCanvas = document.createElement(HTML_TAGS.CANVAS)

    declineCanvas.setAttribute(DATA_ATTRS.PRINT_CAPTURE, ATTR_VALUES.EMPTY)

    const fbCanvas = document.createElement(HTML_TAGS.CANVAS)

    fbCanvas.className = STATE_CLASSES.IS_FALLBACK

    const copyHost = document.createElement(HTML_TAGS.DIV)
    const copyShadow = copyHost.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const shCanvas = document.createElement(HTML_TAGS.CANVAS)
    const shCanvas2 = document.createElement(HTML_TAGS.CANVAS)

    shCanvas.toDataURL = () => 'data:image/png;base64,SH=='
    shCanvas2.toDataURL = () => 'data:image/png;base64,S2=='
    copyShadow.append(shCanvas, shCanvas2)

    // Landscape hoists — the light-DOM one climbs to `: el`; the shadow
    // one recurses outerHost through its root.
    const landCanvas = document.createElement(HTML_TAGS.CANVAS)

    landCanvas.setAttribute(DATA_ATTRS.PRINT_LANDSCAPE, ATTR_VALUES.EMPTY)
    landCanvas.toDataURL = () => 'data:image/png;base64,LA=='

    const landHost = document.createElement(HTML_TAGS.DIV)
    const landShadow2 = landHost.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const landShCanvas = document.createElement(HTML_TAGS.CANVAS)

    landShCanvas.setAttribute(DATA_ATTRS.PRINT_LANDSCAPE, ATTR_VALUES.EMPTY)
    landShCanvas.toDataURL = () => 'data:image/png;base64,LS=='
    landShadow2.appendChild(landShCanvas)

    // A poster video swaps to a still and earns its own caption.
    const video = document.createElement(HTML_TAGS.VIDEO)

    video.setAttribute(MEDIA_ATTRS.POSTER, `${CDN}/poster.jpg`)

    // A thumb-grammar img proves the THUMB_EXT stem fold in the caption.
    // A painted (non-dead) surface keeps the upgrade swap from folding
    // the thumb src away before the caption derives its own still.
    const thumbSrcImg = document.createElement(HTML_TAGS.IMG)

    thumbSrcImg.setAttribute(MEDIA_ATTRS.SRC, `${CDN}/thumb${MEDIA.THUMB_EXT}`)

    Object.defineProperty(thumbSrcImg, 'naturalWidth', { value: 50, configurable: true })
    article.appendChild(thumbSrcImg)

    document.body.append(
      hoistHost,
      sheetHost,
      dupHost,
      nullHost,
      coverDiv,
      faceDiv,
      tocDiv,
      plateDiv,
      hideDiv,
      noneDiv,
      zeroDiv,
      visDiv,
      article,
      vidFigure,
      noStemFigure,
      liveFigure,
      stemFigure,
      skipCanvas,
      declineCanvas,
      fbCanvas,
      copyHost,
      landCanvas,
      landHost,
      video
    )

    // A plate still whose decode rejects rides the catch's `return
    // undefined` fallback — only `.print-copy` surfaces reject so every
    // screen layer keeps its bytes through the pass.
    const imgProto = window.HTMLImageElement.prototype
    const realDecode = imgProto.decode

    imgProto.decode = function () {
      return this.classList.contains(PRINT_CLASSES.COPY)
        ? Promise.reject(new Error('still decode failed'))
        : Promise.resolve()
    }

    fireBeforePrint()

    imgProto.decode = realDecode

    // In-place seats: the plates landed inside the article (a visible
    // flow sibling vetoed the hoist) — landFigure's plate carries the
    // landscape still copy and the reparented masthead.
    const articlePlates = [...article.querySelectorAll(`.${PRINT_CLASSES.PLATE}`)]
    const plate = articlePlates.find((p) => p.contains(landFigure))

    expect(plate).toBeTruthy()
    expect(plate.classList.contains(PRINT_CLASSES.PLATE_LANDSCAPE)).toBe(true)
    expect(article.contains(plate)).toBe(true)
    expect(plate.querySelector('img[src$="hero.jpg"]')).toBeTruthy()

    // The reparented masthead rides inside the plate, stamped bleed-head.
    expect(plate.contains(head)).toBe(true)
    expect(head.classList.contains(PRINT_CLASSES.BLEED_HEAD)).toBe(true)

    // The canvas still stayed inside main — it rode the plate too.
    const stillCopy = plate.querySelector(`img.${PRINT_CLASSES.COPY}[src^="data:image"]`)

    expect(stillCopy).toBeTruthy()

    // Hoisted figure: the plate sits at document level after the covers.
    const plates = [...document.body.children].filter((el) =>
      el.classList.contains(PRINT_CLASSES.PLATE)
    )

    expect(plates.some((p) => p.contains(hoistFigure))).toBe(true)

    // Thumb-only landscape still earned its copy; the box-ratio figure
    // with no src'd layer got no copy; the shadow-less figure survives.
    const thumbPlate = [...document.querySelectorAll(`.${PRINT_CLASSES.PLATE}`)].find((p) =>
      p.contains(thumbFigure)
    )

    expect(thumbPlate?.querySelector(`img.${PRINT_CLASSES.COPY}`)).toBeTruthy()

    const liveCaption = [...document.querySelectorAll(`.${PRINT_CLASSES.CAPTION}`)].find((cap) =>
      cap.textContent.includes(`${CDN}/live.jpg`)
    )

    // No stem → the live shadow img's src is what the credit cites.
    expect(liveCaption).toBeTruthy()

    // The is-video figure's own caption short-circuits (no stem → no
    // still URL); the still layer inside it prints its own img credit —
    // img captions seat inside the figure's shadow next to their layer.
    const vidCaption = [...vidFigure.shadowRoot.querySelectorAll(`.${PRINT_CLASSES.CAPTION}`)].find(
      (cap) => cap.textContent.includes(`${CDN}/vstill.jpg`)
    )

    expect(vidCaption).toBeTruthy()

    // Landscape hoist copies: light-DOM and shadow-anchored, each plated.
    const landCopies = [...document.querySelectorAll(`img.${PRINT_CLASSES.COPY}`)].filter((img) =>
      img.src.includes('data:image/png;base64,L')
    )

    expect(landCopies.length).toBeGreaterThanOrEqual(2)
    expect(document.documentElement.classList.contains(PRINT_CLASSES.PLATE_DOC)).toBe(true)

    // The two shadow canvases emit two stills; the second walked past the
    // first copy (and its caption) to seat itself.
    const firstCopy = copyHost.nextElementSibling

    expect(firstCopy?.classList.contains(PRINT_CLASSES.COPY)).toBe(true)

    const secondCopy = document.querySelector('img[src$="S2=="]')

    expect(secondCopy).toBeTruthy()
    expect(secondCopy.previousElementSibling?.classList.contains(PRINT_CLASSES.CAPTION)).toBe(true)

    // The poster video carries a still copy plus its source caption.
    const vidCopy = [...document.querySelectorAll(`img.${PRINT_CLASSES.COPY}`)].find((img) =>
      img.src.includes(`${CDN}/poster.jpg`)
    )

    expect(vidCopy).toBeTruthy()

    const vidCap = [...document.querySelectorAll(`.${PRINT_CLASSES.CAPTION}`)].find((cap) =>
      cap.textContent.includes(`${CDN}/poster.jpg`)
    )

    expect(vidCap).toBeTruthy()

    // Captured-decline + is-fallback canvases print via their own
    // fallback class and restore it on afterprint.
    expect(declineCanvas.classList.contains(PRINT_CLASSES.FALLBACK)).toBe(true)
    expect(fbCanvas.classList.contains(PRINT_CLASSES.FALLBACK)).toBe(true)
    expect(skipCanvas.classList.contains(PRINT_CLASSES.FALLBACK)).toBe(false)

    fireAfterPrint()

    // Exit restores the bleed reparents — the figure is home and the
    // masthead lost the bleed-head tag (stale-next anchors revalidated).
    expect(main.contains(landFigure)).toBe(true)
    expect(head.classList.contains(PRINT_CLASSES.BLEED_HEAD)).toBe(false)
    expect(declineCanvas.classList.contains(PRINT_CLASSES.FALLBACK)).toBe(false)
    expect(fbCanvas.classList.contains(PRINT_CLASSES.FALLBACK)).toBe(false)
  })

  test('rejected decodes retire dead surfaces, anchors and emptied shadow hosts', async () => {
    const app = document.createElement(HTML_TAGS.DIV)

    app.id = APP_IDS.APP

    // ── Light-DOM retire arms ──
    // bare: img anchor; aDying: <a> anchor; picDying: <picture> anchor —
    // each orphan caption gets removed with the dead surface.
    const bare = mkImg({ src: `${CDN}/bare.jpg`, decode: 'reject' })
    const anchor = document.createElement(HTML_TAGS.A)

    anchor.setAttribute(LINK_ATTRS.HREF, `${CDN}/card`)

    const aDying = mkImg({ src: `${CDN}/a.jpg`, decode: 'reject' })

    anchor.appendChild(aDying.img)

    const picture = document.createElement(HTML_TAGS.PICTURE)
    const picDying = mkImg({ src: `${CDN}/p.jpg`, decode: 'reject' })

    picture.appendChild(picDying.img)

    // A caption-less dead img — its next sibling is not a caption, so the
    // orphan check leaves it standing.
    const quiet = mkImg({ src: `${CDN}/quiet.jpg`, decode: 'reject' })

    quiet.img.setAttribute(DATA_ATTRS.PRINT_NO_CAPTION, ATTR_VALUES.EMPTY)

    const keeper = document.createElement(HTML_TAGS.DIV)

    // Painted or incomplete surfaces keep standing — only a truly dead
    // (complete && zero-pixel) surface retires.
    const alive = mkImg({ src: `${CDN}/alive.jpg`, naturalWidth: 50, decode: 'reject' })
    const loading = mkImg({ src: `${CDN}/load.jpg`, complete: false, decode: 'reject' })

    // Same-stem twins: the second img's dedupe retires the first mid-pass,
    // so its own decode reject hits the already-marked early return.
    const twinA = mkImg({ src: `${CDN}/dup${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`, decode: 'reject' })
    const twinB = mkImg({
      src: `${CDN}/dup${MEDIA.MOZ}${MEDIA.Q75}${MEDIA.EXT}`,
      decode: 'resolve',
    })

    // Pre-marked layers: the rescued-src un-mark, the src-less operand,
    // and the data: operand all evaluate in one pass. The src-less twin
    // sits BEFORE its src'd sibling — a later same-stem sibling would
    // otherwise promote it off the retire path.
    const rescuedBare = mkImg({ decode: 'resolve' })

    rescuedBare.img.classList.add(PRINT_CLASSES.SRC)

    // The sibling-promote fallback: the src-less layer inherits its
    // sibling's .webp original verbatim — the .jpg rung ladder never
    // proves a webp, so `promoted` stays '' and the manifest-gated
    // `original === thumbSrc` write lands instead. The later layer then
    // dedupes the .webp sibling retired under it.
    const thumbPrev = mkImg({ src: `${CDN}/loose${MEDIA.WEBP_EXT}`, decode: 'resolve' })
    const promoteBare = mkImg({ decode: 'resolve' })

    const rescued = mkImg({ src: `${CDN}/photo${MEDIA.EXT}`, decode: 'resolve' })

    rescued.img.classList.add(PRINT_CLASSES.SRC)

    const rescuedData = mkImg({ src: 'data:image/png;base64,AA==', decode: 'resolve' })

    rescuedData.img.classList.add(PRINT_CLASSES.SRC)

    app.append(
      bare.img,
      anchor,
      picture,
      quiet.img,
      keeper,
      alive.img,
      loading.img,
      twinA.img,
      twinB.img,
      rescuedBare.img,
      thumbPrev.img,
      promoteBare.img,
      rescued.img,
      rescuedData.img
    )

    // ── Shadow retire arms ──
    // surviveHost keeps standing — a sibling layer still prints.
    const surviveHost = document.createElement(HTML_TAGS.DIV)
    const surviveShadow = surviveHost.attachShadow({ mode: COMMON_ATTRS.OPEN })

    surviveShadow.append(
      mkImg({ src: `${CDN}/die.jpg`, decode: 'reject' }).img,
      mkImg({ src: `${CDN}/live.jpg`, decode: 'resolve' }).img
    )

    // collapseFigure's only layer dies — the emptied host collapses and
    // its seated caption plus a QR-link sibling get swept with it.
    const collapseFigure = mkFigure('proj/pic')
    const collapseShadow = collapseFigure.attachShadow({ mode: COMMON_ATTRS.OPEN })

    collapseShadow.appendChild(mkImg({ src: `${CDN}/die.jpg`, decode: 'reject' }).img)

    // comboHost's next sibling is a canvas still — a copy blocks the
    // host collapse even with no surviving layers.
    const comboHost = document.createElement(HTML_TAGS.DIV)
    const comboShadow = comboHost.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const comboCanvas = document.createElement(HTML_TAGS.CANVAS)

    comboCanvas.toDataURL = () => 'data:image/png;base64,CO=='
    comboShadow.append(comboCanvas, mkImg({ src: `${CDN}/die.jpg`, decode: 'reject' }).img)

    document.body.append(app, surviveHost, collapseFigure, comboHost)

    fireBeforePrint()

    // The dying layer's figure caption seats after the host — a trailing
    // QR sibling rides the same sweep.
    const cap = collapseFigure.nextElementSibling
    const fakeQr = document.createElement(HTML_TAGS.DIV)

    fakeQr.className = PRINT_CLASSES.QR_LINK

    collapseFigure.after(cap, fakeQr)

    await wait(30)

    // Light-DOM retirements: dead imgs tagged out; their captions are gone.
    expect(bare.img.classList.contains(PRINT_CLASSES.SRC)).toBe(true)
    expect(aDying.img.classList.contains(PRINT_CLASSES.SRC)).toBe(true)
    expect(picDying.img.classList.contains(PRINT_CLASSES.SRC)).toBe(true)
    expect(anchor.nextElementSibling?.classList.contains(PRINT_CLASSES.CAPTION)).toBe(false)
    expect(picture.nextElementSibling?.classList.contains(PRINT_CLASSES.CAPTION)).toBe(false)

    // The caption-less sibling kept its place.
    expect(quiet.img.classList.contains(PRINT_CLASSES.SRC)).toBe(true)
    expect(quiet.img.nextElementSibling).toBe(keeper)

    // Painted/loading surfaces stayed untouched by the retire.
    expect(alive.img.classList.contains(PRINT_CLASSES.SRC)).toBe(false)
    expect(loading.img.classList.contains(PRINT_CLASSES.SRC)).toBe(false)

    // The dedupe-retired twin's late reject hit the marked early return —
    // it stays retired, its sibling prints.
    expect(twinA.img.classList.contains(PRINT_CLASSES.SRC)).toBe(true)
    expect(twinB.img.classList.contains(PRINT_CLASSES.SRC)).toBe(false)

    // The rescued layer won its src back and took the floor rung — a
    // dead-standing src swaps only within the snapshot window, so the
    // smallest proven pull wins over the top tier; src-less/data twins
    // stayed marked.
    expect(rescued.img.classList.contains(PRINT_CLASSES.SRC)).toBe(false)
    expect(rescued.img.getAttribute(MEDIA_ATTRS.SRC)).toBe(
      `${CDN}/photo${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`
    )
    expect(rescuedBare.img.classList.contains(PRINT_CLASSES.SRC)).toBe(true)
    expect(rescuedData.img.classList.contains(PRINT_CLASSES.SRC)).toBe(true)

    // The manifest-gated sibling promote wrote the .webp original —
    // promoted, the layer then retired the .webp sibling under it.
    expect(promoteBare.img.getAttribute(MEDIA_ATTRS.SRC)).toBe(`${CDN}/loose${MEDIA.WEBP_EXT}`)
    expect(promoteBare.img.classList.contains(PRINT_CLASSES.SRC)).toBe(false)
    expect(thumbPrev.img.classList.contains(PRINT_CLASSES.SRC)).toBe(true)
    expect(thumbPrev.img.hasAttribute(MEDIA_ATTRS.SRC)).toBe(false)

    // Emptied host collapsed with its caption/QR siblings; the
    // still-served host stands.
    expect(collapseFigure.classList.contains(PRINT_CLASSES.SRC)).toBe(true)
    expect(fakeQr.isConnected).toBe(false)
    expect(surviveHost.classList.contains(PRINT_CLASSES.SRC)).toBe(false)

    // A copy next sibling blocks the collapse.
    expect(comboHost.classList.contains(PRINT_CLASSES.SRC)).toBe(false)

    // ── A decode settling after the job hits the !printing guard ──
    const held = mkImg({ src: `${CDN}/held.jpg`, decode: 'hold' })

    app.appendChild(held.img)
    fireAfterPrint()
    fireBeforePrint()
    fireAfterPrint()

    // Reject lands post-exit — the retire no-ops.
    held.release(new Error('late'))

    await wait(0)

    expect(held.img.classList.contains(PRINT_CLASSES.SRC)).toBe(false)
  })

  test('the upgrade guard holds an alive unwarmed swap and a mobile box picks the mobile stem', () => {
    const app = document.createElement(HTML_TAGS.DIV)

    app.id = APP_IDS.APP

    // Alive (painted) img, unwarmed, mid-screen: the swap guard holds —
    // a cold multi-megabyte pull can never race the snapshot. The cold
    // stem is never warmed anywhere in the suite, so warmReady can't
    // arm the swap either.
    const alive = mkImg({ src: `${CDN}/cold${MEDIA.EXT}`, naturalWidth: 50, decode: 'resolve' })

    // A dead src always swaps — paper shows the proven rung.
    const dead = mkImg({
      src: `${CDN}/dead${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`,
      decode: 'resolve',
    })

    // Already at the top rung — the best!==current guard skips the write.
    const topped = mkImg({
      src: `${CDN}/top${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`,
      naturalWidth: 50,
      decode: 'resolve',
    })

    // Small box → the `-mobile` derivative stem is the proven pick.
    const mob = mkImg({ src: `${CDN}/mob${MEDIA.EXT}`, decode: 'resolve' })

    Object.defineProperty(mob.img, 'getBoundingClientRect', {
      value: () => ({ width: 300, height: 200 }),
      configurable: true,
    })

    // Small box with NO mobile rungs → the full ladder answers instead;
    // the small-box drop still clamps the pick below the top rung.
    const mobless = mkImg({ src: `${CDN}/alt${MEDIA.EXT}`, decode: 'resolve' })

    Object.defineProperty(mobless.img, 'getBoundingClientRect', {
      value: () => ({ width: 300, height: 200 }),
      configurable: true,
    })

    app.append(alive.img, dead.img, topped.img, mob.img, mobless.img)
    document.body.appendChild(app)

    fireBeforePrint()

    expect(alive.img.getAttribute(MEDIA_ATTRS.SRC)).toBe(`${CDN}/cold${MEDIA.EXT}`)
    expect(dead.img.getAttribute(MEDIA_ATTRS.SRC)).toBe(`${CDN}/dead${MEDIA.EXT}`)
    expect(topped.img.getAttribute(MEDIA_ATTRS.SRC)).toBe(
      `${CDN}/top${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`
    )
    expect(mob.img.getAttribute(MEDIA_ATTRS.SRC)).toBe(
      `${CDN}/mob${MEDIA.MOBILE_SUFFIX}${MEDIA.EXT}`
    )
    expect(mobless.img.getAttribute(MEDIA_ATTRS.SRC)).toBe(
      `${CDN}/alt${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`
    )
  })

  test('the contents page collects heads across shadow trees on the home route', () => {
    router.currentRoute = { name: ROUTE_NAMES.HOME }

    // Light-DOM heads — normal text, aria-label lead, whitespace-label
    // fallback to textContent, card-stack sub-entry, dupe, empty, sr-only,
    // [hidden] and [inert] subtree skips.
    const heads = []
    const mkHead = (text, attrs = {}) => {
      const h = document.createElement(HTML_TAGS.H2)

      h.textContent = text

      for (const [k, v] of Object.entries(attrs)) h.setAttribute(k, v)

      return h
    }

    heads.push(mkHead(TEST_TEXT.HEADING))
    heads.push(mkHead('', { [ARIA_ATTRS.ARIA_LABEL]: NAV_TEXT.ABOUT }))
    heads.push(mkHead(NAV_TEXT.CONTACT, { [ARIA_ATTRS.ARIA_LABEL]: '   ' }))
    heads.push(mkHead(TEST_TEXT.HEADING)) // duplicate — deduped
    heads.push(mkHead('')) // empty — skipped
    heads.push(mkHead(TEST_TEXT.SECOND, { class: A11Y_CLASSES.SR_ONLY })) // sr-only — skipped

    const cardWrap = document.createElement(HTML_TAGS.DIV)

    cardWrap.className = CARD_STACK_CLASSES.CARD_STACK_CARD
    cardWrap.appendChild(mkHead(TEST_TEXT.BODY))

    const hiddenWrap = document.createElement(HTML_TAGS.DIV)

    hiddenWrap.setAttribute(COMMON_ATTRS.HIDDEN, ATTR_VALUES.EMPTY)
    hiddenWrap.appendChild(mkHead('Hidden'))

    const inertWrap = document.createElement(HTML_TAGS.DIV)

    inertWrap.setAttribute(COMMON_ATTRS.INERT, ATTR_VALUES.EMPTY)
    inertWrap.appendChild(mkHead('Inert'))

    // A shadow-bound h1 joins the list; a site-toast shadow (chrome) is
    // skipped entirely.
    const host = document.createElement(HTML_TAGS.DIV)
    const shadow = host.attachShadow({ mode: COMMON_ATTRS.OPEN })

    shadow.appendChild(mkHead('Shadow'))

    const toast = document.createElement(COMPONENT_TAGS.SITE_TOAST)
    const toastShadow = toast.attachShadow({ mode: COMMON_ATTRS.OPEN })

    toastShadow.appendChild(mkHead('Chrome'))

    document.body.append(...heads, cardWrap, hiddenWrap, inertWrap, host, toast)

    fireBeforePrint()

    const toc = document.querySelector(`.${PRINT_CLASSES.TOC}`)

    expect(toc).toBeTruthy()
    expect(toc.querySelector(`.${PRINT_CLASSES.TOC_HEAD}`).textContent).toBe(NAV_TEXT.CONTENTS)

    const items = toc.querySelectorAll(`.${PRINT_CLASSES.TOC_ITEM}`)
    const subs = toc.querySelectorAll(`.${PRINT_CLASSES.TOC_ITEM_SUB}`)

    // Heading, aria-label About, textContent Contact, shadow h1 — dupes,
    // empties, sr-only, hidden, inert and chrome heads all filtered.
    expect(items).toHaveLength(4)
    expect(subs).toHaveLength(1)
    expect(subs[0].querySelector(`.${PRINT_CLASSES.TOC_TEXT}`).textContent).toBe(TEST_TEXT.BODY)
    expect(subs[0].querySelector(`.${PRINT_CLASSES.TOC_NUM}`).textContent).toBe('')
    expect(toc.textContent).not.toContain('Hidden')
    expect(toc.textContent).not.toContain('Chrome')

    fireAfterPrint()

    // Fewer than three collected heads → the leaf drops entirely.
    document.body.replaceChildren()

    const lone = mkHead(TEST_TEXT.HEADING)

    document.body.appendChild(lone)
    fireBeforePrint()

    expect(document.querySelector(`.${PRINT_CLASSES.TOC}`)).toBeNull()
  })

  test('the cover portrait rides plates, figure stems and the about image in order', () => {
    const proto = window.HTMLImageElement.prototype
    const realDecode = proto.decode

    // Every injected still/portrait decode rejects — the catch arrows run.
    proto.decode = () => Promise.reject(new Error('decode fail'))

    document.title = `${BASE_TITLE} | ${TEST_TEXT.SECOND}`

    // Arm 1: a landscape canvas plate's still is the cover star.
    const landCanvas = document.createElement(HTML_TAGS.CANVAS)

    landCanvas.setAttribute(DATA_ATTRS.PRINT_LANDSCAPE, ATTR_VALUES.EMPTY)
    landCanvas.toDataURL = () => 'data:image/png;base64,PT=='

    document.body.appendChild(landCanvas)
    fireBeforePrint()

    let portrait = document.querySelector(`.${PRINT_CLASSES.COVER_PHOTO}`)

    expect(portrait).toBeTruthy()
    expect(portrait.src).toContain('data:image/png')

    // A dead cover star drops itself rather than printing a broken box.
    portrait.dispatchEvent(new window.Event(WINDOW_EVENTS.ERROR))
    expect(portrait.isConnected).toBe(false)

    fireAfterPrint()
    document.body.replaceChildren()

    // Arm 2: no plate copies — the internal hero's proven stem wins. The
    // figure's own plate reparents it out of internal-main, so the walk
    // reads the ancestor main of a NESTED plate — the stem pick fires
    // off the outer well's host.
    const heroOuter = document.createElement(HTML_TAGS.DIV)

    heroOuter.className = INTERNAL_CLASSES.INTERNAL_MAIN

    // A painted sibling ahead keeps the seat in-place — a hoisted plate
    // leaves the document before the cover reads it.
    const heroAhead = document.createElement(HTML_TAGS.DIV)

    paintedRect(heroAhead)

    const heroMain = document.createElement(HTML_TAGS.DIV)

    heroMain.className = INTERNAL_CLASSES.INTERNAL_MAIN

    const hero = mkFigure('proj/hero')
    const heroShadow = hero.attachShadow({ mode: COMMON_ATTRS.OPEN })

    heroShadow.appendChild(mkImg({ src: 'h' }).img)
    heroMain.appendChild(hero)
    heroOuter.append(heroAhead, heroMain)

    // A figure outside internal-main can't be the cover star.
    const sideFigure = mkFigure('proj/pic')

    sideFigure.attachShadow({ mode: COMMON_ATTRS.OPEN })
    sideFigure.shadowRoot.appendChild(mkImg({ src: 's' }).img)

    // The side figure seats first so the walk's continue arm runs before
    // the stem'd hero ends it.
    document.body.append(sideFigure, heroOuter)
    fireBeforePrint()

    portrait = document.querySelector(`.${PRINT_CLASSES.COVER_PHOTO}`)

    expect(portrait).toBeTruthy()
    expect(portrait.src.endsWith(`proj/hero${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`)).toBe(true)

    fireAfterPrint()

    // Arms are exclusive — each fixture leaves the tree so the next
    // portrait pick can't inherit a leftover star.
    document.body.replaceChildren()

    // Arm 3: an internal-main figure with no stem → falls to the about
    // portrait image (gravatar/currentSrc chain). The nested-main wrap
    // keeps the stem check non-null so the `if (stem)` false arm runs.
    const bareOuter = document.createElement(HTML_TAGS.DIV)

    bareOuter.className = INTERNAL_CLASSES.INTERNAL_MAIN

    const bareAhead = document.createElement(HTML_TAGS.DIV)

    paintedRect(bareAhead)

    const bareMain = document.createElement(HTML_TAGS.DIV)

    bareMain.className = INTERNAL_CLASSES.INTERNAL_MAIN

    const bareFigure = mkFigure()

    bareFigure.attachShadow({ mode: COMMON_ATTRS.OPEN })
    bareFigure.shadowRoot.appendChild(mkImg({ src: 'b' }).img)
    bareMain.appendChild(bareFigure)
    bareOuter.append(bareAhead, bareMain)

    const aboutImg = document.createElement(HTML_TAGS.IMG)

    aboutImg.className = ABOUT_CLASSES.ABOUT_PROFILE_PICTURE_IMG
    aboutImg.setAttribute(MEDIA_ATTRS.SRC, `${CDN}/me.jpg`)

    // A plated copy with no resolvable src drops the portrait pick to
    // the `|| EMPTY` arm before the figure-stem walk runs.
    const emptyPlate = document.createElement(HTML_TAGS.DIV)

    emptyPlate.className = PRINT_CLASSES.PLATE

    const emptyCopy = document.createElement(HTML_TAGS.IMG)

    emptyCopy.className = PRINT_CLASSES.COPY
    emptyPlate.appendChild(emptyCopy)

    document.body.append(emptyPlate, bareOuter, aboutImg)
    fireBeforePrint()

    portrait = document.querySelector(`.${PRINT_CLASSES.COVER_PHOTO}`)

    expect(portrait).toBeTruthy()
    expect(portrait.src).toBe(`${CDN}/me.jpg`)

    // The issue title read the non-brand half of document.title.
    const sub = document.querySelector(`.${PRINT_CLASSES.COVER_SUB}`)

    expect(sub.textContent).toBe(TEST_TEXT.SECOND)

    fireAfterPrint()

    // An about image with no resolvable src → no portrait at all.
    document.body.replaceChildren()

    const bareMain2 = document.createElement(HTML_TAGS.DIV)

    bareMain2.className = INTERNAL_CLASSES.INTERNAL_MAIN

    const bareFigure2 = mkFigure()

    bareFigure2.attachShadow({ mode: COMMON_ATTRS.OPEN })
    bareFigure2.shadowRoot.appendChild(mkImg({ src: 'b2' }).img)
    bareMain2.appendChild(bareFigure2)

    const emptyAbout = document.createElement(HTML_TAGS.IMG)

    emptyAbout.className = ABOUT_CLASSES.ABOUT_PROFILE_PICTURE_IMG

    document.body.append(bareMain2, emptyAbout)
    fireBeforePrint()

    expect(document.querySelector(`.${PRINT_CLASSES.COVER_PHOTO}`)).toBeNull()

    proto.decode = realDecode
  })

  test('the mutation sweep marks resolved imgs, coalesces and falls back without idle', async () => {
    // The `warm` stem is suite-isolated — nothing else ever puts
    // `warm-uncompressed` on an img src, so the mark can only come from
    // this sweep. The marker sits decoded at the top rung; the in-flight
    // `warm.jpg` layer's swap gate reads the mark and writes best.
    const markBox = document.createElement(HTML_TAGS.DIV)
    const markImg = mkImg({
      src: `${CDN}/warm${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`,
      naturalWidth: 50,
      decode: 'resolve',
    }).img

    markBox.appendChild(markImg)

    const coldBox = document.createElement(HTML_TAGS.DIV)
    const coldImg = mkImg({
      src: `${CDN}/warm${MEDIA.EXT}`,
      complete: false,
      decode: 'resolve',
    }).img

    coldBox.appendChild(coldImg)

    const canvas = document.createElement(HTML_TAGS.CANVAS)

    const app = document.createElement(HTML_TAGS.DIV)

    app.id = APP_IDS.APP
    app.append(markBox, coldBox, canvas)
    document.body.appendChild(app)

    // The install-time observer captured its callback at init.
    expect(moObserved).toBeTruthy()
    expect(moObserved.options).toMatchObject({ childList: true, subtree: true })

    // A second callback while the sweep is still queued coalesces away.
    moCallback([{ type: 'childList' }])
    moCallback([{ type: 'childList' }])

    await wait(PREFETCH_CONFIG.FALLBACK_DELAY + 60)

    fireBeforePrint()

    // The sweep marked the resolved top rung — warmReady armed the swap.
    expect(coldImg.getAttribute(MEDIA_ATTRS.SRC)).toBe(
      `${CDN}/warm${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`
    )

    // A sweep during the committed job no-ops outright — nothing throws.
    moCallback([{ type: 'childList' }])

    await wait(30)

    fireAfterPrint()

    // No requestIdleCallback → the bounded setTimeout fallback marks a
    // fresh pair; `dead-uncompressed` is likewise suite-isolated so only
    // this sweep could have marked it.
    const realIdle = window.requestIdleCallback

    window.requestIdleCallback = undefined

    const deadBox = document.createElement(HTML_TAGS.DIV)
    const deadMark = mkImg({
      src: `${CDN}/dead${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`,
      naturalWidth: 50,
      decode: 'resolve',
    }).img

    deadBox.appendChild(deadMark)

    const deadColdBox = document.createElement(HTML_TAGS.DIV)
    const deadCold = mkImg({
      src: `${CDN}/dead${MEDIA.EXT}`,
      complete: false,
      decode: 'resolve',
    }).img

    deadColdBox.appendChild(deadCold)
    app.append(deadBox, deadColdBox)

    moCallback([{ type: 'childList' }])

    await wait(PREFETCH_CONFIG.FALLBACK_DELAY + 60)

    window.requestIdleCallback = realIdle

    fireBeforePrint()

    expect(deadCold.getAttribute(MEDIA_ATTRS.SRC)).toBe(
      `${CDN}/dead${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`
    )

    fireAfterPrint()
  })

  test('the matchMedia edges enter, cancel a pending exit and debounce out', async () => {
    // True edge → enter.
    mqlMatches = true
    mqlListener({ matches: true })

    expect(document.querySelector(`.${PRINT_CLASSES.COVER}`)).toBeTruthy()

    // False edge arms the debounce; a true edge cancels it mid-flight.
    mqlMatches = false
    mqlListener({ matches: false })
    mqlMatches = true
    mqlListener({ matches: true })

    // Still printing — the armed teardown was cancelled.
    expect(document.querySelector(`.${PRINT_CLASSES.COVER}`)).toBeTruthy()

    // A genuine false edge rides the debounce into exit().
    mqlMatches = false
    mqlListener({ matches: false })

    await wait(PRINT_TIMING.MM_EXIT_DEBOUNCE + 60)

    expect(document.querySelector(`.${PRINT_CLASSES.COVER}`)).toBeNull()

    // An afterprint while the debounce is armed clears the timer in exit.
    mqlMatches = true
    mqlListener({ matches: true })
    mqlMatches = false
    mqlListener({ matches: false })
    fireAfterPrint()

    expect(document.querySelector(`.${PRINT_CLASSES.COVER}`)).toBeNull()
  })

  test('trackPrintJob and trackPrintNode ride the job lifecycle; a bare keydown is ignored', async () => {
    // A keydown without the chord evaluates the key check and bails.
    const ev = new window.Event(KEYBOARD_EVENTS.KEYDOWN)

    ev.ctrlKey = true
    ev.key = KEYS.KEY_I

    window.dispatchEvent(ev)

    const ev2 = new window.Event(KEYBOARD_EVENTS.KEYDOWN)

    ev2.metaKey = true
    ev2.key = KEYS.KEY_I

    window.dispatchEvent(ev2)

    expect(nativePrint).not.toHaveBeenCalled()

    // A printprepare listener can track async composition and its own
    // injected node — the tracked node exits with the job's teardown.
    let composed = false
    const onPrepare = () => {
      const tracked = document.createElement(HTML_TAGS.DIV)

      tracked.id = 'prt-tracked'
      document.body.appendChild(tracked)
      trackPrintNode(tracked)
      trackPrintJob(Promise.resolve().then(() => (composed = true)))
      trackPrintJob(Promise.reject(new Error('composition failed')))
    }

    window.addEventListener(PRINT_EVENTS.PREPARE, onPrepare)

    fireBeforePrint()

    expect(document.getElementById('prt-tracked')).toBeTruthy()

    await wait(0)

    expect(composed).toBe(true)

    fireAfterPrint()

    expect(document.getElementById('prt-tracked')).toBeNull()

    window.removeEventListener(PRINT_EVENTS.PREPARE, onPrepare)
  })

  test('menu beforeprint emits the contents page, the caption URL spread and the video/stem arms', async () => {
    router.currentRoute = { name: ROUTE_NAMES.HOME }

    // ── Contents-page head inventory ──
    // Alpha/Beta/Gamma list (one card-sub entry), a duplicate drops on
    // the seen set, [hidden]/[inert] subtrees and a chrome host's shadow
    // never yield — TOC_MIN_ITEMS needs the three survivors.
    const headA = document.createElement(HTML_TAGS.H2)

    headA.textContent = 'Alpha'

    const headB = document.createElement(HTML_TAGS.H2)

    headB.setAttribute(ARIA_ATTRS.ARIA_LABEL, 'Beta')

    const cardBox = document.createElement(HTML_TAGS.DIV)

    cardBox.className = CARD_STACK_CLASSES.CARD_STACK_CARD

    const headC = document.createElement(HTML_TAGS.H2)

    headC.textContent = 'Gamma'
    cardBox.appendChild(headC)

    const headDup = document.createElement(HTML_TAGS.H2)

    headDup.textContent = 'Alpha'

    const hiddenBox = document.createElement(HTML_TAGS.DIV)

    hiddenBox.setAttribute(COMMON_ATTRS.HIDDEN, ATTR_VALUES.EMPTY)
    hiddenBox.appendChild(document.createElement(HTML_TAGS.H2))

    const inertBox = document.createElement(HTML_TAGS.DIV)

    inertBox.setAttribute(COMMON_ATTRS.INERT, ATTR_VALUES.EMPTY)
    inertBox.appendChild(document.createElement(HTML_TAGS.H2))

    const chromeHost = document.createElement(COMPONENT_TAGS.SEARCH_MODAL)
    const chromeShadow = chromeHost.attachShadow({ mode: COMMON_ATTRS.OPEN })

    chromeShadow.appendChild(document.createElement(HTML_TAGS.H2))

    // ── Print-hide sheets ──
    // `.wrap-hide` is a real match arm for printHidden; `???` is the
    // selector matches() throws on — the harvest keeps both, and
    // bleedAtStart's sibling checks hit each in turn.
    const wrapSheet = {
      cssRules: [
        {
          type: RULE_MEDIA,
          media: { mediaText: 'print' },
          // happy-dom's :host sheet pass reads conditionText — keep it so
          // a stray getComputedStyle on the host parses instead of
          // throwing on the media-less rule.
          conditionText: 'print',
          cssRules: [
            { type: RULE_STYLE, style: { display: ATTR_VALUES.NONE }, selectorText: '.wrap-hide' },
            { type: RULE_STYLE, style: { display: ATTR_VALUES.NONE }, selectorText: '???' },
          ],
        },
      ],
    }
    const sheetHost = document.createElement(HTML_TAGS.DIV)
    const sheetShadow = sheetHost.attachShadow({ mode: COMMON_ATTRS.OPEN })

    Object.defineProperty(sheetShadow, 'adoptedStyleSheets', {
      value: [wrapSheet],
      configurable: true,
    })

    // ── Article + caption grammar spread ──
    const article = document.createElement(HTML_TAGS.ARTICLE)

    article.className = READER_CLASSES.CONTENT

    const ahead = document.createElement(HTML_TAGS.DIV)

    paintedRect(ahead)

    const head = document.createElement(HTML_TAGS.H1)

    head.className = INTERNAL_CLASSES.INTERNAL_TITLE

    const main = document.createElement(HTML_TAGS.DIV)

    main.className = INTERNAL_CLASSES.INTERNAL_MAIN

    // Thumb grammar: `x-thumb.jpg` folds to `x.jpg` — the stem proves
    // nothing in the manifest so the caption cites the still itself.
    const thumbImg = mkImg({ src: `${CDN}/x${MEDIA.THUMB_EXT}` }).img

    // Proven stem: the manifest carries alt's ladder — the caption cites
    // the top rung.
    const altImg = mkImg({ src: `${CDN}/alt${MEDIA.EXT}` }).img

    // Stemless figure + empty-shadow figure: mediaStem's '' arms and
    // figureSourceUrl's img?. ?? EMPTY tail.
    const stemlessFigure = mkFigure()
    const stemlessShadow = stemlessFigure.attachShadow({ mode: COMMON_ATTRS.OPEN })

    stemlessShadow.appendChild(mkImg({ src: `${CDN}/alt${MEDIA.EXT}` }).img)

    const emptyFigure = mkFigure()

    emptyFigure.attachShadow({ mode: COMMON_ATTRS.OPEN })

    // Canvas caption: the still's own data URI can't round-trip, so the
    // media arm falls back to window.location.href.
    const capCanvas = document.createElement(HTML_TAGS.CANVAS)

    capCanvas.toDataURL = () => 'data:image/png;base64,DD=='

    // data-print-capture: the driver owns the still — captureCanvas
    // declines and the fallback arm tags it.
    const driverCanvas = document.createElement(HTML_TAGS.CANVAS)

    driverCanvas.setAttribute(DATA_ATTRS.PRINT_CAPTURE, ATTR_VALUES.EMPTY)

    // Videos: poster attr, src-derived still, dead player, plus the
    // figure-shadow pair — placeholder-only shadow injects the still
    // copy; a real img layer retires the video outright.
    const vPoster = document.createElement(HTML_TAGS.VIDEO)

    vPoster.setAttribute(MEDIA_ATTRS.POSTER, `${CDN}/vp${MEDIA.EXT}`)

    const vSrc = document.createElement(HTML_TAGS.VIDEO)

    vSrc.setAttribute(MEDIA_ATTRS.SRC, `${CDN}/v${MEDIA.VIDEO_EXT}`)

    const vDead = document.createElement(HTML_TAGS.VIDEO)

    const vidFigure = mkFigure('proj/pic')
    const vidShadow = vidFigure.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const vidEl = document.createElement(HTML_TAGS.VIDEO)
    const vidHolder = document.createElement(HTML_TAGS.IMG)

    vidHolder.className = MEDIA_CLASSES.RENDER_PLACEHOLDER
    vidShadow.append(vidEl, vidHolder)

    const vidFigure2 = mkFigure('proj/pic')
    const vidShadow2 = vidFigure2.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const vidEl2 = document.createElement(HTML_TAGS.VIDEO)
    const vidStill = document.createElement(HTML_TAGS.IMG)

    vidStill.setAttribute(MEDIA_ATTRS.SRC, `${CDN}/vs${MEDIA.EXT}`)
    vidShadow2.append(vidEl2, vidStill)

    // Bleed/head-move: the landscape figure rides the in-place plate and
    // the masthead reparents — `main` stays the move record's next
    // sibling, anchored in the parent through teardown.
    const landFigure = mkFigure('proj/hero')
    const landShadow = landFigure.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const landImg = document.createElement(HTML_TAGS.IMG)

    landImg.className = MEDIA_CLASSES.RENDER_MEDIA_HIGH
    landImg.setAttribute(MEDIA_ATTRS.SRC, `${CDN}/hero${MEDIA.EXT}`)

    Object.defineProperty(landImg, 'naturalWidth', { value: 2000, configurable: true })
    Object.defineProperty(landImg, 'naturalHeight', { value: 1000, configurable: true })
    landShadow.appendChild(landImg)

    // Nested-shadow landscape canvas — the hoisted still's outerHost()
    // recursion crosses two boundaries to seat the plate at top level.
    const nestHost = document.createElement(HTML_TAGS.DIV)
    const nestShadow = nestHost.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const innerHost = document.createElement(HTML_TAGS.DIV)
    const innerShadow = innerHost.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const landCanvas = document.createElement(HTML_TAGS.CANVAS)

    landCanvas.setAttribute(DATA_ATTRS.PRINT_LANDSCAPE, ATTR_VALUES.EMPTY)
    landCanvas.toDataURL = () => 'data:image/png;base64,LL=='
    innerShadow.appendChild(landCanvas)
    nestShadow.appendChild(innerHost)

    // Bleed checks across a shadow boundary: this figure's climb probes
    // a `.wrap-hide` sibling (matches the harvested selector) after a
    // plain sibling evaluated the throwing `???` selector.
    const hideBox = document.createElement(HTML_TAGS.DIV)
    const hideShadow = hideBox.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const hideMain = document.createElement(HTML_TAGS.DIV)

    hideMain.className = INTERNAL_CLASSES.INTERNAL_MAIN

    const hideFigure = mkFigure('proj/pic')

    hideFigure.attachShadow({ mode: COMMON_ATTRS.OPEN })
    hideFigure.shadowRoot.appendChild(mkImg({ src: 'hz' }).img)
    hideMain.appendChild(hideFigure)
    hideShadow.appendChild(hideMain)

    const myhideSib = document.createElement(HTML_TAGS.DIV)

    myhideSib.className = 'wrap-hide'

    const normalSib = document.createElement(HTML_TAGS.DIV)

    zeroRect(normalSib)

    const coverSib = document.createElement(HTML_TAGS.DIV)

    coverSib.className = PRINT_CLASSES.COVER

    // landFigure first: the cover-photo arm-2 pick breaks on the first
    // internal-main figure — it must be the stemmed one.
    main.append(
      landFigure,
      thumbImg,
      altImg,
      stemlessFigure,
      emptyFigure,
      capCanvas,
      driverCanvas,
      vPoster,
      vSrc,
      vDead,
      vidFigure,
      vidFigure2
    )
    article.append(ahead, head, main)

    // The dead cover-copy: a `.print-copy` inside `.print-plate` with no
    // src — the pick's `el.src || EMPTY` arm, then the internal-main
    // hero figure fills arm 2's `if (stem)` branch while a src-less twin
    // fills its false side.
    const deadPlate = document.createElement(HTML_TAGS.DIV)

    deadPlate.className = `${PRINT_CLASSES.PLATE} ${PRINT_CLASSES.PLATE_LANDSCAPE}`

    const deadCopy = document.createElement(HTML_TAGS.IMG)

    deadCopy.className = PRINT_CLASSES.COPY
    deadPlate.appendChild(deadCopy)

    const heroMain = document.createElement(HTML_TAGS.DIV)

    heroMain.className = INTERNAL_CLASSES.INTERNAL_MAIN

    const heroFigure = mkFigure('proj/pic')

    heroFigure.attachShadow({ mode: COMMON_ATTRS.OPEN })
    heroFigure.shadowRoot.appendChild(mkImg({ src: 'h5' }).img)

    const nostemFigure = mkFigure()

    nostemFigure.attachShadow({ mode: COMMON_ATTRS.OPEN })
    nostemFigure.shadowRoot.appendChild(mkImg({ src: 'h6' }).img)
    heroMain.append(heroFigure, nostemFigure)

    // `#app` src-less img → upgradeImage's `?? EMPTY` rescue arms.
    const appBox = document.createElement(HTML_TAGS.DIV)

    appBox.id = APP_IDS.APP

    const nosrcImg = document.createElement(HTML_TAGS.IMG)

    appBox.appendChild(nosrcImg)

    // `<picture>` ladders: a srcset'd source unplugs, a bare source is
    // the false arm.
    const picture = document.createElement(HTML_TAGS.PICTURE)
    const srcSource = document.createElement(HTML_TAGS.SOURCE)
    const bareSource = document.createElement(HTML_TAGS.SOURCE)

    srcSource.setAttribute(MEDIA_ATTRS.SRCSET, `${CDN}/alt${MEDIA.WEBP_EXT} 1x`)
    picture.append(srcSource, bareSource, mkImg({ src: `${CDN}/alt${MEDIA.EXT}` }).img)
    article.appendChild(picture)

    // sheetHost sits after hideBox: a host's own adopted sheets get
    // parsed by happy-dom's :host pass on getComputedStyle, so keeping
    // it off every bleedAtStart sibling walk isolates the harvest from
    // the style engine.
    document.body.append(
      deadPlate,
      article,
      heroMain,
      appBox,
      coverSib,
      myhideSib,
      normalSib,
      hideBox,
      nestHost,
      headA,
      headB,
      cardBox,
      headDup,
      hiddenBox,
      inertBox,
      chromeHost,
      sheetHost
    )

    // Every injected copy's decode rejects — swapInCopy's `.catch`
    // swallow arm runs for each still. The override scopes to the
    // injected stand-ins: upgradeImage's decode kick fires for every
    // fixture img, and an unscoped reject would retire them all on
    // the dead-src arm — the copies alone must fail.
    const origDecode = window.HTMLImageElement.prototype.decode

    window.HTMLImageElement.prototype.decode = function decode() {
      return this.classList?.contains(PRINT_CLASSES.COPY)
        ? Promise.reject(new Error('copy decode failed'))
        : Promise.resolve()
    }

    fireBeforePrint()

    window.HTMLImageElement.prototype.decode = origDecode

    // Decode rejections land on microtasks — let the `.catch` swallow run.
    await wait(0)

    // The contents page emitted — three unique heads, one card sub.
    const toc = document.querySelector(`.${PRINT_CLASSES.TOC}`)

    expect(toc).toBeTruthy()
    expect(toc.textContent).toContain('Alpha')
    expect(toc.textContent).toContain('Beta')
    expect(toc.textContent).toContain('Gamma')
    expect(toc.querySelectorAll(`.${PRINT_CLASSES.TOC_ITEM_SUB}`).length).toBe(1)

    // Thumb grammar cited the still; proven stem cited the top rung.
    const captions = [...document.querySelectorAll(`.${PRINT_CLASSES.CAPTION}`)].map(
      (c) => c.textContent
    )

    expect(captions.some((t) => t.includes(`${CDN}/x${MEDIA.EXT}`))).toBe(true)
    expect(
      captions.some((t) => t.includes(`${CDN}/alt${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`))
    ).toBe(true)

    // Canvas caption fell back to the page URL.
    expect(captions.some((t) => t.includes(window.location.href))).toBe(true)

    // The dead video retired; poster/src videos injected copies — the
    // stills ride the source figure's plate (a loose copy would strand
    // its own sheet) while the caption keeps the seat next to the box.
    expect(vDead.classList.contains(PRINT_CLASSES.SRC)).toBe(true)
    expect(vPoster.classList.contains(PRINT_CLASSES.SRC)).toBe(true)
    expect(
      [...document.querySelectorAll(`img.${PRINT_CLASSES.COPY}`)].some((i) =>
        i.src.includes(`vp${MEDIA.EXT}`)
      )
    ).toBe(true)

    // The stem'd figure-shadow video seated the `.mp4.jpg` still copy.
    expect(
      [...document.querySelectorAll(`img.${PRINT_CLASSES.COPY}`)].some((i) =>
        i.src.includes(`proj/pic${MEDIA.VIDEO_EXT}${MEDIA.EXT}`)
      )
    ).toBe(true)

    // The capture-declined canvas carries the fallback marker.
    expect(driverCanvas.classList.contains(PRINT_CLASSES.FALLBACK)).toBe(true)

    // The hide-check walked: myhideSib counted as no-content on paper,
    // normalSib survived the `???` selector throw and still vetoed the
    // hoist alongside the painted `ahead` box.
    const plates = [...document.querySelectorAll(`.${PRINT_CLASSES.PLATE}`)]

    expect(plates.some((p) => p.contains(landFigure))).toBe(true)

    // Teardown restores — the moved masthead seats back before `main`.
    fireAfterPrint()

    expect(head.parentElement).toBe(article)
    expect(head.nextElementSibling).toBe(main)
    expect(document.documentElement.classList.contains(PRINT_CLASSES.PLATE_DOC)).toBe(false)
  })
})
