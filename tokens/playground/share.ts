/**
 * @file tokens/playground/share.ts
 * @description Earth Playground share-capture contract — the bucket key
 * prefix every shareable engine screenshot uploads under
 * (`${CDN_URLS.CDN_BASE}experiments/earth-playground/share/` on the public
 * GCS bucket), the site-served manifest URL the build emits and the
 * runtime fetches for the random og:image rotation, and the image
 * extensions accepted into the set. Kept import-free so the standalone
 * Node build generators can consume it under plain type-stripping.
 */

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
  IMAGE_EXTS: ['.png', '.jpg', '.jpeg', '.webp'],
})
