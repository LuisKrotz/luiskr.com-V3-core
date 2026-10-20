/**
 * @file animation-desc-tails.test.js
 * @description Coverage for core/utils/a11y/animation-desc.ts — the
 * translated animation-description binder. Covers: the record lookup
 * (live locale dictionary + bundled EN fallback + missing id), the
 * hidden desc node lifecycle (document root, shadow root, reuse +
 * re-text on locale switch, non-queryable root), the element contract
 * (img alt + longdesc + describedby, canvas role/label/fallback text,
 * generic aria-label), accessible-name preservation, idempotent
 * re-application and the empty-record no-op.
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
  })

  test('document-root: img gets alt, longdesc ref and the hidden node', () => {
    const img = document.createElement(HTML_TAGS.IMG)

    document.body.appendChild(img)
    applyAnimationDesc(img, TEST_ID)

    const node = document.getElementById(DESC_ID)

    expect(node).not.toBeNull()
    expect(node.tagName).toBe(HTML_TAGS.SPAN.toUpperCase())
    expect(node.classList.contains(A11Y_CLASSES.SR_ONLY)).toBe(true)
    expect(node.textContent.length).toBeGreaterThan(0)
    expect(img.getAttribute(MEDIA_ATTRS.ALT)).toBe(animationAlt(TEST_ID))
    expect(img.getAttribute(ARIA_ATTRS.ARIA_DESCRIBEDBY)).toBe(DESC_ID)
    expect(img.getAttribute(COMMON_ATTRS.LONGDESC)).toBe(`#${DESC_ID}`)
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
    expect(img.getAttribute(ARIA_ATTRS.ARIA_DESCRIBEDBY)).toBe(DESC_ID)
  })

  test('canvas gets role=img, aria-label and fallback text content', () => {
    const canvas = document.createElement(HTML_TAGS.CANVAS)

    document.body.appendChild(canvas)
    applyAnimationDesc(canvas, TEST_ID)

    expect(canvas.getAttribute(ARIA_ATTRS.ROLE)).toBe(ARIA_ATTRS.ROLE_IMG)
    expect(canvas.getAttribute(ARIA_ATTRS.ARIA_LABEL)).toBe(animationAlt(TEST_ID))
    expect(canvas.getAttribute(ARIA_ATTRS.ARIA_DESCRIBEDBY)).toBe(DESC_ID)
    expect(canvas.textContent).toBe(animationLongDesc(TEST_ID))
  })

  test('generic elements get aria-label but no longdesc/alt attrs', () => {
    const div = document.createElement(HTML_TAGS.DIV)

    document.body.appendChild(div)
    applyAnimationDesc(div, TEST_ID)

    expect(div.getAttribute(ARIA_ATTRS.ARIA_LABEL)).toBe(animationAlt(TEST_ID))
    expect(div.getAttribute(MEDIA_ATTRS.ALT)).toBeNull()
    expect(div.getAttribute(COMMON_ATTRS.LONGDESC)).toBeNull()
    expect(div.getAttribute(ARIA_ATTRS.ARIA_DESCRIBEDBY)).toBe(DESC_ID)
  })

  test('existing accessible names are never overwritten', () => {
    const img = document.createElement(HTML_TAGS.IMG)

    img.setAttribute(MEDIA_ATTRS.ALT, 'author-provided alt')
    document.body.appendChild(img)
    applyAnimationDesc(img, TEST_ID)

    expect(img.getAttribute(MEDIA_ATTRS.ALT)).toBe('author-provided alt')

    const div = document.createElement(HTML_TAGS.DIV)

    div.setAttribute(ARIA_ATTRS.ARIA_LABEL, 'author-provided label')
    document.body.appendChild(div)
    applyAnimationDesc(div, TEST_ID)

    expect(div.getAttribute(ARIA_ATTRS.ARIA_LABEL)).toBe('author-provided label')
  })

  test('existing canvas role is preserved', () => {
    const canvas = document.createElement(HTML_TAGS.CANVAS)

    canvas.setAttribute(ARIA_ATTRS.ROLE, 'presentation')
    document.body.appendChild(canvas)
    applyAnimationDesc(canvas, TEST_ID)

    expect(canvas.getAttribute(ARIA_ATTRS.ROLE)).toBe('presentation')
  })

  test('img with existing alt still gains longdesc + describedby', () => {
    const img = document.createElement(HTML_TAGS.IMG)

    img.setAttribute(MEDIA_ATTRS.ALT, 'kept')
    document.body.appendChild(img)
    applyAnimationDesc(img, TEST_ID)

    expect(img.getAttribute(MEDIA_ATTRS.ALT)).toBe('kept')
    expect(img.getAttribute(COMMON_ATTRS.LONGDESC)).toBe(`#${DESC_ID}`)
    expect(img.getAttribute(ARIA_ATTRS.ARIA_DESCRIBEDBY)).toBe(DESC_ID)
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
    expect(div.getAttribute(ARIA_ATTRS.ARIA_LABEL)).toBe('novo alt')
    expect(document.querySelectorAll(`#${DESC_ID}`).length).toBe(1)
  })

  test('empty longdesc produces no node and no describedby', () => {
    liveRecord('alt only', ATTR_VALUES.EMPTY)

    const div = document.createElement(HTML_TAGS.DIV)

    document.body.appendChild(div)
    applyAnimationDesc(div, TEST_ID)

    expect(div.getAttribute(ARIA_ATTRS.ARIA_LABEL)).toBe('alt only')
    expect(div.getAttribute(ARIA_ATTRS.ARIA_DESCRIBEDBY)).toBeNull()
    expect(document.getElementById(DESC_ID)).toBeNull()
  })

  test('canvas fallback text is not overwritten when already set', () => {
    const canvas = document.createElement(HTML_TAGS.CANVAS)

    canvas.textContent = 'author fallback'
    document.body.appendChild(canvas)
    applyAnimationDesc(canvas, TEST_ID)

    expect(canvas.textContent).toBe('author fallback')
  })

  test('detached element hosts the desc node inside its own root', () => {
    const div = document.createElement(HTML_TAGS.DIV)

    applyAnimationDesc(div, TEST_ID)

    expect(div.getAttribute(ARIA_ATTRS.ARIA_LABEL)).toBe(animationAlt(TEST_ID))
    expect(div.querySelector(`#${DESC_ID}`)).not.toBeNull()
    expect(document.getElementById(DESC_ID)).toBeNull()
  })

  test('alt-less records still bind describedby + longdesc', () => {
    liveRecord(ATTR_VALUES.EMPTY, 'only the long text')

    const img = document.createElement(HTML_TAGS.IMG)

    document.body.appendChild(img)
    applyAnimationDesc(img, TEST_ID)

    expect(img.getAttribute(MEDIA_ATTRS.ALT)).toBeNull()
    expect(img.getAttribute(ARIA_ATTRS.ARIA_LABEL)).toBeNull()
    expect(img.getAttribute(ARIA_ATTRS.ARIA_DESCRIBEDBY)).toBe(DESC_ID)
  })

  test('describedby merges with a pre-existing ref instead of replacing it', () => {
    const div = document.createElement(HTML_TAGS.DIV)

    div.setAttribute(ARIA_ATTRS.ARIA_DESCRIBEDBY, 'other-ref')
    document.body.appendChild(div)
    applyAnimationDesc(div, TEST_ID)

    expect(div.getAttribute(ARIA_ATTRS.ARIA_DESCRIBEDBY)).toBe(`other-ref ${DESC_ID}`)
  })

  test('canvas fallback text refreshes on re-apply when helper-owned', () => {
    const canvas = document.createElement(HTML_TAGS.CANVAS)

    document.body.appendChild(canvas)
    applyAnimationDesc(canvas, TEST_ID)

    liveRecord('x', 'refreshed canvas text')
    applyAnimationDesc(canvas, TEST_ID)

    expect(canvas.textContent).toBe('refreshed canvas text')
    expect(canvas.getAttribute(DATA_ATTRS.DATA_ANIM_DESC)).toBe(TEST_ID)
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

  test('falsy root skips the desc node but still applies the name', () => {
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

    expect(el.attrs[ARIA_ATTRS.ARIA_LABEL]).toBe(animationAlt(TEST_ID))
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

    expect(el.attrs[ARIA_ATTRS.ARIA_DESCRIBEDBY]).toBeUndefined()
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

    expect(el.attrs[ARIA_ATTRS.ARIA_DESCRIBEDBY]).toBeUndefined()
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

    expect(el.attrs[ARIA_ATTRS.ARIA_DESCRIBEDBY]).toBeUndefined()
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
    expect(el.attrs[ARIA_ATTRS.ARIA_DESCRIBEDBY]).toBe(DESC_ID)
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
    expect(img.getAttribute(ARIA_ATTRS.ARIA_DESCRIBEDBY)).toBe(DESC_ID)
  })

  test('the document body itself anchors the node via the document host', () => {
    const main = document.createElement(HTML_TAGS.MAIN)

    document.body.appendChild(main)

    applyAnimationDesc(document.body, TEST_ID)

    const node = main.querySelector(`#${DESC_ID}`)

    expect(node).not.toBeNull()
    expect(document.body.getAttribute(ARIA_ATTRS.ARIA_DESCRIBEDBY)).toBe(DESC_ID)
  })
})
