/**
 * @file firebase-auth-timeout-tails.test.js
 * @description Coverage tails for core/firebase.ts — the bounded
 * auth-bootstrap arms added for blocked third-party storage: a failing
 * getAuthInstance records the failure code, resets the cached import
 * promise so retries can succeed, and the background subscribe still
 * wires the listener (both its success and rejection arms).
 *
 * Order matters: _authInstance memoizes after the first successful
 * getAuthInstance, so every failing flow uses mockImplementationOnce —
 * getAuth calls after the first failure behave normally again.
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import { CACHE_STORAGE_KEYS } from '@core/tokens/data/storage.js'
import { AUTH_STRINGS } from '@core/tokens/strings/auth.js'

const mockAuth = { currentUser: null, marker: 'auth-instance' }
const mockUnsub = jest.fn()

jest.unstable_mockModule('firebase/auth', () => ({
  getAuth: jest.fn(() => mockAuth),
  GoogleAuthProvider: jest.fn(() => ({ setCustomParameters: jest.fn() })),
  signInWithPopup: jest.fn(async () => ({ user: { uid: 'u1' } })),
  signInWithRedirect: jest.fn(async () => undefined),
  getRedirectResult: jest.fn(async () => null),
  signOut: jest.fn(async () => undefined),
  onAuthStateChanged: jest.fn(() => mockUnsub),
}))

jest.unstable_mockModule('firebase/app', () => ({
  initializeApp: jest.fn(() => ({ marker: 'app' })),
}))

jest.unstable_mockModule('firebase/database', () => ({
  getDatabase: jest.fn(() => ({ marker: 'db' })),
}))

const firebase = await import('@core/firebase.js')

const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  sessionStorage.clear()
})

describe('firebase auth timeout tails', () => {
  test('init failure and background-retry failure hit the swallow arm', async () => {
    const { getAuth } = await import('firebase/auth')

    // Both the foreground race and the background retry reject → the
    // background .catch arm (devWarn) runs.
    getAuth
      .mockImplementationOnce(() => {
        throw new Error('chunk-load-failed')
      })
      .mockImplementationOnce(() => {
        throw new Error('chunk-load-failed-again')
      })

    const unsub = await firebase.onAuthChange(jest.fn())

    expect(sessionStorage.getItem(CACHE_STORAGE_KEYS.CMS_AUTH_ERROR)).toBe(
      'auth/auth-init-failed'
    )
    expect(typeof unsub).toBe('function')
    expect(() => unsub()).not.toThrow()

    await flush()
  })

  test('init failure records the code and the background retry subscribes', async () => {
    const { getAuth, onAuthStateChanged } = await import('firebase/auth')

    sessionStorage.setItem(CACHE_STORAGE_KEYS.CMS_AUTH_REDIRECT, '1')

    // First getAuth throws — the foreground race rejects; the dropped
    // _authPromise lets the background retry re-import and succeed.
    getAuth.mockImplementationOnce(() => {
      throw new Error('chunk-load-failed')
    })

    const unsub = await firebase.onAuthChange(jest.fn())

    // Code-less error → the || 'auth/auth-init-failed' fallback arm.
    expect(sessionStorage.getItem(CACHE_STORAGE_KEYS.CMS_AUTH_ERROR)).toBe(
      'auth/auth-init-failed'
    )
    expect(sessionStorage.getItem(CACHE_STORAGE_KEYS.CMS_AUTH_REDIRECT)).toBeNull()
    expect(typeof unsub).toBe('function')

    await flush()

    expect(onAuthStateChanged).toHaveBeenCalled()
  })

  test('a getRedirectResult timeout records the event-timeout code', async () => {
    jest.useFakeTimers()

    try {
      const { getRedirectResult } = await import('firebase/auth')

      sessionStorage.setItem(CACHE_STORAGE_KEYS.CMS_AUTH_REDIRECT, '1')

      getRedirectResult.mockImplementationOnce(() => new Promise(() => {}))

      const p = firebase.onAuthChange(jest.fn())

      // Let the auth instance + dynamic import resolve, then run the 6s
      // event timer out (async advance flushes microtasks between steps).
      await jest.advanceTimersByTimeAsync(0)
      await jest.advanceTimersByTimeAsync(7000)

      const unsub = await p

      expect(sessionStorage.getItem(CACHE_STORAGE_KEYS.CMS_AUTH_ERROR)).toBe(
        AUTH_STRINGS.ERR_REDIRECT_EVENT_TIMEOUT
      )
      expect(sessionStorage.getItem(CACHE_STORAGE_KEYS.CMS_AUTH_REDIRECT)).toBeNull()
      expect(typeof unsub).toBe('function')
    } finally {
      jest.useRealTimers()
    }
  })
})
