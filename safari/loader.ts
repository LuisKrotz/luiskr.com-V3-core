/**
 * @file safari-loader.js
 * @description Safari/iOS compatibility bundle entry — imports the
 * Safari compat SCSS and the prototype patches.
 * Dynamically imported ONLY when feature detection in main.js determines
 * the browser needs it (`!CSS.supports('container-type','inline-size')`
 * or an Apple/GestureEvent signal). Vite code-splits this into its own
 * chunk at build time, so Chrome, Firefox, and Safari 16+ never download
 * or execute it — old-iOS users pay the compat cost alone.
 *
 * The iOS 14.x–15.3 baseline shims (polyfills.ts) are NOT part of this
 * graph: the inline browser-loader fetches them as a guarded classic
 * script before the tier bundle, so modern engines never download the
 * bytes and old engines still get them before any app module evaluates.
 */
/* istanbul ignore file */
import '@core/sass/components/safari/safari-compat.scss'
import './patch.js'
