/**
 * @file webgl-mode-tails.test.js
 * @description Coverage tails for utils/canvas/webgl-mode.ts — the
 * force-lost context revival inside webglContext() (restorable → the
 * same handle back live; unrestorable → null so callers take the honest
 * fallback) and every webglContextDead() decision arm: unprobed canvas,
 * missing/live context, a restorable loss (false — the normal retry
 * recovers it), and a permanently dead binding (true — the caller must
 * swap the element).
 */
import { webglContext, webglContextDead } from '@core/utils/canvas/webgl-mode.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { WEBGL_STRINGS } from '@core/tokens/strings/webgl.js'
import { STATE_CLASSES } from '@core/tokens/classes/state.js'

/** Fresh detached canvas element. */
const canvas = () => document.createElement(HTML_TAGS.CANVAS)

/** Canvas whose getContext hands `ctx` back for the webgl mode only. */
const withCtx = (ctx) => {
  const c = canvas()

  c.getContext = (type) => (String(type) === WEBGL_STRINGS.WEBGL ? ctx : null)

  return c
}

/** Context stub — `isContextLost` reads `lost`, getExtension hands `loseExt`. */
const lostCtx = (lost, loseExt) => ({
  isContextLost: () => lost,
  getExtension: (name) => (name === WEBGL_STRINGS.WEBGL_LOSE_CONTEXT ? loseExt : null),
})

/** Restorable context — restoreContext() flips the lost flag off. */
const revivableCtx = () => {
  const ctx = {
    isContextLost: () => ctx.lost,
    lost: true,
    getExtension: () => ({
      restoreContext: () => {
        ctx.lost = false
      },
    }),
  }

  return ctx
}

describe('webgl-mode tails', () => {
  afterEach(() => {
    document.documentElement.classList.remove(STATE_CLASSES.REDUCED_MOTION)
    window.history.replaceState(null, '', '/')
  })

  test('webglContext revives a force-lost binding and returns the live context', () => {
    const ctx = revivableCtx()
    const c = withCtx(ctx)

    expect(webglContext(c)).toBe(ctx)
    expect(ctx.lost).toBe(false)
  })

  test('webglContext resolves null when the lost context cannot be restored', () => {
    // No lose-context extension at all.
    expect(webglContext(withCtx(lostCtx(true, null)))).toBeNull()

    // Extension object present but restoreContext is not callable.
    expect(webglContext(withCtx(lostCtx(true, { restoreContext: 1 })))).toBeNull()

    // restoreContext runs but the loss persists — real GPU eviction.
    expect(webglContext(withCtx(lostCtx(true, { restoreContext: () => {} })))).toBeNull()
  })

  test('webglContext passes live and function-less probes through unchanged', () => {
    const live = lostCtx(false, null)

    expect(webglContext(withCtx(live))).toBe(live)

    // A context object with no isContextLost member is trusted as-is.
    const bare = {}

    expect(webglContext(withCtx(bare))).toBe(bare)
  })

  test('webglContextDead — guard arms resolve false', () => {
    expect(webglContextDead(null)).toBe(false)

    // getContext non-callable — a poisoned stub object.
    const weird = canvas()

    weird.getContext = null

    expect(webglContextDead(weird)).toBe(false)

    // No context bound at all — nothing to be dead.
    const bare = canvas()

    bare.getContext = () => null

    expect(webglContextDead(bare)).toBe(false)

    // Context present and live.
    expect(webglContextDead(withCtx(lostCtx(false, null)))).toBe(false)

    // Context object without isContextLost — trusted live.
    expect(webglContextDead(withCtx({}))).toBe(false)
  })

  test('webglContextDead — restorable loss is false; permanent loss is true', () => {
    const ctx = revivableCtx()

    expect(webglContextDead(withCtx(ctx))).toBe(false)
    expect(ctx.lost).toBe(false)

    // Extension missing → the binding stays lost → dead.
    expect(webglContextDead(withCtx(lostCtx(true, null)))).toBe(true)

    // restoreContext runs but the loss persists → dead.
    expect(webglContextDead(withCtx(lostCtx(true, { restoreContext: () => {} })))).toBe(true)

    // restoreContext non-callable → dead.
    expect(webglContextDead(withCtx(lostCtx(true, { restoreContext: 1 })))).toBe(true)
  })

  test('webglContextDead short-circuits under reduced motion', () => {
    document.documentElement.classList.add(STATE_CLASSES.REDUCED_MOTION)

    const c = withCtx(lostCtx(true, { restoreContext: () => {} }))

    expect(webglContextDead(c)).toBe(false)
  })
})
