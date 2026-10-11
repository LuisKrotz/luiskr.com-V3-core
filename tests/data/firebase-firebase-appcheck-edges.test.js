/**
 * @file firebase-firebase-appcheck-edges.test.js
 * @description Covers ensureAppCheck() in core/firebase.ts — the
 * env-gated App Check init that runs before the lazy auth/db SDKs so
 * Identity Toolkit calls carry a token when the project enforces App
 * Check: absent site key (no-op), v3 vs Enterprise provider selection,
 * the localhost debug token, and the failed-init retry contract.
 */
import { describe, test, expect, jest, afterEach } from '@jest/globals'
import { APP_IDS } from '@core/tokens/ids/app.js'
import { AUTH_STRINGS } from '@core/tokens/strings/auth.js'

const mockAuth = { currentUser: null, marker: 'auth-instance' }
const mockDb = { marker: 'db-instance' }

jest.unstable_mockModule('firebase/auth', () => ({
  getAuth: jest.fn(() => mockAuth),
  GoogleAuthProvider: jest.fn(() => ({ setCustomParameters: jest.fn() })),
  signInWithPopup: jest.fn(async () => ({ user: { uid: 'u1' } })),
  signInWithRedirect: jest.fn(async () => undefined),
  getRedirectResult: jest.fn(async () => null),
  signOut: jest.fn(async () => undefined),
  onAuthStateChanged: jest.fn((_a, cb) => () => cb),
}))

jest.unstable_mockModule('firebase/database', () => ({
  getDatabase: jest.fn(() => mockDb),
  ref: jest.fn((db) => ({ db })),
  child: jest.fn((r, p) => ({ ...r, path: p })),
  get: jest.fn(async (r) => ({ exists: () => true, val: () => ({ sdk: true, path: r?.path }) })),
}))

jest.unstable_mockModule('firebase/app', () => ({
  initializeApp: jest.fn((config) => ({ config, marker: APP_IDS.APP })),
}))

const mockInitAppCheck = jest.fn(() => ({ marker: 'appcheck' }))

jest.unstable_mockModule('firebase/app-check', () => ({
  initializeAppCheck: mockInitAppCheck,
  ReCaptchaV3Provider: jest.fn(function (key) {
    this.key = key
    this.kind = 'v3'
  }),
  ReCaptchaEnterpriseProvider: jest.fn(function (key) {
    this.key = key
    this.kind = AUTH_STRINGS.APPCHECK_PROVIDER_ENTERPRISE
  }),
}))

describe('firebase — app-check edges', () => {
  const origSelf = globalThis.self

  afterEach(() => {
    globalThis.__VITE_ENV__ = undefined
    globalThis.self = origSelf
    delete globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN
    mockInitAppCheck.mockClear()
  })

  const freshFirebase = async (env) => {
    globalThis.__VITE_ENV__ = env
    jest.resetModules()

    return await import('@core/firebase.js')
  }

  test('no site key configured → App Check never initializes, auth still loads', async () => {
    const fresh = await freshFirebase({})

    const auth = await fresh.getAuthInstance()

    expect(auth).toBe(mockAuth)
    expect(mockInitAppCheck).not.toHaveBeenCalled()
  })

  test('a configured site key initializes App Check with reCAPTCHA v3 before auth', async () => {
    const fresh = await freshFirebase({ VITE_FIREBASE_APPCHECK_SITE_KEY: 'site-key-1' })

    await fresh.getAuthInstance()

    expect(mockInitAppCheck).toHaveBeenCalledWith(fresh.app, {
      provider: expect.objectContaining({ kind: 'v3', key: 'site-key-1' }),
      isTokenAutoRefreshEnabled: true,
    })
  })

  test('provider=enterprise selects ReCaptchaEnterpriseProvider', async () => {
    const fresh = await freshFirebase({
      VITE_FIREBASE_APPCHECK_SITE_KEY: 'site-key-2',
      VITE_FIREBASE_APPCHECK_PROVIDER: AUTH_STRINGS.APPCHECK_PROVIDER_ENTERPRISE,
    })

    await fresh.getAuthInstance()

    expect(mockInitAppCheck).toHaveBeenCalledWith(fresh.app, {
      provider: expect.objectContaining({
        kind: AUTH_STRINGS.APPCHECK_PROVIDER_ENTERPRISE,
        key: 'site-key-2',
      }),
      isTokenAutoRefreshEnabled: true,
    })
  })

  test('the debug env value exposes the localhost debug token on self', async () => {
    globalThis.self = globalThis

    const fresh = await freshFirebase({
      VITE_FIREBASE_APPCHECK_SITE_KEY: 'site-key-3',
      VITE_FIREBASE_APPCHECK_DEBUG: 'debug-token-1',
    })

    await fresh.getAuthInstance()

    expect(globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN).toBe('debug-token-1')
    expect(mockInitAppCheck).toHaveBeenCalled()
  })

  test('the internal-error backend probe returns empty when no api key resolves', async () => {
    const origAtob = globalThis.atob
    const origFetch = globalThis.fetch
    const fetchSpy = jest.fn()

    globalThis.atob = undefined
    globalThis.fetch = fetchSpy

    try {
      const fresh = await freshFirebase({})
      const { signInWithPopup, signInWithRedirect } = await import('firebase/auth')
      const before = signInWithRedirect.mock.calls.length

      signInWithPopup.mockRejectedValueOnce({ code: AUTH_STRINGS.ERR_INTERNAL })

      await fresh.signInWithGoogle()

      // No key → the probe skips the network entirely; the error keeps
      // its normal redirect-fallback path.
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(signInWithRedirect.mock.calls.length).toBe(before + 1)
    } finally {
      globalThis.atob = origAtob
      globalThis.fetch = origFetch
    }
  })

  test('a failed App Check init warns, returns null, and the next call retries', async () => {
    const fresh = await freshFirebase({ VITE_FIREBASE_APPCHECK_SITE_KEY: 'site-key-4' })

    mockInitAppCheck.mockImplementationOnce(() => {
      throw new Error('appcheck-boom')
    })

    const auth = await fresh.getAuthInstance()

    expect(auth).toBe(mockAuth)

    // Cached promise was dropped — a second attempt re-runs the init.
    await fresh.getDbInstance()

    expect(mockInitAppCheck.mock.calls.length).toBe(2)
  })
})
