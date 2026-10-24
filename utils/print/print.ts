/**
 * @file utils/print/print.ts
 * @description Print-mode DOM adapter. `beforeprint` (and the matchMedia
 * print channel, which covers engines where the event never fires) flips the
 * document into its printable form: the prerendered reader article becomes
 * the visible surface (the print sheet hides the live app chrome), lazy
 * media upgrades to eager/high-priority so everything resolves before the
 * snapshot, videos stand in as their poster stills, and canvases swap for a
 * captured PNG — engines that clear their buffer answer the `printcapture`
 * request event, preserveDrawingBuffer surfaces answer `toDataURL` directly.
 * `afterprint` walks the swap back down: injected stand-ins are removed and
 * every mutated attribute is restored to its recorded value.
 */

import { devWarn } from '@core/devlog.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { PRINT_CLASSES } from '@core/tokens/classes/print.js'
import { READER_CLASSES } from '@core/tokens/classes/reader.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { CLIPBOARD_EVENTS, FORM_EVENTS, PRINT_EVENTS } from '@core/tokens/events/dom.js'
import { MEDIA_QUERIES } from '@core/tokens/primitives.js'
import { NET_STRINGS } from '@core/tokens/strings/net.js'

/** Elements whose attributes were mutated — restored verbatim on exit. */
const touched = new Map<Element, Map<string, string | null>>()

/** Live canvas/video elements marked `print-src` — class removed on exit. */
const marked: Element[] = []

/** Injected `.print-copy` stand-ins — removed on exit. */
const copies: Element[] = []

/** True while the printable form is applied — re-entry is a no-op. */
let printing = false

/** Theme class state captured on entry so exit can put it back. */
let darkWasOn = false

/** Module install guard — the boot path may run more than once in tests. */
let installed = false

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
  // can always record the pristine value.
  bag.set(name, el.getAttribute(name))
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
  const media = root.querySelectorAll(`${HTML_TAGS.CANVAS},${HTML_TAGS.VIDEO},${HTML_TAGS.IMG}`)

  for (const el of media) yield el

  const hosts = root.querySelectorAll('*')

  for (const el of hosts) {
    if (el.shadowRoot) yield* walkMedia(el.shadowRoot)
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
  const detail: { dataUrl?: string } = {}

  canvas.dispatchEvent(new CustomEvent(PRINT_EVENTS.CAPTURE, { detail }))

  if (detail.dataUrl) return detail.dataUrl

  try {
    return canvas.toDataURL(NET_STRINGS.IMAGE_PNG)
  } catch (err) {
    devWarn('print: canvas capture failed', err)

    return ''
  }
}

/**
 * Places a stand-in where it will actually print. Stand-ins for surfaces
 * inside the reader article replace in place; stand-ins for surfaces inside
 * the app chrome (which the print sheet hides) move into the article — or,
 * on routes without one, onto <body> so three.js pages still print their
 * scene still.
 * @param src Live element being replaced.
 * @param copy Injected stand-in element.
 */
const placeCopy = (src: Element, copy: HTMLElement): void => {
  const article = document.querySelector(`${HTML_TAGS.ARTICLE}.${READER_CLASSES.CONTENT}`)

  if (article?.contains(src)) {
    src.after(copy)

    return
  }

  ;(article ?? document.body).appendChild(copy)
}

/**
 * Injects a `.print-copy` stand-in after/alongside `src` and tags `src` so
 * the print sheet hides the live version.
 * @param src Live element (canvas or video).
 * @param url Image URL the stand-in renders.
 */
const swapInCopy = (src: Element, url: string): void => {
  const img = document.createElement(HTML_TAGS.IMG)

  img.className = PRINT_CLASSES.COPY
  img.alt = ''
  img.src = url
  writeAttr(img, MEDIA_ATTRS.DECODING, MEDIA_ATTRS.DECODING_SYNC)

  placeCopy(src, img)

  copies.push(img)

  src.classList.add(PRINT_CLASSES.SRC)

  marked.push(src)
}

/**
 * Upgrades a lazy/deferred article image so it actually resolves before the
 * print snapshot: eager loading, high fetch priority, synchronous decode.
 * @param img Article image element.
 */
const upgradeImage = (img: HTMLImageElement): void => {
  writeAttr(img, MEDIA_ATTRS.LOADING, MEDIA_ATTRS.LOADING_EAGER)
  writeAttr(img, MEDIA_ATTRS.FETCH_PRIORITY, MEDIA_ATTRS.FETCH_PRIORITY_HIGH)
  writeAttr(img, MEDIA_ATTRS.DECODING, MEDIA_ATTRS.DECODING_SYNC)
}

/**
 * Swaps a video for its poster still — printers rasterize neither the
 * element nor its first frame, so the poster is the highest-quality
 * printable representation the pipeline ships.
 * @param video Video element.
 */
const swapVideo = (video: HTMLVideoElement): void => {
  const poster = video.getAttribute(MEDIA_ATTRS.POSTER)

  if (poster) swapInCopy(video, poster)
}

/**
 * The printable form: fires `printprepare` first so views can sync their
 * generated DOM (docs rendered diagrams) into the reader mirror, then drops
 * the dark theme for ink-friendly light tokens, then walks every media
 * surface — canvases become captured stills, poster-carrying videos become
 * images, and lazy article images upgrade to eager/high so they resolve in
 * time.
 */
const enter = (): void => {
  if (printing) return

  printing = true

  window.dispatchEvent(new Event(PRINT_EVENTS.PREPARE))

  const html = document.documentElement

  darkWasOn = html.classList.contains(STATE_CLASSES.DARK_MODE)

  if (darkWasOn) html.classList.remove(STATE_CLASSES.DARK_MODE)

  const article = document.querySelector(`${HTML_TAGS.ARTICLE}.${READER_CLASSES.CONTENT}`)

  for (const el of walkMedia(document)) {
    if (el.tagName === HTML_TAGS.CANVAS.toUpperCase()) {
      const url = captureCanvas(el as HTMLCanvasElement)

      if (url) swapInCopy(el, url)
    } else if (el.tagName === HTML_TAGS.VIDEO.toUpperCase()) {
      swapVideo(el as HTMLVideoElement)
    } else if (article?.contains(el)) {
      upgradeImage(el as HTMLImageElement)
    }
  }
}

/**
 * Tears the printable form down: stand-ins are removed, `print-src` tags
 * drop, every mutated attribute restores its recorded value (or removal),
 * and the dark theme returns if it was on.
 */
const exit = (): void => {
  if (!printing) return

  printing = false

  for (const copy of copies) copy.remove()

  copies.length = 0

  for (const el of marked) el.classList.remove(PRINT_CLASSES.SRC)

  marked.length = 0

  for (const [el, bag] of touched) {
    for (const [name, value] of bag) {
      if (value === null) el.removeAttribute(name)
      else el.setAttribute(name, value)
    }
  }

  touched.clear()

  if (darkWasOn) document.documentElement.classList.add(STATE_CLASSES.DARK_MODE)

  darkWasOn = false
}

/**
 * Installs the print hooks once: the native before/afterprint pair plus the
 * matchMedia('print') change channel — some engines skip the events but
 * always flip the media query, so both paths feed the same enter/exit.
 */
export const initPrintSupport = (): void => {
  if (installed) return

  installed = true

  window.addEventListener(CLIPBOARD_EVENTS.BEFORE_PRINT, enter)
  window.addEventListener(CLIPBOARD_EVENTS.AFTER_PRINT, exit)

  window.matchMedia(MEDIA_QUERIES.PRINT).addEventListener(FORM_EVENTS.CHANGE, (e) => {
    if (e.matches) enter()
    else exit()
  })
}
