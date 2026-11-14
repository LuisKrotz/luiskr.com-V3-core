/**
 * @file tokens/classes/print.js
 * @description Print-mode class tokens — injected by core/utils/print/print.ts
 * and styled by core/sass/base/structure/_print.scss. Sole declaration site —
 * consumers import members rather than re-declaring the literals
 * (zero-hardcoding rules 4–5).
 */

/**
 * Frozen print class-name map — the runtime swaps non-printable surfaces
 * (canvases, videos) for static <img> stand-ins on beforeprint and tags both
 * sides so the print sheet can flip them; every printed media surface gets a
 * source/date/author caption, footer links get a small QR each, and the
 * document ends with a single page-URL QR.
 */
export const PRINT_CLASSES = Object.freeze({
  /** Static <img> stand-in injected next to a canvas/video for print. */
  COPY: 'print-copy',
  /** Marks the live canvas/video the copy replaces — hidden only on paper. */
  SRC: 'print-src',
  /**
   * Print-owned freeze of the canvas's `is-fallback` state — stamped by
   * the adapter when the walk finds a demo surface unpaintable (fallback
   * already on, or the capture handshake declined). Widget init paths
   * (initWebGL/wasm mount/pool restore) legitimately remove `is-fallback`
   * when a surface comes up LATE — after the walk — which would hide the
   * stage's authored fallback and strand a blank box on paper. The print
   * sheet's fallback selectors honor `.is-fallback,.print-fallback`
   * alike, so the walk's decision survives any post-commit class churn.
   */
  FALLBACK: 'print-fallback',
  /**
   * Source line injected under every printed media surface — "Source:
   * <asset URL> · <print date> · Luis Krötz" so paper output attributes
   * each listed image/video to its file and its author.
   */
  CAPTION: 'print-caption',
  /**
   * Small QR link injected under each footer link on print — paper
   * readers scan straight into that link's destination.
   */
  QR_LINK: 'print-qr-link',
  /**
   * End-of-document QR — links back to the printed page itself, injected
   * once at the foot of the body on beforeprint.
   */
  QR_PAGE: 'print-qr-page',
  /**
   * Real-destination line injected under a `[data-print-link]` anchor —
   * the anchor's absolute URL spelled out as readable text so a paper
   * reader sees where a directory row leads without scanning the QR.
   */
  LINK_URL: 'print-link-url',
  /**
   * Plain-text fill a component injects on `printprepare` where its live
   * DOM holds no printable copy (card-stack descriptions sit inside
   * `<draw-text>` writers that stay empty until their own reveal arms) —
   * carries `hidden` and a shadow-local print rule reveals it on paper.
   */
  FILL: 'print-fill',
  /**
   * One body paragraph inside a `print-fill` — the project feature's
   * long copy (the project's own `sections` text) seats one span per
   * paragraph so the sheet can rule paragraph pacing independently of
   * the `<br>`-joined card blurb it replaces.
   */
  FILL_PARA: 'print-fill-para',
  /**
   * `print-doc` on <html> — stamped by the adapter when a route-prepared
   * `article.reader-content` mirror is the print document (docs selected
   * page): the print sheet hides #app and unparks the mirror. Class-driven
   * rather than a `:has()` gate — the has-selector arm proved unreliable
   * under emulated print media in headless shells.
   */
  DOC: 'print-doc',
  /**
   * `print-cover-only` on <html> — stamped when a cover-only route
   * (search, not-found) prints: the sheet hides the app host so the
   * single injected cover sheet is the whole document.
   */
  COVER_ONLY: 'print-cover-only',
  /**
   * `print-landscape` on <html> — stamped when a `data-print-landscape`
   * surface exists (Earth scene): `body` takes the named landscape
   * `@page` so the whole job paginates sideways.
   */
  LANDSCAPE: 'print-landscape',
  /**
   * `print-plate-doc` on <html> — stamped when a scene plate is the
   * job's only printable app content (Earth/star-field routes): the
   * sheet hides #app's other children so the empty view chrome can't
   * strand a default sheet between the named cover and plate pages.
   */
  PLATE_DOC: 'print-plate-doc',
  /**
   * Title cover — the injected first sheet: black page carrying the gold
   * `Luis Krötz` masthead and the localized "Portfolio" line.
   */
  COVER: 'print-cover',
  /** Cover masthead — the silver name line. */
  COVER_TITLE: 'print-cover-title',
  /**
   * Cover star — the Gravatar portrait plate seated over the masthead's
   * lower half (the magazine "name behind the cover star" move); built
   * fresh in buildCovers from the live about picture.
   */
  COVER_PHOTO: 'print-cover-photo',
  /** Cover issue line — the print date reading as the edition stamp. */
  COVER_ISSUE: 'print-cover-issue',
  /** Cover subtitle — the localized "Portfolio" word. */
  COVER_SUB: 'print-cover-sub',
  /**
   * Face page — the second injected sheet, reproducing the intro loader's
   * orbital rings + brand line without the percent counter.
   */
  FACE: 'print-face',
  /** Face-page radial blue glow — mirrors intro-loader-glow. */
  FACE_GLOW: 'print-face-glow',
  /** Face-page blueprint grid — mirrors intro-loader-grid. */
  FACE_GRID: 'print-face-grid',
  /** Face-page outer orbital ring (the loader's cw ring, static). */
  FACE_SPINNER: 'print-face-spinner',
  /** Face-page inner counter-orbiting ring (the loader's ccw ring). */
  FACE_SPINNER_INNER: 'print-face-spinner-inner',
  /** Face-page brand line under the rings. */
  FACE_TITLE: 'print-face-title',
  /**
   * Back cover — the injected last sheet: black page with the site QR
   * centred and the copyright line pinned to the bottom edge.
   */
  BACK: 'print-back',
  /** Back-cover QR wrapper — the centred scan block. */
  BACK_QR: 'print-back-qr',
  /** Back-cover copyright line — pinned to the sheet's bottom edge. */
  BACK_COPY: 'print-back-copy',
  /**
   * Cover-only home link — the printed <a> carrying the site's own
   * address under the scan block on the single-sheet job the
   * cover-only routes (search, not-found) emit.
   */
  BACK_HOME: 'print-back-home',
  /**
   * Full-bleed editorial spread — stamped on a section's hero figure so
   * its containing box takes the margin-zero named page and the image
   * paints edge-to-edge like a magazine spread.
   */
  BLEED: 'print-bleed',
  /**
   * Landscape arm of the bleed stamp — a figure wider than tall takes
   * the `size: landscape` named page, so the reader rotates the physical
   * sheet to view it at maximum scale.
   */
  BLEED_LANDSCAPE: 'print-bleed--landscape',
  /**
   * Bleed-spread masthead — stamped on the title h1 the adapter moves
   * inside the hero's containing block so the title overlays the plate
   * instead of stranding alone on a content sheet ahead of it.
   */
  BLEED_HEAD: 'print-bleed-head',
  /**
   * Scene plate — the wrapper the adapter seats around a `data-print-*`
   * canvas's captured still (Earth/star-field scenes): a full-sheet
   * unbreakable box pulled into the page margins so the still paints
   * edge-to-edge like a magazine plate.
   */
  PLATE: 'print-plate',
  /**
   * Landscape arm of the plate stamp — a still wider than tall quarter-
   * turns inside the portrait sheet (the "turn the magazine" spread)
   * instead of swapping to a `size: landscape` named page, which strands
   * empty transition sheets in Chromium.
   */
  PLATE_LANDSCAPE: 'print-plate--landscape',
  /**
   * Internal hero arm of the plate stamp — a `.print-plate` hoisted to
   * `<body>` level after the covers. It stays on the DEFAULT page and
   * pulls itself edge-to-edge with negative margins: the named-page
   * contract the scene plates use strands a phantom default sheet at
   * the transition when the plate is a top-level body child.
   */
  PLATE_INTERNAL: 'print-plate--internal',
  /**
   * Dossier arm of the plate stamp — a component injects it on
   * `printprepare` for a scene route's information spread (star-field
   * body cards): same margin-zero named page as the media plates, but
   * paper-backed with padded editorial content instead of an edge-to-edge
   * still. Long dossiers fragment to continuation sheets.
   */
  PLATE_DOSSIER: 'print-plate--dossier',
  /**
   * Section cover — a component-injected part-opener carrying the face
   * page's own ink sheet + orbital rings (`.print-face` sibling), so a
   * multi-part document (star-field's per-group dossier book) opens
   * each category with the same divider the front matter uses.
   */
  SECTION: 'print-section',
  /** Section-cover part number — the small "01" line over the title. */
  SECTION_NUM: 'print-section-num',
  /** Section-cover title — the localized group name at the hub. */
  SECTION_TITLE: 'print-section-title',
  /** Section-cover count — the seated-records line under the title. */
  SECTION_COUNT: 'print-section-count',
  /**
   * Contents page — the injected sheet seated between the face page and
   * the first content page: the magazine's table of contents, built
   * from the live headings since paper has no nav chrome.
   */
  TOC: 'print-toc',
  /** Contents masthead — the "Contents" title line. */
  TOC_HEAD: 'print-toc-head',
  /** Numbered top-level entry (a section head). */
  TOC_ITEM: 'print-toc-item',
  /** Indented unnumbered entry (a card title inside its section). */
  TOC_ITEM_SUB: 'print-toc-item--sub',
  /** The entry's running section number cell. */
  TOC_NUM: 'print-toc-num',
  /** The entry's heading text cell. */
  TOC_TEXT: 'print-toc-text',
  /**
   * Gate veil — the fullscreen scrim the gated entry (Ctrl/Cmd+P,
   * window.print) seats over the page while settle + prep + the decode
   * barrier rebuild the DOM for paper: the scroll sweep, layer climbs,
   * plate reparents and src swaps would otherwise read as the site
   * glitching mid-build. Screen chrome, not a print node — the print
   * sheet hides it outright in _print.scss. Rides the open dialog and
   * drops only with the job's teardown.
   */
  VEIL: 'print-veil',
  /** Gate veil's outer orbital ring — the face page spinner's echo. */
  VEIL_SPINNER: 'print-veil-spinner',
  /** Gate veil's inner counter-orbiting ring. */
  VEIL_SPINNER_INNER: 'print-veil-spinner-inner',
})
