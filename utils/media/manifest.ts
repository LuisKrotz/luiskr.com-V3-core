/**
 * @file utils/media/manifest.ts
 * @description Runtime knowledge of which CDN objects exist, backed by the
 * build-time bucket manifest (`/meta/media-manifest.json`). Needed because
 * `<picture><source>` selection is type-based only — a 404 on a <source>
 * never falls back to <img>, so a webp/webm variant may be offered only
 * when the manifest confirms the object exists. Unknown ⇒ omit the source;
 * the <img>/<video> original always stands alone.
 */
import { CDN_URLS } from '@core/tokens/media/urls.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { webpSibling, webmSibling, encodeMediaUrl } from '../media.js'

/** Parsed bucket key set — null until (or unless) the manifest fetch lands. */
let keys: Set<string> | null = null

/** In-flight fetch dedupe — multiple boot callers share one request. */
let pending: Promise<void> | null = null

/**
 * Fetches the bucket key manifest once; resolves immediately on repeat
 * calls. Fire-and-forget at boot — renders that happen before it lands
 * simply emit no <source>, which is the safe path.
 */
export function initMediaManifest(): Promise<void> {
  if (keys || typeof fetch !== TYPE_STRINGS.FUNCTION) {
    return Promise.resolve()
  }

  if (!pending) {
    pending = fetch(CDN_URLS.MEDIA_MANIFEST)
      .then((res) => (res.ok ? res.json() : []))
      .then((list: unknown) => {
        keys = new Set(Array.isArray(list) ? (list as string[]) : [])
      })
      .catch(() => {
        // Offline/fetch denial — stay unmanifested (null ⇒ no variant
        // knowledge, originals only) and clear `pending` so a later call
        // retries rather than latching the transient failure.
        pending = null
      })
  }

  return pending
}

/**
 * Whether the manifest has arrived. Lets the media-figure probe distinguish
 * "unknown — try webp" from "known-absent — skip straight to the original".
 */
export function mediaManifestReady(): boolean {
  return keys !== null
}

/**
 * Whether the manifest lists the CDN object behind `url`. Absolute URLs
 * get the CDN_BASE prefix stripped to their bucket key; non-CDN URLs
 * (gravatars, data URIs) always report false — they have no siblings.
 * @param url Full media URL or a raw bucket key.
 */
export function mediaKeyExists(url: string): boolean {
  if (!keys || !url) return false

  let key = url.startsWith(CDN_URLS.CDN_BASE) ? url.slice(CDN_URLS.CDN_BASE.length) : url

  // Callers may hand in an encodeMediaUrl'd URL while bucket keys are
  // stored raw — reverse valid %XX escapes ('%20' → space) so both forms
  // match. Malformed escapes (a '%' not followed by two hex digits) make
  // decodeURI throw, so they short-circuit to the raw comparison.
  if (key.includes('%') && !/%(?![0-9a-fA-F]{2})/.test(key)) {
    key = decodeURI(key)
  }

  return keys.has(key)
}

/**
 * webp sibling of a .jpg URL when the manifest confirms it was generated,
 * '' otherwise — safe srcset input for a <source>: empty means "no source".
 * @param url Original .jpg media URL.
 */
export function webpIfExists(url: string): string {
  const webp = webpSibling(url)

  return webp && mediaKeyExists(webp) ? encodeMediaUrl(webp) : ATTR_VALUES.EMPTY
}

/**
 * webm sibling of an .mp4 URL when it exists in the manifest, '' otherwise.
 * `<video><source>` DOES retry the next source on network failure, so this
 * gate is belt-and-suspenders for saving a doomed request, not correctness.
 * @param url Original .mp4 media URL.
 */
export function webmIfExists(url: string): string {
  const webm = webmSibling(url)

  return webm && mediaKeyExists(webm) ? encodeMediaUrl(webm) : ATTR_VALUES.EMPTY
}
