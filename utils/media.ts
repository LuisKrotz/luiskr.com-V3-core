/**
 * @file utils/media.ts
 * @description Media-URL builders — the single place where CDN filename
 * grammar is assembled. `buildMediaUrls` is the authoritative implementation
 * of the mozjpeg/mp4 suffix convention; the Gravatar helpers rewrite the
 * `size=` query param so avatars arrive at the right resolution for the
 * rendered box (and at 1×/2×/3× for srcset).
 */
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { MEDIA } from '@core/tokens/media/suffixes.js'
import { NET_STRINGS } from '@core/tokens/strings/net.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { GRAVATAR_SIZES } from '@core/tokens/media/dimensions.js'
import type { CoverRung } from './media/manifest.js'

/**
 * A media entry's URL-relevant fields as stored in the DB: `src` is the
 * extensionless stem the CDN grammar appends suffixes to, and `isVideo`
 * selects between the image and video suffix sets.
 */
export interface MediaUrlItem {
  src?: string
  isVideo?: boolean
}

/**
 * Resolved media URL triple — the full-quality `source`, the progressive
 * `thumb` (mozjpeg small variant or video poster frame), and the `isVideo`
 * discriminator echoed back so consumers don't re-inspect the item.
 */
export interface MediaUrls {
  source: string
  thumb: string
  isVideo: boolean
}

/**
 * Checks if a given URL belongs to gravatar.com (exact host or any
 * subdomain like `secure.gravatar.com`). Non-Gravatar URLs must not get
 * `size=` rewrites — that param is Gravatar-specific. `new URL` throws on
 * malformed input and relative URLs without a base — the try/catch maps
 * both to `false` (not-Gravatar) since either case is unrewritable anyway.
 * @param urlStr Candidate URL (absolute or relative).
 * @returns Whether the host is gravatar.com or a subdomain.
 */
export const isGravatarUrl = (urlStr: string): boolean => {
  if (typeof urlStr !== TYPE_STRINGS.STRING) return false

  try {
    const origin =
      typeof window !== TYPE_STRINGS.UNDEFINED ? window.location.origin : NET_STRINGS.HTTP_LOCALHOST

    const parsed = new URL(urlStr, origin)

    return (
      parsed.hostname === NET_STRINGS.GRAVATAR_HOSTNAME ||
      parsed.hostname.endsWith(NET_STRINGS.GRAVATAR_HOSTNAME_SUFFIX)
    )
  } catch {
    return false
  }
}

/**
 * Builds responsive Gravatar srcset with 1x, 2x, 3x density descriptors —
 * 200/300/400 px variants chosen by GRAVATAR_SIZE_*. Any existing `size=`
 * param is stripped first so the rewrite is idempotent; `sep` picks `?` or
 * `&` depending on whether other query params remain (stripping `size=`
 * may have consumed the `?`).
 * @param urlStr Gravatar URL to expand.
 * @returns srcset string, or '' for non-Gravatar input.
 */
export const getGravatarSrcset = (urlStr: string): string => {
  if (!isGravatarUrl(urlStr)) return ATTR_VALUES.EMPTY

  const base = urlStr.replace(/(\?|&)size=\d+/, ATTR_VALUES.EMPTY)

  const sep = base.includes('?') ? '&' : '?'

  return `${base}${sep}size=${GRAVATAR_SIZES.GRAVATAR_SIZE_1X} 1x, ${base}${sep}size=${GRAVATAR_SIZES.GRAVATAR_SIZE_2X} 2x, ${base}${sep}size=${GRAVATAR_SIZES.GRAVATAR_SIZE_3X} 3x`
}

/**
 * Replaces the `size=` parameter on a Gravatar URL. Non-Gravatar URLs pass
 * through unchanged (the param is meaningless off-domain), and a URL with
 * no `size=` is left alone since the regex finds no match.
 * @param urlStr Candidate Gravatar URL.
 * @param size Pixel edge to request (default 300 — the rendered avatar box).
 * @returns Rewritten URL, original URL, or '' for non-string input.
 */
export const getOptimizedGravatar = (urlStr: string, size = 300): string => {
  if (!urlStr || typeof urlStr !== TYPE_STRINGS.STRING) return ATTR_VALUES.EMPTY

  if (isGravatarUrl(urlStr)) {
    return urlStr.replace(/size=\d+/, `size=${size}`)
  }

  return urlStr
}

/**
 * Percent-encodes a media URL for attribute/markup emission — bucket keys
 * can carry literal spaces ('brazilian leather/…', '…PARIS FASHION-WEEK…')
 * and non-ASCII ('garçonne'), which the bucket serves fine but which break
 * <source srcset> candidates (its grammar splits on whitespace) and
 * RFC-3986-strict contexts (sitemap locs, JSON-LD image/contentUrl).
 * Idempotent: already-encoded input decodes first, so a %20 never
 * becomes %2520 (encodeURI escapes '%' itself). Malformed escapes make
 * decodeURI throw — the catch emits the input with bare '%' → %25.
 * @param url Raw or encoded media URL (may contain spaces/non-ASCII).
 * @returns The emission-safe URL ('' stays '').
 */
export const encodeMediaUrl = (url: string): string => {
  if (!url) return url

  try {
    return encodeURI(decodeURI(url))
  } catch {
    return encodeURI(url)
  }
}

/**
 * Derives the .webp sibling of a .jpg URL — the compressed-variant naming
 * convention replaces only the extension, so the webp sits beside the
 * original at the same path ("if webp exists" is decided by the request,
 * no manifest lookup). Returns '' for non-.jpg input so callers can
 * conditionally render a <source>.
 * @param url JPG media URL.
 * @returns The same URL with .webp instead of .jpg, or '' when not .jpg.
 */
export const webpSibling = (url: string): string =>
  url.endsWith(MEDIA.EXT)
    ? `${url.slice(0, -MEDIA.EXT.length)}${MEDIA.WEBP_EXT}`
    : ATTR_VALUES.EMPTY

/**
 * Derives the .webm sibling of an .mp4 URL — same convention as
 * webpSibling: `x.mp4` → `x.webm` and `x.mp4-scaledown-2x.mp4` →
 * `x.mp4-scaledown-2x.webm`. Returns '' for non-.mp4 input.
 * @param url MP4 media URL.
 * @returns The same URL with .webm instead of .mp4, or '' when not .mp4.
 */
export const webmSibling = (url: string): string =>
  url.endsWith(MEDIA.VIDEO_EXT)
    ? `${url.slice(0, -MEDIA.VIDEO_EXT.length)}${MEDIA.WEBM_EXT}`
    : ATTR_VALUES.EMPTY

/**
 * `load` step on a progressive cover's high layer — the ladder walker.
 * Records the painted URL in the host registry (re-renders rebuild the
 * shadow DOM wholesale via replaceChildren, so the registry is what
 * re-emits the reached tier instead of replaying from the LQIP) and
 * publishes the loaded class driving the CSS crossfade. When rungs
 * remain above the painted one it preloads the next tier through a
 * detached Image — the probe request doubles as the webp decode check —
 * and swaps `src` only once bytes confirm, so a painted rung can never
 * tear. The swap re-fires the img's own `load`, re-entering this step
 * until the highest proven tier is reached.
 * @param registry Host map of cover key → highest confirmed painted URL
 * (undefined-tolerant: a bare host still gets the class + the climb, it
 * just can't persist the reached tier across re-renders).
 * @param coverKey Stable identity of the cover (the original URL).
 * @param img The high-layer img that fired `load` (event currentTarget).
 * @param rungs Ascending proven tiers from coverVariants — last is top.
 * @param loadedClass Class token that turns the layer's opacity on.
 */
export function coverLadderStep(
  registry: Map<string, string> | undefined,
  coverKey: string,
  img: HTMLImageElement | null,
  rungs: CoverRung[],
  loadedClass: string
): void {
  if (!img || !rungs.length) return

  const painted = img.currentSrc || img.src

  registry?.set(coverKey, painted)

  img.classList.add(loadedClass)

  const idx = rungs.findIndex((rung) => rung.jpg === painted || rung.webp === painted)

  if (idx < 0 || idx >= rungs.length - 1) return

  const next = rungs[idx + 1]

  let target = next.webp || next.jpg

  /** Publishes a confirmed tier — the emitted rung-0 <source> has served
   *  by now, so its <source> nodes go and img.src becomes authoritative;
   *  the resulting `load` re-enters this step to climb the next rung. */
  const advance = (): void => {
    const pic = img.closest(HTML_TAGS.PICTURE)

    pic?.querySelectorAll(HTML_TAGS.SOURCE).forEach((source) => source.remove())

    img.src = target

    registry?.set(coverKey, target)
  }

  // Match loadHighRes: no Image constructor means no probe — assign the
  // universally-decodable jpg directly and let the img's own load drive.
  const ImageCtor =
    typeof window !== TYPE_STRINGS.UNDEFINED && window.Image
      ? window.Image
      : typeof Image !== TYPE_STRINGS.UNDEFINED
        ? Image
        : null

  if (!ImageCtor) {
    target = next.jpg

    advance()

    return
  }

  const probe = new ImageCtor()

  probe.onload = advance

  probe.onerror = () => {
    // A manifest-proven webp can still fail to decode — retry the jpg
    // once; a dead jpg leaves the painted rung standing.
    if (target !== next.jpg) {
      target = next.jpg

      probe.src = target
    }
  }

  probe.src = target
}

/**
 * Constructs media URLs for images and videos following the project's
 * compression pipeline. URL grammar:
 *   image source : storage + folder + src + '-mozjpg-uncompressed.jpg'   (full quality)
 *   image thumb  : storage + folder + src + '-mozjpg3-MSSIM-tuned-kodak.jpg' (blur-up)
 *   video source : storage + folder + src + '.mp4'
 *   video thumb  : storage + folder + src + '.mp4.jpg-thumb.jpg'         (poster frame)
 * `src` in the DB never carries an extension — the pipeline's suffix is
 * appended here, which is why an unsuffixed URL 404s.
 * @param storage - Base storage URL (store.getters.getStorage())
 * @param folder - Project folder prefix, e.g. 'aboutmarco/'
 * @param item - Media item descriptor `{ src, isVideo }`
 */
export const buildMediaUrls = (
  storage: string,
  folder: string,
  item: MediaUrlItem | null
): MediaUrls => {
  if (!item || !storage)
    return { source: ATTR_VALUES.EMPTY, thumb: ATTR_VALUES.EMPTY, isVideo: false }

  // `?? false`: a missing flag means image — the DB only marks videos
  // explicitly, so undefined must not flip an image into the mp4 grammar.
  const isVideo = item.isVideo ?? false

  // Missing folder/src collapse to '' so the result is an empty-suffix URL
  // the caller's `|| placeholder` handling can reject — never 'undefined'.
  const srcPath = (folder || ATTR_VALUES.EMPTY) + (item.src || ATTR_VALUES.EMPTY)

  // Outputs are emission-encoded — schema JSON-LD and attribute consumers
  // both receive canonical URLs; the raw-space bucket form never leaks.
  const source = encodeMediaUrl(
    isVideo
      ? `${storage}${srcPath}${MEDIA.VIDEO_EXT}`
      : `${storage}${srcPath}${MEDIA.MOZ}${MEDIA.Q100}${MEDIA.EXT}`
  )

  const thumb = encodeMediaUrl(
    isVideo
      ? `${storage}${srcPath}${MEDIA.VIDEO_THUMB_EXT}`
      : `${storage}${srcPath}${MEDIA.MOZ}${MEDIA.THUMB_SUFFIX}${MEDIA.EXT}`
  )

  return { source, thumb, isVideo }
}
