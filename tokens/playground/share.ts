/**
 * @file tokens/playground/share.ts
 * @description Playground share-capture contract — the bucket key
 * prefixes every shareable engine screenshot uploads under
 * (`${CDN_URLS.CDN_BASE}experiments/<experiment>/share/` on the public
 * GCS bucket), the site-served manifest URLs the build emits and the
 * runtime fetches for the random og:image rotation, and the image
 * extensions accepted into each set. Kept import-free so the standalone
 * Node build generators can consume it under plain type-stripping.
 */

/** Image extensions accepted into every share set — one declaration so all sets admit the same capture formats. */
const SHARE_IMAGE_EXTS = Object.freeze(['.png', '.jpg', '.jpeg', '.webp'])

/**
 * Earth Playground share-capture tokens. Sole declaration site — consumers
 * (build generators, runtime share rotation) import members from this
 * frozen map rather than re-declaring the literals (zero-hardcoding rule).
 */
export const EARTH_SHARE = Object.freeze({
  /** Bucket key prefix (relative to the media manifest root) every share capture lives under. */
  PREFIX: 'experiments/earth-playground/share/',
  /** Site-served JSON manifest of the share set — emitted at build time, fetched lazily by the runtime rotation. */
  MANIFEST_URL: '/meta/earth-playground-share.json',
  /** Image extensions accepted into the share set. */
  IMAGE_EXTS: SHARE_IMAGE_EXTS,
})

/**
 * Star Field share-capture tokens — the star-field experiment's parallel
 * of EARTH_SHARE: engine screenshots under the star-field share/ prefix
 * feed the same og:image rotation, sitemap image tags, parked gallery
 * and JSON-LD ImageObject ItemList surfaces.
 */
export const STAR_SHARE = Object.freeze({
  /** Bucket key prefix (relative to the media manifest root) every share capture lives under. */
  PREFIX: 'experiments/star-field/share/',
  /** Site-served JSON manifest of the share set — emitted at build time, fetched lazily by the runtime rotation. */
  MANIFEST_URL: '/meta/star-field-share.json',
  /** Image extensions accepted into the share set. */
  IMAGE_EXTS: SHARE_IMAGE_EXTS,
})
