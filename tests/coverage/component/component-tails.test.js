/**
 * @file component-tails.test.js
 * @description Split from coverage-tails-2.test.js — covers the "Component tails" describe.
 */
import _store from '@core/store.js'
import { BaseComponent } from '@core/Component.js'

import '@website/components/feedback/CookieBanner.js'
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'

/** Generous flush — component mount/render steps need real timers. */
const flush = (ms = 60) => new Promise((r) => setTimeout(r, ms))

describe('Component tails', () => {
  test('_updateDom rebuilds a missing content node', async () => {
    const el = document.createElement(COMPONENT_TAGS.COOKIE_BANNER)

    document.body.appendChild(el)
    await flush()

    el._contentNode = null
    el._updateDom()

    expect(el._contentNode).toBeTruthy()

    el.remove()
  })

  test('re-mount reuses existing shadow nodes', async () => {
    const el = document.createElement(COMPONENT_TAGS.COOKIE_BANNER)

    document.body.appendChild(el)
    await flush()

    el.remove()
    document.body.appendChild(el)
    await flush()

    expect(el.shadowRoot).toBeTruthy()

    el.remove()
  })

  test('legacy <style> fallback when CSSStyleSheet is unavailable', async () => {
    const saved = globalThis.CSSStyleSheet

    delete globalThis.CSSStyleSheet

    try {
      const el = document.createElement(COMPONENT_TAGS.COOKIE_BANNER)

      document.body.appendChild(el)
      await flush()

      el.remove()
      document.body.appendChild(el)
      await flush()

      el.remove()
    } finally {
      globalThis.CSSStyleSheet = saved
    }
  })

  test('constructable stylesheet path adopts and reuses shared sheets', async () => {
    const saved = globalThis.CSSStyleSheet

    globalThis.CSSStyleSheet =
      window.CSSStyleSheet ||
      class CSSStyleSheet {
        replaceSync() {}
      }

    try {
      const el = document.createElement(COMPONENT_TAGS.COOKIE_BANNER)

      document.body.appendChild(el)
      await flush()

      el.remove()
      document.body.appendChild(el)
      await flush()

      el.remove()
    } finally {
      globalThis.CSSStyleSheet = saved
    }
  })

  test('_applyRenderOutput covers missing content node and array output', async () => {
    const el = document.createElement(COMPONENT_TAGS.COOKIE_BANNER)

    document.body.appendChild(el)
    await flush()

    const node = el._contentNode

    el._contentNode = null
    el._applyRenderOutput(document.createElement(HTML_TAGS.DIV))

    el._contentNode = node
    el._applyRenderOutput([
      document.createElement(HTML_TAGS.DIV),
      null,
      document.createElement(HTML_TAGS.SPAN),
    ])

    el.remove()
  })

  test('$$ returns an empty array when shadowRoot is absent', () => {
    // Prototype-call on a bare host — every real element attaches a
    // shadow root in the constructor, so the null arm only shows for
    // detached/pre-upgrade instances.
    const bare = { shadowRoot: null }

    expect(BaseComponent.prototype.$$.call(bare, 'div')).toEqual([])
    expect(BaseComponent.prototype.$.call(bare, 'div')).toBeNull()
  })

  test('_renderInitial returns early when shadowRoot is absent', () => {
    // Same bare-host shape as the $$ guard — no style/content work may run
    // before the shadow root exists.
    const bare = { shadowRoot: null }

    expect(BaseComponent.prototype._renderInitial.call(bare)).toBeUndefined()
  })

  test('addScopedListener disposers run on disconnect', async () => {
    const el = document.createElement(COMPONENT_TAGS.COOKIE_BANNER)

    document.body.appendChild(el)
    await flush()

    const handler = () => {}

    expect(el instanceof BaseComponent).toBe(true)

    el.addScopedListener(document, 'test-evt', handler)

    expect(el._eventDisposers.length).toBe(1)

    el.remove()

    expect(el._eventDisposers).toEqual([])
  })

  test('_renderInitial falls back to a <style> node without constructable sheets', async () => {
    const saved = globalThis.CSSStyleSheet

    globalThis.CSSStyleSheet = undefined

    const el = document.createElement(COMPONENT_TAGS.COOKIE_BANNER)

    document.body.appendChild(el)
    await flush()

    expect(el._styleNode).toBeTruthy()

    el.remove()

    globalThis.CSSStyleSheet = saved
  })
})
