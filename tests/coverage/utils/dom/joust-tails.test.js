/**
 * @file joust-tails.test.js
 * @description Coverage for core/utils/dom/joust.ts — the click-to-reveal
 * gate for round icon chips: hover-less pins and second-tap activation,
 * hover-capable/keyboard/programmatic pass-throughs, single-open collapse,
 * outside-press + Escape dismissal (incl. the empty-composedPath fallback
 * and detached-chip pruning), and the document-less arm/disarm guards.
 */
import { joustChip, joustClick, joustCollapseAll } from '@core/utils/dom/joust.js'
import { JOUST_CLASSES } from '@core/tokens/classes/joust.js'
import { KEYS } from '@core/tokens/primitives.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { KEYBOARD_EVENTS, MOUSE_EVENTS, POINTER_EVENTS } from '@core/tokens/events/dom.js'

/** Mirrors the setup.js matchMedia mock shape with a switchable `matches`. */
const stubMatchMedia = (matches) => {
  window.matchMedia = (query) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

/** A joust chip: `joust` root button hosting a `joust-label` span. */
const makeChip = () => {
  const chip = document.createElement(HTML_TAGS.BUTTON)

  chip.classList.add(JOUST_CLASSES.JOUST)

  const label = document.createElement(HTML_TAGS.SPAN)

  label.classList.add(JOUST_CLASSES.JOUST_LABEL)

  chip.appendChild(label)

  document.body.appendChild(chip)

  return { chip, label }
}

/** Dispatches a real MouseEvent click and returns the gate result the handler saw. */
const clickChip = (el, detail = 1) => {
  let fired = null

  const handler = (e) => {
    fired = joustClick(e)
  }

  el.addEventListener(MOUSE_EVENTS.CLICK, handler, { once: true })

  el.dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, detail }))

  return fired
}

describe('joust gate tails', () => {
  let origMatchMedia

  beforeEach(() => {
    origMatchMedia = window.matchMedia
  })

  afterEach(() => {
    joustCollapseAll()

    window.matchMedia = origMatchMedia

    document.body.innerHTML = CHAR_STRINGS.EMPTY
  })

  test('hover-capable input fires single-shot without pinning', () => {
    stubMatchMedia(false)

    const { chip } = makeChip()

    expect(clickChip(chip)).toBe(true)
    expect(chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(false)
  })

  test('hover-less first tap pins the label, second tap activates', () => {
    stubMatchMedia(true)

    const { chip } = makeChip()

    expect(clickChip(chip)).toBe(false)
    expect(chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(true)

    expect(clickChip(chip)).toBe(true)
    expect(chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(false)
  })

  test('a tap on the revealed label span activates the pinned chip', () => {
    stubMatchMedia(true)

    const { chip, label } = makeChip()

    expect(clickChip(chip)).toBe(false)
    expect(clickChip(label)).toBe(true)
    expect(chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(false)
  })

  test('keyboard/programmatic clicks and non-MouseEvent dispatches skip the gate', () => {
    stubMatchMedia(true)

    const { chip } = makeChip()

    // Keyboard Enter — detail 0 → activate without pinning.
    expect(clickChip(chip, 0)).toBe(true)
    expect(chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(false)

    // Plain Event('click') — scripted dispatch, always passes.
    let fired = null

    chip.addEventListener(
      MOUSE_EVENTS.CLICK,
      (e) => {
        fired = joustClick(e)
      },
      { once: true }
    )

    chip.dispatchEvent(new Event(MOUSE_EVENTS.CLICK, { bubbles: true }))

    expect(fired).toBe(true)
    expect(chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(false)

    // No event at all (programmatic toggle) → fires.
    expect(joustClick(undefined)).toBe(true)

    // currentTarget without closest() — a non-Element stub → fires.
    expect(joustClick({ currentTarget: {} })).toBe(true)

    // Explicit non-pointer flag on joustChip → fires.
    expect(joustChip(chip, false)).toBe(true)
  })

  test('joustChip defaults to pointer-initiated when the flag is omitted', () => {
    stubMatchMedia(true)

    const { chip } = makeChip()

    expect(joustChip(chip)).toBe(false)
    expect(chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(true)
  })

  test('elements outside any joust root fire immediately', () => {
    stubMatchMedia(true)

    const { chip } = makeChip()
    const plain = document.createElement(HTML_TAGS.BUTTON)

    document.body.appendChild(plain)

    expect(joustChip(plain, true)).toBe(true)
    expect(joustChip(null, true)).toBe(true)
    expect(clickChip(chip)).toBe(false)
  })

  test('single-open: jousting a second chip collapses the first', () => {
    stubMatchMedia(true)

    const a = makeChip()
    const b = makeChip()

    expect(joustChip(a.chip, true)).toBe(false)
    expect(a.chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(true)

    expect(joustChip(b.chip, true)).toBe(false)
    expect(a.chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(false)
    expect(b.chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(true)
  })

  test('outside press collapses the pin, inside press keeps it', () => {
    stubMatchMedia(true)

    const { chip } = makeChip()

    expect(clickChip(chip)).toBe(false)

    // Press inside the chip → pin survives.
    chip.dispatchEvent(new MouseEvent(POINTER_EVENTS.POINTERDOWN, { bubbles: true }))

    expect(chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(true)

    // Press outside (body) → pin collapses without firing.
    document.body.dispatchEvent(new MouseEvent(POINTER_EVENTS.POINTERDOWN, { bubbles: true }))

    expect(chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(false)
  })

  test('the empty-path fallback resolves inside/outside via Node.contains', () => {
    stubMatchMedia(true)

    const { chip } = makeChip()

    expect(clickChip(chip)).toBe(false)

    // happy-dom calls composedPath() once internally to build the
    // propagation path — a stub returning [] on the second call leaves
    // dispatch intact while _onPress sees the empty-path fallback arm.
    const emptyOnSecondCall = (el) => {
      const ev = new MouseEvent(POINTER_EVENTS.POINTERDOWN, { bubbles: true })
      let calls = 0

      Object.defineProperty(ev, 'composedPath', {
        value: () => {
          calls += 1

          return calls === 1 ? [el, document.body, document] : []
        },
      })

      return ev
    }

    chip.dispatchEvent(emptyOnSecondCall(chip))

    expect(chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(true)

    document.body.dispatchEvent(emptyOnSecondCall(document.body))

    expect(chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(false)
  })

  test('Escape collapses the pin; other keys leave it', () => {
    stubMatchMedia(true)

    const { chip } = makeChip()

    expect(clickChip(chip)).toBe(false)

    document.dispatchEvent(new KeyboardEvent(KEYBOARD_EVENTS.KEYDOWN, { key: KEYS.ENTER }))

    expect(chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(true)

    document.dispatchEvent(new KeyboardEvent(KEYBOARD_EVENTS.KEYDOWN, { key: KEYS.ESCAPE }))

    expect(chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(false)
  })

  test('detached chips are pruned on the press sweep', () => {
    stubMatchMedia(true)

    const { chip } = makeChip()

    expect(clickChip(chip)).toBe(false)

    chip.remove()

    document.body.dispatchEvent(new MouseEvent(POINTER_EVENTS.POINTERDOWN, { bubbles: true }))

    expect(chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(false)
  })

  test('joustCollapseAll empties the pin set and disarms the sweep', () => {
    stubMatchMedia(true)

    const { chip } = makeChip()

    joustCollapseAll()

    expect(clickChip(chip)).toBe(false)
    expect(chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(true)

    joustCollapseAll()

    expect(chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(false)

    // Disarmed: an outside press after collapse is a no-op (still safe).
    document.body.dispatchEvent(new MouseEvent(POINTER_EVENTS.POINTERDOWN, { bubbles: true }))
  })

  test('a missing document skips arm/disarm without breaking the pin', () => {
    stubMatchMedia(true)

    const { chip } = makeChip()
    const origDocument = globalThis.document

    delete globalThis.document

    expect(joustChip(chip, true)).toBe(false)
    expect(chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(true)

    joustCollapseAll()

    expect(chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(false)

    globalThis.document = origDocument
  })

  test('a missing matchMedia counts as hover-capable', () => {
    const prev = window.matchMedia

    delete window.matchMedia

    const { chip } = makeChip()

    expect(clickChip(chip)).toBe(true)
    expect(chip.classList.contains(JOUST_CLASSES.JOUST_OPEN)).toBe(false)

    window.matchMedia = prev
  })
})
