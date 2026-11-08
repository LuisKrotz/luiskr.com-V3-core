/**
 * @file wasm-worker.js
 * @description Batch-compute worker for the wasm pool: instantiates the
 * shared engine.wasm numeric module once, then serves every dispatched
 * action off the main thread — masonry layout, media analytics, spring
 * integration, draw-text timing, media-hash keys, image/svg decode,
 * video prefetch/probe/segment fetch, docs-scene sphere packing,
 * star-field buffer fills, deepfield record decode, and route-search
 * scoring. Every handler mirrors its main-thread JS fallback exactly so
 * worker and fallback output can never drift.
 *
 * Contract notes:
 * - Message `type` strings mirror core/tokens/data/wasm.ts WASM_ACTIONS
 *   (+ WASM_STRINGS.BATCH_LAYOUT); a worker cannot import the TS tokens,
 *   so the wire names are redeclared here as bare strings — keep both
 *   files in sync.
 * - Tuning constants mirror token modules (DRAW_TIMINGS, MASONRY,
 *   DOCS_UNITS) for the same reason; each bag documents its source.
 *   Where the dispatcher ships a token bag it arrives as `params` and is
 *   the live source — never redeclare those values here.
 * - Result shapes ({ results, kept }, { results, totalHeight }, …) are
 *   the pool's wire contract — field names must not change.
 */

// ── Worker-level tokens (mirrors of TS token modules — see header) ───

/** engine.wasm URL — mirrors WASM_POOL.ENGINE_URL (tokens/data/wasm.ts). */
const ENGINE_URL = '/scripts/wasm/engine.wasm'

/** READY/ERROR lifecycle message types posted before any dispatch lands. */
const LIFECYCLE = Object.freeze({ READY: 'READY', ERROR: 'ERROR' })

/** Masonry aspect multipliers — mirrors MASONRY.COMP_MULTS (tokens/layout/masonry.ts). */
const COMP_MULTS = Object.freeze([0.56, 0.58, 0.54, 0.57, 0.55])
/** Featured-card aspect multiplier — featured tiles render wider/shorter. */
const FEATURED_MULT = 0.48
/** Column-span contract: dense grids (≥14 cols) span 6/4; featured spans 2 otherwise. */
const DENSE_COLS = 14
const DENSE_FEATURED_SPAN = 6
const DENSE_SPAN = 4
const FEATURED_SPAN = 2
/** Dense-grid column candidates, per span (precomputed anchor sets). */
const DENSE_CANDIDATES_FEATURED = Object.freeze([0, 8, 4])
const DENSE_CANDIDATES_NORMAL = Object.freeze([0, 4, 6, 8, 10])

/** Draw-text clamps — mirrors DRAW_TIMINGS (tokens/media/dimensions.ts). */
const DRAW_DELAY_MIN_MS = 1
const DRAW_DELAY_MAX_MS = 22
const DRAW_INDEX_STEP_MS = 30
const DRAW_TARGET_MS = 1800
/** Media-aspect fallback when dims are missing — 16:9. */
const ASPECT_FALLBACK_W = 16
const ASPECT_FALLBACK_H = 9

/** Spring integrator defaults + fixed step (seconds — ~60 Hz frame). */
const SPRING_STIFFNESS = 180
const SPRING_DAMPING = 12
const SPRING_DT = 0.016

/** djb2 hash seed — the media-key hash algorithm's fixed start. */
const DJB2_SEED = 5381

/** Byte-range prefetch probes — 256 KB warm / 128 KB probe. */
const PREFETCH_RANGE_BYTES = 262143
const PROBE_RANGE_BYTES = 131071

/** Docs-scene constants — mirrors DOCS_UNITS (tokens/strings/docs.ts). */
const DOCS_SCENE = Object.freeze({
  GOLDEN_ANGLE: 2.399963, // DOCS_UNITS.SCENE_Y_HASH — the golden-angle spiral step.
  SPIN_HASH: 4.208, // DOCS_UNITS.SCENE_SPIN_HASH — per-parent phase rotation.
  MIN_ORBIT: 6, // DOCS_UNITS.SCENE_MIN_ORBIT — cluster orbit floor.
  MIN_SEP: 12, // DOCS_UNITS.SCENE_MIN_SEP — minimum node separation.
  CHILD_SCALE: 0.72, // DOCS_UNITS.SCENE_CHILD_SCALE — orbit shrink per level.
  GLYPH_MAX: 3, // DOCS_UNITS.SCENE_GLYPH_MAX — icon size cap.
  DIR_RADIUS: 1.15, // DOCS_UNITS.SCENE_DIR_RADIUS — folder glyph radius.
  FILE_RADIUS: 0.55, // DOCS_UNITS.SCENE_FILE_RADIUS — file glyph radius.
  GLYPH_FIT: 0.14, // DOCS_UNITS.SCENE_GLYPH_FIT — icon-to-orbit ratio.
  RELAX_ITERS: 30, // DOCS_UNITS.SCENE_RELAX_ITERS — pairwise relaxation passes.
  EPSILON: 1e-6, // Division guard for coincident nodes.
  ANCHOR_INDEX: 0, // The root node never moves during relaxation.
})

/** Star-field bubble-carve respawn cap — max attempts to replace a point
 *  that lands inside a void bubble before keeping the dimmed original. */
const BUBBLE_RETRIES = 8

/** LCG stream constants — Numerical Recipes multiplier/increment. */
const LCG_MULT = 1664525
const LCG_INC = 1013904223
const LCG_NORM = 4294967296

/** Route-search score weights — title > keywords > path > preview. */
const SEARCH_SCORE = Object.freeze({
  TITLE_EXACT: 100,
  TITLE_PREFIX: 60,
  TITLE_CONTAINS: 40,
  KEYWORD: 25,
  PATH: 15,
  PREVIEW: 10,
  EMPTY_QUERY: 1,
})

/** Shared fetch options — worker fetches always reuse the browser cache. */
const FORCE_CACHE = Object.freeze({ cache: 'force-cache' })

/** Instantiated engine.wasm export table — null until the fetch below lands. */
let wasmInstance = null

/**
 * `isCrossOriginUrl` — true for absolute http(s) URLs outside this
 * origin: workers must not fan out third-party fetches (CORS + cache
 * semantics differ); callers keep their own fallback for those.
 * @param url Candidate URL.
 * @returns True when the URL is cross-origin.
 */
const isCrossOriginUrl = (url) =>
  typeof url === 'string' && url.startsWith('http') && !url.startsWith(self.location.origin)

/**
 * `bitmapOptions` — the createImageBitmap option set shared by every
 * decode handler: GPU-hardware resize at decode time, no CPU color
 * transforms, EXIF orientation respected.
 * @param width Requested decode width px (0 = natural).
 * @param height Requested decode height px (0 = natural).
 * @returns The option bag.
 */
const bitmapOptions = (width, height) => {
  const options = {
    colorSpaceConversion: 'none',
    premultiplyAlpha: 'none',
    imageOrientation: 'from-image',
  }

  if (width > 0) options.resizeWidth = width

  if (height > 0) options.resizeHeight = height

  if (width > 0 || height > 0) options.resizeQuality = 'high'

  return options
}

/**
 * `decodeBitmap` — decode a Blob to ImageBitmap with the shared options,
 * falling back to a bare decode when the engine rejects resize/color
 * options (older engines).
 * @param blob The image bytes.
 * @param width Requested width px. @param height Requested height px.
 * @returns Promise<ImageBitmap>.
 */
const decodeBitmap = (blob, width, height) =>
  createImageBitmap(blob, bitmapOptions(width, height)).catch(() => createImageBitmap(blob))

/**
 * `callEngine` — invoke an engine.wasm export when the module is live,
 * else return undefined so the caller's JS fallback expression applies.
 * @param name Export name.
 * @param args Numeric args (engine routines are number-only).
 * @returns The wasm result, or undefined.
 */
const callEngine = (name, ...args) =>
  wasmInstance && typeof wasmInstance[name] === 'function' ? wasmInstance[name](...args) : undefined

/**
 * `post` — reply on the current dispatch: type + id correlation, the
 * results payload, any extra sibling fields (BATCH_LAYOUT adds
 * totalHeight next to results), and an optional transfer list for
 * zero-copy results.
 * @param id Dispatch id. @param type Result type string.
 * @param results Result payload. @param transfer Optional transferables.
 * @param extra Optional sibling fields merged into the message.
 */
const post = (id, type, results, transfer, extra) =>
  transfer
    ? self.postMessage({ id, type, results, ...extra }, transfer)
    : self.postMessage({ id, type, results, ...extra })

// ── Engine bootstrap ─────────────────────────────────────────────────
// Instantiate engine.wasm once at worker start; READY tells the pool the
// thread is usable. A failed module still runs — every handler falls
// back to its inline JS formula, so the worker degrades gracefully.
fetch(ENGINE_URL)
  .then((res) => {
    if (!res.ok) throw new Error('WASM fetch failed')

    return res.arrayBuffer()
  })
  .then((bytes) => WebAssembly.instantiate(bytes))
  .then(({ instance }) => {
    wasmInstance = instance.exports

    self.postMessage({ type: LIFECYCLE.READY })
  })
  .catch((err) => {
    self.postMessage({ type: LIFECYCLE.ERROR, error: err ? err.message : 'WASM init error' })
  })

self.onmessage = async (event) => {
  const { id, type, payload } = event.data || {}

  if (!type) return

  if (type === 'BATCH_LAYOUT') {
    // Masonry packing: place each item in its lowest-height candidate
    // column run, tracking per-column tops. Featured cards span wider.
    const { items, cols, containerW, gap } = payload
    const columnCount = cols || 1
    const columnWidth = Math.floor(
      callEngine('calc_column_width', columnCount, containerW, gap) ??
        (containerW - (columnCount - 1) * gap) / columnCount
    )
    const columnHeights = Array(columnCount).fill(0)

    const results = (items || []).map((item, index) => {
      const isFeatured = !!item.featured
      const aspectMult = isFeatured ? FEATURED_MULT : COMP_MULTS[index % COMP_MULTS.length]
      const columnSpan =
        columnCount >= DENSE_COLS
          ? isFeatured
            ? DENSE_FEATURED_SPAN
            : DENSE_SPAN
          : isFeatured && columnCount > 1
            ? FEATURED_SPAN
            : 1
      const itemWidth = columnSpan * columnWidth + (columnSpan - 1) * gap
      const imageHeight = Math.round(itemWidth * aspectMult)

      // Dense grids probe a fixed anchor set; sparse grids probe every
      // legal span start.
      const candidates =
        columnCount >= DENSE_COLS
          ? columnSpan === DENSE_FEATURED_SPAN
            ? DENSE_CANDIDATES_FEATURED
            : DENSE_CANDIDATES_NORMAL
          : Array.from({ length: columnCount - columnSpan + 1 }, (_, c) => c)

      // Lowest-top candidate run of `columnSpan` consecutive columns.
      let bestColumn = 0
      let bestTop = Infinity

      for (const candidate of candidates) {
        let top = 0

        for (let s = 0; s < columnSpan; s++) top = Math.max(top, columnHeights[candidate + s])

        if (top < bestTop) {
          bestTop = top
          bestColumn = candidate
        }
      }

      const top = bestTop
      const left = bestColumn * (columnWidth + gap)

      for (let s = 0; s < columnSpan; s++) columnHeights[bestColumn + s] = top + imageHeight + gap

      return { index, itemW: itemWidth, imageH: imageHeight, colW: columnWidth, top, left }
    })

    const totalHeight = Math.max(...columnHeights) - gap

    post(id, 'BATCH_LAYOUT_RESULT', results, undefined, { totalHeight })
  } else if (type === 'PROCESS_MEDIA_ANALYTICS') {
    // Card height for a single media tile — aspect falls back to 16:9
    // when the CMS row lacks dims.
    const { width, height, isVideo } = payload
    const aspectRatio = (width || ASPECT_FALLBACK_W) / (height || ASPECT_FALLBACK_H)
    const cardH = callEngine('calc_card_height', width, aspectRatio, 0) ?? width / aspectRatio

    post(id, 'MEDIA_ANALYTICS_RESULT', { aspectRatio, cardH, isVideo })
  } else if (type === 'COMPUTE_SPRING_PHYSICS') {
    // One semi-implicit Euler step: a = k(x_target − x) − c·v, then
    // v += a·dt and x += v·dt — the same integrator the main thread runs.
    const {
      current = 0,
      target = 1,
      velocity = 0,
      stiffness = SPRING_STIFFNESS,
      damping = SPRING_DAMPING,
    } = payload
    const distance = target - current
    const force = distance * stiffness
    const dampForce = velocity * damping
    const accel = force - dampForce
    const newVelocity = velocity + accel * SPRING_DT
    const newPosition = current + newVelocity * SPRING_DT

    post(id, 'SPRING_PHYSICS_RESULT', { position: newPosition, velocity: newVelocity })
  } else if (type === 'DOCS_SCENE_LAYOUT') {
    // Docs architecture scene: batch hierarchical-sphere positions
    // off-thread. Payload: { parents, sibs, sibCounts, dirs } — results
    // carry the flattened xyz triplets in node order (the formula mirrors
    // the main-thread fallback in arch-scene.ts; DOCS_SCENE above mirrors
    // the DOCS_UNITS token bag). Cluster radii use the reference's
    // shrink-ratio orbit with a sibling-glyph clearance floor — a single
    // forward pass (parents precede children in placed order), NOT
    // subtree-extent packing, which grows exponentially past ~a hundred
    // nodes.
    const { parents = [], sibs = [], sibCounts = [], dirs = [] } = payload
    const nodeCount = parents.length
    const xyz = new Float32Array(nodeCount * 3)
    const scale = new Float32Array(nodeCount)
    const cluster = new Float64Array(nodeCount)
    const kids = new Int32Array(nodeCount)

    for (let i = 0; i < nodeCount; i++) if (parents[i] >= 0) kids[parents[i]]++

    for (let i = 0; i < nodeCount; i++) {
      const childCount = kids[i]
      const parent = parents[i]
      const inherited = parent >= 0 ? cluster[parent] * DOCS_SCENE.CHILD_SCALE : 0

      cluster[i] =
        childCount === 0
          ? 0
          : Math.max(
              DOCS_SCENE.MIN_ORBIT,
              inherited,
              (2 * DOCS_SCENE.GLYPH_MAX + DOCS_SCENE.MIN_SEP) /
                (2 * Math.sin(Math.PI / Math.max(childCount, 2)))
            )
    }

    for (let i = 0; i < nodeCount; i++) {
      const parent = parents[i]
      const orbit = parent < 0 ? cluster[0] : cluster[parent]
      const baseRadius = dirs[i] ? DOCS_SCENE.DIR_RADIUS : DOCS_SCENE.FILE_RADIUS

      // Orbit-proportional glyph (the reference's icon-to-orbit ratio),
      // capped at GLYPH_MAX — the size the sibling chord guarantees;
      // the root always renders at GLYPH_MAX (the big center hub).
      scale[i] =
        parent < 0
          ? DOCS_SCENE.GLYPH_MAX / baseRadius
          : Math.max(1, Math.min(DOCS_SCENE.GLYPH_FIT * orbit, DOCS_SCENE.GLYPH_MAX) / baseRadius)

      if (parent < 0) continue

      const sibTotal = Math.max(sibCounts[i], 1)
      const sibIndex = sibs[i]
      const polar = Math.acos(1 - (2 * (sibIndex + 0.5)) / sibTotal)
      const azimuth = sibIndex * DOCS_SCENE.GOLDEN_ANGLE + parent * DOCS_SCENE.SPIN_HASH

      xyz[i * 3] = xyz[parent * 3] + orbit * Math.sin(polar) * Math.cos(azimuth)
      xyz[i * 3 + 1] = xyz[parent * 3 + 1] + orbit * Math.cos(polar)
      xyz[i * 3 + 2] = xyz[parent * 3 + 2] + orbit * Math.sin(polar) * Math.sin(azimuth)
    }

    // Pairwise relax — the sibling chord covers siblings; rare cross-
    // branch collisions get nudged apart by half the deficit each
    // (root stays anchored). Mirrors layoutPositionsJs in arch-scene.ts.
    const radii = new Float64Array(nodeCount)

    for (let i = 0; i < nodeCount; i++)
      radii[i] = (dirs[i] ? DOCS_SCENE.DIR_RADIUS : DOCS_SCENE.FILE_RADIUS) * scale[i]

    for (let iter = 0; iter < DOCS_SCENE.RELAX_ITERS; iter++) {
      let moved = false

      for (let nodeA = 0; nodeA < nodeCount; nodeA++) {
        for (let nodeB = nodeA + 1; nodeB < nodeCount; nodeB++) {
          const need = radii[nodeA] + radii[nodeB] + DOCS_SCENE.MIN_SEP
          const deltaX = xyz[nodeB * 3] - xyz[nodeA * 3]
          const deltaY = xyz[nodeB * 3 + 1] - xyz[nodeA * 3 + 1]
          const deltaZ = xyz[nodeB * 3 + 2] - xyz[nodeA * 3 + 2]
          const distance = Math.hypot(deltaX, deltaY, deltaZ)

          if (distance >= need) continue

          const anchored = nodeA === DOCS_SCENE.ANCHOR_INDEX
          const pushDist = (need - distance) / (anchored ? 1 : 2)
          const invDist = distance > DOCS_SCENE.EPSILON ? 1 / distance : 0
          const unitX = invDist ? deltaX * invDist : Math.cos(nodeA * DOCS_SCENE.SPIN_HASH)
          const unitY = invDist ? deltaY * invDist : 0.5
          const unitZ = invDist ? deltaZ * invDist : Math.sin(nodeA * DOCS_SCENE.SPIN_HASH)

          if (!anchored) {
            xyz[nodeA * 3] -= unitX * pushDist
            xyz[nodeA * 3 + 1] -= unitY * pushDist
            xyz[nodeA * 3 + 2] -= unitZ * pushDist
          }

          xyz[nodeB * 3] += unitX * pushDist
          xyz[nodeB * 3 + 1] += unitY * pushDist
          xyz[nodeB * 3 + 2] += unitZ * pushDist

          moved = true
        }
      }

      if (!moved) break
    }

    post(id, 'DOCS_SCENE_LAYOUT_RESULT', { xyz, scale }, [xyz.buffer, scale.buffer])
  } else if (type === 'COMPUTE_TEXT_TIMING') {
    // Draw-text stagger math — delay clamped to the token band so long
    // texts finish on time and short texts don't stall. Mirrors
    // calcDrawTextDelay/calcDrawTextOffset in wasm-layout.ts exactly.
    const { totalChars = 0, targetDurationMs = DRAW_TARGET_MS, idx = 0, charsBefore = 0 } = payload
    const delay = Math.max(
      DRAW_DELAY_MIN_MS,
      Math.min(
        DRAW_DELAY_MAX_MS,
        Math.round(
          callEngine('calc_draw_text_delay', totalChars, targetDurationMs) ??
            targetDurationMs / (totalChars || 1)
        )
      )
    )
    const offset =
      callEngine('calc_draw_text_offset', idx, charsBefore, delay) ??
      charsBefore * delay + idx * DRAW_INDEX_STEP_MS

    post(id, 'TEXT_TIMING_RESULT', { delay, offset })
  } else if (type === 'COMPUTE_MEDIA_HASH') {
    // djb2 over the URL — the media-cache key hash (deterministic, so
    // any worker produces the same key).
    const { url = '' } = payload
    let hash = DJB2_SEED

    for (let i = 0; i < url.length; i++) {
      hash = (hash << 5) + hash + url.charCodeAt(i)
      hash |= 0
    }

    const key = 'media_hash_' + Math.abs(hash).toString(36)

    post(id, 'MEDIA_HASH_RESULT', { key, hash: Math.abs(hash) })
  } else if (type === 'DECODE_IMAGE_WASM') {
    // Single-image decode with GPU-hardware resize at decode time (see
    // bitmapOptions above). Blob missing → nothing to do.
    const { blob, width, height } = payload

    if (!blob) return

    decodeBitmap(blob, width, height)
      .then((bitmap) => {
        post(
          id,
          'DECODE_IMAGE_WASM_RESULT',
          { bitmap, width: bitmap.width, height: bitmap.height },
          [bitmap]
        )
      })
      .catch((err) => {
        self.postMessage({ id, type: 'DECODE_IMAGE_WASM_ERROR', error: err?.message })
      })
  } else if (type === 'DECODE_IMAGE_BATCH_WASM') {
    // Parallel batch decode: fetch + GPU-hardware decode all images in a
    // single worker invocation using Promise.all. All resulting
    // ImageBitmaps transfer back zero-copy in one transferList.
    // Each item: { url, width, height, index }
    const { items } = payload

    if (!items || !items.length) {
      post(id, 'DECODE_IMAGE_BATCH_WASM_RESULT', [])

      return
    }

    const decodeOne = async ({ url, width, height, index }) => {
      try {
        if (!url || isCrossOriginUrl(url)) {
          return { index, url, bitmap: null, error: 'Cross-origin fetch avoided' }
        }

        const res = await fetch(url, FORCE_CACHE)

        if (!res.ok) return { index, bitmap: null, error: `HTTP ${res.status}` }

        const blob = await res.blob()

        try {
          const bitmap = await decodeBitmap(blob, width, height)

          return { index, url, bitmap, width: bitmap.width, height: bitmap.height }
        } catch (err) {
          return { index, url, bitmap: null, error: err?.message }
        }
      } catch (err) {
        return { index, url, bitmap: null, error: err?.message }
      }
    }

    // Fan-out: decode all images in parallel within this worker.
    Promise.all(items.map(decodeOne))
      .then((results) => {
        const transferList = results.filter((r) => r.bitmap).map((r) => r.bitmap)

        post(id, 'DECODE_IMAGE_BATCH_WASM_RESULT', results, transferList)
      })
      .catch((err) => {
        self.postMessage({ id, type: 'DECODE_IMAGE_BATCH_WASM_ERROR', error: err?.message })
      })
  } else if (type === 'DECODE_MEDIA_URL_WASM') {
    // Legacy single-URL path — kept for backward compatibility.
    const { url } = payload

    if (!url) return

    if (isCrossOriginUrl(url)) {
      self.postMessage({
        id,
        type: 'DECODE_MEDIA_URL_WASM_ERROR',
        error: 'Cross-origin fetch avoided',
      })

      return
    }

    fetch(url, FORCE_CACHE)
      .then((res) => {
        if (!res.ok) throw new Error('Fetch failed')

        return res.blob()
      })
      .then((blob) => createImageBitmap(blob))
      .then((bitmap) => {
        post(
          id,
          'DECODE_MEDIA_URL_WASM_RESULT',
          { bitmap, width: bitmap.width, height: bitmap.height },
          [bitmap]
        )
      })
      .catch((err) => {
        self.postMessage({ id, type: 'DECODE_MEDIA_URL_WASM_ERROR', error: err?.message })
      })
  } else if (type === 'PREFETCH_VIDEO_WASM') {
    // Multi-threaded parallel quality-variant prefetch.
    // Fetches all provided quality URLs simultaneously using Promise.all so the
    // best available stream is ready the moment the element enters the viewport.
    // payload: { variants: [{ url, quality, width, height }], posterUrl? }
    const { variants = [], posterUrl } = payload

    if (!variants.length) {
      post(id, 'PREFETCH_VIDEO_WASM_RESULT', { variants: [], best: null, poster: null })

      return
    }

    const fetchVariant = async ({ url: variantUrl, quality, width, height }) => {
      try {
        if (!variantUrl || isCrossOriginUrl(variantUrl)) {
          return {
            url: variantUrl,
            quality,
            width,
            height,
            primed: false,
            error: 'Cross-origin avoided',
          }
        }

        // Range-request the first 256 KB to prime the browser cache
        // without a full download — enough to begin buffering immediately.
        const rangeRes = await fetch(variantUrl, {
          ...FORCE_CACHE,
          headers: { Range: `bytes=0-${PREFETCH_RANGE_BYTES}` },
        })
        const status = rangeRes.status
        const contentType = rangeRes.headers.get('content-type') || ''
        const contentRange = rangeRes.headers.get('content-range') || ''
        const acceptsRanges = rangeRes.headers.get('accept-ranges') === 'bytes'
        let totalBytes = 0
        const totalMatch = contentRange.match(/\/(\d+)$/)

        if (totalMatch) totalBytes = parseInt(totalMatch[1], 10)

        return {
          url: variantUrl,
          quality,
          width,
          height,
          status,
          contentType,
          totalBytes,
          acceptsRanges,
          primed: status === 206 || status === 200,
        }
      } catch (err) {
        return { url: variantUrl, quality, width, height, primed: false, error: err?.message }
      }
    }

    // Parallel fetch all quality variants + poster simultaneously.
    const [variantResults, posterBitmap] = await Promise.all([
      Promise.all(variants.map(fetchVariant)),
      posterUrl && typeof posterUrl === 'string' && !isCrossOriginUrl(posterUrl)
        ? fetch(posterUrl, FORCE_CACHE)
            .then((r) => (r.ok ? r.blob() : null))
            .then((b) => (b ? createImageBitmap(b) : null))
            .catch(() => null)
        : Promise.resolve(null),
    ])

    const transferList = posterBitmap ? [posterBitmap] : []

    post(
      id,
      'PREFETCH_VIDEO_WASM_RESULT',
      {
        variants: variantResults,
        best:
          variantResults
            .filter((v) => v.primed)
            .sort((a, b) => (b.width || 0) - (a.width || 0))[0] || null,
        poster: posterBitmap,
      },
      transferList
    )
  } else if (type === 'PROBE_VIDEO_WASM') {
    // Lightweight probe: fetch first 128 KB to detect codec, resolution,
    // and range support without downloading the full file.
    // Used by the NPU predictor to pick the best quality variant early.
    // payload: { url }
    const { url: probeUrl } = payload

    if (!probeUrl || isCrossOriginUrl(probeUrl)) {
      post(id, 'PROBE_VIDEO_WASM_RESULT', null)

      return
    }

    try {
      const res = await fetch(probeUrl, {
        ...FORCE_CACHE,
        headers: { Range: `bytes=0-${PROBE_RANGE_BYTES}` },
      })
      const contentType = res.headers.get('content-type') || ''
      const contentRange = res.headers.get('content-range') || ''
      const acceptsRanges = res.headers.get('accept-ranges') === 'bytes'
      const status = res.status
      let totalBytes = 0
      const totalMatch = contentRange.match(/\/(\d+)$/)

      if (totalMatch) totalBytes = parseInt(totalMatch[1], 10)

      let codec = 'unknown'

      if (contentType.includes('mp4')) codec = 'h264/mp4'
      else if (contentType.includes('webm')) codec = 'vp9/webm'
      else if (contentType.includes('ogg')) codec = 'theora/ogg'
      else if (contentType.includes('av1') || contentType.includes('avif')) codec = 'av1'

      post(id, 'PROBE_VIDEO_WASM_RESULT', {
        url: probeUrl,
        codec,
        contentType,
        totalBytes,
        acceptsRanges,
        supportsStreaming: acceptsRanges && status === 206,
      })
    } catch (err) {
      self.postMessage({ id, type: 'PROBE_VIDEO_WASM_ERROR', error: err?.message })
    }
  } else if (type === 'DECODE_VIDEO_SEGMENT_WASM') {
    // Segment fetch: retrieve a specific byte range of a video file, returning
    // the raw ArrayBuffer zero-copy for use with WebCodecs or MediaSource API.
    // Multiple workers can handle concurrent segments in parallel.
    // payload: { url, byteStart, byteEnd }
    const { url: segmentUrl, byteStart = 0, byteEnd } = payload

    if (!segmentUrl) return

    try {
      const rangeHeader = byteEnd != null ? `bytes=${byteStart}-${byteEnd}` : `bytes=${byteStart}-`
      const res = await fetch(segmentUrl, { ...FORCE_CACHE, headers: { Range: rangeHeader } })

      if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`)

      const buffer = await res.arrayBuffer()

      post(
        id,
        'DECODE_VIDEO_SEGMENT_WASM_RESULT',
        {
          url: segmentUrl,
          byteStart,
          byteEnd: byteEnd ?? byteStart + buffer.byteLength - 1,
          byteLength: buffer.byteLength,
          buffer,
        },
        [buffer]
      )
    } catch (err) {
      self.postMessage({ id, type: 'DECODE_VIDEO_SEGMENT_WASM_ERROR', error: err?.message })
    }
  } else if (type === 'DECODE_SVG_WASM') {
    // Fetch an SVG off the main thread and parse its intrinsic dimensions
    // (viewBox, width, height attributes) via regex — no DOM required.
    // Returns: { svgText, intrinsicWidth, intrinsicHeight, aspectRatio }
    // payload: { url }
    const { url: svgUrl } = payload

    if (!svgUrl) return

    try {
      const res = await fetch(svgUrl, FORCE_CACHE)

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const svgText = await res.text()

      // Extract dimensions from viewBox="x y w h" or width/height attributes.
      let intrinsicWidth = 0
      let intrinsicHeight = 0
      const viewBoxMatch = svgText.match(/viewBox=["'][\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)["']/)

      if (viewBoxMatch) {
        intrinsicWidth = parseFloat(viewBoxMatch[1])
        intrinsicHeight = parseFloat(viewBoxMatch[2])
      }

      if (!intrinsicWidth) {
        const widthMatch = svgText.match(/\bwidth=["']([0-9.]+)(?:px)?["']/)

        if (widthMatch) intrinsicWidth = parseFloat(widthMatch[1])
      }

      if (!intrinsicHeight) {
        const heightMatch = svgText.match(/\bheight=["']([0-9.]+)(?:px)?["']/)

        if (heightMatch) intrinsicHeight = parseFloat(heightMatch[1])
      }

      const aspectRatio = intrinsicHeight > 0 ? intrinsicWidth / intrinsicHeight : 0

      post(id, 'DECODE_SVG_WASM_RESULT', {
        url: svgUrl,
        svgText,
        intrinsicWidth,
        intrinsicHeight,
        aspectRatio,
      })
    } catch (err) {
      self.postMessage({ id, type: 'DECODE_SVG_WASM_ERROR', error: err?.message })
    }
  } else if (
    type === 'SF_FILL_SPIRAL' ||
    type === 'SF_FILL_ELLIPTICAL' ||
    type === 'SF_FILL_DUST' ||
    type === 'SF_FILL_SPECKLES' ||
    type === 'SF_FILL_BELT' ||
    type === 'SF_DECODE_DEEPFIELD'
  ) {
    // Star-field buffer fills — chunked by absolute index so a galaxy
    // sized job runs on several workers at once. The math mirrors the
    // main-thread fallbacks in engine/spiral.ts, star-cloud.ts,
    // belt.ts and structures.ts exactly: per-point RNG streams are
    // LCGs seeded `seed ^ (i+1)·params.SEED_STEP` (the Fibonacci hash step),
    // which makes any [indexStart,indexEnd) range reproducible anywhere.
    // All tuning constants arrive in `params` (the live SF_SPIRAL/
    // SF_STRUCTURE/SF_BELT/scale token bags) so worker output can never
    // drift from tokens.
    const params = payload.p || {}
    const { seed = 0, count = 0, i0 = 0, i1 = count } = payload
    const indexStart = i0
    const indexEnd = i1
    const randOf = (index) => {
      let state = (seed ^ Math.imul(index + 1, params.SEED_STEP >>> 0)) >>> 0

      return () => {
        state = (Math.imul(state, LCG_MULT) + LCG_INC) >>> 0

        return state / LCG_NORM
      }
    }

    const pointCount = Math.max(0, indexEnd - indexStart)
    const pos = new Float32Array(pointCount * 3)
    const col = new Float32Array(pointCount * 3)
    let kept = 0

    if (type === 'SF_FILL_SPIRAL') {
      const { radius = 1, arms = 4, thick = 1, halo = 0, jitter = 0, bubble } = payload
      const bulgeCount = Math.floor(count * params.BULGE)
      const haloCount = Math.floor(count * halo)
      const goldenSeed = seed * (params.GOLDEN - 1)
      const barTilt = (goldenSeed - Math.floor(goldenSeed)) * Math.PI * 2
      const barCos = Math.cos(barTilt)
      const barSin = Math.sin(barTilt)
      const warpPhase = barTilt + Math.PI / 2

      for (let i = indexStart; i < indexEnd; i++) {
        const rand = randOf(i)
        const offset = (i - indexStart) * 3
        const inHalo = i >= count - haloCount
        const inBulge = i < bulgeCount

        if (inHalo) {
          const haloRadius = Math.abs(rand() + rand() - 1) * radius * params.HALO_RADIUS
          const sphereY = rand() * 2 - 1
          const azimuth = rand() * Math.PI * 2
          const sphereR = Math.sqrt(1 - sphereY * sphereY)

          pos[offset] = Math.cos(azimuth) * sphereR * haloRadius
          pos[offset + 1] = sphereY * haloRadius
          pos[offset + 2] = Math.sin(azimuth) * sphereR * haloRadius

          const edgeT = 0.5 + 0.5 * (haloRadius / (radius * params.HALO_RADIUS))

          col[offset] = (params.CORE_R + (params.EDGE_R - params.CORE_R) * edgeT) * params.HALO_DIM
          col[offset + 1] =
            (params.CORE_G + (params.EDGE_G - params.CORE_G) * edgeT) * params.HALO_DIM
          col[offset + 2] =
            (params.CORE_B + (params.EDGE_B - params.CORE_B) * edgeT) * params.HALO_DIM
        } else {
          const radial = inBulge
            ? Math.abs(rand() + rand() - 1) * radius * 0.16
            : Math.sqrt(rand()) * radius * params.DISC_SPREAD

          const logRadius = Math.log(Math.max(radial, params.ARM_LOG_RMIN) / params.ARM_LOG_R0)
          const armIndex = i % arms
          const armPitch =
            params.ARM_LOG_B *
            params.ARM_PITCH_TIGHT *
            (1 + params.ARM_PITCH_VAR * Math.sin(armIndex * params.GOLDEN_ANGLE))
          const armLumin =
            1 - params.ARM_LUM_VAR * Math.abs(Math.sin(armIndex * params.GOLDEN_ANGLE))
          const baseAngle =
            logRadius * armPitch +
            (armIndex * Math.PI * 2) / arms +
            Math.sin(radial * params.ARM_SWAY_FREQ + armIndex * params.GOLDEN_ANGLE) *
              params.ARM_SWAY_AMP *
              (params.ARM_SWAY_CORE + (1 - params.ARM_SWAY_CORE) * Math.min(1, radial / radius))

          const rimMix = inBulge
            ? 0
            : params.ARM_JITTER_CORE +
              (params.ARM_JITTER_RIM - params.ARM_JITTER_CORE) * (radial / radius)
          const isSpur = !inBulge && rand() < params.ARM_SPUR_FRAC
          const jitterAmount = jitter * rimMix + (isSpur ? params.ARM_SPUR_JITTER : 0)
          const scatter = inBulge ? 0 : rand() + rand() + rand() - 1.5
          const angle = inBulge
            ? rand() * Math.PI * 2
            : baseAngle + (isSpur ? Math.PI / arms : 0) + scatter * jitterAmount

          const yScatter =
            (rand() + rand() - 1) * radius * params.THIN * thick * (inBulge ? 3.2 : 1)
          const radialNorm = Math.min(1, radial / radius)
          const yPos = inBulge
            ? yScatter
            : yScatter * (1 + radialNorm * params.DISC_FLARE) +
              params.DISC_WARP * radius * radialNorm * radialNorm * Math.sin(angle - warpPhase)

          pos[offset] = Math.cos(angle) * radial
          pos[offset + 1] = yPos
          pos[offset + 2] = Math.sin(angle) * radial

          if (inBulge) {
            const barU = pos[offset] * barCos + pos[offset + 2] * barSin
            const barV = -pos[offset] * barSin + pos[offset + 2] * barCos

            pos[offset] = barU * params.BAR_X * barCos - barV * barSin
            pos[offset + 2] = barU * params.BAR_X * barSin + barV * barCos
          }

          const edgeT = inBulge ? 0.22 : radial / radius
          const knotWave = Math.sin(angle * params.KNOT_LOBES - logRadius * params.KNOT_DRIFT)
          const knotFactor = inBulge
            ? 1
            : 1 - params.KNOT_DEPTH + params.KNOT_DEPTH * knotWave * knotWave
          const hotSpot = inBulge ? 0 : Math.max(0, knotWave) ** params.KNOT_POW
          const luminosity = 1 + (rand() + rand() - 1) * params.LUM_JITTER
          const isHII = !inBulge && rand() < params.HII_FRAC
          const hotR = isHII ? params.HII_R : params.KNOT_HOT_R
          const hotG = isHII ? params.HII_G : params.KNOT_HOT_G
          const hotB = isHII ? params.HII_B : params.KNOT_HOT_B
          const edgeFade = Math.min(
            1,
            Math.max(
              0,
              (radius * params.DISC_SPREAD - radial) /
                (radius * (params.DISC_SPREAD - params.EDGE_FADE_START))
            )
          )
          const laneFactor = inBulge
            ? 0
            : 1 - Math.min(1, Math.abs(scatter) * params.LANE_SCATTER_INV)
          const laneMix = laneFactor * params.LANE_MIX
          const glow = knotFactor * edgeFade * armLumin * luminosity
          const hotEdge = hotSpot * edgeFade * armLumin

          const baseR = params.CORE_R + (params.EDGE_R - params.CORE_R) * edgeT
          const baseG = params.CORE_G + (params.EDGE_G - params.CORE_G) * edgeT
          const baseB = params.CORE_B + (params.EDGE_B - params.CORE_B) * edgeT

          col[offset] = (baseR + (params.LANE_R - baseR) * laneMix) * glow + hotEdge * hotR
          col[offset + 1] = (baseG + (params.LANE_G - baseG) * laneMix) * glow + hotEdge * hotG
          col[offset + 2] = (baseB + (params.LANE_B - baseB) * laneMix) * glow + hotEdge * hotB
        }

        if (bubble) {
          const bubbleDX = pos[offset] - bubble.x
          const bubbleDY = pos[offset + 1] - bubble.y
          const bubbleDZ = pos[offset + 2] - bubble.z
          const inside =
            bubbleDX * bubbleDX + bubbleDY * bubbleDY + bubbleDZ * bubbleDZ < bubble.r * bubble.r

          if (inside && rand() < params.BUBBLE_KEEP) {
            col[offset] *= params.BUBBLE_DIM
            col[offset + 1] *= params.BUBBLE_DIM
            col[offset + 2] *= params.BUBBLE_DIM
          } else if (inside) {
            let tries = 0

            while (tries++ < BUBBLE_RETRIES) {
              const respawnDX = pos[offset] - bubble.x
              const respawnDY = pos[offset + 1] - bubble.y
              const respawnDZ = pos[offset + 2] - bubble.z

              if (
                respawnDX * respawnDX + respawnDY * respawnDY + respawnDZ * respawnDZ >=
                bubble.r * bubble.r
              )
                break

              const respawnRadius = Math.hypot(pos[offset], pos[offset + 2])
              const respawnAngle = rand() * Math.PI * 2

              pos[offset] = Math.cos(respawnAngle) * respawnRadius
              pos[offset + 1] = (rand() + rand() - 1) * radius * params.THIN * thick
              pos[offset + 2] = Math.sin(respawnAngle) * respawnRadius
            }
          }
        }
      }
      kept = pointCount
    } else if (type === 'SF_FILL_ELLIPTICAL') {
      const { radius = 1, tint = [1, 1, 1] } = payload

      for (let i = indexStart; i < indexEnd; i++) {
        const rand = randOf(i)
        const offset = (i - indexStart) * 3
        const radial = Math.abs(rand() + rand() + rand() - 1.5) * radius * params.ELLIPSE_RADIAL
        const sphereY = rand() * 2 - 1
        const azimuth = rand() * Math.PI * 2
        const sphereR = Math.sqrt(1 - sphereY * sphereY)

        pos[offset] = Math.cos(azimuth) * sphereR * radial
        pos[offset + 1] = sphereY * radial * params.ELLIPSE_FLAT
        pos[offset + 2] = Math.sin(azimuth) * sphereR * radial

        const edgeT = Math.min(1, radial / radius)
        const edgeNorm = radial / (radius * params.ELLIPSE_RADIAL * 1.5)
        const edgeFade =
          1 - Math.min(1, Math.max(0, (edgeNorm - params.ELLIPSE_EDGE) / (1 - params.ELLIPSE_EDGE)))
        const brightness = (params.ELLIPSE_CORE - edgeT * params.ELLIPSE_FADE) * edgeFade

        col[offset] = tint[0] * brightness
        col[offset + 1] = tint[1] * brightness
        col[offset + 2] = tint[2] * brightness
      }
      kept = pointCount
    } else if (type === 'SF_FILL_DUST') {
      const { radius = 1, arms = 4 } = payload

      for (let i = indexStart; i < indexEnd; i++) {
        const rand = randOf(i)
        const offset = (i - indexStart) * 3
        const radial =
          (params.DUST_R_MIN + (params.DUST_R_MAX - params.DUST_R_MIN) * Math.sqrt(rand())) * radius
        const logRadius = Math.log(Math.max(radial, params.ARM_LOG_RMIN) / params.ARM_LOG_R0)
        const armIndex = i % arms
        const gapPitch =
          params.ARM_LOG_B *
          params.ARM_PITCH_TIGHT *
          (1 + params.ARM_PITCH_VAR * Math.sin((armIndex + 0.5) * params.GOLDEN_ANGLE))
        const baseAngle =
          logRadius * gapPitch +
          ((armIndex + 0.5) * Math.PI * 2) / arms +
          Math.sin(radial * params.ARM_SWAY_FREQ + (armIndex + 0.5) * params.GOLDEN_ANGLE) *
            params.ARM_SWAY_AMP *
            (params.ARM_SWAY_CORE + (1 - params.ARM_SWAY_CORE) * Math.min(1, radial / radius))
        const angle = baseAngle + (rand() + rand() + rand() - 1.5) * params.DUST_JITTER
        const yPos = (rand() + rand() - 1) * radius * params.THIN * params.VOLUMETRIC_THICK * 0.4

        pos[offset] = Math.cos(angle) * radial
        pos[offset + 1] = yPos
        pos[offset + 2] = Math.sin(angle) * radial
        col[offset] = params.DUST_R
        col[offset + 1] = params.DUST_G
        col[offset + 2] = params.DUST_B
      }
      kept = pointCount
    } else if (type === 'SF_FILL_SPECKLES') {
      // Member-galaxy knots along a seeded filament axis — the preamble
      // (axis, perpendicular basis, knot offsets) ships in the payload so
      // every chunk scatters around identical geometry; member points use
      // per-point hashed streams for chunkability.
      const {
        radius = 1,
        tint = [1, 1, 1],
        axis = [1, 0, 0],
        lat1 = [0, 1, 0],
        lat2 = [0, 0, 1],
        knotAt = [0],
      } = payload
      const fillRadius = radius * params.SPECKLE_FILL
      const knotCount = knotAt.length

      for (let i = indexStart; i < indexEnd; i++) {
        const rand = randOf(i)
        const offset = (i - indexStart) * 3
        const gauss = () => (rand() + rand() + rand() - 1.5) * fillRadius * 0.14
        const knotIndex = Math.floor(rand() * knotCount)
        const along = knotAt[knotIndex] + gauss() * 1.6
        const lateral1 = gauss()
        const lateral2 = gauss() * params.SPECKLE_FLATTEN

        pos[offset] = axis[0] * along + lat1[0] * lateral1 + lat2[0] * lateral2
        pos[offset + 1] = axis[1] * along + lat1[1] * lateral1 + lat2[1] * lateral2
        pos[offset + 2] = axis[2] * along + lat1[2] * lateral1 + lat2[2] * lateral2

        const brightness = params.SPECKLE_DIM + rand() * (1 - params.SPECKLE_DIM)

        col[offset] = tint[0] * brightness
        col[offset + 1] = tint[1] * brightness
        col[offset + 2] = tint[2] * brightness
      }
      kept = pointCount
    } else if (type === 'SF_FILL_BELT') {
      // Annulus with Kirkwood-lane rejection — candidates are per-index
      // seeded, rejected draws compact out of the chunk's kept count.
      const { inner = 0, width = 1, puff = 0, lanes = 0, tint = [1, 1, 1] } = payload

      for (let i = indexStart; i < indexEnd; i++) {
        const rand = randOf(i)
        const radial = inner + Math.sqrt(rand()) * width
        const angle = rand() * Math.PI * 2
        const laneWave = Math.sin(radial * lanes)

        if (lanes > 0 && rand() > 1 - params.GAP_DEPTH * laneWave * laneWave) continue

        const offset = kept * 3

        pos[offset] = Math.cos(angle) * radial
        pos[offset + 1] = (rand() + rand() - 1) * puff
        pos[offset + 2] = Math.sin(angle) * radial

        const albedo = 1 - params.ALBEDO_JITTER / 2 + rand() * params.ALBEDO_JITTER

        col[offset] = tint[0] * albedo
        col[offset + 1] = tint[1] * albedo
        col[offset + 2] = tint[2] * albedo
        kept++
      }
    } else if (type === 'SF_DECODE_DEEPFIELD') {
      // Packed Float32 record decode — heliocentric galactic ly → chart
      // units via the three-tier compression, B-V → spectral tint ramp,
      // magnitude → brightness with the survey edge fade. `data` arrives
      // as a structured-cloned Uint8Array of record bytes (header
      // already stripped; `count` carries the record total) so the main
      // thread keeps its buffer when the fallback must run.
      const { data } = payload
      const bytes = data instanceof Uint8Array ? data : new Uint8Array(data || [])
      const stride = params.STRIDE || 6
      const total = Math.min(
        count,
        Math.floor(bytes.byteLength / 4 / stride),
        params.MAX_STARS || Infinity
      )
      const floats = new Float32Array(bytes.buffer, bytes.byteOffset, total * stride)
      const recordStart = indexStart || 0
      const recordEnd = Math.min(indexEnd || total, total)

      const chartDist = (ly) => {
        if (ly <= 0) return 0

        const galacticEdge = params.GALACTIC_BREAK / params.GALACTIC_LY

        if (ly <= params.GALACTIC_BREAK) return ly / params.GALACTIC_LY

        const localEdge =
          galacticEdge +
          params.LOCAL_GROUP_BREAK / params.LOCAL_GROUP_LY -
          params.GALACTIC_BREAK / params.LOCAL_GROUP_LY

        if (ly <= params.LOCAL_GROUP_BREAK)
          return galacticEdge + (ly - params.GALACTIC_BREAK) / params.LOCAL_GROUP_LY

        return Math.min(
          localEdge + (ly - params.LOCAL_GROUP_BREAK) / params.COSMIC_LY,
          params.COSMIC_CLAMP
        )
      }

      const spectralTint = (colorIndex) => {
        const lerp = (from, to, t) => [
          from[0] + (to[0] - from[0]) * t,
          from[1] + (to[1] - from[1]) * t,
          from[2] + (to[2] - from[2]) * t,
        ]

        if (colorIndex <= params.CI_LOW) return params.STAR_BLUE
        if (colorIndex <= params.CI_WARM)
          return lerp(
            params.STAR_BLUE,
            params.STAR_WHITE,
            colorIndex / (params.CI_WARM - params.CI_LOW)
          )
        if (colorIndex <= params.CI_GOLD)
          return lerp(
            params.STAR_WHITE,
            params.STAR_GOLD,
            (colorIndex - params.CI_WARM) / (params.CI_GOLD - params.CI_WARM)
          )
        if (colorIndex <= params.CI_RED)
          return lerp(
            params.STAR_GOLD,
            params.STAR_RED,
            (colorIndex - params.CI_GOLD) / (params.CI_RED - params.CI_GOLD)
          )
        return params.STAR_RED
      }

      for (let i = recordStart; i < recordEnd; i++) {
        const base = i * stride
        const galX = floats[base]
        const galY = floats[base + 1]
        const galZ = floats[base + 2]
        const distLy = Math.sqrt(galX * galX + galY * galY + galZ * galZ)
        const kind = floats[base + 5]

        if (kind === params.KIND_STAR && distLy > params.STAR_MAX_LY) continue

        const scaleT = distLy > 0 ? chartDist(distLy) / distLy : 0
        const offset = kept * 3

        pos[offset] = -galX * scaleT
        pos[offset + 1] = galZ * scaleT
        pos[offset + 2] = galY * scaleT

        const magnitude = floats[base + 3]
        const colorIndex = floats[base + 4]
        const rgb =
          kind === params.KIND_EXOPLANET
            ? params.EXO_TINT
            : kind === params.KIND_DSO
              ? params.DSO_TINT
              : spectralTint(colorIndex)
        const edge =
          kind === params.KIND_DSO
            ? 1
            : 1 - Math.min(1, Math.max(0, (distLy - params.EDGE_LY) / params.EDGE_BAND_LY))
        const brightness =
          Math.max(params.MAG_FLOOR, params.MAG_BIAS - magnitude * params.MAG_SLOPE) * edge

        col[offset] = rgb[0] * brightness
        col[offset + 1] = rgb[1] * brightness
        col[offset + 2] = rgb[2] * brightness
        kept++
      }
    }

    post(id, type + '_RESULT', { pos, col, kept }, [pos.buffer, col.buffer])
  } else if (type === 'ROUTE_SEARCH') {
    // Route-search autocomplete scorer — mirrors scoreRoutesJs in
    // core/utils/wasm/wasm-search.ts exactly (AND semantics across query
    // terms; title > keywords > path > preview; empty query returns the
    // whole catalog in order). Kept as plain JS in the worker: the wasm
    // engine exports only numeric helpers today, and the scoring cost is
    // the loop, not the arithmetic.
    const { query = '', items = [] } = payload

    const normalizeText = (text) =>
      (text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()

    const terms = normalizeText(query).split(' ').filter(Boolean)
    const hits = []

    if (!terms.length) {
      for (let i = 0; i < items.length; i++) hits.push({ i, s: SEARCH_SCORE.EMPTY_QUERY })
    } else {
      items.forEach((item, index) => {
        const title = normalizeText(item.t)
        const itemPath = normalizeText(item.p)
        const preview = normalizeText(item.d)
        const keywords = (item.k || []).map(normalizeText)

        let score = 0
        let matchedAll = true

        for (const term of terms) {
          let best = 0

          if (title === term) best = SEARCH_SCORE.TITLE_EXACT
          else if (title.startsWith(term)) best = SEARCH_SCORE.TITLE_PREFIX
          else if (title.includes(term)) best = SEARCH_SCORE.TITLE_CONTAINS

          for (const keyword of keywords) {
            if (keyword.includes(term)) best = Math.max(best, SEARCH_SCORE.KEYWORD)
          }

          if (itemPath.includes(term)) best = Math.max(best, SEARCH_SCORE.PATH)
          if (preview.includes(term)) best = Math.max(best, SEARCH_SCORE.PREVIEW)

          if (best === 0) {
            matchedAll = false
            break
          }

          score += best
        }

        if (matchedAll) hits.push({ i: index, s: score })
      })

      hits.sort((a, b) => b.s - a.s || a.i - b.i)
    }

    post(id, 'ROUTE_SEARCH_RESULT', hits)
  }
}
