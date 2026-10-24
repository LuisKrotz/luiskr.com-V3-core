/**
 * @file print-tails.test.js
 * @description Coverage for core/utils/print/print.ts — the beforeprint/
 * afterprint DOM adapter. Covers the install guard, the native-event and
 * matchMedia entry channels, the enter/exit reentry guards, the dark-theme
 * swap, every media-surface swap path (canvas via printcapture answer,
 * canvas via preserved-buffer toDataURL, canvas capture failure, poster
 * video, poster-less video, article-image upgrade), copy placement
 * (in-article, shadow → article append, no-article → body append), and the
 * attribute restoration arms (recorded value vs absent → removeAttribute).
 */
import { initPrintSupport } from '@core/utils/print/print.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { PRINT_CLASSES } from '@core/tokens/classes/print.js'
import { READER_CLASSES } from '@core/tokens/classes/reader.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { CLIPBOARD_EVENTS, FORM_EVENTS, PRINT_EVENTS } from '@core/tokens/events/dom.js'
import { MEDIA_QUERIES } from '@core/tokens/primitives.js'

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
  let origMatchMedia

  beforeAll(() => {
    origMatchMedia = window.matchMedia

    // Capture the change listener so both matches arms can be driven.
    window.matchMedia = (query) => ({
      matches: false,
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
  })

  afterAll(() => {
    window.matchMedia = origMatchMedia
  })

  afterEach(() => {
    // Never leak a "still printing" state (or stray nodes) across tests.
    fireAfterPrint()

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

    shadow.appendChild(shCanvas)
    document.body.appendChild(host)

    // Video with a poster → poster still; without → left alone.
    const poster = document.createElement(HTML_TAGS.VIDEO)

    poster.setAttribute(MEDIA_ATTRS.POSTER, 'https://cdn.example/x.jpg')

    const bare = document.createElement(HTML_TAGS.VIDEO)

    article.appendChild(poster)
    article.appendChild(bare)

    // Lazy article image upgrades; one keeps a recorded attr to restore.
    const lazy = document.createElement(HTML_TAGS.IMG)

    lazy.setAttribute(MEDIA_ATTRS.LOADING, MEDIA_ATTRS.LOADING_LAZY)

    const plain = document.createElement(HTML_TAGS.IMG)

    article.appendChild(lazy)
    article.appendChild(plain)

    // An image outside the article stays untouched — only the mirror's
    // media upgrades.
    const stray = document.createElement(HTML_TAGS.IMG)

    document.body.appendChild(stray)

    fireBeforePrint()

    const copies = article.querySelectorAll(`.${PRINT_CLASSES.COPY}`)

    // inCanvas img + shadow img + poster img = 3 stand-ins.
    expect(copies).toHaveLength(3)
    expect(inCanvas.nextElementSibling.classList.contains(PRINT_CLASSES.COPY)).toBe(true)
    expect(article.querySelector(`img[src$="SH=="]`)).toBeTruthy()
    expect(article.querySelector(`img[src="https://cdn.example/x.jpg"]`)).toBeTruthy()

    expect(lazy.getAttribute(MEDIA_ATTRS.LOADING)).toBe(MEDIA_ATTRS.LOADING_EAGER)
    expect(lazy.getAttribute(MEDIA_ATTRS.FETCH_PRIORITY)).toBe(MEDIA_ATTRS.FETCH_PRIORITY_HIGH)
    expect(lazy.getAttribute(MEDIA_ATTRS.DECODING)).toBe(MEDIA_ATTRS.DECODING_SYNC)

    expect(stray.getAttribute(MEDIA_ATTRS.LOADING)).toBeNull()

    expect(document.documentElement.classList.contains(STATE_CLASSES.DARK_MODE)).toBe(false)

    fireAfterPrint()

    expect(article.querySelector(`.${PRINT_CLASSES.COPY}`)).toBeNull()
    expect(lazy.getAttribute(MEDIA_ATTRS.LOADING)).toBe(MEDIA_ATTRS.LOADING_LAZY)
    expect(plain.getAttribute(MEDIA_ATTRS.LOADING)).toBeNull()
    expect(document.documentElement.classList.contains(STATE_CLASSES.DARK_MODE)).toBe(true)
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
    const canvas = document.createElement(HTML_TAGS.CANVAS)

    canvas.toDataURL = () => 'data:image/png;base64,MQ=='

    document.body.appendChild(canvas)

    mqlListener({ matches: true })

    expect(document.querySelector(`.${PRINT_CLASSES.COPY}`)).toBeTruthy()

    mqlListener({ matches: false })

    expect(document.querySelector(`.${PRINT_CLASSES.COPY}`)).toBeNull()
  })
})
