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
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { webpSibling, webmSibling, encodeMediaUrl } from '../media.js'

/** Parsed bucket key set — null until (or unless) the manifest fetch lands. */
let keys: Set<string> | null = null

/** In-flight fetch dedupe — multiple boot callers share one request. */
let pending: Promise<void> | null = null

/**
 * Fetch-failure latch — true once the manifest request rejects and the
 * caller settles into originals-only mode. Separate from `keys` (which
 * stays null on failure) so render gates can distinguish "still
 * unknown — hold off the heavy <img> fetch" from "proven absent — serve
 * the original". A later successful retry clears the latch.
 */
let failed = false

/**
 * Arrival subscribers — media-gated renders (mosaics, related cards,
 * figures) run before the manifest lands and emit originals-only markup;
 * each subscriber re-renders on arrival so manifest-proven thumb/webp
 * rungs replace the heavy fallbacks. Drained on fire — one-shot by
 * design: the manifest never invalidates after it loads.
 */
const listeners = new Set<() => void>()

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
        failed = false

        for (const cb of listeners) cb()

        listeners.clear()
      })
      .catch(() => {
        // Offline/fetch denial — stay unmanifested (null ⇒ no variant
        // knowledge, originals only) and clear `pending` so a later call
        // retries rather than latching the transient failure. Subscribers
        // still fire — they re-render into the originals fallback.
        pending = null
        failed = true

        for (const cb of listeners) cb()
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
 * Whether the manifest request settled into failure. Paired with
 * `mediaManifestReady()` it lets renders tell "manifest still in flight"
 * (hold the heavy original <img> — the LQIP box paints) from "proven
 * unmanifested" (emit the original — no variants exist to wait for).
 * @returns true once the fetch rejected; cleared on a later success.
 */
export function mediaManifestFailed(): boolean {
  return failed
}

/**
 * Fires `cb` when the manifest lands — components that rendered
 * originals-only pictures subscribe here and re-render so proven
 * thumb/webp siblings replace the heavy fallbacks. When the manifest is
 * already loaded `cb` runs synchronously (subscribe-then-render callers
 * emit the upgraded markup on their first pass). The returned disposer
 * detaches the listener — call it in disconnectedCallback/onDestroy so
 * nothing re-renders a torn-down element.
 * @param cb Re-render callback, one-shot.
 * @returns Unsubscribe disposer.
 */
export function onMediaManifest(cb: () => void): () => void {
  if (keys) {
    cb()

    return () => {}
  }

  listeners.add(cb)

  return () => {
    listeners.delete(cb)
  }
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

/**
 * One proven rung on a progressive-cover quality ladder — the jpg URL
 * plus its webp sibling ('' when the manifest can't prove it).
 */
export interface CoverRung {
  /** Proven .jpg variant URL for the tier. */
  jpg: string
  /** Proven .webp sibling, '' when the manifest can't prove it. */
  webp: string
}

/** Manifest-gated cover URL matrix — see coverVariants(). */
export interface CoverVariants {
  /** URL for the LQIP <img src> — kodak blur thumb when proven, else the original. */
  src: string
  /** webp matching `src`, '' when not proven. */
  webp: string
  /** ≤768px LQIP jpg for a media-scoped <source>, '' when not proven. */
  mobileJpg: string
  /** ≤768px LQIP webp — preferred over mobileJpg when both exist. */
  mobileWebp: string
  /** Ascending display-quality rungs the high layer climbs (coverLadderStep
   *  walks them, highest proven quality last) — empty when no LQIP
   *  exists, since `src` is then already the original. */
  rungs: CoverRung[]
  /** Ascending rungs on the 768px `{stem}-mobile` derivative ladder —
   *  the correct climb for boxes ≤768 CSS px (the same stem grammar, so
   *  every rung is a fraction of its full-width twin's bytes). Empty when
   *  the manifest proves no mobile tier. */
  mobileRungs: CoverRung[]
}

/**
 * Ascending quality-tier suffixes for a cover ladder — q50 → q75 → the
 * raw original → uncompressed, mirroring the build-time IMAGE_VARIANTS
 * quality order in shared/scripts/build/media-manifest.mjs (uncompressed
 * pass preferred, then raw original). The '' entry is the original URL.
 */
const LADDER_SUFFIXES: readonly string[] = Object.freeze([
  MEDIA.Q50,
  MEDIA.Q75,
  ATTR_VALUES.EMPTY,
  MEDIA.Q100,
])

/**
 * Builds the ascending upgrade ladder for one `covers/<stem>.jpg` URL —
 * every derivative rung is `mediaKeyExists`-proven so a swapped-in src
 * can never 404; the original row ('' suffix) is always trusted because
 * it IS the URL the database points at. Non-.jpg input keeps its stem
 * whole and resolves to just the passthrough original rung.
 * @param stemJpg Emission-encoded media URL ending in .jpg (original).
 * @returns Ascending rungs — lowest quality first, highest last.
 */
export function coverRungs(stemJpg: string): CoverRung[] {
  const stem = stemJpg.endsWith(MEDIA.EXT) ? stemJpg.slice(0, -MEDIA.EXT.length) : stemJpg

  return LADDER_SUFFIXES.flatMap((suffix) => {
    const jpg = suffix ? encodeMediaUrl(`${stem}${MEDIA.MOZ}${suffix}${MEDIA.EXT}`) : stemJpg

    return jpg === stemJpg || mediaKeyExists(jpg) ? [{ jpg, webp: webpIfExists(jpg) }] : []
  })
}

/**
 * Fully manifest-gated quality ladder for an extensionless media stem
 * (`folder/pic` — the figure/video grammar where derived files are
 * `stem-mozjpg-<quality>.jpg`). Unlike coverRungs even the raw
 * `{stem}.jpg` is proven by mediaKeyExists — the pipeline emits only
 * suffixed tiers, so an untrusted passthrough could 404. Returns [] when
 * the manifest is absent or proves nothing; callers then fall back to
 * the historic "the request IS the check" probe.
 * @param stem Emission-encoded media URL without an extension.
 * @returns Ascending proven rungs — lowest quality first, highest last.
 */
export function mediaRungs(stem: string): CoverRung[] {
  return LADDER_SUFFIXES.flatMap((suffix) => {
    const jpg = encodeMediaUrl(
      `${stem}${suffix ? `${MEDIA.MOZ}${suffix}` : ATTR_VALUES.EMPTY}${MEDIA.EXT}`
    )

    return mediaKeyExists(jpg) ? [{ jpg, webp: webpIfExists(jpg) }] : []
  })
}

/**
 * Resolves the progressive cover matrix for one `covers/<stem>.jpg` URL:
 * the kodak LQIP blur-up (plus its 768px mobile tier and webp siblings)
 * as the first paint, and `rungs` as the ascending quality ladder the
 * high layer climbs once bytes confirm — q50 → q75 → original →
 * uncompressed, highest proven tier last. Every variant is gated on
 * `mediaKeyExists` so an unproven object can never become a card's only
 * image; a missing/never-loaded manifest yields the original URL with
 * its own webp probe and no ladder (`rungs` stays empty).
 * @param coverJpg Emission-encoded covers/*.jpg URL (original).
 * @returns Bound URLs for picture/img — empty strings mean "omit".
 */
export function coverVariants(coverJpg: string): CoverVariants {
  const stem = coverJpg.endsWith(MEDIA.EXT) ? coverJpg.slice(0, -MEDIA.EXT.length) : coverJpg

  const thumbJpg = encodeMediaUrl(`${stem}${MEDIA.MOZ}${MEDIA.THUMB_SUFFIX}${MEDIA.EXT}`)

  const mobileJpg = encodeMediaUrl(
    `${stem}${MEDIA.MOZ}${MEDIA.THUMB_SUFFIX}${MEDIA.MOBILE_SUFFIX}${MEDIA.EXT}`
  )

  // The jpg is the <img> fallback — only its own manifest hit may promote
  // a variant into `src`; a webp sibling gates itself on the jpg below.
  const hasThumb = mediaKeyExists(thumbJpg)

  const hasMobile = mediaKeyExists(mobileJpg)

  return {
    src: hasThumb ? thumbJpg : coverJpg,
    webp: hasThumb ? webpIfExists(thumbJpg) : webpIfExists(coverJpg),
    mobileJpg: hasMobile ? mobileJpg : ATTR_VALUES.EMPTY,
    mobileWebp: hasMobile ? webpIfExists(mobileJpg) : ATTR_VALUES.EMPTY,
    rungs: hasThumb ? coverRungs(coverJpg) : [],
    // mediaRungs, not coverRungs: the `{stem}-mobile.jpg` original is NOT
    // unconditionally trusted — several buckets carry only the suffixed
    // mobile tiers, so every rung needs its own manifest proof.
    mobileRungs: hasThumb ? mediaRungs(`${stem}${MEDIA.MOBILE_SUFFIX}`) : [],
  }
}
