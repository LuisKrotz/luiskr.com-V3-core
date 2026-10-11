/**
 * @file firebase-redirect-event-tails.test.js
 * @description Coverage tails for core/firebase.ts — the null-redirect-
 * result arm in onAuthChange: when a redirect leg ran (marker set) but
 * getRedirectResult resolves null, the OAuth event was lost to blocked
 * third-party storage — the auth/no-redirect-event code is flagged so the
 * login view shows the blocked-storage diagnosis. Also covers the
 * guarded-storage catch arms in the failure recorders.
 */
import { describe, test, expect, jest, afterEach } from '@jest/globals'
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

afterEach(() => {
  jest.restoreAllMocks()
})

describe('firebase redirect event tails', () => {
  test('a null result with an outstanding marker flags no-redirect-event', async () => {
    sessionStorage.setItem(CACHE_STORAGE_KEYS.CMS_AUTH_REDIRECT, '1')

    const unsub = await firebase.onAuthChange(jest.fn())

    expect(sessionStorage.getItem(CACHE_STORAGE_KEYS.CMS_AUTH_ERROR)).toBe(
      AUTH_STRINGS.ERR_NO_REDIRECT_EVENT
    )
    expect(sessionStorage.getItem(CACHE_STORAGE_KEYS.CMS_AUTH_REDIRECT)).toBeNull()
    expect(unsub).toBe(mockUnsub)
  })

  test('a null result without the marker is a plain first visit — no error', async () => {
    sessionStorage.removeItem(CACHE_STORAGE_KEYS.CMS_AUTH_REDIRECT)
    sessionStorage.removeItem(CACHE_STORAGE_KEYS.CMS_AUTH_ERROR)

    await firebase.onAuthChange(jest.fn())

    expect(sessionStorage.getItem(CACHE_STORAGE_KEYS.CMS_AUTH_ERROR)).toBeNull()
  })

  test('storage failures inside the failure recorders are swallowed', async () => {
    jest.spyOn(window.Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage-blocked')
    })
    jest.spyOn(window.Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage-blocked')
    })

    const unsub = await firebase.onAuthChange(jest.fn())

    expect(unsub).toBe(mockUnsub)
  })

  test('a rejected getRedirectResult still records the real code when storage works', async () => {
    const { getRedirectResult } = await import('firebase/auth')

    sessionStorage.setItem(CACHE_STORAGE_KEYS.CMS_AUTH_REDIRECT, '1')

    getRedirectResult.mockRejectedValueOnce(
      Object.assign(new Error('blocked'), { code: 'auth/unauthorized-domain' })
    )

    await firebase.onAuthChange(jest.fn())

    expect(sessionStorage.getItem(CACHE_STORAGE_KEYS.CMS_AUTH_ERROR)).toBe(
      'auth/unauthorized-domain'
    )
    expect(sessionStorage.getItem(CACHE_STORAGE_KEYS.CMS_AUTH_REDIRECT)).toBeNull()
  })
})
