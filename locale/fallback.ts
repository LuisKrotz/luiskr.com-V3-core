/**
 * @file locale/fallback.ts
 * @description Build-time English translation snapshot. The Vite plugin
 * `virtual:i18n-fallback` inlines `database.json`'s `translations/en` node
 * at build time, so every component has instantly-renderable English copy
 * before (and if) the Firebase fetch resolves — first paint never shows
 * empty labels, and no user-facing string lives in JS source.
 */

import snapshot from 'virtual:i18n-fallback'

/** Per-locale boot-loader copy inlined by the Vite plugin. */
export interface LoaderCopy {
  /** Legacy terminal-style spec lines (English tech log). */
  lines: string[]
  /** Loader headline (brand mark, same across locales). */
  title: string
  /** Localized boot-stage messages shown under the percent. */
  stages: string[]
  [key: string]: unknown
}

/** Shape of the translations/<locale> DB node inlined by the Vite plugin. */
interface FallbackSnapshot {
  APP: {
    actions: { click: string; tap: string }
    carousel: Record<string, unknown>
    statsHud: Record<string, unknown>
    loader: LoaderCopy
    [key: string]: unknown
  }
  /** locale → loader copy — inlined for ALL locales so the boot loader
   *  localizes before the per-locale i18n chunks resolve. */
  loaderLocales: Record<string, LoaderCopy>
  components: Record<string, unknown>
  pages: Record<string, unknown>
  [key: string]: unknown
}

/**
 * English UI copy snapshotted from database.json at build time.
 * Components read live translations from the store first and fall back to
 * this snapshot, so no user-visible string lives in JavaScript source.
 */
export const FALLBACK = Object.freeze(snapshot as FallbackSnapshot)

/**
 * The APP subtree of the fallback snapshot — app-shell copy (actions,
 * carousel labels, loader lines) consumed before Firebase resolves.
 */
export const FALLBACK_APP = FALLBACK.APP

/**
 * Boot-loader copy keyed by locale — every language is inlined so the
 * intro loader can localize its stage messages at boot time, before the
 * async per-locale i18n chunks land.
 */
export const FALLBACK_LOADERS = FALLBACK.loaderLocales

/**
 * The components subtree — per-component copy fallbacks keyed by component
 * token (e.g. aboutSection, siteToast).
 */
export const FALLBACK_COMPONENTS = FALLBACK.components

/**
 * The pages subtree — per-page fallback nodes (home, about, legal…).
 */
export const FALLBACK_PAGES = FALLBACK.pages
