/**
 * @file tokens/attrs/data.js
 * @description `data-*` attribute tokens — token group. Every name is
 * composed from the shared `_DATA` prefix so the `data-` string itself is
 * declared exactly once (zero-hardcoding rule 9: compose, don't repeat).
 * These attributes carry per-element bookkeeping: list indices for
 * carousels/mosaics, CMS editor bindings, and the `data-content` marker
 * BaseComponent stamps on its shadow content wrapper.
 */

import { _DATA } from '../base.js'

/**
 * Frozen data attribute-name map — sole declaration site for these tokens; consumers read
 * members and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes
 * the token contract immutable at runtime.
 */
export const DATA_ATTRS = Object.freeze({
  /** `data-index` — generic positional index (lists, slides). */
  DATA_INDEX: `${_DATA}index`,
  /** `data-lang` — locale marker stamped by language UI rows. */
  DATA_LANG: `${_DATA}lang`,
  /** `data-flag` — marks flag-canvas nodes inside language rows. */
  DATA_FLAG: `${_DATA}flag`,
  /** `data-switch` — marks toggle-switch rows in preferences. */
  DATA_SWITCH: `${_DATA}switch`,
  /** `data-tab` — tab identifier for tabbed surfaces (CMS panels). */
  DATA_TAB: `${_DATA}tab`,
  /** `data-idx` — compact index variant used where `index` would collide. */
  DATA_IDX: `${_DATA}idx`,
  /** `data-sec` — section index for nav/scroll bookkeeping. */
  DATA_SEC: `${_DATA}sec`,
  /** `data-tidx` — tab index variant for nested tab groups. */
  DATA_TIDX: `${_DATA}tidx`,
  /** `data-col` — column index for grid/mosaic cell bookkeeping. */
  DATA_COL: `${_DATA}col`,
  /** `data-midx` — media index inside a figure's media list. */
  DATA_MIDX: `${_DATA}midx`,
  /** `data-size` — size variant marker on sized media items. */
  DATA_SIZE: `${_DATA}size`,
  /** `data-action` — action name bound by CMS/editor buttons. */
  DATA_ACTION: `${_DATA}action`,
  /** `data-field` — field binding name in CMS editor inputs. */
  DATA_FIELD: `${_DATA}field`,
  /** `data-dim-idx` — dimension index for multi-size media entries. */
  DATA_DIM_IDX: `${_DATA}dim-idx`,
  /** `data-prop` — property binding name in CMS property editors. */
  DATA_PROP: `${_DATA}prop`,
  /** `data-theme` — theme value marker on theme picker buttons. */
  DATA_THEME: `${_DATA}theme`,
  /** `data-content` — marker stamped on BaseComponent's persistent shadow content wrapper; reused to find the wrapper across re-mounts. */
  DATA_CONTENT: `${_DATA}content`,
  /** `data-carousel-idx` — slide index inside carousel tracks. */
  DATA_CAROUSEL_IDX: `${_DATA}carousel-idx`,
  /** `data-sec-idx` — section index variant for multi-section views. */
  DATA_SEC_IDX: `${_DATA}sec-idx`,
  /** `data-param` — parameter name bound by playground controls. */
  DATA_PARAM: `${_DATA}param`,
  /** `data-check` — checkbox binding marker in preference editors. */
  DATA_CHECK: `${_DATA}check`,
  /** `data-app-wrapper` — marks the top-level app wrapper element. */
  DATA_APP_WRAPPER: `${_DATA}app-wrapper`,
  /** `data-path` — manifest path stamped on docs tree/grid buttons. */
  DATA_PATH: `${_DATA}path`,
  /** `data-body` — star-field body id bound by navigator rows + pick meshes. */
  DATA_BODY: `${_DATA}body`,
  /** Marks a docs-content box whose delegated link handler is attached. */
  DATA_WIRED: `${_DATA}wired`,
  /**
   * `data-anim-label` — the alt the animation-desc helper last stamped;
   * lets locale re-applies refresh only helper-owned names (an author
   * name that diverges from the stamp is never clobbered).
   */
  DATA_ANIM_LABEL: `${_DATA}anim-label`,
  /**
   * `data-anim-desc` — marks canvas fallback text owned by the
   * animation-desc helper (value = the ANIMATION_IDS entry, so the
   * marker doubles as the element's animation identity).
   */
  DATA_ANIM_DESC: `${_DATA}anim-desc`,
  /**
   * `data-print-capture` — opt-in marker on a canvas that must print its
   * painted frame even though it is aria-hidden/role-button (animation
   * demos, playground scenes). The print adapter still requests a fresh
   * frame via `printcapture` before the preserved-buffer read.
   */
  PRINT_CAPTURE: `${_DATA}print-capture`,
  /**
   * `data-print-skip` — opt-out marker on a canvas that must never print
   * (docs landing background scene): the adapter retires the element and
   * injects no still.
   */
  PRINT_SKIP: `${_DATA}print-skip`,
  /**
   * `data-print-link` — marks an anchor that earns a `.print-qr-link`
   * code beside itself in print (sitemap route rows — every printed
   * route scans open). Locale/leaf chips stay QR-free: the marker is
   * per-anchor, not per-region.
   */
  PRINT_LINK: `${_DATA}print-link`,
  /**
   * `data-print-doc` — marks the `article.reader-content` mirror a route
   * populated for the print pass (docs renders the selected page into
   * it): the print sheet unparks the article and drops #app regardless
   * of the mirror's child shape — unlike the `> div` heuristic, which
   * only recognises unprepared prerendered mirrors.
   */
  PRINT_DOC: `${_DATA}print-doc`,
  /**
   * `data-print-landscape` — marker on a surface whose print output must
   * paginate landscape (the Earth scene is wider than tall): the adapter
   * stamps `html.print-landscape` and the print sheet's named `@page`
   * flips the whole job to landscape sheets.
   */
  PRINT_LANDSCAPE: `${_DATA}print-landscape`,
  /**
   * `data-print-no-caption` — opt-out marker on a media surface that must
   * print WITHOUT its `.print-caption` source line (the about portrait —
   * a personal photo needs no asset attribution on paper). The element
   * itself still prints; only the credit line is suppressed.
   */
  PRINT_NO_CAPTION: `${_DATA}print-no-caption`,
  /**
   * `data-mermaid-src` — the raw diagram source stashed on a rendered
   * `.docs-mermaid` block at render time: the block's textContent is
   * replaced by the SVG, so the print pass re-renders from this attr
   * with the paper theme instead of inheriting the screen palette.
   */
  DOCS_MERMAID_SRC: `${_DATA}mermaid-src`,
  /**
   * `data-print-rotate` — stamped at print-render time on a docs
   * diagram block whose drawn aspect is wider than the portrait content
   * box: the print sheet quarter-turns the diagram inside a full-page
   * slot instead of shrinking it to illegibility (the "turn the
   * magazine" move the bleed plates use, applied to vector content).
   */
  PRINT_ROTATE: `${_DATA}print-rotate`,
})
