/**
 * @file utils/a11y/animation-desc.ts
 * @description Animated-element descriptions — binds every animated
 * surface to its translated long description so assistive tech,
 * AI agents and SEO crawlers can read what the animation is, what it
 * does, how it triggers and which tech drives it.
 *
 * Data: `translations/<loc>/components.animations.<id>` carries
 * `{alt, longdesc}` per ANIMATION_IDS entry — fetched per locale into
 * `store.lang.components` with the build-time English snapshot as the
 * fallback, so the text is always resolvable.
 *
 * DOM contract (`applyAnimationDesc`):
 *   1. One hidden `<span id="lk-anim-desc-<id>" class="sr-only">`
 *      per animation id per root (shadow root or document) holds the
 *      longdesc text — `aria-describedby` requires same-root refs,
 *      which is why the node lives in the element's own root. It is
 *      anchored as the element's sibling so it inherits whatever
 *      landmark wraps the element (axe `region` — AT-readable text
 *      must not sit loose at a root).
 *   2. The element gets `aria-describedby` → that node.
 *   3. `<img>` also gets `longdesc="#lk-anim-desc-<id>"` (the HTML4
 *      long-description URL — a same-document fragment is a valid URI)
 *      plus `alt` from the record's `alt` field when unset.
 *   4. `<canvas>` also gets `role="img"`, `aria-label`, and the
 *      longdesc as its fallback content — canvas children render
 *      nowhere but are exactly what crawlers/no-JS readers see.
 *   5. Links, buttons and hosts holding interactive descendants never
 *      get `aria-label` — their own content/children are the accessible
 *      name (stamping the same animation label on every tile made
 *      axe's `identical-links-same-purpose` rule fire, and a name on a
 *      control-bearing container swallows the descendants' semantics).
 *      Leaf generic hosts (div/span…) DO get `aria-label`, plus
 *      `role="img"` when they carry no role — a bare generic element
 *      is prohibited from holding a label (axe `aria-prohibited-attr`),
 *      while role=img on a container would nest its interactive
 *      children inside an image (axe `nested-interactive`). Shadow-host
 *      custom elements keep the label (their only name) but never take
 *      the role — their controls live in the shadow root.
 *
 * Everything is additive and idempotent — re-applying updates the
 * description text in place (locale switch) without duplicating nodes.
 */

import { ANIMATION_DESC_ID_PREFIX } from '@core/tokens/data/animation-ids.js'
import { CMS_KEYS } from '@core/tokens/data/cms-keys.js'
import { A11Y_CLASSES } from '@core/tokens/classes/a11y.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { COMMON_ATTRS } from '@core/tokens/attrs/common.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { MEDIA_ATTRS } from '@core/tokens/attrs/media.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { HTML_TAGS, HTML_PHRASING_TAGS } from '@core/tokens/elements/html.js'
import { COMMON_SELECTORS } from '@core/tokens/selectors/common.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { componentText } from '@core/locale/ui-text.js'

/** Phrasing-tag membership set — built once from the token map. */
const PHRASING_HOSTS: ReadonlySet<string> = new Set(Object.values(HTML_PHRASING_TAGS))

/** The description record — components.animations.<id>. */
interface AnimationDescRecord {
  alt?: unknown
  longdesc?: unknown
}

/**
 * Reads one animation record from the live-then-fallback components
 * dictionary. Unknown ids yield empty strings — applying them is a
 * no-op, so callers never need a pre-check.
 * @param id ANIMATION_IDS entry.
 * @returns {alt, longdesc} — possibly empty strings.
 */
const record = (id: string): { alt: string; longdesc: string } => {
  const r = componentText(`${CMS_KEYS.ANIMATIONS}.${id}`) as AnimationDescRecord | undefined

  const str = (v: unknown): string =>
    typeof v === TYPE_STRINGS.STRING ? (v as string) : ATTR_VALUES.EMPTY

  return { alt: str(r?.alt), longdesc: str(r?.longdesc) }
}

/**
 * The one-sentence animation label — the `alt`/`aria-label` source.
 * @param id ANIMATION_IDS entry.
 * @returns The localized alt text, or ''.
 */
export const animationAlt = (id: string): string => record(id).alt

/**
 * The full animation description — element, behavior, triggers, tech
 * and purpose in one paragraph.
 * @param id ANIMATION_IDS entry.
 * @returns The localized longdesc text, or ''.
 */
export const animationLongDesc = (id: string): string => record(id).longdesc

/**
 * Ensures the element carries `role="img"` so an applied `aria-label`
 * is legal on a generic host — an author-provided role is never
 * overwritten. Shared by the canvas and generic-element branches.
 * @param el The animated element.
 */
const ensureImgRole = (el: Element): void => {
  if (!el.getAttribute(ARIA_ATTRS.ROLE)) {
    el.setAttribute(ARIA_ATTRS.ROLE, ARIA_ATTRS.ROLE_IMG)
  }
}

/**
 * Finds-or-creates the longdesc node inside `root` and refreshes its
 * text — locale switches land as text updates on the same node, so
 * `aria-describedby` refs never dangle. The node anchors as the
 * element's own sibling so it inherits whatever landmark wraps the
 * element: a loose span at the root is page content outside every
 * landmark, which axe's `region` rule flags. Elements with no element
 * parent (detached or direct shadow-root children) and document-level
 * surfaces (the body, whose `<html>` parent can't take a sibling)
 * fall back to the root / `<main>` / body hosts.
 * @param root The element's root (ShadowRoot for the closed DOM tree,
 *   Document otherwise).
 * @param id ANIMATION_IDS entry.
 * @param text The longdesc text to store.
 * @param el The animated element — sibling anchor for the node.
 * @returns The desc node id the caller points at, or '' when the text
 *   is empty / the root cannot host nodes.
 */
const ensureDescNode = (root: ParentNode, id: string, text: string, el: Element): string => {
  if (!text || typeof root.querySelector !== TYPE_STRINGS.FUNCTION) return ATTR_VALUES.EMPTY

  const nodeId = `${ANIMATION_DESC_ID_PREFIX}${id}`

  let node = root.querySelector(`#${nodeId}`) as HTMLElement | null

  if (!node) {
    // A Document root can't host the span directly (one document
    // element only) — its body carries the node instead; fragment
    // roots (shadow DOM) append to themselves. Owner-document likewise
    // duck-types: Document.createElement exists only on the Document.
    const isDoc = typeof (root as Document).createElement === TYPE_STRINGS.FUNCTION

    const doc = isDoc ? (root as Document) : (root as Node).ownerDocument

    if (!doc) return ATTR_VALUES.EMPTY

    // Resolve the placement host BEFORE creating the node — a
    // document-like root with no element host must bail here, not
    // after a (possibly stub-null) createElement call.
    //
    // Climb out of text-bearing ancestors first: a desc node injected
    // inside an h2/p/button/a leaks its text into that host's
    // textContent — polluting the heading/link accessible name and
    // every textContent consumer. The node anchors as a sibling of the
    // outermost phrasing element, so it lands in the first real
    // container — still inside whatever landmark wraps the element.
    let anchor: Node = el

    let parent = anchor.parentElement

    while (parent && PHRASING_HOSTS.has(parent.localName)) {
      anchor = parent
      parent = parent.parentElement
    }

    // A container parent takes the sibling slot; <html>/<body> parents
    // are document-level surfaces instead — the node lands inside
    // <main> when one exists (real text outside landmarks trips axe's
    // `region` rule), else the document host. Fragment roots (shadow
    // DOM, or a detached element as its own root) take the node
    // themselves.
    const isContainerParent =
      !!parent && parent.localName !== HTML_TAGS.HTML && parent.localName !== HTML_TAGS.BODY

    const host = isContainerParent
      ? null
      : isDoc
        ? (root as Document).body?.querySelector(HTML_TAGS.MAIN) ||
          (root as Document).body ||
          (root as Document).documentElement
        : (root as DocumentFragment)

    if (!isContainerParent && !host) return ATTR_VALUES.EMPTY

    node = doc.createElement(HTML_TAGS.SPAN)

    node.id = nodeId

    // The class is the whole hiding contract — the `.sr-only` rule is
    // authored in `core/sass/base/structure/_a11y.scss` and reaches every
    // root through the adopted sheets (document <link> via _structure.scss,
    // shadow roots via BASE_HOST_STYLES). Never display:none — that would
    // evict the node from the accessibility tree.
    node.className = A11Y_CLASSES.SR_ONLY

    if (isContainerParent && parent) {
      // Sibling of the outermost phrasing ancestor — the node inherits
      // the container's landmark without touching any text-bearing host.
      parent.insertBefore(node, anchor.nextSibling)
    } else {
      host?.appendChild(node)
    }
  }

  node.textContent = text

  return nodeId
}

/**
 * Binds an animated element to its translated description — sets the
 * accessible name (alt/aria-label), `aria-describedby` (+ `longdesc`
 * on imgs, fallback content on canvases) pointing at a hidden desc
 * node injected into the element's own root.
 *
 * Safe to call on every mount/locale-change: the desc node is created
 * once per (root, id) and only re-texted afterwards. Elements without
 * a resolvable description are left untouched.
 * @param el The animated element (any Element — canvas, img, div, button…).
 * @param id ANIMATION_IDS entry naming its animation.
 */
export const applyAnimationDesc = (el: Element, id: string): void => {
  const { alt, longdesc } = record(id)

  if (!alt && !longdesc) return

  const root = el.getRootNode() as ParentNode | null

  const nodeId = root ? ensureDescNode(root, id, longdesc, el) : ATTR_VALUES.EMPTY

  const isImg = el.tagName === HTML_TAGS.IMG.toUpperCase()

  const isCanvas = el.tagName === HTML_TAGS.CANVAS.toUpperCase()

  // Links/buttons own their accessible name through their content — the
  // helper must never stamp one, or every labelled tile reads the same
  // animation text (axe `identical-links-same-purpose`). describedby
  // still applies below.
  const isLinkOrButton =
    el.tagName === HTML_TAGS.A.toUpperCase() || el.tagName === HTML_TAGS.BUTTON.toUpperCase()

  // A host that wraps interactive content keeps the descendants'
  // semantics as its name — stamping a name or role=img on it would
  // nest controls inside an image (axe `nested-interactive`).
  const hostsInteractive = !!el.querySelector?.(COMMON_SELECTORS.INTERACTIVE_CONTENT)

  const isNamedHost = !isLinkOrButton && !hostsInteractive

  // Shadow-host custom elements keep the label (their only accessible
  // name) but never role=img — the controls axe counts live in the
  // shadow root, populated at mount time or later, so a descendant
  // probe cannot be trusted here.
  const isShadowHost = !!(el as HTMLElement).shadowRoot

  // Accessible name — img → alt, everything else → aria-label. The
  // data-anim-label stamp records what the helper applied: a re-apply
  // refreshes the name only when the current value is empty or still
  // equals the stamp (an author-provided/overridden name is never
  // clobbered), which is what makes locale switches safe.
  const nameAttr = isImg ? MEDIA_ATTRS.ALT : ARIA_ATTRS.ARIA_LABEL

  const stamped = el.getAttribute(DATA_ATTRS.DATA_ANIM_LABEL)

  const curName = el.getAttribute(nameAttr)

  if (isNamedHost && alt && (!curName || curName === stamped)) {
    el.setAttribute(nameAttr, alt)

    el.setAttribute(DATA_ATTRS.DATA_ANIM_LABEL, alt)
  }

  // A leaf generic host (div/span…) is prohibited from holding a name —
  // it needs role=img for the label to be legal (axe `aria-prohibited-attr`).
  if (isNamedHost && !isShadowHost && !isImg && !isCanvas) ensureImgRole(el)

  if (nodeId) {
    // describedby takes an id list — merge rather than replace so an
    // author-provided ref survives alongside ours.
    const cur = el.getAttribute(ARIA_ATTRS.ARIA_DESCRIBEDBY) || ATTR_VALUES.EMPTY

    if (!cur.split(CHAR_STRINGS.SPACE_CHAR).includes(nodeId)) {
      el.setAttribute(
        ARIA_ATTRS.ARIA_DESCRIBEDBY,
        cur ? `${cur}${CHAR_STRINGS.SPACE_CHAR}${nodeId}` : nodeId
      )
    }

    if (isImg) el.setAttribute(COMMON_ATTRS.LONGDESC, `${CHAR_STRINGS.HASH}${nodeId}`)
  }

  if (isCanvas) {
    ensureImgRole(el)

    // Canvas fallback content — the element's inner text only surfaces
    // to no-canvas readers, which is exactly the crawler/AI audience.
    // data-anim-desc marks helper-owned text so locale switches
    // re-text it; author content (no marker) is left alone.
    const ownsText = el.getAttribute(DATA_ATTRS.DATA_ANIM_DESC) === id

    if (longdesc && (ownsText || !el.textContent?.trim())) {
      el.textContent = longdesc

      el.setAttribute(DATA_ATTRS.DATA_ANIM_DESC, id)
    }
  }
}
