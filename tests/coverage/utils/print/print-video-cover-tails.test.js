/**
 * @file print-video-cover-tails.test.js
 * @description Coverage for core/utils/print/print.ts video arms that the
 * main tails never reach: printImageUrl's figure-video branch (live frame,
 * missing video element, unproven still), captureVideoFrame's non-data-URL
 * rejection, swapVideo's unproven-still retire, and the cover portrait's
 * in-plate video pick (hoisted `.print-plate-internal` figures with no
 * injected copy — the `stemTopUrl`-empty video ladder).
 */
import { initPrintSupport } from '@core/utils/print/print.js'
import { initMediaManifest } from '@core/utils/media/manifest.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { PRINT_CLASSES } from '@core/tokens/classes/print.js'
import { READER_CLASSES } from '@core/tokens/classes/reader.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { CLIPBOARD_EVENTS, FORM_EVENTS } from '@core/tokens/events/dom.js'
import { INTERNAL_CLASSES } from '@core/tokens/classes/project.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { CDN_URLS } from '@core/tokens/media/urls.js'

/** Bucket keys the stubbed manifest claims exist — `proj/clip` carries only
 *  its emitted video still, exactly the "no image ladder" case the cover
 *  pick's video arm exists for. `proj/novid*` stems stay unproven so their
 *  `.mp4.jpg` guesses resolve ''. */
const MANIFEST_KEYS = [`proj/clip${MEDIA.VIDEO_EXT}${MEDIA.EXT}`]

/** Dispatches the native beforeprint event the module listens for. */
const fireBeforePrint = () => window.dispatchEvent(new window.Event(CLIPBOARD_EVENTS.BEFORE_PRINT))

/** Dispatches the native afterprint event the module listens for. */
const fireAfterPrint = () => window.dispatchEvent(new window.Event(CLIPBOARD_EVENTS.AFTER_PRINT))

/** Builds a reader mirror article in <body>. */
const mkArticle = () => {
  const article = document.createElement(HTML_TAGS.ARTICLE)

  article.className = READER_CLASSES.CONTENT
  document.body.appendChild(article)

  return article
}

/** Figure + open shadow, ready for media children. */
const mkVideoFigure = (src, attrs = {}) => {
  const fig = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

  fig.setAttribute(MEDIA_ATTRS.SRC, src)

  for (const [k, v] of Object.entries(attrs)) fig.setAttribute(k, v)

  return { fig, shadow: fig.attachShadow({ mode: COMMON_ATTRS.OPEN }) }
}

/** Img stamped as decoded-but-dead — `complete` with zero natural width is
 *  `currentDead` under the swap gate, so a proven `best` always writes. */
const mkImg = (src) => {
  const img = document.createElement(HTML_TAGS.IMG)

  img.setAttribute(MEDIA_ATTRS.SRC, src)
  Object.defineProperty(img, 'complete', { value: true, configurable: true })
  Object.defineProperty(img, 'naturalWidth', { value: 0, configurable: true })
  Object.defineProperty(img, 'naturalHeight', { value: 64, configurable: true })

  return img
}

/** Video element stamped as decoded — readyState/videoWidth prove a frame stands. */
const mkPlayedVideo = (attrs = {}) => {
  const video = document.createElement(HTML_TAGS.VIDEO)

  for (const [k, v] of Object.entries(attrs)) video.setAttribute(k, v)

  Object.defineProperty(video, 'readyState', { value: 2, configurable: true })
  Object.defineProperty(video, 'videoWidth', { value: 640, configurable: true })
  Object.defineProperty(video, 'videoHeight', { value: 360, configurable: true })

  return video
}

/** `.internal-main` block with a single figure — the hero context whose
 *  plate-internal hoist the cover pick's second pass reads. */
const mkInternalHero = (fig) => {
  const main = document.createElement(HTML_TAGS.DIV)

  main.className = INTERNAL_CLASSES.INTERNAL_MAIN
  main.appendChild(fig)
  document.body.appendChild(main)

  return main
}

describe('print video + cover tails', () => {
  let mqlListener = null
  let origMatchMedia

  beforeAll(async () => {
    origMatchMedia = window.matchMedia

    window.matchMedia = (query) => ({
      get matches() {
        return false
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

    initPrintSupport()

    expect(mqlListener).toBeInstanceOf(Function)
  })

  afterAll(() => {
    window.matchMedia = origMatchMedia
  })

  afterEach(() => {
    fireAfterPrint()
    document.body.replaceChildren()
    document.documentElement.classList.remove(STATE_CLASSES.DARK_MODE)
  })

  test('figure video arm — decoded frame wins; no video or unproven still keeps the layer src', () => {
    const article = mkArticle()
    const canvasProto = Object.getPrototypeOf(document.createElement(HTML_TAGS.CANVAS))
    const realGetContext = canvasProto.getContext
    const realToDataURL = canvasProto.toDataURL

    canvasProto.getContext = () => ({ drawImage: () => {} })
    canvasProto.toDataURL = () => 'data:image/png;base64,FRAME=='

    // Played shadow video → printImageUrl returns the live frame.
    const { fig: figFrame, shadow: shFrame } = mkVideoFigure('proj/clip', {
      [MEDIA_ATTRS.IS_VIDEO]: ATTR_VALUES.TRUE,
    })
    const layerFrame = mkImg(`${CDN_URLS.CDN_BASE}proj/clip${MEDIA.THUMB_EXT}`)

    shFrame.appendChild(layerFrame)
    shFrame.appendChild(mkPlayedVideo())
    article.appendChild(figFrame)

    // Cold figure with no <video> element → falls to the proven still.
    const { fig: figNoVid, shadow: shNoVid } = mkVideoFigure('proj/clip', {
      [MEDIA_ATTRS.IS_VIDEO]: ATTR_VALUES.TRUE,
    })
    const layerStill = mkImg(`${CDN_URLS.CDN_BASE}proj/clip${MEDIA.THUMB_EXT}`)

    shNoVid.appendChild(layerStill)
    article.appendChild(figNoVid)

    // Unproven still → '' keeps whatever src the layer already stands.
    const { fig: figCold, shadow: shCold } = mkVideoFigure('proj/novid', {
      [MEDIA_ATTRS.IS_VIDEO]: ATTR_VALUES.TRUE,
    })
    const layerCold = mkImg(`${CDN_URLS.CDN_BASE}proj/novid${MEDIA.THUMB_EXT}`)

    shCold.appendChild(layerCold)
    article.appendChild(figCold)

    // Shadow video with no img layer and an unproven still → the video
    // retires outright (nothing printable to swap in).
    const { fig: figDead, shadow: shDead } = mkVideoFigure('proj/novid2', {
      [MEDIA_ATTRS.IS_VIDEO]: ATTR_VALUES.TRUE,
    })
    const deadVideo = document.createElement(HTML_TAGS.VIDEO)

    shDead.appendChild(deadVideo)
    article.appendChild(figDead)

    try {
      fireBeforePrint()

      expect(layerFrame.getAttribute(MEDIA_ATTRS.SRC)).toBe('data:image/png;base64,FRAME==')
      expect(
        layerStill.getAttribute(MEDIA_ATTRS.SRC).endsWith(`clip${MEDIA.VIDEO_EXT}${MEDIA.EXT}`)
      ).toBe(true)
      expect(layerCold.getAttribute(MEDIA_ATTRS.SRC)).toBe(
        `${CDN_URLS.CDN_BASE}proj/novid${MEDIA.THUMB_EXT}`
      )
      expect(deadVideo.classList.contains(PRINT_CLASSES.SRC)).toBe(true)
    } finally {
      fireAfterPrint()
      canvasProto.getContext = realGetContext
      canvasProto.toDataURL = realToDataURL
    }
  })

  test('a canvas answer that is not a data URL keeps the video on its still chain', () => {
    const article = mkArticle()
    const canvasProto = Object.getPrototypeOf(document.createElement(HTML_TAGS.CANVAS))
    const realGetContext = canvasProto.getContext
    const realToDataURL = canvasProto.toDataURL

    canvasProto.getContext = () => ({ drawImage: () => {} })
    canvasProto.toDataURL = () => 'blob:null/deadbeef'

    const played = mkPlayedVideo({ [MEDIA_ATTRS.SRC]: 'https://cdn.example/played.mp4' })

    article.appendChild(played)

    try {
      fireBeforePrint()

      // No poster, unproven derived still → the dead box retires.
      expect(played.classList.contains(PRINT_CLASSES.SRC)).toBe(true)
    } finally {
      fireAfterPrint()
      canvasProto.getContext = realGetContext
      canvasProto.toDataURL = realToDataURL
    }
  })

  test('cover pick reads the hoisted video figure: still when no frame stands, data URL when one does', () => {
    const canvasProto = Object.getPrototypeOf(document.createElement(HTML_TAGS.CANVAS))
    const realGetContext = canvasProto.getContext
    const realToDataURL = canvasProto.toDataURL

    canvasProto.getContext = () => ({ drawImage: () => {} })
    canvasProto.toDataURL = () => 'data:image/png;base64,PLAY=='

    // No <video> in the shadow: the pick falls to the manifest-proven
    // `stem.mp4.jpg` — the only printable tier a video stem has.
    const { fig: figStill, shadow: shStill } = mkVideoFigure('proj/clip', {
      [MEDIA_ATTRS.IS_VIDEO]: ATTR_VALUES.TRUE,
    })

    shStill.appendChild(mkImg(`${CDN_URLS.CDN_BASE}proj/clip${MEDIA.THUMB_EXT}`))
    mkInternalHero(figStill)

    try {
      fireBeforePrint()

      const portrait = document.querySelector(`.${PRINT_CLASSES.COVER_PHOTO}`)

      expect(portrait).toBeTruthy()
      expect(portrait.src.endsWith(`clip${MEDIA.VIDEO_EXT}${MEDIA.EXT}`)).toBe(true)
    } finally {
      fireAfterPrint()
    }

    document.body.replaceChildren()

    // A played video inside the shadow: hasStill retires the element in
    // the swap (no injected copy), then the cover pick captures the live
    // frame — the data URL beats every emitted still.
    const { fig: figPlay, shadow: shPlay } = mkVideoFigure('proj/novid3', {
      [MEDIA_ATTRS.IS_VIDEO]: ATTR_VALUES.TRUE,
    })

    shPlay.appendChild(mkImg(`${CDN_URLS.CDN_BASE}proj/novid3${MEDIA.THUMB_EXT}`))
    shPlay.appendChild(mkPlayedVideo())
    mkInternalHero(figPlay)

    try {
      fireBeforePrint()

      const portrait = document.querySelector(`.${PRINT_CLASSES.COVER_PHOTO}`)

      expect(portrait).toBeTruthy()
      expect(portrait.src).toBe('data:image/png;base64,PLAY==')
    } finally {
      fireAfterPrint()
      canvasProto.getContext = realGetContext
      canvasProto.toDataURL = realToDataURL
    }
  })

  test('cover pick falls through when the video figure proves nothing, and skips non-video arms', () => {
    // Unproven stem + cold video + unproven still → no cover photo.
    const { fig: figEmpty, shadow: shEmpty } = mkVideoFigure('proj/novid4', {
      [MEDIA_ATTRS.IS_VIDEO]: ATTR_VALUES.TRUE,
    })

    shEmpty.appendChild(document.createElement(HTML_TAGS.VIDEO))
    mkInternalHero(figEmpty)

    fireBeforePrint()

    expect(document.querySelector(`.${PRINT_CLASSES.COVER_PHOTO}`)).toBeNull()

    fireAfterPrint()
    document.body.replaceChildren()

    // Unproven stem without the is-video attribute → the video guard's
    // hasAttribute operand declines.
    const { fig: figPlain, shadow: shPlain } = mkVideoFigure('proj/novid5')

    shPlain.appendChild(mkImg(`${CDN_URLS.CDN_BASE}proj/novid5${MEDIA.THUMB_EXT}`))
    mkInternalHero(figPlain)

    fireBeforePrint()

    expect(document.querySelector(`.${PRINT_CLASSES.COVER_PHOTO}`)).toBeNull()

    fireAfterPrint()
    document.body.replaceChildren()

    // is-video="false" → the value guard declines.
    const { fig: figFalse, shadow: shFalse } = mkVideoFigure('proj/novid6', {
      [MEDIA_ATTRS.IS_VIDEO]: ATTR_VALUES.FALSE,
    })

    shFalse.appendChild(mkImg(`${CDN_URLS.CDN_BASE}proj/novid6${MEDIA.THUMB_EXT}`))
    mkInternalHero(figFalse)

    fireBeforePrint()

    expect(document.querySelector(`.${PRINT_CLASSES.COVER_PHOTO}`)).toBeNull()

    fireAfterPrint()
  })
})
