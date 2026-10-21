/**
 * @file super-res.test.js
 * @description Coverage for core/utils/ml/super-res.ts — input gating,
 * canvas readback, NCHW marshal, model output validation, and every
 * null-degradation arm of the 2× enhancement path.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { upscaleImage2x } from '@core/utils/ml/super-res.js'
import { ML } from '@core/tokens/data/ml.js'

/** Minimal drawable stub — naturalWidth/Height drive the gate. */
const makeImg = (w = 4, h = 4) => ({ naturalWidth: w, naturalHeight: h })

/**
 * Stubs document.createElement('canvas') with a 2d-capable fake and
 * records putImageData payloads. Returns the swap-out restorer.
 */
const stubCanvas = ({ ctx = true, drawThrows = false } = {}) => {
  const real = document.createElement
  const calls = { put: [] }
  const fakeCtx = {
    drawImage: () => {
      if (drawThrows) throw new Error('tainted')
    },
    getImageData: (_x, _y, w, h) => ({
      data: new Uint8ClampedArray(w * h * 4).fill(128),
    }),
    putImageData: (d) => calls.put.push(d),
  }
  const fakeCanvas = {
    width: 0,
    height: 0,
    getContext: () => (ctx ? fakeCtx : null),
  }

  document.createElement = () => fakeCanvas

  return { calls, restore: () => (document.createElement = real) }
}

/** Stubs createImageBitmap — records calls, optional failure. */
const stubBitmap = ({ fail = false } = {}) => {
  const real = globalThis.createImageBitmap
  const calls = []

  globalThis.createImageBitmap = async (src) => {
    calls.push(src)

    if (fail) throw new Error('bitmap')

    return { __bitmap: true, src }
  }

  return { calls, restore: () => (globalThis.createImageBitmap = real) }
}

/** happy-dom lacks ImageData — minimal stand-in honoring the shape. */
const stubImageData = () => {
  const real = globalThis.ImageData

  globalThis.ImageData = class {
    constructor(data, w, h) {
      this.data = data
      this.width = w
      this.height = h
    }
  }

  return () => {
    if (real === undefined) delete globalThis.ImageData
    else globalThis.ImageData = real
  }
}

/** run stub resolving a correctly-sized 2× NCHW output for w×h input. */
const okRun = (w, h) => async () => ({
  [ML.OUT_HR_IMAGE]: new Float32Array(w * ML.SUPERRES_SCALE * (h * ML.SUPERRES_SCALE) * 3).fill(0.5),
})

describe('super-res upscaleImage2x', () => {
  let restores = []

  beforeEach(() => (restores = []))
  afterEach(() => restores.forEach((r) => r()))

  test('null image, missing document and missing createImageBitmap gate out', async () => {
    expect(await upscaleImage2x(null)).toBeNull()

    const savedDoc = globalThis.document

    delete globalThis.document
    expect(await upscaleImage2x(makeImg())).toBeNull()
    globalThis.document = savedDoc

    const savedBitmap = globalThis.createImageBitmap

    delete globalThis.createImageBitmap
    expect(await upscaleImage2x(makeImg())).toBeNull()
    globalThis.createImageBitmap = savedBitmap
  })

  test('zero-size and over-cap inputs skip inference entirely', async () => {
    let ran = false
    const run = async () => {
      ran = true

      return {}
    }

    expect(await upscaleImage2x(makeImg(0, 10), run)).toBeNull()

    const side = Math.ceil(Math.sqrt(ML.SUPERRES_MAX_PIXELS)) + 1

    expect(await upscaleImage2x(makeImg(side, side), run)).toBeNull()
    expect(ran).toBe(false)
  })

  test('no 2d context resolves null', async () => {
    const { restore } = stubCanvas({ ctx: false })

    restores.push(restore)
    expect(await upscaleImage2x(makeImg(), okRun(4, 4))).toBeNull()
  })

  test('a throwing drawImage (tainted source) resolves null', async () => {
    const { restore } = stubCanvas({ drawThrows: true })

    restores.push(restore)
    expect(await upscaleImage2x(makeImg(), okRun(4, 4))).toBeNull()
  })

  test('null model output and wrong output length resolve null', async () => {
    const { restore } = stubCanvas()

    restores.push(restore)
    expect(await upscaleImage2x(makeImg(), async () => null)).toBeNull()
    expect(
      await upscaleImage2x(makeImg(), async () => ({ [ML.OUT_HR_IMAGE]: new Float32Array(3) }))
    ).toBeNull()
  })

  test('happy path: NCHW feed → 2× ImageData → ImageBitmap', async () => {
    const c = stubCanvas()
    const b = stubBitmap()

    restores.push(c.restore, b.restore, stubImageData())

    let feed
    const run = async (_slug, feeds) => {
      feed = feeds[ML.IN_LR_IMAGE]

      return okRun(4, 4)()
    }

    const bmp = await upscaleImage2x(makeImg(4, 4), run)

    expect(bmp).not.toBeNull()
    expect(feed.dims).toEqual([1, 3, 4, 4])
    expect(feed.data).toHaveLength(4 * 4 * 3)
    // 128/255 across all channels — flat gray input stays gray.
    expect(feed.data[0]).toBeCloseTo(128 / 255, 3)
    expect(c.calls.put[0].width).toBe(8)
    expect(b.calls).toHaveLength(1)
  })

  test('a failed createImageBitmap resolves null', async () => {
    const c = stubCanvas()
    const b = stubBitmap({ fail: true })

    restores.push(c.restore, b.restore, stubImageData())
    expect(await upscaleImage2x(makeImg(4, 4), okRun(4, 4))).toBeNull()
  })

  test('video and canvas drawables read videoWidth/width dims', async () => {
    const c = stubCanvas()
    const b = stubBitmap()

    restores.push(c.restore, b.restore, stubImageData())

    const vid = { videoWidth: 4, videoHeight: 4 }
    const cnv = { width: 4, height: 4 }

    expect(await upscaleImage2x(vid, okRun(4, 4))).not.toBeNull()
    expect(await upscaleImage2x(cnv, okRun(4, 4))).not.toBeNull()
  })
})
