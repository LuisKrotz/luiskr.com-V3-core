/**
 * @file mosaic/burn.ts — paper-combustion title effect for <home-mosaic>.
 *
 * When a card expands (hover / touch-expand) its overlay title burns away
 * bottom→top like a sheet of paper held to a flame — each letter bucket
 * climbing at its own speed so glyphs ignite and vanish at different
 * moments — while a rewritten copy of the title types itself above the
 * description panel.
 *
 * Mechanism (2D canvas — the text is fully self-drawn, no CORS limits):
 *
 *   raster   — the h2 is re-rendered onto an offscreen "paper" canvas at
 *              the DOM glyph positions (font, letter-spacing, uppercase,
 *              manual word-wrap matching the DOM line box)
 *   erode    — each frame a ragged burn front climbs upward, one speed
 *              per detected glyph (`letters` ink runs); the region
 *              below it is erased via `destination-out`
 *   scorch   — per letter, a `source-atop` gradient band chars only the
 *              ink just above that letter's live front (source-atop
 *              touches ink pixels only — letter gaps stay clean), plus a
 *              soft ink-clipped ember wash where the edge smoulders
 *   particles— embers (bright, rise + flicker + wobble) and char flecks
 *              (dark, curl up then tumble) spawn only where a live front
 *              meets actual glyph ink, and dissolve mid-air; on rebuild
 *              they invert into deposits — motes seeded in the still
 *              empty zone above each letter fall top→bottom and land on
 *              the climbing front, knitting the glyph back into place
 *   rewrite  — a slot is inserted above the description containing an
 *              aria-hidden spacer (holds layout so nothing reflows) and a
 *              <draw-text> clone replaying the title, char by char
 *   rebuild  — on un-hover the raster stitches back bottom→top: the
 *              erase mask sits ABOVE a still-climbing front (stage =
 *              1 − prog), so letters re-ink base-to-cap while deposit
 *              particles rain down onto the moving edge — then the DOM
 *              ink takes the pixels back
 *              with a zero-seam handoff
 *
 * Burn duration is capped to the description's draw time so the last
 * ember dies as the description finishes writing; the rebuild replays
 * at ~55% of that length. Reduced motion skips the canvas entirely:
 * the h2 hides instantly and the slot shows static text. The h2 DOM
 * node stays mounted throughout (a11y + fallback); only its ink is
 * hidden while the canvas owns the pixels.
 *
 * The pipeline is split into ./burn/* modules — types + tunables, front
 * geometry, the paper raster, the compositing pass, the particle sim,
 * the RAF loop, and session mount — leaving this file as the arm/disarm
 * orchestrator.
 */

import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import store from '@core/store.js'
import { frame } from './loop.js'
import { insertTitleSlot, mountBurn } from './mount.js'
import { setBurnDirWasm } from './wasm.js'
import type { BurnCard, BurnClasses, BurnHost, BurnItem } from './types.js'

export type { BurnCard, BurnClasses, BurnHost, BurnItem, BurnSession } from './types.js'

/**
 * Arms the burn on card `i`: inserts the rewrite slot, then mounts the
 * combustion canvas IMMEDIATELY — the user expects the dissolve the
 * moment the pointer lands, not after the card's expand ease. The
 * canvas is measured against the title's hover-instant box and plays
 * the burn where the glyphs stood while the card grows behind it (the
 * h2's ink is hidden as soon as the canvas takes over, so the moving
 * DOM title never shows through). Reduced motion skips the canvas
 * entirely — the title swap happens instantly.
 * @param host The <home-mosaic> component instance.
 * @param i The card index inside the mosaic data set.
 * @param item The card's mosaic item (label drives the rewrite slot).
 * @param speed Burn tempo multiplier — 1 is the authored pace, higher
 *   runs a quicker burn-out (card-stack's hover asks for 2×).
 * @param onBurned Fired once when the forward pass consumes the title —
 *   hosts stage their next beat off it (the description writer starts
 *   only after the burn-out). Fires synchronously on the reduced-motion
 *   instant path.
 * @returns Whether a burn actually armed (canvas mounted, instant
 *   relocate, or live session re-based) — false when the card/title
 *   can't be found so the caller can run its own fallback beat.
 */
export function armCardBurn(
  host: BurnHost,
  i: number,
  item: BurnItem,
  cls: BurnClasses,
  cardSel: string,
  speed = 1,
  onBurned: (() => void) | null = null
): boolean {
  const cardEl = host.$(`${cardSel}[${DATA_ATTRS.DATA_INDEX}="${i}"]`)

  if (!cardEl) return false

  const overlay = cardEl.querySelector<HTMLElement>(`.${cls.TITLE_OVERLAY}`)
  const titleEl = overlay?.querySelector<HTMLElement>(`.${cls.TITLE}`)
  const titleText = item.label || item.title || ATTR_VALUES.EMPTY

  if (!overlay || !titleEl || !titleText) return false

  insertTitleSlot(cardEl, titleText, cls)

  const card = cardEl as BurnCard

  if (store.getters.getReducedMotion?.()) {
    // Reduced motion + a relocating host: skip the canvas and jump the
    // title straight to its rebuilt position — the DOM ink stays put,
    // the host's --burned CSS moves the box.
    if (cls.ITEM_BURNED) {
      cardEl.classList.add(cls.ITEM_BURNED)

      onBurned?.()

      return true
    }

    titleEl.classList.add(cls.TITLE_BURNING)

    // Burn-out-only hosts (card-stack) still get their consume beat —
    // the description writer mounts instantly alongside the hidden ink.
    onBurned?.()

    return true
  }

  if (card._burn) {
    // Re-hover mid-rebuild — rebase the forward clock onto the rebuild
    // progress and combust again; the front turns around mid-glyph
    // instead of restarting the burn from scratch.
    const s = card._burn

    s.dir = 1
    s.t = s.prog * (s.dur / 1000)

    // The crate's set_dir restarts the particle stream on a flip.
    setBurnDirWasm(s)

    if (!s.raf) s.raf = requestAnimationFrame(() => frame(s))

    return true
  }

  return mountBurn(cardEl, overlay, titleEl, item, cls, speed, onBurned)
}

/**
 * Un-arms the burn by reversing it: the consume front descends and
 * un-chars the glyphs until the title raster is whole again — the same
 * effect played backwards, not an instant DOM-ink pop. `prog` captures
 * where the burn stopped so the front returns from exactly the consumed
 * edge; frame() runs the teardown once the text is rebuilt. A card with
 * no session (reduced motion, never armed) restores instantly — safe to
 * call unconditionally.
 * @param host The <home-mosaic> component instance.
 * @param i The card index inside the mosaic data set.
 */
export function disarmCardBurn(host: BurnHost, i: number, cls: BurnClasses, cardSel: string): void {
  const cardEl = host.$(`${cardSel}[${DATA_ATTRS.DATA_INDEX}="${i}"]`)

  if (!cardEl) return

  const s = (cardEl as BurnCard)._burn

  if (s) {
    // Rebase the rebuild clock only when flipping a forward burn — a
    // disarm landing mid-rebuild must keep the counted-down progress or
    // the front snaps back to fully-consumed and re-knits from scratch.
    if (s.dir > 0) s.prog = Math.min(1, s.t / (s.dur / 1000))

    s.dir = -1

    // The crate's set_dir restarts the particle stream on a flip.
    setBurnDirWasm(s)

    // A settled loop already stopped scheduling — restart it so the
    // rebuild actually plays.
    if (!s.raf) s.raf = requestAnimationFrame(() => frame(s))

    return
  }

  cardEl.querySelector(`.${cls.TITLE}`)?.classList.remove(cls.TITLE_BURNING)

  cardEl.classList.remove(cls.ITEM_BURNING)

  if (cls.ITEM_BURNED) cardEl.classList.remove(cls.ITEM_BURNED)

  cardEl.querySelector(`.${cls.TITLE_SLOT}`)?.remove()
}
