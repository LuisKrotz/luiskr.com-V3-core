/**
 * @file utils/a11y/animation-desc.ts
 * @description Animated-element descriptions — places each animated
 * surface's translated long description into the DOM so SEO crawlers
 * and AI agents can read what the animation is, what it does, how it
 * triggers and which tech drives it.
 *
 * Data: `translations/<loc>/components.animations.<id>` carries
 * `{alt, longdesc}` per ANIMATION_IDS entry — fetched per locale into
 * `store.lang.components` with the build-time English snapshot as the
 * fallback, so the text is always resolvable.
 *
 * DOM contract (`applyAnimationDesc`):
 *   The description is CRAWLER-ONLY — it is deliberately kept OUT of
 *   the accessibility tree. Screen readers must not announce animation
 *   marketing text: stamping `aria-describedby`/`longdesc`/`aria-label`
 *   on rendered surfaces made NVDA/Narrator read it as interaction
 *   help and masked real controls. So:
 *   1. One hidden `<span id="lk-anim-desc-<id>" class="sr-only"
 *      aria-hidden="true">` per animation id per root (shadow root or
 *      document) holds the longdesc text as ordinary DOM text — the
 *      audience is crawlers/readers that consume markup. `aria-hidden`
 *      evicts it from the AT tree; `.sr-only` hides it visually (never
 *      display:none — the node must stay in the rendered DOM). It is
 *      anchored as the element's sibling so it inherits whatever
 *      landmark wraps the element.
 *   2. No `aria-*`/`longdesc`/`role` attribute is ever stamped on the
 *      target element — controls keep exactly the semantics their
 *      authors gave them.
 *   3. `<canvas>` elements get no fallback text: the sibling node already
 *      carries the description for every DOM-reading crawler, and inner
 *      text on a labelled canvas makes the accessible name mismatch the
 *      element's text content (WCAG Label-in-Name — IBM's
 *      label_name_visible flags exactly this on the burger canvas).
 *
 * Everything is additive and idempotent — re-applying updates the
 * description text in place (locale switch) without duplicating nodes.
 */

import { ANIMATION_DESC_ID_PREFIX } from '@core/tokens/data/animation-ids.js'
import { CMS_KEYS } from '@core/tokens/data/cms-keys.js'
import { A11Y_CLASSES } from '@core/tokens/classes/a11y.js'
import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { HTML_TAGS, HTML_PHRASING_TAGS } from '@core/tokens/elements/html.js'
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
 * The one-sentence animation label — the `alt`-equivalent record field.
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
 * Finds-or-creates the longdesc node inside `root` and refreshes its
 * text — locale switches land as text updates on the same node, so
 * crawlers always read the active locale. The node anchors as the
 * element's own sibling so it inherits whatever landmark wraps the
 * element. Elements with no element parent (detached or direct
 * shadow-root children) and document-level surfaces (the body, whose
 * `<html>` parent can't take a sibling) fall back to the root /
 * `<main>` / body hosts.
 * @param root The element's root (ShadowRoot for the closed DOM tree,
 *   Document otherwise).
 * @param id ANIMATION_IDS entry.
 * @param text The longdesc text to store.
 * @param el The animated element — sibling anchor for the node.
 * @returns The desc node id, or '' when the text is empty / the root
 *   cannot host nodes.
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
    // textContent — polluting every textContent consumer (and, for AT
    // that flattens DOM text, the host's announced content). The node
    // anchors as a sibling of the outermost phrasing element, so it
    // lands in the first real container — still inside whatever
    // landmark wraps the element.
    let anchor: Node = el

    let parent = anchor.parentElement

    while (parent && PHRASING_HOSTS.has(parent.localName)) {
      anchor = parent
      parent = parent.parentElement
    }

    // A container parent takes the sibling slot; <html>/<body> parents
    // are document-level surfaces instead — the node lands inside
    // <main> when one exists, else the document host. Fragment roots
    // (shadow DOM, or a detached element as its own root) take the
    // node themselves.
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

    // Two exclusions by construction: `.sr-only` (authored in
    // core/sass/base/structure/_a11y.scss, reaching every root through
    // the adopted sheets) keeps it off-screen, and `aria-hidden` keeps
    // it out of the accessibility tree — this text is DOM markup for
    // crawlers and AI readers, never screen-reader speech.
    node.className = A11Y_CLASSES.SR_ONLY

    node.setAttribute(ARIA_ATTRS.ARIA_HIDDEN, ATTR_VALUES.TRUE)

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
 * Places an animated element's translated description into the DOM —
 * a crawler-only `<span class="sr-only" aria-hidden="true">` sibling
 * node carrying the longdesc. No ARIA wiring and no canvas fallback
 * text: the element's own accessibility is left untouched (inner text
 * on a labelled canvas would mismatch its accessible name — the
 * Label-in-Name failure).
 *
 * Safe to call on every mount/locale-change: the desc node is created
 * once per (root, id) and only re-texted afterwards. Elements without
 * a resolvable description are left untouched.
 * @param el The animated element (any Element — canvas, img, div, button…).
 * @param id ANIMATION_IDS entry naming its animation.
 */
export const applyAnimationDesc = (el: Element, id: string): void => {
  const { longdesc } = record(id)

  if (!longdesc) return

  const root = el.getRootNode() as ParentNode | null

  if (root) ensureDescNode(root, id, longdesc, el)
}
