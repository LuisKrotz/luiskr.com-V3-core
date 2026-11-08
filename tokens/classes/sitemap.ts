/**
 * @file tokens/classes/sitemap.js
 * @description Sitemap page class tokens — token group for the
 * <view-sitemap> chrome (title, intro, DOM link index).
 */

import { _B_SITEMAP } from '../base.js'

/**
 * Frozen sitemap class-name map — sole declaration site for these tokens; consumers read
 * members and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes
 * the token contract immutable at runtime.
 */
export const SITEMAP_CLASSES = Object.freeze({
  /** Page wrapper — the full-bleed sitemap column. */
  SITEMAP: _B_SITEMAP,
  /** Page <h1> — the localized sitemap title. */
  SITEMAP_TITLE: `${_B_SITEMAP}-title`,
  /** Intro line under the title — the localized page description. */
  SITEMAP_INTRO: `${_B_SITEMAP}-intro`,
  /** The DOM link index — <nav> with the full nested link tree. */
  SITEMAP_INDEX: `${_B_SITEMAP}-index`,
  /** One section group (pages/legal/portfolio/playground/docs). */
  SITEMAP_GROUP: `${_B_SITEMAP}-group`,
  /** Group heading — the localized section name. */
  SITEMAP_GROUP_TITLE: `${_B_SITEMAP}-group-title`,
  /** Disclosure button inside a collapsible group's heading — toggles the
   *  media walls (they mount their cards on first open). */
  SITEMAP_GROUP_TOGGLE: `${_B_SITEMAP}-group-toggle`,
  /** Disclosure chevron SVG inside the toggle — its aria-expanded
   *  transform is replayed as a mount animation (the view re-renders
   *  fresh nodes on toggle, so a transition can't run). */
  SITEMAP_GROUP_CHEVRON: `${_B_SITEMAP}-group-chevron`,
  /** One-shot spin stamped on the just-OPENED group's chevron — the
   *  keyframe sweeps the closed angle to the node's resting transform. */
  SITEMAP_GROUP_CHEVRON_SPIN_OPEN: `${_B_SITEMAP}-group-chevron--spin-open`,
  /** Same one-shot contract for the just-CLOSED group — sweeps the
   *  open angle back to rest. */
  SITEMAP_GROUP_CHEVRON_SPIN_CLOSE: `${_B_SITEMAP}-group-chevron--spin-close`,
  /** Mosaic modifier — media groups span the full grid and render one
   *  packed card wall (the skyline masonry), not the page-list flow. */
  SITEMAP_GROUP_MOSAIC: `${_B_SITEMAP}-group--mosaic`,
  /** Wide modifier — a long flat group (portfolio) spans the full
   *  index grid and flows its page rows into multi-column tracks
   *  instead of one tall single column. */
  SITEMAP_GROUP_WIDE: `${_B_SITEMAP}-group--wide`,
  /** Packed tile wall — the skyline packer's coordinate space; tile
   *  geometry is all inline styles. */
  SITEMAP_WALL: `${_B_SITEMAP}-wall`,
  /** One packed media card — media + caption overlays. */
  SITEMAP_CARD: `${_B_SITEMAP}-card`,
  /** Card title link — the top caption overlay (DOM-first, before media). */
  SITEMAP_CARD_TITLE: `${_B_SITEMAP}-card-title`,
  /** Card locale-chip row — the bottom caption overlay. */
  SITEMAP_CARD_LOCALES: `${_B_SITEMAP}-card-locales`,
  /** <media-figure> host class inside a card (classes attr passthrough). */
  SITEMAP_CARD_FIGURE: `${_B_SITEMAP}-card-figure`,
  /** Plain capture <img> inside a card — playground share images have no
   *  mozjpeg ladder, so they paint the absolute file URL directly. */
  SITEMAP_CARD_IMG: `${_B_SITEMAP}-card-img`,
  /** Page row inside a group — page link + its locale chips. */
  SITEMAP_PAGE: `${_B_SITEMAP}-page`,
  /** The page's own link (current locale). */
  SITEMAP_PAGE_LINK: `${_B_SITEMAP}-page-link`,

  /** Locale-chip row under a page link. */
  SITEMAP_LOCALES: `${_B_SITEMAP}-locales`,
  /** One locale chip — a leaf link to the page's localized URL. */
  SITEMAP_LOCALE: `${_B_SITEMAP}-locale`,

  /** Locale-code legend under the intro — the <fieldset> decoding each
   *  uppercase chip (EN, BR, HRK, …) into its language name. */
  SITEMAP_LANGS: `${_B_SITEMAP}-langs`,
  /** The fieldset's <legend> label — names the decoder block. */
  SITEMAP_LANGS_TITLE: `${_B_SITEMAP}-langs-title`,
  /** The <ul> of "CODE — Name" pairs inside the fieldset. */
  SITEMAP_LANGS_LIST: `${_B_SITEMAP}-langs-list`,
  /** One legend item — a "CODE — Name" list row. */
  SITEMAP_LANG: `${_B_SITEMAP}-lang`,
  /** The legend's code term — the uppercase chip abbreviation. */
  SITEMAP_LANG_CODE: `${_B_SITEMAP}-lang-code`,
  /** The legend's language description — the locale's full label. */
  SITEMAP_LANG_NAME: `${_B_SITEMAP}-lang-name`,
})
