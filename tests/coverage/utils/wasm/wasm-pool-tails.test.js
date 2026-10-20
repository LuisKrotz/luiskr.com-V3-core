/**
 * @file wasm-pool-tails.test.js
 * @description Coverage for core/utils/wasm/wasm-pool.ts — the worker
 * dispatcher. Covers handleMessage's unknown-id arm, Worker constructor
 * failures, destroy() teardown (pending-task resolve + worker terminate,
 * including their throwing catch arms), the pagehide teardown listener,
 * the reply-timeout _dropWorker path, the wipeout→respawn cooldown arms,
 * _dropWorker's index/cursor/foreign-task arms, and the null-payload
 * dispatch arm.
 */
import { describe, test, expect, jest, afterEach } from '@jest/globals'
import { wasmPool } from '@core/utils/wasm/wasm-pool.js'
import { WASM_POOL } from '@core/tokens/data/wasm.js'
import { WINDOW_EVENTS } from '@core/tokens/events/dom.js'
import { WASM_ACTIONS } from '@core/constants.js'

import { TEST_TEXT } from '@tests/fixtures/test-constants.js'
import '@website/components/feedback/CookieBanner.js'
import '@website/components/home/ContactSection.js'
import '@website/views/not-found/NotFound.js'

const WorkerSaved = globalThis.Worker

/**
 * Minimal Worker stand-in — postMessage never replies unless a reply is
 * wired in, so pending tasks stay in the map until dropped or destroyed.
 * @param {boolean} reply Whether postMessage schedules a fake reply.
 * @returns {object} A Worker-shaped stub recorded for assertions.
 */
const makeWorkerStub = (reply = false) => {
  const w = {
    postMessage({ id } = {}) {
      if (reply) queueMicrotask(() => this.onmessage?.({ data: { id } }))
    },
    terminate: jest.fn(),
    onmessage: null,
    onerror: null,
  }
  return w
}

afterEach(() => {
  globalThis.Worker = WorkerSaved
  jest.useRealTimers()
})

describe('wasm-pool tails', () => {
  test('handleMessage ignores unknown ids and init tolerates worker failure', () => {
    wasmPool.handleMessage?.({ data: { id: 'nope-xyz' } })

    globalThis.Worker = class {
      constructor() {
        throw new Error(TEST_TEXT.SECOND)
      }
    }
    wasmPool.init?.()
  })

  test('a full wipeout cooldown-gates the next dispatch, then respawns after the window', async () => {
    // Kill the only worker → _wipedAt stamps the wipeout. A dispatch
    // inside RESPAWN_COOLDOWN_MS early-returns out of _ensurePool and
    // resolves null; backdating _wipedAt re-arms the spawn.
    const dead = makeWorkerStub()

    wasmPool.workers = [dead]
    wasmPool._poolReady = true
    wasmPool._wipeouts = 0
    wasmPool._wipedAt = 0
    wasmPool._dropWorker(dead)

    expect(dead.terminate).toHaveBeenCalled()

    globalThis.Worker = class {
      constructor() {
        Object.assign(this, makeWorkerStub(true))
      }
    }

    const cooled = await wasmPool.dispatch(WASM_ACTIONS.PROBE_VIDEO_WASM, null)

    expect(cooled).toBeNull()

    wasmPool._wipedAt = Date.now() - WASM_POOL.RESPAWN_COOLDOWN_MS - 1

    const res = await wasmPool.dispatch(WASM_ACTIONS.PROBE_VIDEO_WASM, null)

    expect(wasmPool.workers.length).toBeGreaterThan(0)
    expect(res).not.toBeNull()
  })

  test('dropping a worker not in the pool leaves the cursor and tasks alone', () => {
    const stray = makeWorkerStub()
    const foreign = makeWorkerStub()

    // A pending task owned by a different worker takes the continue arm.
    wasmPool.pendingTasks.set(99, {
      resolve: jest.fn(),
      worker: foreign,
      timeout: setTimeout(() => {}, WASM_POOL.REPLY_TIMEOUT_MS),
    })

    wasmPool.workers = []
    wasmPool.nextWorkerIdx = 7

    wasmPool._dropWorker(stray)

    expect(wasmPool.nextWorkerIdx).toBe(0)
    expect(wasmPool.pendingTasks.has(99)).toBe(true)

    wasmPool.pendingTasks.clear()
  })

  test('a reply that never lands drops its worker on the timeout', async () => {
    jest.useFakeTimers()

    const silent = makeWorkerStub(false)

    wasmPool.workers = [silent]
    wasmPool._poolReady = true

    const p = wasmPool.dispatch(WASM_ACTIONS.PROBE_VIDEO_WASM, {})

    jest.advanceTimersByTime(WASM_POOL.REPLY_TIMEOUT_MS + 1)

    await expect(p).resolves.toBeNull()
    expect(silent.terminate).toHaveBeenCalled()
  })

  test('destroy resolves pending callers, terminates workers, and tolerates throws', () => {
    const w = makeWorkerStub()
    const wedged = {
      terminate: jest.fn(() => {
        throw new Error(TEST_TEXT.SECOND)
      }),
    }

    wasmPool.workers = [w, wedged]
    wasmPool._poolReady = true
    wasmPool.pendingTasks.set(4242, {
      resolve: () => {
        throw new Error(TEST_TEXT.SECOND)
      },
      worker: w,
      timeout: setTimeout(() => {}, WASM_POOL.REPLY_TIMEOUT_MS),
    })

    wasmPool.destroy()

    expect(w.terminate).toHaveBeenCalled()
    expect(wasmPool.workers).toHaveLength(0)
    expect(wasmPool.pendingTasks.size).toBe(0)
  })

  test('pagehide tears the pool down once', () => {
    const w = makeWorkerStub()

    wasmPool.workers = [w]
    wasmPool._poolReady = true
    wasmPool._wipeouts = 0

    window.dispatchEvent(new Event(WINDOW_EVENTS.PAGEHIDE))

    expect(w.terminate).toHaveBeenCalled()
    expect(wasmPool.workers).toHaveLength(0)
  })
})
