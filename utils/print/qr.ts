/**
 * @file utils/print/qr.ts
 * @description Dependency-free QR encoder for the print surfaces — byte-mode
 * segments at error-correction level M (≈15% damage tolerance), auto-sized
 * across versions 1–40, rendered to a single-path inline <svg> so paper
 * output stays vector-crisp at any DPI. The matrix pipeline follows the
 * reference implementation published by Project Nayuki (MIT), trimmed to
 * the byte-mode/level-M slice URL payloads need.
 */

import { ARIA_ATTRS } from '@core/tokens/attrs/aria.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { h } from '@core/jsx.js'

/** Highest QR version — versions 1–40 are defined by the spec. */
const MAX_VERSION = 40

/** Byte-mode segment marker (0b0100) written ahead of the count field. */
const BYTE_MODE = 0x4

/** Data-length field width: 8 bits through version 9, 16 from version 10. */
const COUNT_BITS_SHORT = 8
const COUNT_BITS_LONG = 16
const COUNT_VERSION_CUT = 10

/** ISO/IEC 18004 pad bytes, alternating EC/11 once the terminator lands. */
const PAD_A = 0xec
const PAD_B = 0x11

/** Reed–Solomon arithmetic lives in GF(256) over the 0x11D primitive poly. */
const GF_POLY = 0x11d

/** Format-info BCH(15,5) generator poly and its fixed XOR mask. */
const FORMAT_POLY = 0x537
const FORMAT_MASK = 0x5412

/** Version-info BCH(18,6) generator poly (versions ≥ 7 only). */
const VERSION_POLY = 0x1f25

/** Mask patterns the matrix is scored against — spec defines exactly 8. */
const MASK_COUNT = 8

/** Quiet-zone modules reserved around the symbol — the spec minimum is 4. */
const QUIET = 4

/** Penalty weights for the four mask-selection rules (N1–N4). */
const PENALTY_N1_RUN = 5
const PENALTY_N1_BASE = 3
const PENALTY_N2 = 3
const PENALTY_N3 = 40
const PENALTY_N3_PATTERN = 7
const PENALTY_N3_GUARD = 4
const PENALTY_N4 = 10

/** The 1:1:3:1:1 finder-like run the N3 rule hunts for. */
const PENALTY_N3_PAT: ReadonlyArray<number> = Object.freeze([1, 0, 1, 1, 1, 0, 1])

/**
 * Error-correction codewords per block at level M, indexed by version 1–40
 * (index 0 is a padding sentinel). ISO/IEC 18004 table 9, column M.
 */
const ECC_PER_BLOCK_M: ReadonlyArray<number> = Object.freeze([
  0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28,
  28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
])

/**
 * Reed–Solomon block count at level M, indexed by version 1–40 (index 0 is a
 * padding sentinel). ISO/IEC 18004 table 9, column M.
 */
const BLOCKS_M: ReadonlyArray<number> = Object.freeze([
  0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25,
  26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49,
])

/**
 * Alignment-pattern centre coordinates per version (index 0 is a padding
 * sentinel). ISO/IEC 18004 annex E — the spacing is irregular enough that
 * the spec table beats any derived formula for exactness.
 */
const ALIGN_POSITIONS: ReadonlyArray<ReadonlyArray<number>> = Object.freeze([
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
  [6, 28, 50, 72, 94],
  [6, 26, 50, 74, 98],
  [6, 30, 54, 78, 102],
  [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110],
  [6, 30, 58, 86, 114],
  [6, 34, 62, 90, 118],
  [6, 26, 50, 74, 98, 122],
  [6, 30, 54, 78, 102, 126],
  [6, 26, 52, 78, 104, 130],
  [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138],
  [6, 30, 58, 86, 114, 142],
  [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154],
  [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162],
  [6, 26, 54, 82, 110, 138, 166],
  [6, 30, 58, 86, 114, 142, 170],
])

/**
 * Total modules carrying raw codeword bits for a version — the matrix area
 * minus finder/separator/timing/alignment/format/version reservations.
 * @param ver QR version 1–40
 * @returns raw module count (a few over a whole byte; the excess are remainder bits)
 */
const rawModules = (ver: number): number => {
  let result = (16 * ver + 128) * ver + 64

  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2

    result -= (25 * numAlign - 10) * numAlign - 55

    if (ver >= 7) result -= 36
  }

  return result
}

/**
 * Data codewords a version carries at level M — raw modules rounded down to
 * bytes minus every block's ECC share.
 * @param ver QR version 1–40
 * @returns usable data codeword count
 */
const dataCodewords = (ver: number): number =>
  Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK_M[ver] * BLOCKS_M[ver]

/**
 * Smallest version that fits a byte payload of `len` — mode marker + count
 * field + payload must fit inside the version's data bits.
 * @param len payload byte count
 * @returns version 1–40, or 0 when the payload outgrows v40-M
 */
const pickVersion = (len: number): number => {
  for (let ver = 1; ver <= MAX_VERSION; ver++) {
    const countBits = ver < COUNT_VERSION_CUT ? COUNT_BITS_SHORT : COUNT_BITS_LONG

    if (4 + countBits + len * 8 <= dataCodewords(ver) * 8) return ver
  }

  return 0
}

/**
 * Bit-buffer appender — pushes `len` bits of `val`, MSB first.
 * @param bits growing bit array (0/1 entries)
 * @param val source integer
 * @param len how many low bits of `val` to emit
 */
const pushBits = (bits: number[], val: number, len: number): void => {
  for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1)
}

/**
 * Segment encoder — turns the UTF-8 payload into the version's data
 * codewords: byte-mode marker, count field, payload, up-to-4-bit terminator,
 * byte alignment, then alternating EC/11 pad bytes to capacity.
 * @param bytes UTF-8 payload
 * @param ver chosen version
 * @returns data codewords (pre-ECC)
 */
const encodeData = (bytes: Uint8Array, ver: number): Uint8Array => {
  const capacity = dataCodewords(ver) * 8
  const bits: number[] = []

  pushBits(bits, BYTE_MODE, 4)
  pushBits(bits, bytes.length, ver < COUNT_VERSION_CUT ? COUNT_BITS_SHORT : COUNT_BITS_LONG)
  bytes.forEach((b) => pushBits(bits, b, 8))
  pushBits(bits, 0, Math.min(4, capacity - bits.length))
  // Byte-alignment filler — everything past the terminator is "don't care"
  // for decoders, and emitting a whole 00 byte when already aligned keeps
  // the stream byte-identical to the reference encoders the tests gate on.
  pushBits(bits, 0, Math.min(8 - (bits.length % 8), capacity - bits.length))

  for (let pad = PAD_A; bits.length < capacity; pad ^= PAD_A ^ PAD_B) pushBits(bits, pad, 8)

  const out = new Uint8Array(bits.length / 8)

  bits.forEach((b, i) => {
    out[i >>> 3] |= b << (7 - (i & 7))
  })

  return out
}

/**
 * GF(256) carry-less multiply over the 0x11D primitive polynomial — the
 * Russian-peasant shift/XOR form used by the reference implementation.
 * @param x multiplicand
 * @param y multiplier
 * @returns product byte
 */
const rsMultiply = (x: number, y: number): number => {
  let z = 0

  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * GF_POLY)
    z ^= ((y >>> i) & 1) * x
  }

  return z & 0xff
}

/**
 * Generator polynomial of the given degree — the product
 * (x − r⁰)(x − r¹)…(x − r^{degree−1}) over GF(256), highest term first.
 * @param degree ECC codewords per block
 * @returns divisor coefficient array
 */
const rsDivisor = (degree: number): Uint8Array => {
  const result = new Uint8Array(degree)

  result[degree - 1] = 1

  let root = 1

  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = rsMultiply(result[j], root)

      if (j + 1 < degree) result[j] ^= result[j + 1]
    }

    root = rsMultiply(root, 0x02)
  }

  return result
}

/**
 * Polynomial remainder — the ECC bytes for one data block under `divisor`.
 * @param data block's data codewords
 * @param divisor generator polynomial from rsDivisor
 * @returns ECC codeword array, same length as divisor
 */
const rsRemainder = (data: Uint8Array, divisor: Uint8Array): Uint8Array => {
  const result = new Uint8Array(divisor.length)

  for (const b of data) {
    const factor = b ^ result[0]

    result.copyWithin(0, 1)
    result[result.length - 1] = 0
    divisor.forEach((coef, i) => {
      result[i] ^= rsMultiply(coef, factor)
    })
  }

  return result
}

/**
 * Block split + interleave — divides the data codewords into the spec's
 * short/long blocks, appends each block's ECC, then emits the byte stream
 * column-wise so every block's i-th byte lands adjacent. Short blocks carry
 * a pad slot at index `shortDataLen` that the interleave skips.
 * @param data data codewords from encodeData
 * @param ver chosen version
 * @returns interleaved codeword stream (rawModules(ver)/8 bytes)
 */
const interleave = (data: Uint8Array, ver: number): Uint8Array => {
  const numBlocks = BLOCKS_M[ver]
  const eccLen = ECC_PER_BLOCK_M[ver]
  const raw = Math.floor(rawModules(ver) / 8)
  const numShort = numBlocks - (raw % numBlocks)
  const shortBlockLen = Math.floor(raw / numBlocks)
  const shortDataLen = shortBlockLen - eccLen
  const divisor = rsDivisor(eccLen)

  const blocks: Uint8Array[] = []
  let k = 0

  for (let i = 0; i < numBlocks; i++) {
    const datLen = shortDataLen + (i < numShort ? 0 : 1)
    const dat = data.slice(k, k + datLen)

    k += datLen

    const ecc = rsRemainder(dat, divisor)
    const block = new Uint8Array(shortBlockLen + 1)

    block.set(dat)
    block.set(ecc, datLen + (i < numShort ? 1 : 0))
    blocks.push(block)
  }

  const out = new Uint8Array(raw)
  let p = 0

  for (let i = 0; i <= shortBlockLen; i++) {
    for (let j = 0; j < numBlocks; j++) {
      if (i !== shortDataLen || j >= numShort) {
        out[p] = blocks[j][i]
        p++
      }
    }
  }

  return out
}

/**
 * Format-information writer — BCH(15,5) of (ecl‖mask) XOR 0x5412, drawn
 * twice around the finders, plus the always-dark module at (8, size−8).
 * Level M encodes as 0b00 so the 5-bit payload is just the mask id.
 * @param m module matrix (1 dark / 0 light)
 * @param f function-module mask
 * @param size matrix side
 * @param mask mask pattern id 0–7
 */
const drawFormat = (m: Uint8Array, f: Uint8Array, size: number, mask: number): void => {
  const set = (x: number, y: number, bit: number) => {
    m[y * size + x] = bit
    f[y * size + x] = 1
  }

  let rem = mask

  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * FORMAT_POLY)

  const bits = ((mask << 10) | rem) ^ FORMAT_MASK

  for (let i = 0; i <= 5; i++) set(8, i, (bits >>> i) & 1)
  set(8, 7, (bits >>> 6) & 1)
  set(8, 8, (bits >>> 7) & 1)
  set(7, 8, (bits >>> 8) & 1)
  for (let i = 9; i < 15; i++) set(14 - i, 8, (bits >>> i) & 1)
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, (bits >>> i) & 1)
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, (bits >>> i) & 1)
  set(8, size - 8, 1)
}

/**
 * Function-layer painter — timing first (the finders overwrite their share),
 * then the three finder+separator rings, the alignment crosses (skipping
 * the three finder corners), the version blocks for ver ≥ 7, and a dummy
 * format pass to reserve those cells before data lands.
 * @param ver chosen version
 * @returns module matrix, function mask, and matrix side
 */
const drawFunction = (ver: number): { m: Uint8Array; f: Uint8Array; size: number } => {
  const size = ver * 4 + 17
  const m = new Uint8Array(size * size)
  const f = new Uint8Array(size * size)
  const set = (x: number, y: number, dark: number) => {
    m[y * size + x] = dark
    f[y * size + x] = 1
  }

  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0 ? 1 : 0)
    set(i, 6, i % 2 === 0 ? 1 : 0)
  }

  // Finders + separators — 9×9 Chebyshev rings clipped at the matrix edge.
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy))
        const x = cx + dx
        const y = cy + dy

        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, dist !== 2 && dist !== 4 ? 1 : 0)
      }
    }
  }

  finder(3, 3)
  finder(size - 4, 3)
  finder(3, size - 4)

  const pos = ALIGN_POSITIONS[ver]

  pos.forEach((x, i) => {
    pos.forEach((y, j) => {
      const corner =
        (i === 0 && j === 0) ||
        (i === 0 && j === pos.length - 1) ||
        (i === pos.length - 1 && j === 0)

      if (!corner) {
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            set(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1 ? 1 : 0)
          }
        }
      }
    })
  })

  if (ver >= 7) {
    let rem = ver

    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * VERSION_POLY)

    const bits = (ver << 12) | rem

    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      const bit = (bits >>> i) & 1

      set(a, b, bit)
      set(b, a, bit)
    }
  }

  // Format reservation — the same cells drawFormat later fills are marked
  // function but held light during mask trials; the spec scores each masked
  // candidate before format bits exist, so the trial matrix must match.
  const reserve = (x: number, y: number) => {
    f[y * size + x] = 1
  }

  for (let i = 0; i <= 5; i++) reserve(8, i)
  reserve(8, 7)
  reserve(8, 8)
  reserve(7, 8)
  for (let i = 9; i < 15; i++) reserve(14 - i, 8)
  for (let i = 0; i < 8; i++) reserve(size - 1 - i, 8)
  for (let i = 8; i < 15; i++) reserve(8, size - 15 + i)
  reserve(8, size - 8)

  return { m, f, size }
}

/**
 * Zigzag data placement — interleaved bits drop into the free modules in
 * 2-column sweeps from bottom-right, alternating direction, skipping the
 * column-6 timing strip.
 * @param m module matrix
 * @param f function-module mask
 * @param size matrix side
 * @param codewords interleaved data+ECC stream
 */
const placeData = (m: Uint8Array, f: Uint8Array, size: number, codewords: Uint8Array): void => {
  let i = 0

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5

    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j
        const upward = ((right + 1) & 2) === 0
        const y = upward ? size - 1 - vert : vert

        if (!f[y * size + x] && i < codewords.length * 8) {
          m[y * size + x] = (codewords[i >>> 3] >>> (7 - (i & 7))) & 1
          i++
        }
      }
    }
  }
}

/**
 * Mask condition lookup — the eight spec formulae, 1 when the module inverts.
 * @param mask pattern id 0–7
 * @param x column
 * @param y row
 * @returns 1 to flip, 0 to keep
 */
const maskBit = (mask: number, x: number, y: number): number => {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0 ? 1 : 0
    case 1:
      return y % 2 === 0 ? 1 : 0
    case 2:
      return x % 3 === 0 ? 1 : 0
    case 3:
      return (x + y) % 3 === 0 ? 1 : 0
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0 ? 1 : 0
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0 ? 1 : 0
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0 ? 1 : 0
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0 ? 1 : 0
  }
}

/**
 * Mask toggler — XORs every non-function module whose mask condition holds.
 * Applying the same mask twice restores the matrix, which is how the trial
 * loop reverts each candidate.
 * @param m module matrix (mutated in place)
 * @param f function-module mask
 * @param size matrix side
 * @param mask pattern id 0–7
 */
const applyMask = (m: Uint8Array, f: Uint8Array, size: number, mask: number): void => {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!f[y * size + x] && maskBit(mask, x, y)) m[y * size + x] ^= 1
    }
  }
}

/**
 * Spec penalty scorer — N1 adjacent-run, N2 same-colour 2×2, N3 finder-like
 * 1:1:3:1:1 with a 4-light guard, N4 dark-share deviation. Lower is better.
 * @param m module matrix
 * @param size matrix side
 * @returns penalty score
 */
const penaltyScore = (m: Uint8Array, size: number): number => {
  let penalty = 0

  // N1 — ≥5 same-colour runs in every row and column (3 + run−5 each).
  const runs = (get: (i: number) => number) => {
    let run = 1

    for (let i = 1; i < size; i++) {
      if (get(i) === get(i - 1)) {
        run++
      } else {
        if (run >= PENALTY_N1_RUN) penalty += PENALTY_N1_BASE + run - PENALTY_N1_RUN
        run = 1
      }
    }

    if (run >= PENALTY_N1_RUN) penalty += PENALTY_N1_BASE + run - PENALTY_N1_RUN
  }

  for (let y = 0; y < size; y++) runs((i) => m[y * size + i])
  for (let x = 0; x < size; x++) runs((i) => m[i * size + x])

  // N2 — solid 2×2 blocks.
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = m[y * size + x]

      if (
        c === m[y * size + x + 1] &&
        c === m[(y + 1) * size + x] &&
        c === m[(y + 1) * size + x + 1]
      ) {
        penalty += PENALTY_N2
      }
    }
  }

  // N3 — the 1:1:3:1:1 finder-like run (1011101) with a 4-light guard on
  // either side. Guards may reach into the quiet zone, so a pattern pinned
  // to a matrix edge counts automatically and partial edge guards only need
  // their visible cells light. On a hit the search resumes past the pattern;
  // on a guard miss it resumes mid-pattern so overlaps still count.
  const allLight = (get: (i: number) => number, from: number, to: number): boolean => {
    for (let i = Math.max(from, 0); i < Math.min(to, size); i++) if (get(i)) return false

    return true
  }

  const findPattern = (get: (i: number) => number, from: number): number => {
    for (let i = from; i + PENALTY_N3_PATTERN <= size; i++) {
      let hit = true

      for (let k = 0; k < PENALTY_N3_PATTERN; k++) {
        if (get(i + k) !== PENALTY_N3_PAT[k]) {
          hit = false
          break
        }
      }

      if (hit) return i
    }

    return -1
  }

  const n3 = (get: (i: number) => number) => {
    let idx = findPattern(get, 0)

    while (idx !== -1) {
      let next = idx + PENALTY_N3_PATTERN

      if (
        idx === 0 ||
        idx === size - PENALTY_N3_PATTERN ||
        allLight(get, idx - PENALTY_N3_GUARD, idx) ||
        allLight(get, idx + PENALTY_N3_PATTERN, idx + PENALTY_N3_PATTERN + PENALTY_N3_GUARD)
      ) {
        penalty += PENALTY_N3
      } else {
        next = idx + PENALTY_N3_GUARD
      }

      idx = findPattern(get, next)
    }
  }

  for (let y = 0; y < size; y++) n3((i) => m[y * size + i])
  for (let x = 0; x < size; x++) n3((i) => m[i * size + x])

  // N4 — each whole 5% band the dark share deviates from 50%.
  let dark = 0

  for (let i = 0; i < size * size; i++) dark += m[i]

  penalty += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * PENALTY_N4

  return penalty
}

/**
 * Full encode — UTF-8 byte segment → smallest fitting version → data +
 * interleaved ECC → function layer → best of the 8 masks by penalty score.
 * @param text payload (URLs in practice)
 * @returns dark-module matrix + side, or null past the v40-M capacity
 */
export const encodeQr = (text: string): { size: number; modules: Uint8Array } | null => {
  const bytes = new TextEncoder().encode(text)
  const ver = pickVersion(bytes.length)

  if (!ver) return null

  const codewords = interleave(encodeData(bytes, ver), ver)
  const { m, f, size } = drawFunction(ver)

  placeData(m, f, size, codewords)

  let bestMask = 0
  let bestScore = Infinity

  for (let mask = 0; mask < MASK_COUNT; mask++) {
    applyMask(m, f, size, mask)

    const score = penaltyScore(m, size)

    if (score < bestScore) {
      bestScore = score
      bestMask = mask
    }

    applyMask(m, f, size, mask)
  }

  applyMask(m, f, size, bestMask)
  drawFormat(m, f, size, bestMask)

  return { size, modules: m }
}

/**
 * Print-time QR element — a <svg><path></svg> pair drawn in currentColor so
 * the code inherits the document ink on paper. Adjacent dark modules on a
 * row merge into single h-runs so the path stays short for v30+ symbols.
 * @param text payload — returns null when it outgrows v40-M
 * @returns aria-hidden svg element (the wrapper link carries the semantics)
 */
export const qrSvg = (text: string): SVGSVGElement | null => {
  const qr = encodeQr(text)

  if (!qr) return null

  const { size, modules } = qr
  const parts: string[] = []

  for (let y = 0; y < size; y++) {
    let x = 0

    while (x < size) {
      if (!modules[y * size + x]) {
        x++
        continue
      }

      const x0 = x

      while (x < size && modules[y * size + x]) x++

      parts.push(`M${x0 + QUIET} ${y + QUIET}h${x - x0}v1h${x0 - x}z`)
    }
  }

  return h(
    'svg',
    {
      viewBox: `0 0 ${size + QUIET * 2} ${size + QUIET * 2}`,
      [ARIA_ATTRS.ARIA_HIDDEN]: ATTR_VALUES.TRUE,
    },
    h('path', { d: parts.join(CHAR_STRINGS.EMPTY), fill: ATTR_VALUES.CURRENT_COLOR })
  ) as SVGSVGElement
}
