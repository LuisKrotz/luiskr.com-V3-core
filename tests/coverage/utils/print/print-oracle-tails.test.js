/**
 * @file print-oracle-tails.test.js
 * @description Coverage for core/utils/print/print.ts — the print-CSS
 * oracle (collectPrintHides/printHidden) and the tail branches the
 * bigger suites never reach: nested @media and grouping rules inside
 * @media print, the harvest chain's non-hidden style-rule tail, the
 * empty-bag barrier early return, the populated-article doc gate's
 * non-attr arm, the dialog guard's timeout teardown, TOC rows mixing
 * section and card heads, the canvas caption's page-URL fallback, the
 * cover portrait's error drop, the un-postered video's src-attr still
 * derivation, and the compose event's announce-true dispatch.
 */
import { jest } from '@jest/globals'
import { initMediaManifest } from '@core/utils/media/manifest.js'
import router from '@core/router/router.js'
import { initPrintSupport, printJobActive, trackPrintJob } from '@core/utils/print/print.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { ABOUT_CLASSES } from '@core/tokens/classes/about.js'
import { CARD_STACK_CLASSES } from '@core/tokens/classes/card-stack.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'
import { PRINT_CLASSES } from '@core/tokens/classes/print.js'
import { READER_CLASSES } from '@core/tokens/classes/reader.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import {
  CLIPBOARD_EVENTS,
  FORM_EVENTS,
  PRINT_EVENTS,
  WINDOW_EVENTS,
} from '@core/tokens/events/dom.js'
import { APP_IDS } from '@core/tokens/ids/app.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { PRINT_TIMING } from '@core/tokens/motion/print.js'
import { ROUTE_NAMES } from '@core/tokens/routes/names.js'

/** Dispatches the native beforeprint event the module listens for. */
const fireBeforePrint = () => window.dispatchEvent(new window.Event(CLIPBOARD_EVENTS.BEFORE_PRINT))

/** Dispatches the native afterprint event the module listens for. */
const fireAfterPrint = () => window.dispatchEvent(new window.Event(CLIPBOARD_EVENTS.AFTER_PRINT))

/** Flushes the runPrintJob continuation past its async settles. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

/** Fixture-only selector the nested @media block hides on paper. */
const SEL_NESTED_HIDE = 'np'

/** Fixture-only selector the @supports block hides on paper. */
const SEL_SUPPORTS_HIDE = 'sp'

/** Fixture-only selector that stays painted under print. */
const SEL_VISIBLE = 'vis'

/** Bucket keys the stubbed manifest claims exist for these fixtures. */
const MANIFEST_KEYS = [
  `proj/deep${MEDIA.EXT}`,
  `proj/deep${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`,
  `https://cdn.example/vid${MEDIA.VIDEO_EXT}${MEDIA.EXT}`,
]

/**
 * An #app shell — the media-walk eligibility anchor — with the given
 * children seated inside.
 * @param {...Node} kids Children to append inside the shell.
 * @returns {HTMLElement} the shell element
 */
const appShell = (...kids) => {
  const shell = document.createElement(HTML_TAGS.DIV)

  shell.id = APP_IDS.APP
  shell.append(...kids)
  document.body.appendChild(shell)

  return shell
}

/**
 * A bleed candidate: media-figure host carrying a proven stem whose
 * shadow img reports a portrait ratio — tags BLEED without the
 * landscape variant.
 * @returns {HTMLElement} the figure host
 */
const mkBleedFigure = () => {
  const fig = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

  fig.setAttribute(MEDIA_ATTRS.SRC, 'proj/deep')

  const shadow = fig.attachShadow({ mode: COMMON_ATTRS.OPEN })
  const img = document.createElement(HTML_TAGS.IMG)

  Object.defineProperty(img, 'naturalWidth', { value: 1000, configurable: true })
  Object.defineProperty(img, 'naturalHeight', { value: 2000, configurable: true })

  shadow.appendChild(img)

  return fig
}

describe('print oracle tails', () => {
  let origMatchMedia
  let origPrint
  let nativePrint
  let mqlListener = null
  let mqlMatches = false

  beforeAll(async () => {
    origMatchMedia = window.matchMedia

    // Capture the change listener so both matches arms can be driven; the
    // getter keeps `matches` live so tests can flip the query under an
    // armed teardown timer.
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

    // The CSSOM globals the oracle probes — the env binds window but not
    // the CSSRule constants, so without this the harvest early-returns.
    globalThis.CSSRule = window.CSSRule

    // happy-dom ships no window.print — the install wraps whatever the
    // bind sees, so the spy must be in place BEFORE init runs or the
    // gated entry's nativePrint target never exists.
    origPrint = window.print
    nativePrint = jest.fn()
    window.print = nativePrint

    initPrintSupport()
  })

  afterAll(() => {
    // Restore the env's no-CSSOM state — other suites assert the oracle's
    // early-return arm.
    delete globalThis.CSSRule
    window.matchMedia = origMatchMedia
    window.print = origPrint
  })

  afterEach(() => {
    fireAfterPrint()

    document.body.replaceChildren()
    document.head.querySelectorAll('[data-oracle-sheet]').forEach((el) => el.remove())
    document.documentElement.classList.remove(STATE_CLASSES.DARK_MODE)
    document.documentElement.classList.remove(PRINT_CLASSES.DOC)

    mqlMatches = false
    router.currentRoute = null
    nativePrint.mockReset()
  })

  test('nested @media and grouping rules inside @media print feed the hide oracle', () => {
    // The oracle walks the LIVE cssRules: a nested gate inside a print
    // block keeps the print context, a grouping wrapper (@supports)
    // inherits it, a display:block style rule inside print drops off
    // the hide list, and a ::-selector can't match a sibling at all.
    const sheet = document.createElement('style')

    sheet.setAttribute('data-oracle-sheet', ATTR_VALUES.EMPTY)
    sheet.textContent =
      `@media print {` +
      `@media (orientation: landscape) { .${SEL_NESTED_HIDE} { display: none; } }` +
      `@supports (display: grid) { .${SEL_SUPPORTS_HIDE} { display: none; } }` +
      `.${SEL_VISIBLE} { display: block; }` +
      `.${SEL_NESTED_HIDE}::before { display: none; }` +
      `}` +
      `@media screen { .scrn { display: none; } }`

    document.head.appendChild(sheet)

    // Bleed A sits behind only print-hidden siblings — on paper nothing
    // precedes it, so the plate hoists to the front of the document.
    const mainA = document.createElement(HTML_TAGS.DIV)

    mainA.className = INTERNAL_CLASSES.INTERNAL_MAIN

    const figA = mkBleedFigure()
    const figA2 = mkBleedFigure()

    // figA's recorded restore anchor is figA2 — a real sibling that the
    // same pass reparents into its own plate, so exit falls back to the
    // parent tail instead of anchoring on a moved reference.
    mainA.append(figA, figA2)

    const hiddenSib = document.createElement(HTML_TAGS.DIV)

    hiddenSib.className = `${SEL_NESTED_HIDE} ${SEL_SUPPORTS_HIDE}`
    // Painted on screen (the rule only hides on paper), measurable, and
    // carrying the harvested selector — only the oracle keeps this
    // sibling from vetoing the hoist.
    hiddenSib.setAttribute(COMMON_ATTRS.STYLE, 'display: block')
    hiddenSib.getBoundingClientRect = () => ({
      width: 40,
      height: 40,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    })

    const hiddenSibB = document.createElement(HTML_TAGS.DIV)

    hiddenSibB.className = SEL_SUPPORTS_HIDE
    hiddenSibB.setAttribute(COMMON_ATTRS.STYLE, 'display: block')
    hiddenSibB.getBoundingClientRect = () => ({
      width: 40,
      height: 40,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    })

    document.body.append(hiddenSib, hiddenSibB, mainA)

    // Bleed B sits behind a sibling that still paints on paper — the
    // plate seats in place right before the block.
    const visSib = document.createElement(HTML_TAGS.DIV)

    visSib.className = SEL_VISIBLE
    visSib.getBoundingClientRect = () => ({
      width: 40,
      height: 40,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    })

    // The block's internal masthead hoists into the plate with the block
    // itself recorded as its restore anchor — the live reparent below
    // drives that anchor stale, so exit restores at the parent's tail.
    const headB = document.createElement(HTML_TAGS.H1)

    headB.className = INTERNAL_CLASSES.INTERNAL_TITLE
    headB.textContent = 'Internal block'

    const mainB = document.createElement(HTML_TAGS.DIV)

    mainB.className = INTERNAL_CLASSES.INTERNAL_MAIN

    const figB = mkBleedFigure()
    // A stable trailing sibling — figB's recorded restore anchor is
    // still seated in the block at exit, so it re-anchors in place.
    const tailB = document.createElement(HTML_TAGS.P)

    mainB.append(figB, tailB)
    document.body.append(visSib, headB, mainB)

    fireBeforePrint()

    const plateA = figA.closest(`.${PRINT_CLASSES.PLATE}`)
    const plateB = mainB.previousElementSibling

    expect(plateA?.classList.contains(PRINT_CLASSES.PLATE_INTERNAL)).toBe(true)
    expect(plateB?.classList.contains(PRINT_CLASSES.PLATE)).toBe(true)
    expect(plateB?.contains(mainB)).toBe(false)
    expect(plateB?.contains(headB)).toBe(true)
    expect(headB.classList.contains(PRINT_CLASSES.BLEED_HEAD)).toBe(true)

    // A live re-parent mid-job — headB's recorded `next` anchor no
    // longer sits under its recorded parent, so exit restores at the
    // parent's tail rather than anchoring on the moved reference.
    const wrapB = document.createElement(HTML_TAGS.DIV)

    document.body.appendChild(wrapB)
    wrapB.appendChild(mainB)

    fireAfterPrint()

    // figA2 was reparented into its own plate — figA's stale anchor fell
    // back to the main's tail, so both figures restore inside the block.
    expect(mainA.contains(figA)).toBe(true)
    expect(mainA.contains(figA2)).toBe(true)
    expect(figB.nextElementSibling).toBe(tailB)
    // headB's stale anchor forced the parent-tail fallback — the
    // masthead lands at the body tail with its bleed-head flag lifted.
    expect(headB.parentNode).toBe(document.body)
    expect(headB.nextSibling).toBeNull()
    expect(headB.classList.contains(PRINT_CLASSES.BLEED_HEAD)).toBe(false)
  })

  test('the empty pending bag releases the gated job without polling', async () => {
    // No media, no tracked jobs — both barrier calls early-return.
    appShell()

    window.print()

    await flush()

    expect(nativePrint).toHaveBeenCalledTimes(1)
    expect(document.querySelector(`.${PRINT_CLASSES.COVER}`)).toBeTruthy()
  })

  test('a populated reader article without the doc attr gates print-doc off its children', () => {
    // The doc-gate's second arm: populated article, no data-print-doc,
    // only section children (no wrapper div) → the class lands.
    appShell()

    const article = document.createElement(HTML_TAGS.ARTICLE)

    article.className = READER_CLASSES.CONTENT
    article.appendChild(document.createElement(HTML_TAGS.SECTION))
    document.body.appendChild(article)

    fireBeforePrint()

    expect(document.documentElement.classList.contains(PRINT_CLASSES.DOC)).toBe(true)
  })

  test('a silent dialog restores the page once the grace window lapses', async () => {
    appShell()

    window.print()

    await flush()

    expect(document.querySelector(`.${PRINT_CLASSES.COVER}`)).toBeTruthy()

    // No beforeprint, no matchMedia edge — the guard unwinds by hand.
    await new Promise((resolve) => setTimeout(resolve, PRINT_TIMING.DIALOG_GRACE + 200))

    expect(document.querySelector(`.${PRINT_CLASSES.COVER}`)).toBeNull()
  })

  test('contents rows number section heads and indent card heads', () => {
    router.currentRoute = { name: ROUTE_NAMES.HOME }

    const section = document.createElement(HTML_TAGS.H2)

    section.textContent = 'Selected work'

    const cardA = document.createElement(HTML_TAGS.DIV)

    cardA.className = CARD_STACK_CLASSES.CARD_STACK_CARD

    const headA = document.createElement(HTML_TAGS.H3)

    headA.textContent = 'Transa'
    cardA.appendChild(headA)

    const cardB = document.createElement(HTML_TAGS.DIV)

    cardB.className = CARD_STACK_CLASSES.CARD_STACK_CARD

    const headB = document.createElement(HTML_TAGS.H3)

    headB.textContent = 'Star Field'
    cardB.appendChild(headB)

    // An empty head falls straight through the text fallback and gets
    // skipped; a duplicate title repeats a listed entry and gets
    // skipped; a head inside a [hidden] subtree is invisible to paper
    // and drops at the walkHeads filter upstream — the contents page
    // only counts reachable unique text once.
    const empty = document.createElement(HTML_TAGS.H3)
    const dup = document.createElement(HTML_TAGS.H3)

    dup.textContent = 'Star Field'

    const hidWrap = document.createElement(HTML_TAGS.DIV)

    hidWrap.setAttribute(COMMON_ATTRS.HIDDEN, ATTR_VALUES.EMPTY)

    const hidHead = document.createElement(HTML_TAGS.H2)

    hidHead.textContent = 'Off-paper'
    hidWrap.appendChild(hidHead)

    document.body.append(section, cardA, cardB, empty, dup, hidWrap)

    fireBeforePrint()

    const toc = document.querySelector(`.${PRINT_CLASSES.TOC}`)
    const sectionRow = toc?.querySelector(`.${PRINT_CLASSES.TOC_ITEM}`)
    const subRows = toc?.querySelectorAll(`.${PRINT_CLASSES.TOC_ITEM_SUB}`)

    expect(toc).toBeTruthy()
    expect(sectionRow?.querySelector(`.${PRINT_CLASSES.TOC_NUM}`)?.textContent).toBe('1')
    expect(subRows?.length).toBe(2)
    expect(subRows?.[0]?.querySelector(`.${PRINT_CLASSES.TOC_NUM}`)?.textContent).toBe(
      ATTR_VALUES.EMPTY
    )
  })

  test('a dead cover portrait drops itself, not the sheet', () => {
    const img = document.createElement(HTML_TAGS.IMG)

    img.className = ABOUT_CLASSES.ABOUT_PROFILE_PICTURE_IMG
    img.setAttribute(MEDIA_ATTRS.SRC, 'https://cdn.example/portrait.jpg')
    appShell(img)

    fireBeforePrint()

    const photo = document.querySelector(`.${PRINT_CLASSES.COVER_PHOTO}`)

    expect(photo).toBeTruthy()

    photo.dispatchEvent(new window.Event(WINDOW_EVENTS.ERROR))

    expect(document.querySelector(`.${PRINT_CLASSES.COVER_PHOTO}`)).toBeNull()
    expect(document.querySelector(`.${PRINT_CLASSES.COVER}`)).toBeTruthy()
  })

  test('an un-postered video derives its print still off the src attribute', () => {
    const video = document.createElement(HTML_TAGS.VIDEO)

    video.setAttribute(MEDIA_ATTRS.SRC, `https://cdn.example/vid${MEDIA.VIDEO_EXT}`)
    appShell(video)

    fireBeforePrint()

    const copy = document.querySelector(`.${PRINT_CLASSES.COPY}`)

    expect(copy?.getAttribute(MEDIA_ATTRS.SRC)).toBe(
      `https://cdn.example/vid${MEDIA.VIDEO_EXT}${MEDIA.EXT}`
    )
  })

  test('a canvas still cites the page URL in its print caption', () => {
    const canvas = document.createElement(HTML_TAGS.CANVAS)

    canvas.toDataURL = () => 'data:image/png;base64,AA=='
    appShell(canvas)

    fireBeforePrint()

    const captions = [...document.querySelectorAll(`.${PRINT_CLASSES.CAPTION}`)]

    expect(document.querySelector(`.${PRINT_CLASSES.COPY}`)).toBeTruthy()
    expect(captions.some((cap) => cap.textContent.includes(window.location.href))).toBe(true)
  })

  test('the compose event announces the menu-initiated pass', () => {
    const onPrepare = jest.fn()

    window.addEventListener(PRINT_EVENTS.PREPARE, onPrepare)

    fireBeforePrint()

    expect(onPrepare).toHaveBeenCalled()

    window.removeEventListener(PRINT_EVENTS.PREPARE, onPrepare)
  })

  test('a trackPrintJob whose catch swallows to undefined queues nothing', () => {
    // Composition listeners register fetch promises through
    // trackPrintJob — one whose .catch resolves to undefined hands the
    // barrier bag a hole, and the empty-job arm drops it silently.
    appShell()

    trackPrintJob({ catch: () => undefined })

    fireBeforePrint()

    expect(document.querySelector(`.${PRINT_CLASSES.COVER}`)).toBeTruthy()
  })

  test('an image without a decode api queues no tracked job', () => {
    // Engines without HTMLImageElement.decode resolve the kick to
    // undefined — the barrier bag skips it rather than tracking a hole.
    const img = document.createElement(HTML_TAGS.IMG)

    img.setAttribute(MEDIA_ATTRS.SRC, 'https://cdn.example/plain.jpg')
    Object.defineProperty(img, 'decode', { value: undefined, configurable: true })
    Object.defineProperty(img, 'complete', { value: true, configurable: true })
    Object.defineProperty(img, 'naturalWidth', { value: 800, configurable: true })
    Object.defineProperty(img, 'naturalHeight', { value: 600, configurable: true })
    appShell(img)

    fireBeforePrint()

    expect(img.getAttribute(MEDIA_ATTRS.SRC)).toBe('https://cdn.example/plain.jpg')
    expect(document.querySelector(`.${PRINT_CLASSES.COVER}`)).toBeTruthy()
  })

  test('printJobActive reports the committed window', () => {
    appShell()

    expect(printJobActive()).toBe(false)

    fireBeforePrint()

    expect(printJobActive()).toBe(true)

    fireAfterPrint()

    expect(printJobActive()).toBe(false)
  })

  test('the pending barrier resets its quiet window on progress then bails on a wedged job', async () => {
    jest.useFakeTimers()

    try {
      appShell()

      let release

      // One job settles mid-wait (the count moves between polls and the
      // quiet window resets) while the other never settles — progress
      // keeps the gate open past its first cap, then the stall releases
      // the job once nothing moves for a full PREP_CAP.
      trackPrintJob(new Promise((resolve) => (release = resolve)))
      trackPrintJob(new Promise(() => {}))

      window.print()

      // Generous settle — the manifest wait, scroll sweep and prep all
      // land inside this window so the release below happens while the
      // barrier is already polling.
      await jest.advanceTimersByTimeAsync(10000)

      expect(nativePrint).not.toHaveBeenCalled()

      release()

      await jest.advanceTimersByTimeAsync(10000)

      // The wedged job still holds the gate — progress reset the quiet
      // window, so the bail restarts from the settle, not the arm.
      expect(nativePrint).not.toHaveBeenCalled()

      // A job that lands mid-wait isn't in this pass's covered snapshot —
      // the cleanup keeps it in the bag for the next barrier instead of
      // splicing work it never waited on.
      trackPrintJob(Promise.resolve())

      await jest.advanceTimersByTimeAsync(PRINT_TIMING.PREP_CAP + 1000)

      expect(nativePrint).toHaveBeenCalledTimes(1)
    } finally {
      jest.useRealTimers()
    }
  })

  test('a matchMedia false edge inside the apply grace re-arms the teardown', () => {
    jest.useFakeTimers()

    try {
      appShell()

      // beforeprint stamps the apply-grace clock and commits the DOM —
      // a print-off query edge inside that window is the engine's media
      // apply lagging, not a real job end, so the deferred recheck must
      // re-arm instead of erasing the live job's sheet.
      fireBeforePrint()

      expect(document.querySelector(`.${PRINT_CLASSES.COVER}`)).toBeTruthy()

      mqlListener({ matches: false })

      jest.advanceTimersByTime(PRINT_TIMING.MM_EXIT_DEBOUNCE + 1)

      expect(document.querySelector(`.${PRINT_CLASSES.COVER}`)).toBeTruthy()

      // Re-armed rechecks keep finding the stamp inside the grace until
      // the window closes — then the same false query tears down for real.
      jest.advanceTimersByTime(PRINT_TIMING.MM_APPLY_GRACE + PRINT_TIMING.MM_EXIT_DEBOUNCE)

      expect(document.querySelector(`.${PRINT_CLASSES.COVER}`)).toBeNull()
      expect(printJobActive()).toBe(false)
    } finally {
      jest.useRealTimers()
    }
  })

  test('a rescued retired layer keeps its recorded src instead of re-pointing cold', () => {
    // Pass 1: a src-less img has nothing to promote and no stem — it
    // retires to print-src without ever touching the touched bag.
    const well = document.createElement(HTML_TAGS.DIV)
    const cold = document.createElement(HTML_TAGS.IMG)

    well.appendChild(cold)
    appShell(well)

    fireBeforePrint()

    expect(cold.classList.contains(PRINT_CLASSES.SRC)).toBe(true)

    // Pass 2: the layer wins a real src mid-job — the rescue arm un-marks
    // it and the undecoded arm writes the floor rung, recording the
    // landed src. Retired imgs stay out of imgDecided, so every later
    // re-entry still walks it.
    cold.setAttribute(MEDIA_ATTRS.SRC, `proj/deep${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`)
    Object.defineProperty(cold, 'complete', { value: false, configurable: true })

    // A fresh styled clone lands mid-job too — the commit already ran,
    // so its screen style strips on the spot instead of queueing.
    const fresh = document.createElement(HTML_TAGS.IMG)

    fresh.setAttribute(MEDIA_ATTRS.SRC, 'https://cdn.example/fresh.jpg')
    fresh.setAttribute(COMMON_ATTRS.STYLE, 'opacity:0.5')

    document.getElementById(APP_IDS.APP)?.appendChild(fresh)

    fireBeforePrint()

    expect(cold.classList.contains(PRINT_CLASSES.SRC)).toBe(false)
    expect(cold.getAttribute(MEDIA_ATTRS.SRC)).toBe(`proj/deep${MEDIA.EXT}`)
    expect(fresh.hasAttribute(COMMON_ATTRS.STYLE)).toBe(false)

    // Pass 3: the same layer re-walks with its src now recorded — the
    // touched-src arm stands it instead of churning the URL back to the
    // floor rung inside the snapshot window.
    cold.setAttribute(MEDIA_ATTRS.SRC, `proj/deep${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`)

    fireBeforePrint()

    expect(cold.getAttribute(MEDIA_ATTRS.SRC)).toBe(`proj/deep${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`)
    expect(cold.classList.contains(PRINT_CLASSES.SRC)).toBe(false)
  })
})
