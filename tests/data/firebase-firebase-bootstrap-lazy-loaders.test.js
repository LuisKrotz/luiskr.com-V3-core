/**
 * @file firebase-firebase-bootstrap-lazy-loaders.test.js
 * @description Split from firebase.test.js — covers the "firebase — bootstrap & lazy loaders" describe.
 */
import { describe, test, expect, jest } from '@jest/globals'
import { APP_IDS } from '@core/tokens/ids/app.js'
import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import { AUTH_STRINGS, AUTH_URLS } from '@core/tokens/strings/auth.js'
import { CACHE_STORAGE_KEYS } from '@core/tokens/data/storage.js'
import { NET_STRINGS } from '@core/tokens/strings/net.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'

const mockAuth = { currentUser: null, marker: 'auth-instance' }
const mockDb = { marker: 'db-instance' }

/**
 * probeAuthBackend re-issues the createAuthUri REST call after an opaque
 * auth/internal-error — stub fetch globally so tests never hit the
 * network. The default ok:true response makes the probe return empty
 * (no server message → the redirect fallback stays eligible).
 */
const fetchMock = jest.fn(async () => ({ ok: true, json: async () => ({}) }))
globalThis.fetch = fetchMock

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

const firebase = await import('@core/firebase.js')

describe('firebase — bootstrap & lazy loaders', () => {
  test('app initializes with project config', () => {
    expect(firebase.app.marker).toBe(APP_IDS.APP)
    expect(firebase.app.config.projectId).toBe('luiskr-com')
    expect(firebase.app.config.databaseURL).toContain('luiskr-com')
  })

  test('no eager auth/db exports — SDKs load only via the lazy getters', () => {
    // The auth/db Proxy shims were removed: nothing may import a Firebase SDK
    // instance synchronously; getAuthInstance/getDbInstance are the contract.
    expect('auth' in firebase).toBe(false)
    expect('db' in firebase).toBe(false)
  })

  test('getAuthInstance lazily loads and memoizes the auth instance', async () => {
    const a1 = await firebase.getAuthInstance()
    const a2 = await firebase.getAuthInstance()
    expect(a1).toBe(mockAuth)
    expect(a2).toBe(mockAuth)
  })

  test('getDbInstance lazily loads and memoizes the db instance', async () => {
    const d1 = await firebase.getDbInstance()
    const d2 = await firebase.getDbInstance()
    expect(d1).toBe(mockDb)
    expect(d2).toBe(mockDb)
  })

  test('signInWithGoogle forces the account chooser and resolves the user', async () => {
    const { signInWithPopup } = await import('firebase/auth')
    const res = await firebase.signInWithGoogle()
    expect(res.user.uid).toBe('u1')
    expect(signInWithPopup).toHaveBeenCalled()
  })

  test('logoutUser signs out', async () => {
    const { signOut } = await import('firebase/auth')
    await firebase.logoutUser()
    expect(signOut).toHaveBeenCalledWith(mockAuth)
  })

  test('signInWithGoogle falls back to redirect when the popup environment fails', async () => {
    const { signInWithPopup, signInWithRedirect } = await import('firebase/auth')

    signInWithPopup.mockRejectedValueOnce({ code: AUTH_STRINGS.ERR_INTERNAL })

    const res = await firebase.signInWithGoogle()

    expect(signInWithRedirect).toHaveBeenCalled()
    expect(res).toBeUndefined()
  })

  test('signInWithGoogle preserves the popup-leg code for the login view', async () => {
    const { signInWithPopup } = await import('firebase/auth')

    sessionStorage.removeItem(CACHE_STORAGE_KEYS.CMS_AUTH_POPUP_ERROR)
    signInWithPopup.mockRejectedValueOnce({ code: AUTH_STRINGS.ERR_INTERNAL })

    await firebase.signInWithGoogle()

    expect(sessionStorage.getItem(CACHE_STORAGE_KEYS.CMS_AUTH_POPUP_ERROR)).toBe(
      AUTH_STRINGS.ERR_INTERNAL
    )

    sessionStorage.removeItem(CACHE_STORAGE_KEYS.CMS_AUTH_POPUP_ERROR)
  })

  test('signInWithGoogle still redirects when sessionStorage is unavailable', async () => {
    const { signInWithPopup, signInWithRedirect } = await import('firebase/auth')

    jest.spyOn(window.Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage-blocked')
    })

    signInWithPopup.mockRejectedValueOnce({ code: AUTH_STRINGS.ERR_INTERNAL })

    await expect(firebase.signInWithGoogle()).resolves.toBeUndefined()
    expect(signInWithRedirect).toHaveBeenCalled()

    jest.restoreAllMocks()
  })

  test('signInWithGoogle persists the popup-leg detail alongside the code', async () => {
    const { signInWithPopup } = await import('firebase/auth')

    sessionStorage.removeItem(CACHE_STORAGE_KEYS.CMS_AUTH_POPUP_DETAIL)
    signInWithPopup.mockRejectedValueOnce({
      code: AUTH_STRINGS.ERR_INTERNAL,
      message: 'helper iframe never answered',
    })

    await firebase.signInWithGoogle()

    expect(sessionStorage.getItem(CACHE_STORAGE_KEYS.CMS_AUTH_POPUP_DETAIL)).toBe(
      'helper iframe never answered'
    )

    sessionStorage.removeItem(CACHE_STORAGE_KEYS.CMS_AUTH_POPUP_DETAIL)
  })

  test('an internal-error wrapping a backend rejection skips the redirect fallback', async () => {
    const { signInWithPopup, signInWithRedirect } = await import('firebase/auth')

    const before = signInWithRedirect.mock.calls.length

    // App-Check-enforced 401 → the redirect leg would hit the same wall,
    // so the error must surface immediately instead of navigating away.
    signInWithPopup.mockRejectedValueOnce({
      code: AUTH_STRINGS.ERR_INTERNAL,
      message: '{"error":{"code":401,"message":"Firebase App Check token is invalid."}}',
    })

    await expect(firebase.signInWithGoogle()).rejects.toEqual({
      code: AUTH_STRINGS.ERR_INTERNAL,
      message: '{"error":{"code":401,"message":"Firebase App Check token is invalid."}}',
    })

    expect(signInWithRedirect.mock.calls.length).toBe(before)
  })

  test('an internal-error probes the backend, persists the real server cause, and skips redirect', async () => {
    const { signInWithPopup, signInWithRedirect } = await import('firebase/auth')

    const before = signInWithRedirect.mock.calls.length

    sessionStorage.removeItem(CACHE_STORAGE_KEYS.CMS_AUTH_POPUP_DETAIL)
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'Firebase App Check token is invalid.' } }),
    })
    signInWithPopup.mockRejectedValueOnce({ code: AUTH_STRINGS.ERR_INTERNAL })

    await expect(firebase.signInWithGoogle()).rejects.toEqual({
      code: AUTH_STRINGS.ERR_INTERNAL,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(AUTH_URLS.CREATE_AUTH_URI),
      expect.objectContaining({ method: NET_STRINGS.METHOD_POST })
    )
    expect(sessionStorage.getItem(CACHE_STORAGE_KEYS.CMS_AUTH_POPUP_DETAIL)).toBe(
      'Firebase App Check token is invalid.'
    )
    expect(signInWithRedirect.mock.calls.length).toBe(before)

    sessionStorage.removeItem(CACHE_STORAGE_KEYS.CMS_AUTH_POPUP_DETAIL)
  })

  test('probe responses without a usable server message still redirect', async () => {
    const { signInWithPopup, signInWithRedirect } = await import('firebase/auth')

    const before = signInWithRedirect.mock.calls.length

    // res.ok → the endpoint accepted the probe: nothing to report.
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    signInWithPopup.mockRejectedValueOnce({ code: AUTH_STRINGS.ERR_INTERNAL })
    await firebase.signInWithGoogle()

    // Non-ok body without error.message → still no recovered cause.
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    signInWithPopup.mockRejectedValueOnce({ code: AUTH_STRINGS.ERR_INTERNAL })
    await firebase.signInWithGoogle()

    expect(signInWithRedirect.mock.calls.length).toBe(before + 2)
  })

  test('probe transport failures still redirect — fetch throw and bad json', async () => {
    const { signInWithPopup, signInWithRedirect } = await import('firebase/auth')

    const before = signInWithRedirect.mock.calls.length

    fetchMock.mockRejectedValueOnce(new Error('offline'))
    signInWithPopup.mockRejectedValueOnce({ code: AUTH_STRINGS.ERR_INTERNAL })
    await firebase.signInWithGoogle()

    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => {
        throw new Error('not json')
      },
    })
    signInWithPopup.mockRejectedValueOnce({ code: AUTH_STRINGS.ERR_INTERNAL })
    await firebase.signInWithGoogle()

    expect(signInWithRedirect.mock.calls.length).toBe(before + 2)
  })

  test('the probe skips entirely when fetch is unavailable', async () => {
    const { signInWithPopup, signInWithRedirect } = await import('firebase/auth')

    const before = signInWithRedirect.mock.calls.length
    const fetchCalls = fetchMock.mock.calls.length

    globalThis.fetch = undefined

    try {
      signInWithPopup.mockRejectedValueOnce({ code: AUTH_STRINGS.ERR_INTERNAL })
      await firebase.signInWithGoogle()
    } finally {
      globalThis.fetch = fetchMock
    }

    expect(fetchMock.mock.calls.length).toBe(fetchCalls)
    expect(signInWithRedirect.mock.calls.length).toBe(before + 1)
  })

  test('the probe builds the handler continueUri when a window exists', async () => {
    const { signInWithPopup } = await import('firebase/auth')

    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'denied' } }),
    })
    signInWithPopup.mockRejectedValueOnce({ code: AUTH_STRINGS.ERR_INTERNAL })

    await expect(firebase.signInWithGoogle()).rejects.toEqual({
      code: AUTH_STRINGS.ERR_INTERNAL,
    })

    const body = JSON.parse(fetchMock.mock.calls.at(-1)[1].body)
    expect(body.continueUri).toContain(AUTH_URLS.HANDLER_PATH)
    expect(body.providerId).toBe(AUTH_STRINGS.PROVIDER_GOOGLE)
  })

  test('the probe sends an empty continueUri when no window exists', async () => {
    const { signInWithPopup } = await import('firebase/auth')

    const origWindow = globalThis.window

    delete globalThis.window
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    signInWithPopup.mockRejectedValueOnce({ code: AUTH_STRINGS.ERR_INTERNAL })

    try {
      await firebase.signInWithGoogle()

      const body = JSON.parse(fetchMock.mock.calls.at(-1)[1].body)
      expect(body.continueUri).toBe(ATTR_VALUES.EMPTY)
    } finally {
      globalThis.window = origWindow
    }
  })

  test('an error without a code or message rethrows unchanged', async () => {
    const { signInWithPopup, signInWithRedirect } = await import('firebase/auth')

    const before = signInWithRedirect.mock.calls.length

    signInWithPopup.mockRejectedValueOnce({})

    await expect(firebase.signInWithGoogle()).rejects.toEqual({})
    expect(signInWithRedirect.mock.calls.length).toBe(before)
  })

  test('signInWithGoogle redirects for every popup-environment code', async () => {
    const { signInWithPopup, signInWithRedirect } = await import('firebase/auth')

    const before = signInWithRedirect.mock.calls.length

    for (const code of [
      AUTH_STRINGS.ERR_POPUP_BLOCKED,
      AUTH_STRINGS.ERR_STORAGE_UNSUPPORTED,
      AUTH_STRINGS.ERR_ENV_UNSUPPORTED,
    ]) {
      signInWithPopup.mockRejectedValueOnce({ code })
      await firebase.signInWithGoogle()
    }

    expect(signInWithRedirect.mock.calls.length).toBe(before + 3)
  })

  test('signInWithGoogle rethrows user cancellations instead of redirecting', async () => {
    const { signInWithPopup, signInWithRedirect } = await import('firebase/auth')

    const before = signInWithRedirect.mock.calls.length

    signInWithPopup.mockRejectedValueOnce({ code: AUTH_STRINGS.ERR_POPUP_CLOSED })

    await expect(firebase.signInWithGoogle()).rejects.toEqual({
      code: AUTH_STRINGS.ERR_POPUP_CLOSED,
    })

    expect(signInWithRedirect.mock.calls.length).toBe(before) // no new fallback
  })

  test('onAuthChange subscribes via onAuthStateChanged', async () => {
    const { onAuthStateChanged } = await import('firebase/auth')
    const unsub = await firebase.onAuthChange(() => {})
    expect(onAuthStateChanged).toHaveBeenCalled()
    expect(typeof unsub).toBe(TYPE_STRINGS.FUNCTION)
  })

  test('onAuthChange still subscribes when the redirect result rejects', async () => {
    const { getRedirectResult, onAuthStateChanged } = await import('firebase/auth')

    getRedirectResult.mockRejectedValueOnce(new Error('redirect failed'))

    const unsub = await firebase.onAuthChange(() => {})

    expect(onAuthStateChanged).toHaveBeenCalled()
    expect(typeof unsub).toBe(TYPE_STRINGS.FUNCTION)
  })
})
