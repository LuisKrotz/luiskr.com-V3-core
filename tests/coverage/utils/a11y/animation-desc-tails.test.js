/**
 * @file animation-desc-tails.test.js
 * @description Coverage for core/utils/a11y/animation-desc.ts — the
 * translated animation-description injector. Covers: the record lookup
 * (live locale dictionary + bundled EN fallback + missing id), the
 * hidden desc node lifecycle (document root, shadow root, reuse +
 * re-text on locale switch, non-queryable root), the crawler-only
 * contract (aria-hidden + sr-only node, ZERO ARIA wiring on targets —
 * no describedby/longdesc/label/role is ever stamped), the no-canvas-
 * inner-text rule (inner text on a labelled canvas mismatches the
 * accessible name — Label-in-Name), and the empty-record no-op.
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import store from '@core/store.js'
import { LANG_MUTATIONS } from '@core/tokens/events/mutations.js'
import { ANIMATION_IDS, ANIMATION_DESC_ID_PREFIX } from '@core/tokens/data/animation-ids.js'
import { A11Y_CLASSES } from '@core/tokens/classes/a11y.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import {
  animationAlt,
  animationLongDesc,
  applyAnimationDesc,
} from '@core/utils/a11y/animation-desc.js'

const TEST_ID = ANIMATION_IDS.GENIE_MODAL
const DESC_ID = `${ANIMATION_DESC_ID_PREFIX}${TEST_ID}`

/** Injects a live components dictionary carrying one animation record. */
const liveRecord = (alt, longdesc) => {
  store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, {
    animations: { [TEST_ID]: { alt, longdesc } },
  })
}

/** Every attribute the old contract used to stamp must stay unset. */
const expectNoAriaWiring = (el) => {
  expect(el.getAttribute(ARIA_ATTRS.ARIA_DESCRIBEDBY)).toBeNull()
  expect(el.getAttribute(ARIA_ATTRS.ARIA_LABEL)).toBeNull()
  expect(el.getAttribute(ARIA_ATTRS.ROLE)).toBeNull()
  expect(el.getAttribute(COMMON_ATTRS.LONGDESC)).toBeNull()
  expect(el.getAttribute(DATA_ATTRS.DATA_ANIM_LABEL)).toBeNull()
}

describe('animation-desc tails', () => {
  beforeEach(() => {
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, {})
    document.body.innerHTML = ATTR_VALUES.EMPTY
    document.head.innerHTML = ATTR_VALUES.EMPTY
  })

  afterEach(() => {
    store.commit(LANG_MUTATIONS.SET_COMPONENT_LANG, {})
    document.body.innerHTML = ATTR_VALUES.EMPTY
  })

  test('resolves the bundled EN fallback when no live dictionary is loaded', () => {
    const alt = animationAlt(TEST_ID)
    const longdesc = animationLongDesc(TEST_ID)

    expect(alt.length).toBeGreaterThan(0)
    expect(longdesc.length).toBeGreaterThan(alt.length)
  })

  test('live locale records win over the fallback', () => {
    liveRecord('live alt', 'live longdesc body')

    expect(animationAlt(TEST_ID)).toBe('live alt')
    expect(animationLongDesc(TEST_ID)).toBe('live longdesc body')
  })

  test('unknown ids yield empty strings and apply() is a no-op', () => {
    expect(animationAlt('no-such-animation')).toBe(ATTR_VALUES.EMPTY)
    expect(animationLongDesc('no-such-animation')).toBe(ATTR_VALUES.EMPTY)

    const img = document.createElement(HTML_TAGS.IMG)

    document.body.appendChild(img)
    applyAnimationDesc(img, 'no-such-animation')

    expect(img.getAttribute(MEDIA_ATTRS.ALT)).toBeNull()
    expect(document.getElementById('lk-anim-desc-no-such-animation')).toBeNull()
  })

  test('non-string record fields coerce to empty strings', () => {
    liveRecord(42, null)

    expect(animationAlt(TEST_ID)).toBe(ATTR_VALUES.EMPTY)
    expect(animationLongDesc(TEST_ID)).toBe(ATTR_VALUES.EMPTY)

    const div = document.createElement(HTML_TAGS.DIV)

    document.body.appendChild(div)
    applyAnimationDesc(div, TEST_ID)

    expect(document.getElementById(DESC_ID)).toBeNull()
  })

  test('document-root img: crawler node lands, zero a11y wiring on the image', () => {
    const img = document.createElement(HTML_TAGS.IMG)

    document.body.appendChild(img)
    applyAnimationDesc(img, TEST_ID)

    const node = document.getElementById(DESC_ID)

    expect(node).not.toBeNull()
    expect(node.tagName).toBe(HTML_TAGS.SPAN.toUpperCase())
    expect(node.classList.contains(A11Y_CLASSES.SR_ONLY)).toBe(true)
    expect(node.getAttribute(ARIA_ATTRS.ARIA_HIDDEN)).toBe(ATTR_VALUES.TRUE)
    expect(node.textContent.length).toBeGreaterThan(0)

    // The image keeps exactly the semantics its author gave it.
    expectNoAriaWiring(img)
    expect(img.getAttribute(MEDIA_ATTRS.ALT)).toBeNull()
  })

  test('an author-provided alt is preserved and never clobbered', () => {
    const img = document.createElement(HTML_TAGS.IMG)

    img.setAttribute(MEDIA_ATTRS.ALT, 'author-provided alt')
    document.body.appendChild(img)
    applyAnimationDesc(img, TEST_ID)

    expect(img.getAttribute(MEDIA_ATTRS.ALT)).toBe('author-provided alt')
    expectNoAriaWiring(img)
  })

  test('shadow-root: the desc node lands inside the same root', () => {
    const host = document.createElement(HTML_TAGS.DIV)

    host.attachShadow({ mode: 'open' })

    const img = document.createElement(HTML_TAGS.IMG)

    host.shadowRoot.appendChild(img)
    document.body.appendChild(host)
    applyAnimationDesc(img, TEST_ID)

    const node = host.shadowRoot.getElementById(DESC_ID)

    expect(node).not.toBeNull()
    expect(document.getElementById(DESC_ID)).toBeNull()
    expectNoAriaWiring(img)
  })

  test('canvas gets the crawler node only — inner text and attrs untouched', () => {
    const canvas = document.createElement(HTML_TAGS.CANVAS)

    document.body.appendChild(canvas)
    applyAnimationDesc(canvas, TEST_ID)

    // The sibling desc node carries the text; the canvas itself stays
    // pristine — inner text on a labelled canvas mismatches its
    // accessible name (Label-in-Name / IBM label_name_visible).
    expect(document.getElementById(DESC_ID)).not.toBeNull()
    expect(canvas.textContent).toBe(ATTR_VALUES.EMPTY)
    expect(canvas.getAttribute(DATA_ATTRS.DATA_ANIM_DESC)).toBeNull()
    expectNoAriaWiring(canvas)
  })

  test('generic elements get the crawler node and nothing else', () => {
    const div = document.createElement(HTML_TAGS.DIV)

    document.body.appendChild(div)
    applyAnimationDesc(div, TEST_ID)

    expect(document.getElementById(DESC_ID)).not.toBeNull()
    expectNoAriaWiring(div)
  })

  test('links and buttons keep exactly their own semantics', () => {
    for (const tag of [HTML_TAGS.A, HTML_TAGS.BUTTON]) {
      const el = document.createElement(tag)

      el.textContent = 'Read more'
      document.body.appendChild(el)
      applyAnimationDesc(el, TEST_ID)

      expectNoAriaWiring(el)
    }
  })

  test('hosts wrapping interactive descendants are untouched', () => {
    const div = document.createElement(HTML_TAGS.DIV)
    const link = document.createElement(HTML_TAGS.A)

    link.setAttribute('href', '/x')
    link.textContent = 'tile'
    div.appendChild(link)
    document.body.appendChild(div)
    applyAnimationDesc(div, TEST_ID)

    expectNoAriaWiring(div)
  })

  test('shadow hosts get the crawler node and nothing else', () => {
    const host = document.createElement('awards-carousel')

    host.attachShadow({ mode: 'open' })
    document.body.appendChild(host)
    applyAnimationDesc(host, TEST_ID)

    expect(document.getElementById(DESC_ID)).not.toBeNull()
    expectNoAriaWiring(host)
  })

  test('existing canvas role is preserved', () => {
    const canvas = document.createElement(HTML_TAGS.CANVAS)

    canvas.setAttribute(ARIA_ATTRS.ROLE, 'presentation')
    document.body.appendChild(canvas)
    applyAnimationDesc(canvas, TEST_ID)

    expect(canvas.getAttribute(ARIA_ATTRS.ROLE)).toBe('presentation')
  })

  test('re-application is idempotent — one node, refreshed text', () => {
    const div = document.createElement(HTML_TAGS.DIV)

    document.body.appendChild(div)
    applyAnimationDesc(div, TEST_ID)

    const first = document.getElementById(DESC_ID)

    // Locale switch — the same node re-texts, no duplicate.
    liveRecord('novo alt', 'novo texto longo')

    applyAnimationDesc(div, TEST_ID)

    const second = document.getElementById(DESC_ID)

    expect(second).toBe(first)
    expect(second.textContent).toBe('novo texto longo')
    expect(document.querySelectorAll(`#${DESC_ID}`).length).toBe(1)
  })

  test('alt-only records produce no node — longdesc is the payload', () => {
    liveRecord('alt only', ATTR_VALUES.EMPTY)

    const div = document.createElement(HTML_TAGS.DIV)

    document.body.appendChild(div)
    applyAnimationDesc(div, TEST_ID)

    expect(document.getElementById(DESC_ID)).toBeNull()
    expectNoAriaWiring(div)
  })

  test('canvas author fallback content is left untouched', () => {
    const canvas = document.createElement(HTML_TAGS.CANVAS)

    canvas.textContent = 'author fallback'
    document.body.appendChild(canvas)
    applyAnimationDesc(canvas, TEST_ID)

    expect(canvas.textContent).toBe('author fallback')
    expect(canvas.getAttribute(DATA_ATTRS.DATA_ANIM_DESC)).toBeNull()
  })

  test('detached element hosts the desc node inside its own root', () => {
    const div = document.createElement(HTML_TAGS.DIV)

    applyAnimationDesc(div, TEST_ID)

    expect(div.querySelector(`#${DESC_ID}`)).not.toBeNull()
    expect(document.getElementById(DESC_ID)).toBeNull()
  })

  test('canvas re-apply refreshes the node text, never the canvas', () => {
    const canvas = document.createElement(HTML_TAGS.CANVAS)

    document.body.appendChild(canvas)
    applyAnimationDesc(canvas, TEST_ID)

    liveRecord('x', 'refreshed canvas text')
    applyAnimationDesc(canvas, TEST_ID)

    expect(document.getElementById(DESC_ID).textContent).toBe('refreshed canvas text')
    expect(canvas.textContent).toBe(ATTR_VALUES.EMPTY)
    expect(canvas.getAttribute(DATA_ATTRS.DATA_ANIM_DESC)).toBeNull()
  })

  test('canvas text owned by a different animation id is left alone', () => {
    const canvas = document.createElement(HTML_TAGS.CANVAS)

    canvas.textContent = 'author fallback'
    canvas.setAttribute(DATA_ATTRS.DATA_ANIM_DESC, 'other-animation')
    document.body.appendChild(canvas)
    applyAnimationDesc(canvas, TEST_ID)

    expect(canvas.textContent).toBe('author fallback')
    expect(canvas.getAttribute(DATA_ATTRS.DATA_ANIM_DESC)).toBe('other-animation')
  })

  test('falsy root skips the desc node', () => {
    const el = {
      getRootNode: () => null,
      tagName: HTML_TAGS.DIV.toUpperCase(),
      getAttribute: () => null,
      setAttribute: (n, v) => {
        el.attrs[n] = v
      },
      attrs: {},
    }

    applyAnimationDesc(el, TEST_ID)

    expect(el.attrs[ARIA_ATTRS.ARIA_DESCRIBEDBY]).toBeUndefined()
  })

  test('non-queryable root yields no desc node', () => {
    const el = {
      getRootNode: () => ({}),
      tagName: HTML_TAGS.DIV.toUpperCase(),
      getAttribute: () => null,
      setAttribute: (n, v) => {
        el.attrs[n] = v
      },
      attrs: {},
    }

    applyAnimationDesc(el, TEST_ID)

    expect(Object.keys(el.attrs).length).toBe(0)
  })

  test('root without an ownerDocument yields no desc node', () => {
    const el = {
      getRootNode: () => ({ querySelector: () => null }),
      tagName: HTML_TAGS.DIV.toUpperCase(),
      getAttribute: () => null,
      setAttribute: (n, v) => {
        el.attrs[n] = v
      },
      attrs: {},
    }

    applyAnimationDesc(el, TEST_ID)

    expect(Object.keys(el.attrs).length).toBe(0)
  })

  test('document-like root with no element host yields no desc node', () => {
    const el = {
      getRootNode: () => ({
        querySelector: () => null,
        createElement: () => null,
        body: null,
        documentElement: null,
      }),
      tagName: HTML_TAGS.DIV.toUpperCase(),
      getAttribute: () => null,
      setAttribute: (n, v) => {
        el.attrs[n] = v
      },
      attrs: {},
    }

    applyAnimationDesc(el, TEST_ID)

    expect(Object.keys(el.attrs).length).toBe(0)
  })

  test('documentElement hosts the node when body is missing', () => {
    const hostEl = document.createElement(HTML_TAGS.DIV)

    const el = {
      getRootNode: () => ({
        querySelector: (sel) => hostEl.querySelector(sel),
        createElement: (tag) => document.createElement(tag),
        body: null,
        documentElement: hostEl,
      }),
      tagName: HTML_TAGS.DIV.toUpperCase(),
      getAttribute: () => null,
      setAttribute: (n, v) => {
        el.attrs[n] = v
      },
      attrs: {},
    }

    applyAnimationDesc(el, TEST_ID)

    expect(hostEl.querySelector(`#${DESC_ID}`)).not.toBeNull()
  })

  test('desc node climbs out of phrasing parents — heading text stays clean', () => {
    const section = document.createElement(HTML_TAGS.DIV)
    const heading = document.createElement(HTML_TAGS.H2)
    const span = document.createElement(HTML_TAGS.SPAN)
    const img = document.createElement(HTML_TAGS.IMG)

    heading.textContent = 'Section title'
    span.appendChild(img)
    heading.appendChild(span)
    section.appendChild(heading)
    document.body.appendChild(section)

    applyAnimationDesc(img, TEST_ID)

    const node = document.querySelector(`#${DESC_ID}`)

    expect(node).not.toBeNull()
    // Anchored as the heading's sibling — inside the container, outside
    // every text-bearing element.
    expect(node.parentElement).toBe(section)
    expect(heading.textContent).toBe('Section title')
  })

  test('the document body itself anchors the node via the document host', () => {
    const main = document.createElement(HTML_TAGS.MAIN)

    document.body.appendChild(main)

    applyAnimationDesc(document.body, TEST_ID)

    const node = main.querySelector(`#${DESC_ID}`)

    expect(node).not.toBeNull()
  })
})
