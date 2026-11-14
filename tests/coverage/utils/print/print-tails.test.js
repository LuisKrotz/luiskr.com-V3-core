/**
 * @file print-tails.test.js
 * @description Coverage for core/utils/print/print.ts — the beforeprint/
 * afterprint DOM adapter. Covers the install guard, the native-event and
 * matchMedia entry channels, the enter/exit reentry guards, the dark-theme
 * swap, every media-surface swap path (canvas via printcapture answer,
 * canvas via preserved-buffer toDataURL, canvas capture failure, poster
 * video, poster-less video, article-image upgrade), copy placement
 * (in-article, shadow → article append, no-article → body append), the
 * per-media source/date/author captions, the footer link QRs, the single
 * page QR, and the attribute restoration arms (recorded value vs absent
 * → removeAttribute).
 */
import { jest } from '@jest/globals'
import { initPrintSupport } from '@core/utils/print/print.js'
import { bindPrintWarm } from '@core/utils/print/warm-bridge.js'
import { initMediaManifest } from '@core/utils/media/manifest.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { LINK_ATTRS } from '@core/tokens/attrs/link.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { MEDIA_CLASSES } from '@core/tokens/classes/media.js'
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
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'
import { APP_IDS } from '@core/tokens/ids/app.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { MEDIA_CREDIT_LABELS } from '@core/tokens/media/credits.js'
import { BASE_TITLE } from '@core/tokens/routes.js'
import { SVG_STRINGS } from '@core/tokens/strings/svg.js'
import { CDN_URLS } from '@core/tokens/media/urls.js'
import { MEDIA_QUERIES } from '@core/tokens/primitives.js'
import { PRINT_TIMING } from '@core/tokens/motion/print.js'

/** Bucket-relative seed key for the `proj/proven` stem — the manifest
 *  proves only its q75 tier, so the upgrade lands there (a mid rung, not
 *  the uncompressed top). `mediaKeyExists` strips CDN_BASE before lookup. */
const PROVEN_KEY = `proj/proven${MEDIA.MOZ}${MEDIA.Q75}${MEDIA.EXT}`

/**
 * Bucket keys the stubbed manifest claims exist — every pipeline stem the
 * fixtures use resolves its proven top rung so upgrades land on real URLs.
 * Stems absent here correctly resolve to no upgrade at all: the print pass
 * must never fabricate a `-mozjpg-uncompressed` URL it cannot prove.
 */
const MANIFEST_KEYS = [
  `proj/pic${MEDIA.EXT}`,
  `proj/pic${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`,
  `proj/layered${MEDIA.EXT}`,
  `proj/deep${MEDIA.EXT}`,
  `proj/cold${MEDIA.EXT}`,
  PROVEN_KEY,
  // The emitted video-poster stills the figure fixtures cite — a print
  // swap only ever lands on a manifest-proven `X.mp4.jpg`, so each
  // fixture video's still must be claimed here.
  `proj/clip${MEDIA.VIDEO_EXT}${MEDIA.EXT}`,
  `proj/layered${MEDIA.VIDEO_EXT}${MEDIA.EXT}`,
  `https://cdn.example/inner${MEDIA.VIDEO_EXT}${MEDIA.EXT}`,
  `https://cdn.example/photo${MEDIA.EXT}`,
  `https://cdn.example/photo${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`,
  `https://cdn.example/photo${MEDIA.MOZ}${MEDIA.Q75}${MEDIA.EXT}`,
  `https://cdn.example/photo${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`,
  `https://cdn.example/gal/a${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`,
  `https://cdn.example/gal/b${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`,
  `https://cdn.example/mob${MEDIA.MOBILE_SUFFIX}${MEDIA.EXT}`,
]

/** Dispatches the native beforeprint event the module listens for. */
const fireBeforePrint = () => window.dispatchEvent(new window.Event(CLIPBOARD_EVENTS.BEFORE_PRINT))

/** Dispatches the native afterprint event the module listens for. */
const fireAfterPrint = () => window.dispatchEvent(new window.Event(CLIPBOARD_EVENTS.AFTER_PRINT))

/**
 * Builds a reader mirror article in <body> — the hoisted post-mount state
 * every swap path checks against.
 * @returns {HTMLElement} the article element
 */
const mkArticle = () => {
  const article = document.createElement(HTML_TAGS.ARTICLE)

  article.className = READER_CLASSES.CONTENT

  document.body.appendChild(article)

  return article
}

describe('print utils tails', () => {
  let mqlListener = null
  let mqlMatches = false
  let origMatchMedia

  beforeAll(async () => {
    origMatchMedia = window.matchMedia

    // Capture the change listener so both matches arms can be driven; the
    // getter keeps `matches` live so tests can move the query state under
    // an armed teardown timer.
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

    // Seed the real manifest once for the file — initMediaManifest latches,
    // so the per-test calls further down are no-ops on this same set.
    const realFetch = globalThis.fetch

    globalThis.fetch = () =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(MANIFEST_KEYS) })

    await initMediaManifest()

    globalThis.fetch = realFetch
  })

  afterAll(() => {
    window.matchMedia = origMatchMedia
  })

  afterEach(() => {
    // Never leak a "still printing" state (or stray nodes) across tests.
    fireAfterPrint()

    mqlMatches = false

    document.body.replaceChildren()

    document.documentElement.classList.remove(STATE_CLASSES.DARK_MODE)
  })

  test('installs both channels once; a second init is a no-op', () => {
    initPrintSupport()
    initPrintSupport()

    expect(mqlListener).toBeInstanceOf(Function)

    // The mql the listener rode in on is the print channel.
    expect(window.matchMedia(MEDIA_QUERIES.PRINT).media).toBe(MEDIA_QUERIES.PRINT)
  })

  test('afterprint before any beforeprint exits without mutating', () => {
    const canvas = document.createElement(HTML_TAGS.CANVAS)

    document.body.appendChild(canvas)
    canvas.toDataURL = () => 'data:image/png;base64,AA=='

    fireAfterPrint()

    expect(document.querySelector(`.${PRINT_CLASSES.COPY}`)).toBeNull()
    expect(canvas.classList.contains(PRINT_CLASSES.SRC)).toBe(false)
  })

  test('no-article print: canvas stills append to <body>; reentry is a no-op', () => {
    const canvas = document.createElement(HTML_TAGS.CANVAS)

    document.body.appendChild(canvas)

    let reads = 0

    canvas.toDataURL = () => {
      reads++

      return 'data:image/png;base64,AA=='
    }

    fireBeforePrint()
    fireBeforePrint() // printing guard — second dispatch changes nothing

    const copies = document.querySelectorAll(`.${PRINT_CLASSES.COPY}`)

    expect(reads).toBe(1)
    expect(copies).toHaveLength(1)
    expect(copies[0].parentNode).toBe(document.body)
    expect(copies[0].src).toContain('data:image/png')
    expect(canvas.classList.contains(PRINT_CLASSES.SRC)).toBe(true)

    fireAfterPrint()

    expect(document.querySelector(`.${PRINT_CLASSES.COPY}`)).toBeNull()
    expect(canvas.classList.contains(PRINT_CLASSES.SRC)).toBe(false)
  })

  test('article surfaces: in-article canvas, shadow canvas, poster video, image upgrade, theme swap', () => {
    const article = mkArticle()

    document.documentElement.classList.add(STATE_CLASSES.DARK_MODE)

    // Canvas inside the article → stand-in replaces in place.
    const inCanvas = document.createElement(HTML_TAGS.CANVAS)

    inCanvas.toDataURL = () => 'data:image/png;base64,IN=='

    article.appendChild(inCanvas)

    // Canvas inside a shadow root → stand-in lands inside the article.
    const host = document.createElement(HTML_TAGS.DIV)
    const shadow = host.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const shCanvas = document.createElement(HTML_TAGS.CANVAS)

    shCanvas.addEventListener(PRINT_EVENTS.CAPTURE, (e) => {
      e.detail.dataUrl = 'data:image/png;base64,SH=='
    })

    // Decorative (aria-hidden) and button-role canvases are skipped.
    const hiddenCanvas = document.createElement(HTML_TAGS.CANVAS)

    hiddenCanvas.setAttribute(ARIA_ATTRS.ARIA_HIDDEN, ATTR_VALUES.TRUE)

    const btnCanvas = document.createElement(HTML_TAGS.CANVAS)

    btnCanvas.setAttribute(ARIA_ATTRS.ROLE, ARIA_ATTRS.ROLE_BUTTON)

    // data-print-capture opts an aria-hidden canvas IN to the still swap
    // (playground scenes, anim demos) — driver-owned surfaces answer the
    // printcapture handshake rather than a blind toDataURL read, so the
    // stub stamps detail.dataUrl like the widget listeners do;
    // data-print-skip retires a canvas outright with no capture at all.
    const optCanvas = document.createElement(HTML_TAGS.CANVAS)

    optCanvas.setAttribute(ARIA_ATTRS.ARIA_HIDDEN, ATTR_VALUES.TRUE)
    optCanvas.setAttribute(DATA_ATTRS.PRINT_CAPTURE, ATTR_VALUES.EMPTY)
    optCanvas.addEventListener(PRINT_EVENTS.CAPTURE, (e) => {
      e.detail.dataUrl = 'data:image/png;base64,OP=='
    })

    const skipCanvas = document.createElement(HTML_TAGS.CANVAS)

    skipCanvas.setAttribute(DATA_ATTRS.PRINT_SKIP, ATTR_VALUES.EMPTY)
    skipCanvas.toDataURL = () => 'data:image/png;base64,SK=='

    // data-print-landscape wraps the still in the rotated plate — the
    // "turn the magazine" spread; a named landscape @page strands empty
    // transition sheets in Chromium, so the sheet never changes size.
    const landCanvas = document.createElement(HTML_TAGS.CANVAS)

    landCanvas.setAttribute(DATA_ATTRS.PRINT_LANDSCAPE, ATTR_VALUES.EMPTY)
    landCanvas.setAttribute(DATA_ATTRS.PRINT_CAPTURE, ATTR_VALUES.EMPTY)
    landCanvas.addEventListener(PRINT_EVENTS.CAPTURE, (e) => {
      e.detail.dataUrl = 'data:image/png;base64,LA=='
    })

    // Shadow thumb + high-res img pair: high-res promotes src from thumb.
    const shThumb = document.createElement(HTML_TAGS.IMG)

    shThumb.setAttribute(
      MEDIA_ATTRS.SRC,
      `https://cdn.example/photo${MEDIA.MOZ}${MEDIA.THUMB_SUFFIX}.jpg`
    )

    const shHigh = document.createElement(HTML_TAGS.IMG)

    // Shadow video with no poster and no derivable still → retires like
    // a swapped surface rather than printing a dead player box.
    const shVideo = document.createElement(HTML_TAGS.VIDEO)

    // Src-less shadow img with a src-less previous sibling → nothing to
    // promote and no stem → retires with the no-source arm.
    const shBare = document.createElement(HTML_TAGS.IMG)

    // Element with inline style → stripped during print, restored on exit.
    const styledTrack = document.createElement(HTML_TAGS.DIV)

    styledTrack.style.opacity = '0.5'

    shadow.appendChild(shCanvas)
    shadow.appendChild(hiddenCanvas)
    shadow.appendChild(btnCanvas)
    shadow.appendChild(optCanvas)
    shadow.appendChild(skipCanvas)
    shadow.appendChild(landCanvas)
    shadow.appendChild(shThumb)
    shadow.appendChild(shHigh)
    shadow.appendChild(shVideo)
    shadow.appendChild(shBare)
    shadow.appendChild(styledTrack)
    document.body.appendChild(host)

    // Video with a poster → poster still; without → retired so the page
    // never prints a dead player box.
    const poster = document.createElement(HTML_TAGS.VIDEO)

    poster.setAttribute(MEDIA_ATTRS.POSTER, 'https://cdn.example/x.jpg')

    const bare = document.createElement(HTML_TAGS.VIDEO)

    // Relative poster URL — not an openable http(s) address, so the video
    // retires rather than swapping in a still that can't resolve.
    const relPoster = document.createElement(HTML_TAGS.VIDEO)

    relPoster.setAttribute(MEDIA_ATTRS.POSTER, 'media/x.jpg')

    article.appendChild(poster)
    article.appendChild(bare)
    article.appendChild(relPoster)

    // Src-less article img after the src-less video → nothing to promote;
    // no printable source → retires to .print-src.
    const noSrcArt = document.createElement(HTML_TAGS.IMG)

    article.appendChild(noSrcArt)

    // Lazy article image upgrades; one keeps a recorded attr to restore.
    const lazy = document.createElement(HTML_TAGS.IMG)

    lazy.setAttribute(MEDIA_ATTRS.LOADING, MEDIA_ATTRS.LOADING_LAZY)
    lazy.setAttribute(MEDIA_ATTRS.SRC, 'https://cdn.example/lazy.jpg')

    // A sourced article image keeps its src and earns the caption.
    const plain = document.createElement(HTML_TAGS.IMG)

    plain.setAttribute(MEDIA_ATTRS.SRC, 'https://cdn.example/plain.jpg')
    plain.setAttribute(MEDIA_ATTRS.WIDTH, '1281')
    plain.setAttribute(MEDIA_ATTRS.HEIGHT, '100')

    // decode() priming — a resolving decode and a rejecting decode both
    // land silently (the catch swallows); imgs without decode (the rest)
    // take the absent arm.
    lazy.decode = () => Promise.resolve()
    plain.decode = () => Promise.reject(new Error('decode fail'))

    article.appendChild(lazy)
    article.appendChild(plain)

    // <picture> wrapper: the <source> ladder unplugs for the snapshot so
    // the img's own src stands, then restores on exit.
    const pic = document.createElement(HTML_TAGS.PICTURE)
    const picSource = document.createElement(HTML_TAGS.SOURCE)
    const picImg = document.createElement(HTML_TAGS.IMG)

    picSource.setAttribute(MEDIA_ATTRS.SRCSET, 'https://cdn.example/pic.webp')
    picImg.setAttribute(MEDIA_ATTRS.SRC, 'https://cdn.example/pic.jpg')
    pic.appendChild(picSource)
    pic.appendChild(picImg)
    article.appendChild(pic)

    // Marked route anchor — earns a .print-qr-link beside itself; a
    // second marked anchor with a '#'-only href emits nothing.
    const routeLink = document.createElement(HTML_TAGS.A)

    routeLink.setAttribute(LINK_ATTRS.HREF, '/br/portfolio/metcha')
    routeLink.setAttribute(DATA_ATTRS.PRINT_LINK, ATTR_VALUES.EMPTY)

    const hashLink = document.createElement(HTML_TAGS.A)

    hashLink.setAttribute(LINK_ATTRS.HREF, '#top')
    hashLink.setAttribute(DATA_ATTRS.PRINT_LINK, ATTR_VALUES.EMPTY)

    article.appendChild(routeLink)
    article.appendChild(hashLink)

    // Independent sibling imgs under one parent are NOT stack layers —
    // different stems each upgrade to uncompressed and ALL of them print
    // (only same-stem rungs of one media get the layer treatment).
    const galA = document.createElement(HTML_TAGS.IMG)

    galA.setAttribute(
      MEDIA_ATTRS.SRC,
      `https://cdn.example/gal/a${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`
    )

    const galB = document.createElement(HTML_TAGS.IMG)

    galB.setAttribute(
      MEDIA_ATTRS.SRC,
      `https://cdn.example/gal/b${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`
    )

    article.appendChild(galA)
    article.appendChild(galB)

    // An image inside #app (CMS content chrome) upgrades and earns the
    // caption; a body-level stray outside the app shell stays untouched —
    // only printable surfaces get the media pass.
    const appShell = document.createElement(HTML_TAGS.DIV)

    appShell.id = APP_IDS.APP

    const appImg = document.createElement(HTML_TAGS.IMG)

    appImg.setAttribute(MEDIA_ATTRS.SRC, 'https://cdn.example/app.jpg')
    appImg.setAttribute(MEDIA_ATTRS.WIDTH, '1281')
    appImg.setAttribute(MEDIA_ATTRS.HEIGHT, '100')

    appShell.appendChild(appImg)
    document.body.appendChild(appShell)

    const stray = document.createElement(HTML_TAGS.IMG)

    document.body.appendChild(stray)

    // Upgrades only swap to URLs a completed screen load already warmed
    // into the HTTP cache — fire the loads the warm listener rides.
    // Shadow-bound imgs warm through the per-root bridge (`load` is
    // non-composed, so the document capture listener can't see them).
    galA.dispatchEvent(new window.Event(WINDOW_EVENTS.LOAD))
    galB.dispatchEvent(new window.Event(WINDOW_EVENTS.LOAD))
    bindPrintWarm(shadow)
    shThumb.dispatchEvent(new window.Event(WINDOW_EVENTS.LOAD))

    fireBeforePrint()

    const copies = article.querySelectorAll(`.${PRINT_CLASSES.COPY}`)

    // inCanvas img + shadow img + poster img + opt-in capture img +
    // landscape-scene still = 5 stand-ins; the skip canvas retired
    // without a capture attempt, and the landscape still sits in the
    // rotated plate — no html-level landscape page marker exists anymore.
    expect(copies).toHaveLength(5)
    expect(article.querySelector(`img[src$="OP=="]`)).toBeTruthy()
    expect(article.querySelector(`img[src$="LA=="]`)).toBeTruthy()

    const landPlate = article.querySelector(`.${PRINT_CLASSES.PLATE}`)

    expect(landPlate.classList.contains(PRINT_CLASSES.PLATE_LANDSCAPE)).toBe(true)
    expect(landPlate.querySelector(`img[src$="LA=="]`)).toBeTruthy()
    expect(document.documentElement.classList.contains(PRINT_CLASSES.LANDSCAPE)).toBe(false)
    expect(skipCanvas.classList.contains(PRINT_CLASSES.SRC)).toBe(true)
    expect(article.querySelector(`img[src$="SK=="]`)).toBeNull()
    expect(inCanvas.nextElementSibling.classList.contains(PRINT_CLASSES.COPY)).toBe(true)
    expect(article.querySelector(`img[src$="SH=="]`)).toBeTruthy()
    expect(article.querySelector(`img[src="https://cdn.example/x.jpg"]`)).toBeTruthy()

    expect(lazy.getAttribute(MEDIA_ATTRS.LOADING)).toBe(MEDIA_ATTRS.LOADING_EAGER)
    expect(lazy.getAttribute(MEDIA_ATTRS.FETCH_PRIORITY)).toBe(MEDIA_ATTRS.FETCH_PRIORITY_HIGH)
    expect(lazy.getAttribute(MEDIA_ATTRS.DECODING)).toBe(MEDIA_ATTRS.DECODING_SYNC)

    // Gallery siblings: both upgraded, neither hidden — every image
    // prints; the caption is additional, never a replacement.
    expect(galA.classList.contains(PRINT_CLASSES.SRC)).toBe(false)
    expect(galB.classList.contains(PRINT_CLASSES.SRC)).toBe(false)
    expect(
      galA.getAttribute(MEDIA_ATTRS.SRC).endsWith(`${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`)
    ).toBe(true)
    expect(
      galB.getAttribute(MEDIA_ATTRS.SRC).endsWith(`${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`)
    ).toBe(true)

    // The shadow thumb upgrades to the uncompressed tier first; the
    // src-less high layer then inherits that full-quality URL.
    expect(shHigh.getAttribute(MEDIA_ATTRS.SRC)).toBe(
      `https://cdn.example/photo${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`
    )
    expect(shHigh.getAttribute(MEDIA_ATTRS.LOADING)).toBe(MEDIA_ATTRS.LOADING_EAGER)
    expect(styledTrack.hasAttribute(COMMON_ATTRS.STYLE)).toBe(false)

    expect(stray.getAttribute(MEDIA_ATTRS.LOADING)).toBeNull()

    // Poster-less video: nothing derivable → retired rather than a dead
    // player box on paper. Same for the shadow twin and the src-less imgs.
    expect(bare.classList.contains(PRINT_CLASSES.SRC)).toBe(true)
    expect(relPoster.classList.contains(PRINT_CLASSES.SRC)).toBe(true)
    expect(shVideo.classList.contains(PRINT_CLASSES.SRC)).toBe(true)
    expect(shBare.classList.contains(PRINT_CLASSES.SRC)).toBe(true)
    expect(noSrcArt.classList.contains(PRINT_CLASSES.SRC)).toBe(true)

    // App-shell img upgraded; its source/date/author caption landed as
    // its sibling.
    expect(appImg.getAttribute(MEDIA_ATTRS.LOADING)).toBe(MEDIA_ATTRS.LOADING_EAGER)

    const appCap = appImg.nextElementSibling

    expect(appCap.classList.contains(PRINT_CLASSES.CAPTION)).toBe(true)
    expect(appCap.querySelector('a')?.href).toBe('https://cdn.example/app.jpg')
    expect(appCap.textContent).toContain(`${MEDIA_CREDIT_LABELS.SOURCE}:`)
    expect(appCap.textContent).toContain(BASE_TITLE)

    // Article img → caption sibling carrying its own URL.
    const plainCap = plain.nextElementSibling

    expect(plainCap.classList.contains(PRINT_CLASSES.CAPTION)).toBe(true)
    expect(plainCap.querySelector('a')?.href).toBe('https://cdn.example/plain.jpg')

    // Picture ladder unplugged; caption seats after the picture element.
    expect(picSource.hasAttribute(MEDIA_ATTRS.SRCSET)).toBe(false)
    expect(pic.nextElementSibling.classList.contains(PRINT_CLASSES.CAPTION)).toBe(true)

    // Marked route anchor earned its readable destination line AND its
    // scan code (url line seats between anchor and code); the '#'-only
    // href emitted neither.
    const urlLine = routeLink.nextElementSibling

    expect(urlLine.classList.contains(PRINT_CLASSES.LINK_URL)).toBe(true)
    expect(urlLine.textContent).toBe(routeLink.href)
    expect(urlLine.getAttribute(LINK_ATTRS.HREF)).toBe(routeLink.href)
    expect(urlLine.nextElementSibling.classList.contains(PRINT_CLASSES.QR_LINK)).toBe(true)
    expect(hashLink.nextElementSibling?.classList.contains(PRINT_CLASSES.LINK_URL)).not.toBe(true)
    expect(hashLink.nextElementSibling?.classList.contains(PRINT_CLASSES.QR_LINK)).not.toBe(true)

    expect(document.documentElement.classList.contains(STATE_CLASSES.DARK_MODE)).toBe(false)

    fireAfterPrint()

    expect(article.querySelector(`.${PRINT_CLASSES.COPY}`)).toBeNull()
    expect(lazy.getAttribute(MEDIA_ATTRS.LOADING)).toBe(MEDIA_ATTRS.LOADING_LAZY)
    expect(plain.getAttribute(MEDIA_ATTRS.LOADING)).toBeNull()
    expect(shHigh.getAttribute(MEDIA_ATTRS.SRC)).toBeNull()
    expect(picSource.getAttribute(MEDIA_ATTRS.SRCSET)).toBe('https://cdn.example/pic.webp')
    expect(routeLink.nextElementSibling?.classList.contains(PRINT_CLASSES.QR_LINK)).not.toBe(true)
    expect(styledTrack.style.opacity).toBe('0.5')
    expect(document.documentElement.classList.contains(STATE_CLASSES.DARK_MODE)).toBe(true)
    expect(document.documentElement.classList.contains(PRINT_CLASSES.LANDSCAPE)).toBe(false)
  })

  test('capture failure skips the swap without throwing', () => {
    const canvas = document.createElement(HTML_TAGS.CANVAS)

    canvas.toDataURL = () => {
      throw new Error('no ctx')
    }

    document.body.appendChild(canvas)

    fireBeforePrint()

    expect(document.querySelector(`.${PRINT_CLASSES.COPY}`)).toBeNull()
    expect(canvas.classList.contains(PRINT_CLASSES.SRC)).toBe(false)

    fireAfterPrint()
  })

  test('matchMedia print channel drives enter/exit for engines without events', () => {
    jest.useFakeTimers()

    try {
      const canvas = document.createElement(HTML_TAGS.CANVAS)

      canvas.toDataURL = () => 'data:image/png;base64,MQ=='

      document.body.appendChild(canvas)

      mqlMatches = true
      mqlListener({ matches: true })

      expect(document.querySelector(`.${PRINT_CLASSES.COPY}`)).toBeTruthy()

      // The false edge only ARMS the teardown — a mid-job flicker
      // (Chromium's print pipeline toggles the query off briefly before
      // re-arming it for the real render) can't erase the prepared DOM
      // while pagination is still snapshotting it.
      mqlMatches = false
      mqlListener({ matches: false })

      expect(document.querySelector(`.${PRINT_CLASSES.COPY}`)).toBeTruthy()

      // A re-armed true edge inside the window cancels the pending exit.
      mqlMatches = true
      mqlListener({ matches: true })

      jest.advanceTimersByTime(PRINT_TIMING.MM_EXIT_DEBOUNCE + 1)

      expect(document.querySelector(`.${PRINT_CLASSES.COPY}`)).toBeTruthy()

      // A timer that somehow outlives the re-arm still no-ops — the fire
      // re-checks the live query and finds it back to print.
      mqlMatches = false
      mqlListener({ matches: false })
      mqlMatches = true

      jest.advanceTimersByTime(PRINT_TIMING.MM_EXIT_DEBOUNCE + 1)

      expect(document.querySelector(`.${PRINT_CLASSES.COPY}`)).toBeTruthy()

      // The genuine job end leaves the query false — the deferred check
      // fires the real teardown once the window closes.
      mqlMatches = false
      mqlListener({ matches: false })

      jest.advanceTimersByTime(PRINT_TIMING.MM_EXIT_DEBOUNCE + 1)

      expect(document.querySelector(`.${PRINT_CLASSES.COPY}`)).toBeNull()
    } finally {
      mqlMatches = false
      jest.useRealTimers()
    }
  })

  test('figure surfaces: uncompressed upgrade, captions, page QR — all restored on exit', () => {
    // Media-figure → full-quality upgrade + source/date/author caption.
    const fig = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    fig.setAttribute(MEDIA_ATTRS.SRC, 'proj/pic')
    fig.setAttribute(MEDIA_ATTRS.NATURAL_WIDTH, '1281')
    fig.setAttribute(MEDIA_ATTRS.NATURAL_HEIGHT, '1279')

    const figShadow = fig.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const thumb = document.createElement(HTML_TAGS.IMG)

    thumb.className = MEDIA_CLASSES.RENDER_MEDIA_THUMB
    thumb.setAttribute(
      MEDIA_ATTRS.SRC,
      `${CDN_URLS.CDN_BASE}proj/pic${MEDIA.MOZ}${MEDIA.THUMB_SUFFIX}${MEDIA.EXT}`
    )

    const high = document.createElement(HTML_TAGS.IMG)

    high.className = MEDIA_CLASSES.RENDER_MEDIA_HIGH
    high.setAttribute(MEDIA_ATTRS.SRCSET, 'x 1x')

    figShadow.appendChild(thumb)
    figShadow.appendChild(high)
    document.body.appendChild(fig)

    // Non-figure shadow stack (home-mosaic/card-stack shape): layers of
    // one media spread across <picture> wrappers share the media-well
    // scope — same-stem rungs dedupe to the last-processed layer while a
    // stray non-pipeline img keeps its src and stays unmarked.
    const strayHost = document.createElement(HTML_TAGS.DIV)
    const strayShadow = strayHost.attachShadow({ mode: COMMON_ATTRS.OPEN })

    // Src-less layer first — the rung check on its null src exercises the
    // empty-string arm without marking it.
    const bareEarly = document.createElement(HTML_TAGS.IMG)

    const stray = document.createElement(HTML_TAGS.IMG)

    stray.setAttribute(MEDIA_ATTRS.SRC, 'other.jpg')

    // Loose thumb layer outside any figure: `X.jpg-thumb.jpg` upgrades to
    // the still it thumbs — `X.jpg` ships by definition of the suffix.
    const looseThumb = document.createElement(HTML_TAGS.IMG)

    looseThumb.setAttribute(MEDIA_ATTRS.SRC, `proj/loose${MEDIA.VIDEO_THUMB_EXT}`)

    // Src-less layer after an unproven-src sibling: the promoted original
    // `proj/deep-x.jpg` isn't manifest-proven, so no src lands and the
    // layer retires (a broken glyph must never be the printed form).
    const unprovenSib = document.createElement(HTML_TAGS.IMG)

    unprovenSib.setAttribute(MEDIA_ATTRS.SRC, 'proj/deep-x.jpg')

    const deadLayer = document.createElement(HTML_TAGS.IMG)

    // Lower rung inside a <picture>: its source ladders get stripped
    // (the src-less source skips), it upgrades, then a later same-stem
    // layer retires it — and its queued caption drops with it.
    const picA = document.createElement(HTML_TAGS.PICTURE)
    const srcA = document.createElement(HTML_TAGS.SOURCE)

    srcA.setAttribute(MEDIA_ATTRS.SRCSET, 'x 1x')

    const srcBare = document.createElement(HTML_TAGS.SOURCE)
    const qrThumb = document.createElement(HTML_TAGS.IMG)

    qrThumb.setAttribute(
      MEDIA_ATTRS.SRC,
      `https://cdn.example/photo${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`
    )
    qrThumb.setAttribute(MEDIA_ATTRS.NATURAL_WIDTH, '9999')
    picA.appendChild(srcA)
    picA.appendChild(srcBare)
    picA.appendChild(qrThumb)

    const picB = document.createElement(HTML_TAGS.PICTURE)
    const topRung = document.createElement(HTML_TAGS.IMG)

    topRung.setAttribute(
      MEDIA_ATTRS.SRC,
      `https://cdn.example/photo${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`
    )
    topRung.setAttribute(MEDIA_ATTRS.NATURAL_WIDTH, '9999')
    picB.appendChild(topRung)

    // Same-stem layer as a wrapper's last child — retired, exercising
    // the null-nextSibling arm.
    const tailWrap = document.createElement(HTML_TAGS.DIV)
    const tailThumb = document.createElement(HTML_TAGS.IMG)

    tailThumb.setAttribute(
      MEDIA_ATTRS.SRC,
      `https://cdn.example/photo${MEDIA.MOZ}${MEDIA.Q75}${MEDIA.EXT}`
    )
    tailWrap.appendChild(tailThumb)

    const picC = document.createElement(HTML_TAGS.PICTURE)
    const tailMark = document.createElement(HTML_TAGS.IMG)

    tailMark.setAttribute(
      MEDIA_ATTRS.SRC,
      `https://cdn.example/photo${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`
    )
    tailMark.setAttribute(MEDIA_ATTRS.NATURAL_WIDTH, '9999')
    picC.appendChild(tailMark)

    // Img whose real URL is huge — the caption is plain text plus an
    // anchor, so payload size never gates it (unlike a QR payload).
    const hugeImg = document.createElement(HTML_TAGS.IMG)

    hugeImg.setAttribute(MEDIA_ATTRS.SRC, `https://cdn.example/${'b'.repeat(2400)}`)
    hugeImg.setAttribute(MEDIA_ATTRS.NATURAL_WIDTH, '9999')

    // Card-stack-shaped surface: each card is an <a> wrapping a
    // <picture>-wrapped media well, and the "view all" index twin lives
    // in a DIFFERENT well while sharing the card's href and image stem.
    // The deck layer's dedup must stay inside its own well — the index
    // img can neither retire the deck's printed layer nor share its
    // caption (each surface is described independently).
    const cardWrap = document.createElement(HTML_TAGS.DIV)
    const cardA = document.createElement(HTML_TAGS.A)

    cardA.setAttribute(LINK_ATTRS.HREF, '/br/portfolio/proj-a')

    const cardWell = document.createElement(HTML_TAGS.DIV)
    const cardPicT = document.createElement(HTML_TAGS.PICTURE)
    const cardThumb = document.createElement(HTML_TAGS.IMG)

    cardThumb.setAttribute(MEDIA_ATTRS.SRC, 'https://cdn.example/card-a.jpg')
    cardThumb.setAttribute(MEDIA_ATTRS.WIDTH, '800')
    cardThumb.setAttribute(MEDIA_ATTRS.HEIGHT, '450')
    cardPicT.appendChild(cardThumb)

    const cardPicH = document.createElement(HTML_TAGS.PICTURE)
    const cardHigh = document.createElement(HTML_TAGS.IMG)

    cardHigh.setAttribute(MEDIA_ATTRS.SRC, 'https://cdn.example/card-a.webp')
    cardHigh.setAttribute(MEDIA_ATTRS.WIDTH, '800')
    cardHigh.setAttribute(MEDIA_ATTRS.HEIGHT, '450')
    cardPicH.appendChild(cardHigh)

    cardWell.appendChild(cardPicT)
    cardWell.appendChild(cardPicH)
    cardA.appendChild(cardWell)
    cardWrap.appendChild(cardA)

    const idxWrap = document.createElement(HTML_TAGS.DIV)
    const idxA = document.createElement(HTML_TAGS.A)

    idxA.setAttribute(LINK_ATTRS.HREF, '/br/portfolio/proj-a')

    const idxImg = document.createElement(HTML_TAGS.IMG)

    idxImg.setAttribute(MEDIA_ATTRS.SRC, 'https://cdn.example/card-a.jpg')
    idxA.appendChild(idxImg)
    idxWrap.appendChild(idxA)

    // Non-http anchor (mailto) wrapping a relative-src img → the
    // caption's http gate keeps the source line out — nothing seats.
    const mailA = document.createElement(HTML_TAGS.A)

    mailA.setAttribute(LINK_ATTRS.HREF, 'mailto:x@y.z')

    const mailImg = document.createElement(HTML_TAGS.IMG)

    mailImg.setAttribute(MEDIA_ATTRS.SRC, 'proj/m.jpg')
    mailA.appendChild(mailImg)

    // Relative src → the caption's http gate keeps it out either way.
    const boxOnly = document.createElement(HTML_TAGS.IMG)

    boxOnly.setAttribute(MEDIA_ATTRS.SRC, 'proj/box.jpg')
    boxOnly.setAttribute(MEDIA_ATTRS.WIDTH, '10')
    boxOnly.setAttribute(MEDIA_ATTRS.HEIGHT, '10')

    // Absolute src earns the caption regardless of box dims.
    const bigNat = document.createElement(HTML_TAGS.IMG)

    bigNat.setAttribute(MEDIA_ATTRS.SRC, 'https://cdn.example/big.jpg')
    bigNat.setAttribute(MEDIA_ATTRS.WIDTH, '10')
    bigNat.setAttribute(MEDIA_ATTRS.HEIGHT, '10')
    Object.defineProperty(bigNat, 'naturalWidth', { value: 9999 })
    Object.defineProperty(bigNat, 'naturalHeight', { value: 9999 })

    // Img inside an anchor, relative src → the http gate skips the
    // caption too (the sentinel keeps the slot checkable).
    const bigWrap = document.createElement(HTML_TAGS.DIV)
    const bigA = document.createElement(HTML_TAGS.A)

    bigA.setAttribute(LINK_ATTRS.HREF, `/${'x'.repeat(2400)}`)

    const bigImg = document.createElement(HTML_TAGS.IMG)

    bigImg.setAttribute(MEDIA_ATTRS.SRC, 'proj/big.jpg')
    bigA.appendChild(bigImg)
    bigWrap.appendChild(bigA)

    const bigSentinel = document.createElement(HTML_TAGS.DIV)

    bigWrap.appendChild(bigSentinel)

    // A footer inside the shadow exercises walkFooters' shadow recursion
    // and the link-QR path's remaining arms: an empty href and a '#'-only
    // href carry nothing to scan, the deck href dedupes against the card's
    // code, while mailto/https links each emit their own.
    const foot = document.createElement(HTML_TAGS.FOOTER)
    const footEmpty = document.createElement(HTML_TAGS.A)

    footEmpty.setAttribute(LINK_ATTRS.HREF, '')

    const footHash = document.createElement(HTML_TAGS.A)

    footHash.setAttribute(LINK_ATTRS.HREF, '#')

    const footDup = document.createElement(HTML_TAGS.A)

    footDup.setAttribute(LINK_ATTRS.HREF, '/br/portfolio/proj-a')

    const footMail = document.createElement(HTML_TAGS.A)

    footMail.setAttribute(LINK_ATTRS.HREF, 'mailto:foot@x.z')

    const footOk = document.createElement(HTML_TAGS.A)

    footOk.setAttribute(LINK_ATTRS.HREF, 'https://cdn.example/foot-x')

    foot.appendChild(footEmpty)
    foot.appendChild(footHash)
    foot.appendChild(footDup)
    foot.appendChild(footMail)
    foot.appendChild(footOk)

    strayShadow.appendChild(bareEarly)
    strayShadow.appendChild(stray)
    strayShadow.appendChild(looseThumb)
    strayShadow.appendChild(unprovenSib)
    strayShadow.appendChild(deadLayer)
    strayShadow.appendChild(picA)
    strayShadow.appendChild(picB)
    strayShadow.appendChild(tailWrap)
    strayShadow.appendChild(picC)
    strayShadow.appendChild(hugeImg)
    strayShadow.appendChild(cardWrap)
    strayShadow.appendChild(idxWrap)
    strayShadow.appendChild(mailA)
    strayShadow.appendChild(boxOnly)
    strayShadow.appendChild(bigNat)
    strayShadow.appendChild(bigWrap)
    strayShadow.appendChild(foot)
    document.body.appendChild(strayHost)

    // Small figure → no caption. Src-less figure → no caption either.
    const small = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    small.setAttribute(MEDIA_ATTRS.SRC, 'proj/small')
    small.setAttribute(MEDIA_ATTRS.NATURAL_WIDTH, '64')
    small.setAttribute(MEDIA_ATTRS.NATURAL_HEIGHT, '64')

    const noSrc = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    noSrc.setAttribute(MEDIA_ATTRS.NATURAL_WIDTH, '9999')
    noSrc.setAttribute(MEDIA_ATTRS.NATURAL_HEIGHT, '9999')

    document.body.appendChild(small)
    document.body.appendChild(noSrc)

    // Video figure → caption links to the .mp4 source, not the still.
    const vidFig = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    vidFig.setAttribute(MEDIA_ATTRS.SRC, 'proj/clip')
    vidFig.setAttribute(MEDIA_ATTRS.IS_VIDEO, ATTR_VALUES.TRUE)
    vidFig.setAttribute(MEDIA_ATTRS.NATURAL_HEIGHT, '9999')

    const vidShadow = vidFig.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const video = document.createElement(HTML_TAGS.VIDEO)

    vidShadow.appendChild(video)
    document.body.appendChild(vidFig)

    // Video figure whose shadow already carries a poster img layer — the
    // layer prints (uncompressed upgrade), the video only marks; no
    // injected still or the frame would print twice.
    const layeredVid = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    layeredVid.setAttribute(MEDIA_ATTRS.SRC, 'proj/layered')
    layeredVid.setAttribute(MEDIA_ATTRS.IS_VIDEO, ATTR_VALUES.TRUE)
    layeredVid.setAttribute(MEDIA_ATTRS.NATURAL_WIDTH, '64')

    const lvShadow = layeredVid.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const lvPoster = document.createElement(HTML_TAGS.IMG)

    lvPoster.setAttribute(
      MEDIA_ATTRS.SRC,
      `${CDN_URLS.CDN_BASE}proj/layered${MEDIA.VIDEO_THUMB_EXT}`
    )

    const lvVideo = document.createElement(HTML_TAGS.VIDEO)

    lvShadow.appendChild(lvPoster)
    lvShadow.appendChild(lvVideo)
    document.body.appendChild(layeredVid)

    // Non-figure shadow video: no figure stem, so sibling imgs (an
    // intrinsic-size SVG placeholder, a src-less layer) can't suppress
    // the still — the poster copy is injected anyway.
    const blurHost = document.createElement(HTML_TAGS.DIV)
    const bvShadow = blurHost.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const bvPlaceholder = document.createElement(HTML_TAGS.IMG)

    bvPlaceholder.setAttribute(MEDIA_ATTRS.SRC, `${SVG_STRINGS.SVG_DATA_URI_PREFIX}PHN2Zw==`)

    const bvBare = document.createElement(HTML_TAGS.IMG)
    const bvVideo = document.createElement(HTML_TAGS.VIDEO)

    bvVideo.setAttribute(MEDIA_ATTRS.POSTER, 'https://cdn.example/blur-poster.jpg')

    bvShadow.appendChild(bvPlaceholder)
    bvShadow.appendChild(bvBare)
    bvShadow.appendChild(bvVideo)
    document.body.appendChild(blurHost)

    // Video figure with no src at all → stem-less, so its source URL
    // resolves to '' and no caption seats.
    const vidNoSrc = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    vidNoSrc.setAttribute(MEDIA_ATTRS.IS_VIDEO, ATTR_VALUES.TRUE)
    document.body.appendChild(vidNoSrc)

    // Light-DOM video whose still comes off a <source src> child — the
    // video's own src/poster attrs are absent so the source chain does
    // the resolving.
    const srcVid = document.createElement(HTML_TAGS.VIDEO)
    const srcChild = document.createElement(HTML_TAGS.SOURCE)

    srcChild.setAttribute(MEDIA_ATTRS.SRC, 'https://cdn.example/inner.mp4')

    srcVid.appendChild(srcChild)
    document.body.appendChild(srcVid)

    // Figure whose stem the manifest can't prove → no top rung exists,
    // so no caption seats (a fabricated -uncompressed URL would 404).
    const qrOverflow = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    qrOverflow.setAttribute(MEDIA_ATTRS.SRC, `proj/${'a'.repeat(2400)}`)
    qrOverflow.setAttribute(MEDIA_ATTRS.NATURAL_WIDTH, '9999')
    document.body.appendChild(qrOverflow)

    // A figure nested inside another component's shadow still earns its
    // caption — walkFigures recurses through nested shadow roots.
    const nestHost = document.createElement(HTML_TAGS.DIV)
    const nestShadow = nestHost.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const nested = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    nested.setAttribute(MEDIA_ATTRS.SRC, 'proj/deep')
    nested.setAttribute(MEDIA_ATTRS.IS_VIDEO, ATTR_VALUES.FALSE)
    nested.setAttribute(MEDIA_ATTRS.NATURAL_HEIGHT, '9999')

    const nestedShadow = nested.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const nestedImg = document.createElement(HTML_TAGS.IMG)

    nestedImg.setAttribute(MEDIA_ATTRS.SRC, 'proj/deep-x.jpg')
    nestedShadow.appendChild(nestedImg)
    nestShadow.appendChild(nested)
    document.body.appendChild(nestHost)

    // Src-less high layer whose stem's rungs were NEVER warmed: the
    // promoted URL is a cold pull, but print quality wins over preview
    // latency — the layer takes the manifest-proven rung outright and
    // the now-redundant thumb sibling retires under the same stem.
    const coldFig = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    coldFig.setAttribute(MEDIA_ATTRS.SRC, 'proj/cold')
    coldFig.setAttribute(MEDIA_ATTRS.NATURAL_WIDTH, '9999')
    coldFig.setAttribute(MEDIA_ATTRS.NATURAL_HEIGHT, '9999')

    const coldShadow = coldFig.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const coldThumb = document.createElement(HTML_TAGS.IMG)
    const coldHigh = document.createElement(HTML_TAGS.IMG)

    coldThumb.setAttribute(
      MEDIA_ATTRS.SRC,
      `${CDN_URLS.CDN_BASE}proj/cold${MEDIA.MOZ}${MEDIA.THUMB_SUFFIX}${MEDIA.EXT}`
    )
    coldShadow.appendChild(coldThumb)
    coldShadow.appendChild(coldHigh)
    document.body.appendChild(coldFig)

    // Warm the rungs the upgrades need — shadow imgs ride the per-root
    // bridge listener (`load` is non-composed past the boundary).
    bindPrintWarm(strayShadow)
    tailMark.dispatchEvent(new window.Event(WINDOW_EVENTS.LOAD))
    bindPrintWarm(lvShadow)
    lvPoster.dispatchEvent(new window.Event(WINDOW_EVENTS.LOAD))

    fireBeforePrint()

    // High layer promoted to the stem's uncompressed rung; thumb hidden;
    // srcset ladder stripped so the chosen src stands.
    expect(
      high.getAttribute(MEDIA_ATTRS.SRC).endsWith(`proj/pic${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`)
    ).toBe(true)
    expect(high.hasAttribute(MEDIA_ATTRS.SRCSET)).toBe(false)
    expect(thumb.classList.contains(PRINT_CLASSES.SRC)).toBe(true)

    // Non-figure shadow imgs: stray layer untouched; every earlier
    // same-stem rung is retired by the last-processed layer — and its
    // queued caption drops with it (retired layers print nothing, so a
    // caption under one would orphan). tailMark survives as the stack's
    // single printed image, captioned after its own <picture>.
    expect(stray.classList.contains(PRINT_CLASSES.SRC)).toBe(false)
    expect(stray.getAttribute(MEDIA_ATTRS.SRC)).toBe('other.jpg')
    expect(looseThumb.getAttribute(MEDIA_ATTRS.SRC)).toBe(
      `proj/loose${MEDIA.VIDEO_EXT}${MEDIA.EXT}`
    )
    expect(unprovenSib.classList.contains(PRINT_CLASSES.SRC)).toBe(false)
    expect(unprovenSib.getAttribute(MEDIA_ATTRS.SRC)).toBe('proj/deep-x.jpg')
    expect(deadLayer.classList.contains(PRINT_CLASSES.SRC)).toBe(true)
    expect(bareEarly.classList.contains(PRINT_CLASSES.SRC)).toBe(true)
    expect(qrThumb.classList.contains(PRINT_CLASSES.SRC)).toBe(true)
    expect(topRung.classList.contains(PRINT_CLASSES.SRC)).toBe(true)
    expect(tailThumb.classList.contains(PRINT_CLASSES.SRC)).toBe(true)
    expect(tailMark.classList.contains(PRINT_CLASSES.SRC)).toBe(false)

    // Retired stack layers surrender their src — a hidden duplicate rung
    // must not keep pulling its multi-megabyte fetch into the snapshot.
    expect(qrThumb.hasAttribute(MEDIA_ATTRS.SRC)).toBe(false)
    expect(topRung.hasAttribute(MEDIA_ATTRS.SRC)).toBe(false)
    expect(tailThumb.hasAttribute(MEDIA_ATTRS.SRC)).toBe(false)

    // Cold-stem promote: the src-less high layer lands the proven top
    // rung (the engine's load-wait covers the pull) and the thumb
    // sibling retires — same stem, the layer's URL outranks it.
    expect(coldHigh.classList.contains(PRINT_CLASSES.SRC)).toBe(false)
    expect(coldHigh.getAttribute(MEDIA_ATTRS.SRC)).toBe(`${CDN_URLS.CDN_BASE}proj/cold${MEDIA.EXT}`)
    expect(coldThumb.classList.contains(PRINT_CLASSES.SRC)).toBe(true)
    expect(coldThumb.hasAttribute(MEDIA_ATTRS.SRC)).toBe(false)
    expect(picC.nextElementSibling?.classList.contains(PRINT_CLASSES.CAPTION)).toBe(true)
    expect(picC.nextElementSibling?.querySelector('a')?.href).toBe(
      `https://cdn.example/photo${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`
    )
    expect(tailMark.getAttribute(MEDIA_ATTRS.SRC)).toBe(
      `https://cdn.example/photo${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`
    )

    // Retired layers keep no caption — only the survivor's seats.
    expect(picA.querySelector(`.${PRINT_CLASSES.CAPTION}`)).toBeNull()
    expect(picA.nextElementSibling?.classList.contains(PRINT_CLASSES.CAPTION)).toBe(false)

    // Picture source ladders were unplugged for the snapshot.
    expect(srcA.hasAttribute(MEDIA_ATTRS.SRCSET)).toBe(false)

    // Card-stack dedup: the .webp high retires the .jpg thumb — same
    // media, folded extension — inside the card's own media well, while
    // the index twin in a DIFFERENT well can't mark either of them.
    expect(cardThumb.classList.contains(PRINT_CLASSES.SRC)).toBe(true)
    expect(cardHigh.classList.contains(PRINT_CLASSES.SRC)).toBe(false)
    expect(idxImg.classList.contains(PRINT_CLASSES.SRC)).toBe(false)

    // One caption seats after the card anchor — the retired thumb's
    // queued caption dropped with its layer — and the index twin gets
    // its own (each printed surface is described independently).
    const cardCap = cardA.nextElementSibling

    expect(cardCap.classList.contains(PRINT_CLASSES.CAPTION)).toBe(true)
    expect(cardCap.querySelector('a')?.href.endsWith('card-a.webp')).toBe(true)

    const idxCap = idxA.nextElementSibling

    expect(idxCap?.classList.contains(PRINT_CLASSES.CAPTION)).toBe(true)

    // Link QRs: the card anchor scans into its own project route — one
    // code even though two imgs inside the anchor each attempted it; the
    // index twin's shared href dedupes, so nothing seats after its
    // caption. The footer links emit per destination while '', '#' and
    // the already-seen deck href carry nothing.
    const cardQr = cardCap.nextElementSibling

    expect(cardQr?.classList.contains(PRINT_CLASSES.QR_LINK)).toBe(true)
    expect(cardQr?.getAttribute(LINK_ATTRS.HREF)?.endsWith('/br/portfolio/proj-a')).toBe(true)
    expect(idxCap?.nextElementSibling).toBeNull()
    expect(footEmpty.nextElementSibling).toBe(footHash)
    expect(footHash.nextElementSibling).toBe(footDup)
    expect(footDup.nextElementSibling).toBe(footMail)
    expect(footMail.nextElementSibling?.classList.contains(PRINT_CLASSES.QR_LINK)).toBe(true)
    expect(footMail.nextElementSibling?.getAttribute(LINK_ATTRS.HREF)).toBe('mailto:foot@x.z')
    expect(footOk.nextElementSibling?.classList.contains(PRINT_CLASSES.QR_LINK)).toBe(true)
    expect(strayShadow.querySelectorAll(`.${PRINT_CLASSES.QR_LINK}`)).toHaveLength(3)

    // Non-http source (relative src) → the caption's http gate keeps it
    // out — nothing seats under the mailto anchor's img.
    expect(mailImg.nextElementSibling).toBeNull()
    expect(mailA.nextElementSibling).toBe(boxOnly)

    // Relative src → no caption either way.
    expect(boxOnly.nextElementSibling).toBe(bigNat)

    // Absolute src → caption seats regardless of dims.
    expect(bigNat.nextElementSibling?.classList.contains(PRINT_CLASSES.CAPTION)).toBe(true)

    // Relative src inside an anchor → still nothing seats.
    expect(bigA.nextElementSibling).toBe(bigSentinel)

    // Figure caption: source anchor after the host into the real-size file.
    const figCap = fig.nextElementSibling

    expect(figCap.classList.contains(PRINT_CLASSES.CAPTION)).toBe(true)
    expect(figCap.querySelector('a')?.href.endsWith(`${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`)).toBe(
      true
    )
    expect(figCap.textContent).toContain(`${MEDIA_CREDIT_LABELS.SOURCE}:`)
    expect(figCap.textContent).toContain(BASE_TITLE)

    expect(small.nextElementSibling).toBe(noSrc)
    expect(noSrc.nextElementSibling).toBe(vidFig)

    // Video figure: poster-less video gained the derived still placed
    // after the host, and its caption links the .mp4 source.
    const vidStill = vidFig.nextElementSibling

    expect(vidStill.classList.contains(PRINT_CLASSES.COPY)).toBe(true)
    expect(vidStill.src.endsWith(`${MEDIA.VIDEO_EXT}${MEDIA.EXT}`)).toBe(true)

    const vidCap = vidStill.nextElementSibling

    expect(vidCap.classList.contains(PRINT_CLASSES.CAPTION)).toBe(true)
    expect(vidCap.querySelector('a')?.href.endsWith(MEDIA.VIDEO_EXT)).toBe(true)

    // Layered video figure: video tagged, no second still injected — the
    // poster img layer is the printed form, upgraded to the emitted
    // `stem.mp4.jpg` still every -thumb.jpg layer derives from. Its
    // caption lands on the host's own slot.
    expect(lvVideo.classList.contains(PRINT_CLASSES.SRC)).toBe(true)
    expect(
      lvPoster.getAttribute(MEDIA_ATTRS.SRC).endsWith(`layered${MEDIA.VIDEO_EXT}${MEDIA.EXT}`)
    ).toBe(true)
    expect(layeredVid.nextElementSibling?.classList.contains(PRINT_CLASSES.CAPTION)).toBe(true)

    // Non-figure shadow video: no figure stem, so sibling imgs can't
    // suppress the still — the poster copy lands after the shadow host,
    // its caption under that (the video's own poster URL).
    expect(bvVideo.classList.contains(PRINT_CLASSES.SRC)).toBe(true)

    const bvCopy = blurHost.nextElementSibling

    expect(bvCopy.classList.contains(PRINT_CLASSES.COPY)).toBe(true)
    expect(bvCopy.nextElementSibling?.classList.contains(PRINT_CLASSES.CAPTION)).toBe(true)
    expect(bvCopy.nextElementSibling?.querySelector('a')?.href).toBe(
      'https://cdn.example/blur-poster.jpg'
    )

    // Src-less video figure → nothing to describe. The <source>-child
    // video swaps to its still + caption like a poster video — the
    // caption links the .mp4 the <source> resolved to.
    expect(vidNoSrc.nextElementSibling).toBe(srcVid)

    const srcStill = srcVid.nextElementSibling

    expect(srcStill.classList.contains(PRINT_CLASSES.COPY)).toBe(true)
    expect(srcStill.src.endsWith(`inner${MEDIA.VIDEO_EXT}${MEDIA.EXT}`)).toBe(true)
    expect(srcStill.nextElementSibling?.querySelector('a')?.href).toBe(
      'https://cdn.example/inner.mp4'
    )

    // Unproven-stem figure → no caption; the nested figure's caption
    // lands inside its own shadow (querySelector can't see it). The
    // huge-url img earns one anyway — a caption is text, not a QR
    // payload, so capacity never gates it.
    expect(qrOverflow.nextElementSibling?.classList.contains(PRINT_CLASSES.CAPTION)).toBe(false)
    expect(nested.nextElementSibling?.classList.contains(PRINT_CLASSES.CAPTION)).toBe(true)
    expect(hugeImg.classList.contains(PRINT_CLASSES.SRC)).toBe(false)
    expect(hugeImg.nextElementSibling?.classList.contains(PRINT_CLASSES.CAPTION)).toBe(true)

    // End-of-document page QR — on the site root it drops outright (the
    // back cover's own code already scans to the same URL), so document-
    // level link QRs stay zero either way: the card/footer codes live
    // inside strayShadow, which document.querySelectorAll can't reach.
    const pageQr = document.querySelector(`.${PRINT_CLASSES.QR_PAGE}`)

    expect(pageQr).toBeNull()
    expect(document.querySelectorAll(`.${PRINT_CLASSES.QR_LINK}`)).toHaveLength(0)

    fireAfterPrint()

    expect(document.querySelector(`.${PRINT_CLASSES.CAPTION}`)).toBeNull()
    expect(document.querySelector(`.${PRINT_CLASSES.QR_PAGE}`)).toBeNull()
    expect(thumb.classList.contains(PRINT_CLASSES.SRC)).toBe(false)
    expect(qrThumb.classList.contains(PRINT_CLASSES.SRC)).toBe(false)
    expect(srcA.getAttribute(MEDIA_ATTRS.SRCSET)).toBe('x 1x')
    expect(high.getAttribute(MEDIA_ATTRS.SRCSET)).toBe('x 1x')
    expect(qrThumb.getAttribute(MEDIA_ATTRS.SRC)).toBe(
      `https://cdn.example/photo${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`
    )
  })

  test('manifest-ready figure upgrades to the proven top rung — in src and caption', async () => {
    // The manifest already latched in beforeAll — this call resolves as a
    // no-op on the same seeded set.
    await initMediaManifest()

    const fig = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    fig.setAttribute(MEDIA_ATTRS.SRC, 'proj/proven')
    fig.setAttribute(MEDIA_ATTRS.NATURAL_WIDTH, '9999')

    const figShadow = fig.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const high = document.createElement(HTML_TAGS.IMG)

    high.className = MEDIA_CLASSES.RENDER_MEDIA_HIGH

    figShadow.appendChild(high)
    document.body.appendChild(fig)

    // A stem the manifest doesn't prove gets NO upgrade — a fabricated
    // -uncompressed URL is what the print pass must never emit.
    const other = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    other.setAttribute(MEDIA_ATTRS.SRC, 'proj/unproven')
    other.setAttribute(MEDIA_ATTRS.NATURAL_WIDTH, '9999')

    const otherShadow = other.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const otherImg = document.createElement(HTML_TAGS.IMG)

    otherImg.setAttribute(MEDIA_ATTRS.SRC, 'proj/unproven.jpg')
    otherShadow.appendChild(otherImg)
    document.body.appendChild(other)

    fireBeforePrint()

    // The manifest's proven top rung wins — in both the high layer's src
    // and the figure's caption href.
    const provenUrl = `${CDN_URLS.CDN_BASE}${PROVEN_KEY}`

    expect(high.getAttribute(MEDIA_ATTRS.SRC)).toBe(provenUrl)
    expect(fig.nextElementSibling.classList.contains(PRINT_CLASSES.CAPTION)).toBe(true)
    expect(fig.nextElementSibling.querySelector('a')?.href).toBe(provenUrl)

    // Unproven stem: img keeps its original src and earns no caption —
    // a relative source URL fails the caption's http gate.
    expect(otherImg.getAttribute(MEDIA_ATTRS.SRC)).toBe('proj/unproven.jpg')
    expect(other.nextElementSibling.classList.contains(PRINT_CLASSES.CAPTION)).toBe(false)

    fireAfterPrint()
  })

  test('reader mirror with parked div wrapper is not the print surface — copies stay in flow', () => {
    // A reader article carrying its static `> div` wrapper stays parked —
    // the live app prints, so shadow stills seat after their host.
    const article = mkArticle()
    const parked = document.createElement(HTML_TAGS.DIV)

    article.appendChild(parked)

    const host = document.createElement(HTML_TAGS.DIV)
    const shadow = host.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const shCanvas = document.createElement(HTML_TAGS.CANVAS)

    shCanvas.toDataURL = () => 'data:image/png;base64,PW=='

    shadow.appendChild(shCanvas)
    document.body.appendChild(host)

    fireBeforePrint()

    const copy = document.querySelector(`.${PRINT_CLASSES.COPY}`)

    expect(copy.previousElementSibling).toBe(host)
    expect(article.contains(copy)).toBe(false)

    fireAfterPrint()

    // An empty reader article isn't the print surface either — stills
    // still seat at their own slot rather than inside it.
    article.remove()
    host.remove()

    const emptyArticle = mkArticle()
    const canvas2 = document.createElement(HTML_TAGS.CANVAS)

    canvas2.toDataURL = () => 'data:image/png;base64,EM=='

    document.body.appendChild(canvas2)

    fireBeforePrint()

    const copy2 = document.querySelector(`.${PRINT_CLASSES.COPY}`)

    expect(copy2.previousElementSibling).toBe(canvas2)
    expect(emptyArticle.contains(copy2)).toBe(false)

    fireAfterPrint()
  })

  test('print-doc marker: prepared mirrors and wrapper-less articles stamp html', () => {
    // data-print-doc arm — a populated article the route marked as the
    // print document flips html.print-doc for the sheet's swap.
    const article = mkArticle()

    article.setAttribute(DATA_ATTRS.PRINT_DOC, ATTR_VALUES.EMPTY)
    article.appendChild(document.createElement(HTML_TAGS.DIV))

    fireBeforePrint()

    expect(document.documentElement.classList.contains(PRINT_CLASSES.DOC)).toBe(true)

    fireAfterPrint()

    expect(document.documentElement.classList.contains(PRINT_CLASSES.DOC)).toBe(false)
  })

  test('footer links each gain a small QR — deduped, non-scannable hrefs skipped', () => {
    // Light-DOM footer (legal-footer shape) with the full href mix.
    const footer = document.createElement(HTML_TAGS.FOOTER)

    const abs = document.createElement(HTML_TAGS.A)

    abs.setAttribute(LINK_ATTRS.HREF, 'https://example.com/here')

    const rel = document.createElement(HTML_TAGS.A)

    rel.setAttribute(LINK_ATTRS.HREF, '/br/portfolio')

    const mail = document.createElement(HTML_TAGS.A)

    mail.setAttribute(LINK_ATTRS.HREF, 'mailto:x@y.z')

    const frag = document.createElement(HTML_TAGS.A)

    frag.setAttribute(LINK_ATTRS.HREF, '#top')

    const empty = document.createElement(HTML_TAGS.A)

    empty.setAttribute(LINK_ATTRS.HREF, '')

    const noHref = document.createElement(HTML_TAGS.A)

    footer.append(abs, rel, mail, frag, empty, noHref)
    document.body.appendChild(footer)

    // A second footer inside a shadow root (awards-mentions shape)
    // repeating `abs`'s href — the dedup set spans all footers, so the
    // repeat scans once, not twice.
    const host = document.createElement(HTML_TAGS.DIV)
    const shadow = host.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const innerFooter = document.createElement(HTML_TAGS.FOOTER)
    const dup = document.createElement(HTML_TAGS.A)

    dup.setAttribute(LINK_ATTRS.HREF, 'https://example.com/here')

    const own = document.createElement(HTML_TAGS.A)

    own.setAttribute(LINK_ATTRS.HREF, 'https://example.com/other')

    innerFooter.append(dup, own)
    shadow.appendChild(innerFooter)
    document.body.appendChild(host)

    fireBeforePrint()

    // Each scannable href seats one .print-qr-link as its anchor's next
    // sibling; the svg payload is inside.
    const absQr = abs.nextElementSibling

    expect(absQr.classList.contains(PRINT_CLASSES.QR_LINK)).toBe(true)
    expect(absQr.href).toBe('https://example.com/here')
    expect(absQr.querySelector('svg')).toBeTruthy()
    expect(rel.nextElementSibling?.classList.contains(PRINT_CLASSES.QR_LINK)).toBe(true)
    expect(rel.nextElementSibling?.href).toBe(rel.href)
    expect(mail.nextElementSibling?.classList.contains(PRINT_CLASSES.QR_LINK)).toBe(true)

    // `#` fragments, empty and missing hrefs carry nothing to scan.
    expect(frag.nextElementSibling).toBe(empty)
    expect(empty.nextElementSibling).toBe(noHref)
    expect(noHref.nextElementSibling).toBeNull()

    // The shadow footer's duplicate of `abs` scans once — `own` is its
    // only emitted code.
    expect(dup.nextElementSibling?.classList.contains(PRINT_CLASSES.QR_LINK)).toBe(false)
    expect(own.nextElementSibling?.classList.contains(PRINT_CLASSES.QR_LINK)).toBe(true)
    expect(document.querySelectorAll(`.${PRINT_CLASSES.QR_LINK}`)).toHaveLength(3)
    expect(shadow.querySelectorAll(`.${PRINT_CLASSES.QR_LINK}`)).toHaveLength(1)

    fireAfterPrint()

    expect(document.querySelector(`.${PRINT_CLASSES.QR_LINK}`)).toBeNull()
    expect(shadow.querySelector(`.${PRINT_CLASSES.QR_LINK}`)).toBeNull()
  })

  test('page QR is skipped when the location exceeds QR capacity', () => {
    const startUrl = window.location.href

    // An overlong location can't encode at v40-M — the page link is the
    // one QR simply omitted rather than injected broken.
    window.happyDOM?.setURL?.(`${startUrl}${'a'.repeat(2400)}`)

    fireBeforePrint()

    expect(document.querySelector(`.${PRINT_CLASSES.QR_PAGE}`)).toBeNull()

    window.happyDOM?.setURL?.(startUrl)

    fireAfterPrint()
  })

  test('back cover still prints when the origin exceeds QR capacity', () => {
    const startUrl = window.location.href

    // An overlong origin can't encode at v40-M either — the back cover
    // keeps its copyright line, the site QR is just omitted.
    window.happyDOM?.setURL?.(`http://${'a'.repeat(2400)}/`)

    fireBeforePrint()

    const back = document.querySelector(`.${PRINT_CLASSES.BACK}`)

    expect(back).toBeTruthy()
    expect(back.querySelector(`.${PRINT_CLASSES.BACK_QR}`)).toBeNull()
    expect(back.querySelector(`.${PRINT_CLASSES.BACK_COPY}`)).toBeTruthy()

    window.happyDOM?.setURL?.(startUrl)

    fireAfterPrint()
  })

  test('internal-main figures tag bleed, -mobile siblings promote, and img load events warm print tiers', () => {
    mkArticle()

    // Bleed figure inside .internal-main — landscape-ratio shadow img →
    // BLEED + BLEED_LANDSCAPE + a caption seated BEFORE the host.
    const main = document.createElement(HTML_TAGS.DIV)

    main.className = INTERNAL_CLASSES.INTERNAL_MAIN

    const fig = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    fig.setAttribute(MEDIA_ATTRS.SRC, 'proj/deep')

    const figShadow = fig.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const figImg = document.createElement(HTML_TAGS.IMG)

    Object.defineProperty(figImg, 'naturalWidth', { value: 2000, configurable: true })
    Object.defineProperty(figImg, 'naturalHeight', { value: 1000, configurable: true })
    figShadow.appendChild(figImg)
    main.appendChild(fig)

    // Shadowless figure — img resolves null so the ratio falls to the
    // laid-out box (portrait here, so no landscape tag). The no-caption
    // opt-out also lands its skip arm on this pass.
    const figBare = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    figBare.setAttribute(DATA_ATTRS.PRINT_NO_CAPTION, ATTR_VALUES.EMPTY)
    figBare.getBoundingClientRect = () => ({
      width: 100,
      height: 200,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    })

    main.appendChild(figBare)

    // Third figure — no shadow img AND a 0-height box → the ratio's
    // last-resort `0` arm.
    const figZero = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    figZero.setAttribute(DATA_ATTRS.PRINT_NO_CAPTION, ATTR_VALUES.EMPTY)
    main.appendChild(figZero)
    document.body.appendChild(main)

    // Src-less layer whose sibling src is a `-mobile` original — proven
    // itself but with no `-mozjpg` ladder, so the promoted rung is '' and
    // the mediaKeyExists(original) arm lands instead.
    const mobHost = document.createElement(HTML_TAGS.DIV)
    const mobShadow = mobHost.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const mobThumb = document.createElement(HTML_TAGS.IMG)
    const mobUrl = `https://cdn.example/mob${MEDIA.MOBILE_SUFFIX}${MEDIA.EXT}`

    mobThumb.setAttribute(MEDIA_ATTRS.SRC, mobUrl)

    const mobHigh = document.createElement(HTML_TAGS.IMG)

    mobShadow.appendChild(mobThumb)
    mobShadow.appendChild(mobHigh)
    document.body.appendChild(mobHost)

    fireBeforePrint()

    expect(fig.classList.contains(PRINT_CLASSES.BLEED)).toBe(true)
    expect(fig.classList.contains(PRINT_CLASSES.BLEED_LANDSCAPE)).toBe(true)
    expect(fig.previousElementSibling?.classList.contains(PRINT_CLASSES.CAPTION)).toBe(true)
    expect(figBare.classList.contains(PRINT_CLASSES.BLEED)).toBe(true)
    expect(figBare.classList.contains(PRINT_CLASSES.BLEED_LANDSCAPE)).toBe(false)
    expect(mobHigh.getAttribute(MEDIA_ATTRS.SRC)).toBe(mobUrl)

    // The load listener's `printing` arm — warming mid-pass is too late.
    const duringImg = document.createElement(HTML_TAGS.IMG)

    document.body.appendChild(duringImg)
    duringImg.dispatchEvent(new window.Event(WINDOW_EVENTS.LOAD))

    fireAfterPrint()

    expect(fig.classList.contains(PRINT_CLASSES.BLEED)).toBe(false)
    expect(fig.classList.contains(PRINT_CLASSES.BLEED_LANDSCAPE)).toBe(false)

    // Warm path — the proven top rung is prefetched through a detached
    // Image; the second load of the same img hits the `warmed` dedup.
    const warmImg = document.createElement(HTML_TAGS.IMG)

    warmImg.setAttribute(MEDIA_ATTRS.SRC, `https://cdn.example/photo${MEDIA.EXT}`)
    document.body.appendChild(warmImg)
    warmImg.dispatchEvent(new window.Event(WINDOW_EVENTS.LOAD))
    warmImg.dispatchEvent(new window.Event(WINDOW_EVENTS.LOAD))

    // A non-img target takes the listener's else arm.
    const notImg = document.createElement(HTML_TAGS.DIV)

    document.body.appendChild(notImg)
    notImg.dispatchEvent(new window.Event(WINDOW_EVENTS.LOAD))

    // No derivable best → `!best`; a relative best → the !http arm.
    const bareImg = document.createElement(HTML_TAGS.IMG)

    document.body.appendChild(bareImg)
    bareImg.dispatchEvent(new window.Event(WINDOW_EVENTS.LOAD))

    const relImg = document.createElement(HTML_TAGS.IMG)

    relImg.setAttribute(MEDIA_ATTRS.SRC, `media/rel${MEDIA.EXT}`)
    document.body.appendChild(relImg)
    relImg.dispatchEvent(new window.Event(WINDOW_EVENTS.LOAD))

    // Low media budget → the warm-up returns before touching the network.
    const lowImg = document.createElement(HTML_TAGS.IMG)

    lowImg.setAttribute(MEDIA_ATTRS.SRC, `https://cdn.example/photo${MEDIA.EXT}`)
    document.body.appendChild(lowImg)

    const origConn = Object.getOwnPropertyDescriptor(Navigator.prototype, 'connection')

    Object.defineProperty(Navigator.prototype, 'connection', {
      value: { saveData: true },
      configurable: true,
    })
    lowImg.dispatchEvent(new window.Event(WINDOW_EVENTS.LOAD))

    if (origConn) Object.defineProperty(Navigator.prototype, 'connection', origConn)
    else delete Navigator.prototype.connection

    // Image-ctor arms: window.Image missing → the global; both missing →
    // the null guard; window itself absent → the typeof arm. Each arm gets
    // its own image — `warmed` dedups by URL before the ctor resolution.
    const noWinImg = document.createElement(HTML_TAGS.IMG)
    const noCtorImg = document.createElement(HTML_TAGS.IMG)

    noWinImg.setAttribute(MEDIA_ATTRS.SRC, `https://cdn.example/gal/c${MEDIA.EXT}`)
    noCtorImg.setAttribute(MEDIA_ATTRS.SRC, `https://cdn.example/gal/d${MEDIA.EXT}`)
    document.body.appendChild(noWinImg)
    document.body.appendChild(noCtorImg)

    const origWindowImage = window.Image

    Object.defineProperty(window, 'Image', {
      value: undefined,
      configurable: true,
      writable: true,
    })
    noWinImg.dispatchEvent(new window.Event(WINDOW_EVENTS.LOAD))

    const origGlobalImage = globalThis.Image

    delete globalThis.Image
    noCtorImg.dispatchEvent(new window.Event(WINDOW_EVENTS.LOAD))
    Object.defineProperty(window, 'Image', {
      value: origWindowImage,
      configurable: true,
      writable: true,
    })
    globalThis.Image = origGlobalImage

    const noWindowImg = document.createElement(HTML_TAGS.IMG)

    noWindowImg.setAttribute(MEDIA_ATTRS.SRC, `https://cdn.example/gal/e${MEDIA.EXT}`)
    document.body.appendChild(noWindowImg)

    const loadEvt = new window.Event(WINDOW_EVENTS.LOAD)
    const origWindow = globalThis.window

    delete globalThis.window
    try {
      noWindowImg.dispatchEvent(loadEvt)
    } finally {
      globalThis.window = origWindow
    }
  })

  test('video hero figure: the injected still must not be the recorded anchor', () => {
    mkArticle()

    document.documentElement.classList.add(STATE_CLASSES.DARK_MODE)

    // Hero layout — the internal-title h1 rides the plate; the figure's
    // shadow video swaps for a .print-copy that seats right AFTER the
    // host, so figure.nextSibling was the still itself when the move
    // recorded it. Restoring through that detached anchor threw mid-exit
    // and stranded the page in its light print face.
    const head = document.createElement(HTML_TAGS.H1)

    head.className = INTERNAL_CLASSES.INTERNAL_TITLE

    const main = document.createElement(HTML_TAGS.DIV)

    main.className = INTERNAL_CLASSES.INTERNAL_MAIN

    const fig = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    fig.setAttribute(MEDIA_ATTRS.SRC, 'proj/clip')
    fig.setAttribute(MEDIA_ATTRS.IS_VIDEO, ATTR_VALUES.TRUE)

    const figShadow = fig.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const video = document.createElement(HTML_TAGS.VIDEO)

    figShadow.appendChild(video)

    const tail = document.createElement(HTML_TAGS.DIV)

    main.appendChild(fig)
    main.appendChild(tail)
    document.body.appendChild(head)
    document.body.appendChild(main)

    fireBeforePrint()

    // The plate swallowed the figure and the still rode along — the
    // recorded anchor had to be `tail`, the first surviving sibling.
    const plate = document.querySelector(`.${PRINT_CLASSES.PLATE}`)

    expect(plate?.contains(fig)).toBe(true)
    expect(plate?.querySelector(`.${PRINT_CLASSES.COPY}`)).toBeTruthy()
    expect(video.classList.contains(PRINT_CLASSES.SRC)).toBe(true)

    fireAfterPrint()

    expect(fig.parentNode).toBe(main)
    expect(fig.nextElementSibling).toBe(tail)
    expect(head.parentNode).toBe(document.body)
    expect(head.nextElementSibling).toBe(main)
    expect(video.classList.contains(PRINT_CLASSES.SRC)).toBe(false)
    expect(document.querySelector(`.${PRINT_CLASSES.COPY}`)).toBeNull()
    expect(document.documentElement.classList.contains(STATE_CLASSES.DARK_MODE)).toBe(true)
  })

  test('a restore anchor re-parented mid-job falls back to the parent tail', () => {
    mkArticle()

    document.documentElement.classList.add(STATE_CLASSES.DARK_MODE)

    const main = document.createElement(HTML_TAGS.DIV)

    main.className = INTERNAL_CLASSES.INTERNAL_MAIN

    // Bare figure — no shadow img, so no still seats after it and the
    // recorded anchor is the real `tail` sibling.
    const fig = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    fig.setAttribute(DATA_ATTRS.PRINT_NO_CAPTION, ATTR_VALUES.EMPTY)

    const tail = document.createElement(HTML_TAGS.DIV)

    main.appendChild(fig)
    main.appendChild(tail)
    document.body.appendChild(main)

    fireBeforePrint()

    // Live DOM churn mid-job — the recorded anchor leaves `main` before
    // afterprint runs; the restore must re-seat at the tail, not throw.
    document.body.appendChild(tail)

    fireAfterPrint()

    expect(fig.parentNode).toBe(main)
    expect(main.lastElementChild).toBe(fig)
    expect(document.documentElement.classList.contains(STATE_CLASSES.DARK_MODE)).toBe(true)
  })

  test('a beforeprint prep failure unwinds instead of stranding print state', () => {
    mkArticle()

    document.documentElement.classList.add(STATE_CLASSES.DARK_MODE)

    // Same hero shape as above — the partial prep carries a moved figure
    // plus an injected still the unwind must reverse.
    const main = document.createElement(HTML_TAGS.DIV)

    main.className = INTERNAL_CLASSES.INTERNAL_MAIN

    const fig = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    fig.setAttribute(MEDIA_ATTRS.SRC, 'proj/clip')
    fig.setAttribute(MEDIA_ATTRS.IS_VIDEO, ATTR_VALUES.TRUE)

    const figShadow = fig.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const video = document.createElement(HTML_TAGS.VIDEO)

    figShadow.appendChild(video)
    main.appendChild(fig)
    document.body.appendChild(main)

    const origPrepend = document.body.prepend

    document.body.prepend = () => {
      throw new Error('prep boom')
    }

    try {
      fireBeforePrint()
    } finally {
      document.body.prepend = origPrepend
    }

    // The job unwound: moved nodes re-seated, injected nodes removed,
    // the mark lifted — and commit never ran, so the theme stayed.
    expect(fig.parentNode).toBe(main)
    expect(video.classList.contains(PRINT_CLASSES.SRC)).toBe(false)
    expect(document.querySelector(`.${PRINT_CLASSES.COPY}`)).toBeNull()
    expect(document.documentElement.classList.contains(STATE_CLASSES.DARK_MODE)).toBe(true)

    // The latch cleared — the next trigger runs a fresh full job.
    fireBeforePrint()

    expect(document.querySelector(`.${PRINT_CLASSES.COPY}`)).toBeTruthy()

    fireAfterPrint()
  })

  test('played video frames beat the emitted still; unproven stills retire', async () => {
    const article = mkArticle()

    // A played light-DOM video — readyState/videoWidth prove a decoded
    // frame — swaps to its live-frame data URL, not the t=0 still file.
    const played = document.createElement(HTML_TAGS.VIDEO)

    played.setAttribute(MEDIA_ATTRS.SRC, 'https://cdn.example/played.mp4')
    Object.defineProperty(played, 'readyState', { value: 2, configurable: true })
    Object.defineProperty(played, 'videoWidth', { value: 640, configurable: true })
    Object.defineProperty(played, 'videoHeight', { value: 360, configurable: true })
    article.appendChild(played)

    const canvasProto = Object.getPrototypeOf(document.createElement(HTML_TAGS.CANVAS))
    const realGetContext = canvasProto.getContext
    const realToDataURL = canvasProto.toDataURL

    canvasProto.getContext = () => ({ drawImage: () => {} })
    canvasProto.toDataURL = () => 'data:image/png;base64,FRAME=='

    try {
      fireBeforePrint()

      const frameCopy = played.nextElementSibling

      expect(frameCopy.classList.contains(PRINT_CLASSES.COPY)).toBe(true)
      expect(frameCopy.src).toBe('data:image/png;base64,FRAME==')
    } finally {
      fireAfterPrint()
    }

    // A frame the canvas can't paint (drawImage throws — tainted, dead
    // context) falls through to the still chain like an unplayed video.
    canvasProto.getContext = () => {
      throw new Error('ctx boom')
    }

    try {
      fireBeforePrint()

      const stillCopy = played.nextElementSibling

      // `played.mp4.jpg` is not manifest-proven → retire, not a 404 well.
      expect(played.classList.contains(PRINT_CLASSES.SRC)).toBe(true)
      expect(stillCopy).toBeNull()
    } finally {
      fireAfterPrint()
      canvasProto.getContext = realGetContext
      canvasProto.toDataURL = realToDataURL
    }

    // A video with data signaled but zero-size buffers (readyState says
    // HAVE_CURRENT_DATA, videoWidth still 0) lands the same retire arm.
    const emptyFrame = document.createElement(HTML_TAGS.VIDEO)

    emptyFrame.setAttribute(MEDIA_ATTRS.SRC, 'https://cdn.example/played.mp4')
    Object.defineProperty(emptyFrame, 'readyState', { value: 2, configurable: true })
    article.appendChild(emptyFrame)

    fireBeforePrint()

    expect(emptyFrame.classList.contains(PRINT_CLASSES.SRC)).toBe(true)

    fireAfterPrint()

    // Figure-shadow still layer: a proven `stem.mp4.jpg` upgrades to the
    // still file, an unproven one keeps the layer's own src — never a
    // fabricated 404.
    const vidFig2 = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    vidFig2.setAttribute(MEDIA_ATTRS.SRC, 'proj/clip')
    vidFig2.setAttribute(MEDIA_ATTRS.IS_VIDEO, ATTR_VALUES.TRUE)

    const vfShadow = vidFig2.attachShadow({ mode: COMMON_ATTRS.OPEN })
    const vfImg = document.createElement(HTML_TAGS.IMG)

    // The real poster grammar — the thumb OF `clip.mp4.jpg` — marked
    // decoded-but-broken (complete, zero natural size) so the ungated
    // pass's dead-src rescue writes the manifest-proven still directly.
    vfImg.setAttribute(MEDIA_ATTRS.SRC, `${CDN_URLS.CDN_BASE}proj/clip${MEDIA.VIDEO_THUMB_EXT}`)
    Object.defineProperty(vfImg, 'complete', { value: true, configurable: true })
    Object.defineProperty(vfImg, 'naturalWidth', { value: 0, configurable: true })
    vfShadow.appendChild(vfImg)
    vfShadow.appendChild(document.createElement(HTML_TAGS.VIDEO))
    document.body.appendChild(vidFig2)

    fireBeforePrint()

    expect(vfImg.getAttribute(MEDIA_ATTRS.SRC).endsWith(`clip${MEDIA.VIDEO_EXT}${MEDIA.EXT}`)).toBe(
      true
    )

    fireAfterPrint()
  })

  test('video-hero internal figure fronts the cover with its proven still', () => {
    mkArticle()

    // Hero plate context — the figure lives in .internal-main and its
    // stem has no image ladder, only the emitted video still.
    const main = document.createElement(HTML_TAGS.DIV)

    main.className = INTERNAL_CLASSES.INTERNAL_MAIN

    const fig = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    fig.setAttribute(MEDIA_ATTRS.SRC, 'proj/clip')
    fig.setAttribute(MEDIA_ATTRS.IS_VIDEO, ATTR_VALUES.TRUE)

    const figShadow = fig.attachShadow({ mode: COMMON_ATTRS.OPEN })

    figShadow.appendChild(document.createElement(HTML_TAGS.VIDEO))
    main.appendChild(fig)
    document.body.appendChild(main)

    fireBeforePrint()

    const portrait = document.querySelector(`.${PRINT_CLASSES.COVER_PHOTO}`)

    expect(portrait).toBeTruthy()
    expect(portrait.src.endsWith(`clip${MEDIA.VIDEO_EXT}${MEDIA.EXT}`)).toBe(true)

    fireAfterPrint()
  })
})
