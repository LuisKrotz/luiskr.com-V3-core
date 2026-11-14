/**
 * @file print-gate-tails.test.js
 * @description Coverage for core/utils/print/print.ts — the gated print
 * entry (runPrintJob). The Ctrl/Cmd+P chord and the window.print wrap
 * both route through the decode barrier: prep runs synchronously (media
 * swaps, hidden nodes), the real dialog waits on every kicked
 * fetch/decode + pending fonts, and only then does commit strip the
 * screen-visible state (dark theme, inline styles) and call the native
 * print. Covers the chord's always-prevent, the deferred strip + theme
 * drop ordering, the job-running dedupe, the cover-only single-sheet
 * arm, the already-printing refresh arm, and the refreshMedia
 * style-strip on late-mounted media.
 */
import { jest } from '@jest/globals'
import { initPrintSupport } from '@core/utils/print/print.js'
import { initMediaManifest } from '@core/utils/media/manifest.js'
import router from '@core/router/router.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { LINK_ATTRS } from '@core/tokens/attrs/link.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { CLIPBOARD_EVENTS, KEYBOARD_EVENTS } from '@core/tokens/events/dom.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { APP_IDS } from '@core/tokens/ids/app.js'
import { KEYS } from '@core/tokens/primitives.js'
import { ROUTE_NAMES } from '@core/tokens/routes/names.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'
import { PRINT_CLASSES } from '@core/tokens/classes/print.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { PRINT_TIMING } from '@core/tokens/motion/print.js'

/** Dispatches the native beforeprint event the module listens for. */
const fireBeforePrint = () => window.dispatchEvent(new window.Event(CLIPBOARD_EVENTS.BEFORE_PRINT))

/** Dispatches the native afterprint event the module listens for. */
const fireAfterPrint = () => window.dispatchEvent(new window.Event(CLIPBOARD_EVENTS.AFTER_PRINT))

/**
 * Builds a Ctrl+P keydown the chord listener intercepts. The env's
 * KeyboardEvent is a mock that drops modifier props, so the event is a
 * plain cancelable Event carrying the two fields the listener reads —
 * the same shape the real chord dispatches.
 */
const ctrlP = () => {
  const evt = new window.Event(KEYBOARD_EVENTS.KEYDOWN, {
    bubbles: true,
    cancelable: true,
  })

  evt.key = KEYS.KEY_P
  evt.ctrlKey = true

  return evt
}

/** Flushes the runPrintJob continuation past its allSettled await. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

/**
 * A media element inside #app — the img-eligibility gate — whose decode
 * the test resolves by hand so the barrier's ordering is observable.
 */
const appImg = () => {
  const shell = document.createElement(HTML_TAGS.DIV)

  shell.id = APP_IDS.APP

  const img = document.createElement(HTML_TAGS.IMG)

  img.setAttribute(MEDIA_ATTRS.SRC, `https://cdn.example/gated${MEDIA.EXT}`)

  shell.appendChild(img)
  document.body.appendChild(shell)

  return img
}

describe('print gate tails', () => {
  let origMatchMedia
  let nativePrint
  let origPrint

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
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })

    const realFetch = globalThis.fetch

    globalThis.fetch = () =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            `https://cdn.example/gated${MEDIA.EXT}`,
            // Rung ladders for the print-upgrade paths — `wall` is a full
            // four-tier stem (a small box caps below the multi-megabyte
            // top), `two` a two-tier stem (the skip count clamps at the
            // floor rung), `dem` a three-tier stem with no original (the
            // decode-failure demotion walks it top → floor).
            `https://cdn.example/wall${MEDIA.EXT}`,
            `https://cdn.example/wall${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`,
            `https://cdn.example/wall${MEDIA.MOZ}${MEDIA.Q75}${MEDIA.EXT}`,
            `https://cdn.example/wall${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`,
            `https://cdn.example/two${MEDIA.EXT}`,
            `https://cdn.example/two${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`,
            `https://cdn.example/dem${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`,
            `https://cdn.example/dem${MEDIA.MOZ}${MEDIA.Q75}${MEDIA.EXT}`,
            `https://cdn.example/dem${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`,
          ]),
      })

    await initMediaManifest()

    globalThis.fetch = realFetch

    // happy-dom ships no window.print — the install wraps whatever the
    // bind sees, so the spy must be in place BEFORE init runs or the
    // gated entry's nativePrint target never exists.
    origPrint = window.print
    nativePrint = jest.fn()
    window.print = nativePrint

    initPrintSupport()
  })

  afterAll(() => {
    window.matchMedia = origMatchMedia
    window.print = origPrint
  })

  afterEach(() => {
    fireAfterPrint()

    document.body.replaceChildren()

    document.documentElement.classList.remove(STATE_CLASSES.DARK_MODE)

    router.currentRoute = null
    // mockReset, not mockClear — the throw-impl test's mockImplementation
    // must not leak into later jobs.
    nativePrint.mockReset()
  })

  test('Ctrl+P prevents the chord, runs the gated job, calls native print', async () => {
    appImg()

    const evt = ctrlP()

    window.dispatchEvent(evt)

    expect(evt.defaultPrevented).toBe(true)

    await flush()

    expect(nativePrint).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.print-cover')).toBeTruthy()

    // The job committed — afterprint restores the app state.
    fireAfterPrint()

    expect(document.querySelector('.print-cover')).toBeNull()
  })

  test('the barrier defers the style strip + theme drop until decodes settle', async () => {
    document.documentElement.classList.add(STATE_CLASSES.DARK_MODE)

    const img = appImg()

    img.setAttribute(COMMON_ATTRS.STYLE, 'opacity: 0.5')

    let resolveDecode

    img.decode = () =>
      new Promise((resolve) => {
        resolveDecode = resolve
      })

    window.dispatchEvent(ctrlP())

    // Prep ran: the src upgraded + the decode is queued — but the
    // screen-visible state (inline style, dark class) survives because
    // commit waits on the barrier.
    await flush()

    expect(img.getAttribute(COMMON_ATTRS.STYLE)).toBe('opacity: 0.5')
    expect(document.documentElement.classList.contains(STATE_CLASSES.DARK_MODE)).toBe(true)
    expect(nativePrint).not.toHaveBeenCalled()

    resolveDecode()
    await flush()

    // Barrier settled → commit stripped the visible state, then print.
    expect(img.hasAttribute(COMMON_ATTRS.STYLE)).toBe(false)
    expect(document.documentElement.classList.contains(STATE_CLASSES.DARK_MODE)).toBe(false)
    expect(nativePrint).toHaveBeenCalledTimes(1)
  })

  test('window.print routes through the same gated job', async () => {
    appImg()

    window.print()

    await flush()

    expect(nativePrint).toHaveBeenCalledTimes(1)
  })

  test('a second trigger during the decode wait joins silently', async () => {
    const img = appImg()

    let resolveDecode

    img.decode = () =>
      new Promise((resolve) => {
        resolveDecode = resolve
      })

    window.print()
    window.print()

    await flush()

    // The dedupe ran while the first job sat on the barrier — one
    // dialog, not two.
    expect(nativePrint).not.toHaveBeenCalled()

    resolveDecode()
    await flush()

    expect(nativePrint).toHaveBeenCalledTimes(1)
  })

  test('a cover-only route prints exactly the black cover sheet', async () => {
    router.currentRoute = { name: ROUTE_NAMES.SEARCH }

    const evt = ctrlP()

    window.dispatchEvent(evt)

    expect(evt.defaultPrevented).toBe(true)

    window.print()

    await flush()

    // The gated job ran to the dialog — deduped into the chord's.
    expect(nativePrint).toHaveBeenCalledTimes(1)

    // Exactly one sheet: the black cover carrying the site scan code +
    // the printed home link. No cover/face/contents, no page content.
    const back = document.querySelector(`.${PRINT_CLASSES.BACK}`)

    expect(back).toBeTruthy()
    expect(document.querySelector(`.${PRINT_CLASSES.COVER}`)).toBeNull()
    expect(document.querySelector(`.${PRINT_CLASSES.FACE}`)).toBeNull()
    expect(document.querySelector(`.${PRINT_CLASSES.TOC}`)).toBeNull()
    expect(document.querySelector(`.${PRINT_CLASSES.QR_LINK}`)).toBeNull()
    expect(document.querySelector(`.${PRINT_CLASSES.CAPTION}`)).toBeNull()
    expect(document.documentElement.classList.contains(PRINT_CLASSES.COVER_ONLY)).toBe(true)

    const qr = back.querySelector(`.${PRINT_CLASSES.BACK_QR}`)

    expect(qr?.querySelector('svg')).toBeTruthy()
    expect(qr?.getAttribute(LINK_ATTRS.HREF)).toBe(`${window.location.origin}/`)

    const home = back.querySelector(`.${PRINT_CLASSES.BACK_HOME}`)

    expect(home?.getAttribute(LINK_ATTRS.HREF)).toBe(`${window.location.origin}/`)
    expect(home?.textContent).toBe(window.location.host)

    // Nothing else rides the sheet — the copyright line stays out.
    expect(back.querySelector(`.${PRINT_CLASSES.BACK_COPY}`)).toBeNull()

    fireAfterPrint()

    expect(document.documentElement.classList.contains(PRINT_CLASSES.COVER_ONLY)).toBe(false)
    expect(document.querySelector(`.${PRINT_CLASSES.BACK}`)).toBeNull()
  })

  test('a beforeprint on a cover-only route emits the same single sheet', () => {
    router.currentRoute = { name: ROUTE_NAMES.NOT_FOUND }

    fireBeforePrint()

    const back = document.querySelector(`.${PRINT_CLASSES.BACK}`)

    expect(back).toBeTruthy()
    expect(back.querySelector(`.${PRINT_CLASSES.BACK_QR}`)).toBeTruthy()
    expect(back.querySelector(`.${PRINT_CLASSES.BACK_HOME}`)).toBeTruthy()
    expect(document.querySelector(`.${PRINT_CLASSES.COVER}`)).toBeNull()
    expect(document.documentElement.classList.contains(PRINT_CLASSES.COVER_ONLY)).toBe(true)
  })

  test('a cover-only sheet keeps its home link when the origin exceeds QR capacity', () => {
    router.currentRoute = { name: ROUTE_NAMES.NOT_FOUND }

    const startUrl = window.location.href

    // An overlong origin can't encode at v40-M — the scan code drops but
    // the printed home link always stands.
    window.happyDOM?.setURL?.(`http://${'a'.repeat(2400)}/`)

    fireBeforePrint()

    const back = document.querySelector(`.${PRINT_CLASSES.BACK}`)

    expect(back).toBeTruthy()
    expect(back.querySelector(`.${PRINT_CLASSES.BACK_QR}`)).toBeNull()
    expect(back.querySelector(`.${PRINT_CLASSES.BACK_HOME}`)).toBeTruthy()

    window.happyDOM?.setURL?.(startUrl)

    fireAfterPrint()
  })

  test('the settle climbs figures through their loadHighRes kick', async () => {
    const fig = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)
    const idle = document.createElement(COMPONENT_TAGS.MEDIA_FIGURE)

    // A rejected climb is swallowed — a stalled fetch can't hold the
    // job; a host that can't climb at all returns no promise to await.
    fig.loadHighRes = jest.fn(() => Promise.reject(new Error('climb stalled')))

    document.body.append(fig, idle)

    window.print()

    await flush()

    // The gated settle climbed the figure before opening the dialog.
    expect(fig.loadHighRes).toHaveBeenCalled()
    expect(nativePrint).toHaveBeenCalledTimes(1)
  })

  test('a live job refreshes media instead of stacking a second dialog', async () => {
    fireBeforePrint()

    expect(document.querySelector('.print-cover')).toBeTruthy()

    window.print()
    window.dispatchEvent(ctrlP())

    await flush()

    expect(nativePrint).not.toHaveBeenCalled()
  })

  test('refreshMedia strips styles on media mounted after commit', async () => {
    fireBeforePrint()

    const img = appImg()

    img.setAttribute(COMMON_ATTRS.STYLE, 'opacity: 0.5')

    fireBeforePrint()

    // The re-entry pass already committed — a fresh clone's screen
    // style strips immediately, not queued behind a second commit.
    expect(img.hasAttribute(COMMON_ATTRS.STYLE)).toBe(false)
  })

  test('a prep failure unwinds the job and never reaches native print', async () => {
    document.documentElement.classList.add(STATE_CLASSES.DARK_MODE)

    appImg()

    const origPrepend = document.body.prepend

    document.body.prepend = () => {
      throw new Error('prep boom')
    }

    try {
      window.print()

      await flush()
    } finally {
      document.body.prepend = origPrepend
    }

    // No dialog, no commit — the partial prep unwound and the theme
    // stayed. The old finally-armed commit stripped both anyway and no
    // afterprint ever arrived to undo it.
    expect(nativePrint).not.toHaveBeenCalled()
    expect(document.documentElement.classList.contains(STATE_CLASSES.DARK_MODE)).toBe(true)
    expect(document.querySelector(`.${PRINT_CLASSES.COPY}`)).toBeNull()

    // The latch cleared — the next gated job runs to the dialog.
    window.print()

    await flush()

    expect(nativePrint).toHaveBeenCalledTimes(1)

    fireAfterPrint()
  })

  test('a nativePrint throw unwinds the committed print state', async () => {
    document.documentElement.classList.add(STATE_CLASSES.DARK_MODE)

    appImg()

    nativePrint.mockImplementation(() => {
      throw new Error('no dialog')
    })

    window.print()

    await flush()

    // The dialog never opened — no afterprint can arrive, so the job
    // unwound by hand: theme back, covers gone.
    expect(nativePrint).toHaveBeenCalledTimes(1)
    expect(document.documentElement.classList.contains(STATE_CLASSES.DARK_MODE)).toBe(true)
    expect(document.querySelector(`.${PRINT_CLASSES.COVER}`)).toBeNull()
  })

  test('the gate veils the page through the job, dropping only at teardown', async () => {
    const img = appImg()

    let resolveDecode

    img.decode = () =>
      new Promise((resolve) => {
        resolveDecode = resolve
      })

    window.print()

    await flush()

    // Mid-barrier the screen sits under the veil — the settle sweep and
    // the prep build's mutations can't read as a glitch behind it.
    expect(document.querySelector(`.${PRINT_CLASSES.VEIL}`)).toBeTruthy()
    expect(document.querySelector(`.${PRINT_CLASSES.VEIL_SPINNER}`)).toBeTruthy()
    expect(document.querySelector(`.${PRINT_CLASSES.VEIL_SPINNER_INNER}`)).toBeTruthy()
    expect(nativePrint).not.toHaveBeenCalled()

    resolveDecode()
    await flush()

    // Committed and the dialog armed — the veil STILL holds: it rides
    // the whole dialog so the committed DOM never reaches the screen.
    expect(document.querySelector(`.${PRINT_CLASSES.VEIL}`)).toBeTruthy()
    expect(nativePrint).toHaveBeenCalledTimes(1)

    fireBeforePrint()

    // The job's teardown drops the veil with the rest of the print face.
    fireAfterPrint()

    expect(document.querySelector(`.${PRINT_CLASSES.VEIL}`)).toBeNull()
  })

  test('a swallowed nativePrint self-restores after the dialog grace', async () => {
    const img = appImg()

    window.print()

    await flush()

    expect(nativePrint).toHaveBeenCalledTimes(1)
    expect(document.querySelector(`.${PRINT_CLASSES.COVER}`)).toBeTruthy()

    // No beforeprint, no matchMedia edge — the engine swallowed the
    // call. The grace window passes and the job unwinds on its own:
    // covers and veil out, the upgrade attrs back to pre-print values.
    await new Promise((resolve) => setTimeout(resolve, PRINT_TIMING.DIALOG_GRACE + 250))

    expect(document.querySelector(`.${PRINT_CLASSES.COVER}`)).toBeNull()
    expect(document.querySelector(`.${PRINT_CLASSES.VEIL}`)).toBeNull()
    expect(img.hasAttribute(MEDIA_ATTRS.LOADING)).toBe(false)
    expect(img.hasAttribute(MEDIA_ATTRS.FETCH_PRIORITY)).toBe(false)
  })

  test('a fired beforeprint keeps the committed job past the grace', async () => {
    appImg()

    window.print()

    await flush()

    expect(nativePrint).toHaveBeenCalledTimes(1)

    // The engine's own beforeprint landed inside the call — the
    // teardown has an owner, so the guard must not unwind a live job.
    fireBeforePrint()

    await new Promise((resolve) => setTimeout(resolve, PRINT_TIMING.DIALOG_GRACE + 250))

    expect(document.querySelector(`.${PRINT_CLASSES.COVER}`)).toBeTruthy()

    fireAfterPrint()

    expect(document.querySelector(`.${PRINT_CLASSES.COVER}`)).toBeNull()
  })

  test('small boxes cap below the MB top rungs; decode failure demotes the ladder', async () => {
    const shell = document.createElement(HTML_TAGS.DIV)

    shell.id = APP_IDS.APP

    document.body.appendChild(shell)

    const box = (img, width) => {
      img.getBoundingClientRect = () => ({ width })
    }

    // Each img seats in its own wrapper — same-stem imgs in one parent
    // scope read as one media's stack layers and the dedup retires all
    // but the last, so independent fixtures need independent wells.
    const seat = (img) => {
      const well = document.createElement(HTML_TAGS.DIV)

      well.appendChild(img)
      shell.appendChild(well)
    }

    // Four-tier stem in a ≤768px card: the full-width ladder's two MB
    // top rungs (original + uncompressed) resolve nothing a card can
    // show, so the pick lands on q75.
    const wall = document.createElement(HTML_TAGS.IMG)

    wall.setAttribute(MEDIA_ATTRS.SRC, `https://cdn.example/wall${MEDIA.EXT}`)
    wall.decode = () => Promise.resolve()
    box(wall, 300)
    seat(wall)

    // A two-tier stem clamps the skip count at the floor — the original
    // IS the only lower rung, so the card keeps it rather than walking
    // off the ladder's bottom.
    const two = document.createElement(HTML_TAGS.IMG)

    two.setAttribute(MEDIA_ATTRS.SRC, `https://cdn.example/two${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`)
    two.decode = () => Promise.resolve()
    box(two, 300)
    seat(two)

    // The same four-tier stem at plate width still takes the
    // uncompressed top — the box term never touches full-width media.
    const plate = document.createElement(HTML_TAGS.IMG)

    plate.setAttribute(MEDIA_ATTRS.SRC, `https://cdn.example/wall${MEDIA.EXT}`)
    plate.decode = () => Promise.resolve()
    box(plate, 1200)
    seat(plate)

    // A corrupt proven rung: the manifest lists the tier but decode
    // rejects, so the rescue walks the src top → q75 → floor, and only
    // then does the layer retire (complete, zero natural size = settled
    // broken). No unproven URL is ever written.
    const dem = document.createElement(HTML_TAGS.IMG)

    dem.setAttribute(MEDIA_ATTRS.SRC, `https://cdn.example/dem${MEDIA.EXT}`)
    dem.decode = () => Promise.reject(new Error('corrupt rung'))
    Object.defineProperty(dem, 'complete', { value: true, configurable: true })
    Object.defineProperty(dem, 'naturalWidth', { value: 0, configurable: true })
    box(dem, 0)
    seat(dem)

    // An un-laddered share-style src has no rung to descend to — a
    // decode failure retires it outright.
    const share = document.createElement(HTML_TAGS.IMG)

    share.setAttribute(MEDIA_ATTRS.SRC, `https://cdn.example/share.png`)
    share.decode = () => Promise.reject(new Error('dead share'))
    Object.defineProperty(share, 'complete', { value: true, configurable: true })
    Object.defineProperty(share, 'naturalWidth', { value: 0, configurable: true })
    seat(share)

    window.print()

    await flush()
    await flush()
    await flush()

    expect(wall.getAttribute(MEDIA_ATTRS.SRC)).toBe(
      `https://cdn.example/wall${MEDIA.MOZ}${MEDIA.Q75}${MEDIA.EXT}`
    )
    expect(two.getAttribute(MEDIA_ATTRS.SRC)).toBe(`https://cdn.example/two${MEDIA.EXT}`)
    expect(plate.getAttribute(MEDIA_ATTRS.SRC)).toBe(
      `https://cdn.example/wall${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`
    )
    // Top rung rejected → q75 rejected → q50 rejected → floor reached,
    // the img retires only once the ladder runs out.
    expect(dem.getAttribute(MEDIA_ATTRS.SRC)).toBe(
      `https://cdn.example/dem${MEDIA.MOZ}${MEDIA.Q50}${MEDIA.EXT}`
    )
    expect(dem.classList.contains(PRINT_CLASSES.SRC)).toBe(true)
    expect(share.classList.contains(PRINT_CLASSES.SRC)).toBe(true)
  })

  test('a prep failure drops the veil with the unwind', async () => {
    appImg()

    const origPrepend = document.body.prepend

    document.body.prepend = () => {
      throw new Error('prep boom')
    }

    try {
      window.print()

      await flush()
    } finally {
      document.body.prepend = origPrepend
    }

    // The job died mid-build — the veil can't outlive it.
    expect(nativePrint).not.toHaveBeenCalled()
    expect(document.querySelector(`.${PRINT_CLASSES.VEIL}`)).toBeNull()

    fireAfterPrint()
  })
})
