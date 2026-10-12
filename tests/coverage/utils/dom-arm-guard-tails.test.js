/**
 * @file dom-arm-guard-tails.test.js
 * @description Coverage tails for the residual-input guard in core/utils/dom.ts —
 * the capture-phase click/pointerdown swallow that keeps gesture residue from
 * firing controls inside a just-mounted overlay.
 */
import { armResidualInputGuard, withinModalArmWindow } from '@core/utils/dom.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { MOUSE_EVENTS, POINTER_EVENTS } from '@core/tokens/events/dom.js'
import { ANIMATION_DURATIONS } from '@core/tokens/motion/animation.js'

describe('dom residual-input guard tails', () => {
  /** Bare element + addScopedListener shim standing in for a BaseComponent host. */
  const makeHost = () => {
    const host = document.createElement(HTML_TAGS.DIV)

    host.addScopedListener = (target, event, handler, options) =>
      target.addEventListener(event, handler, options)

    const child = document.createElement(HTML_TAGS.BUTTON)

    host.appendChild(child)

    document.body.appendChild(host)

    const fired = []

    child.addEventListener(MOUSE_EVENTS.CLICK, () => fired.push(MOUSE_EVENTS.CLICK))

    child.addEventListener(POINTER_EVENTS.POINTERDOWN, () => fired.push(POINTER_EVENTS.POINTERDOWN))

    return { host, child, fired }
  }

  test('withinModalArmWindow disarmed/armed/expired states', () => {
    // openedAt <= 0 → the `openedAt > 0` short-circuit
    expect(withinModalArmWindow(0)).toBe(false)
    // just-armed → inside the window
    expect(withinModalArmWindow(performance.now())).toBe(true)
    // far past → the `now - openedAt < MS` false arm
    expect(withinModalArmWindow(performance.now() - ANIMATION_DURATIONS.MODAL_ARM_MS - 1)).toBe(
      false
    )
  })

  test('guard is inert while the overlay reports closed', () => {
    const { host, child, fired } = makeHost()

    armResidualInputGuard(
      host,
      () => false,
      () => performance.now()
    )

    child.dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, detail: 1 }))

    expect(fired).toEqual([MOUSE_EVENTS.CLICK])

    host.remove()
  })

  test('swallows pointer clicks inside the arm window, lets keyboard clicks through', () => {
    const { host, child, fired } = makeHost()

    armResidualInputGuard(
      host,
      () => true,
      () => performance.now()
    )

    // Real pointer click (detail 1) inside the window → swallowed
    child.dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, detail: 1 }))
    // Pointer press inside the window → swallowed (theme-slider drag guard)
    child.dispatchEvent(new MouseEvent(POINTER_EVENTS.POINTERDOWN, { bubbles: true, detail: 0 }))
    // Keyboard/programmatic click (detail 0) → deliberate, passes
    child.dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, detail: 0 }))
    // Plain Event('click') — non-MouseEvent synthetic → passes
    child.dispatchEvent(new Event(MOUSE_EVENTS.CLICK, { bubbles: true }))

    expect(fired).toEqual([MOUSE_EVENTS.CLICK, MOUSE_EVENTS.CLICK])

    host.remove()
  })

  test('multi-click residuals are stale regardless of the window', () => {
    let openedAt = 0
    const { host, child, fired } = makeHost()

    armResidualInputGuard(
      host,
      () => true,
      () => openedAt
    )

    // detail 2+ click with a fully disarmed window → still swallowed
    child.dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, detail: 2 }))
    // detail 1 with a disarmed window → passes (openedAt 0 never arms)
    child.dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, detail: 1 }))

    openedAt = performance.now() - ANIMATION_DURATIONS.MODAL_ARM_MS - 1

    // detail 1 outside the window → passes
    child.dispatchEvent(new MouseEvent(MOUSE_EVENTS.CLICK, { bubbles: true, detail: 1 }))
    // pointerdown outside the window → passes
    child.dispatchEvent(new MouseEvent(POINTER_EVENTS.POINTERDOWN, { bubbles: true, detail: 0 }))
    // plain Event pointerdown outside the window → passes (non-MouseEvent arm)
    child.dispatchEvent(new Event(POINTER_EVENTS.POINTERDOWN, { bubbles: true }))

    expect(fired).toEqual([
      MOUSE_EVENTS.CLICK,
      MOUSE_EVENTS.CLICK,
      POINTER_EVENTS.POINTERDOWN,
      POINTER_EVENTS.POINTERDOWN,
    ])

    host.remove()
  })
})
