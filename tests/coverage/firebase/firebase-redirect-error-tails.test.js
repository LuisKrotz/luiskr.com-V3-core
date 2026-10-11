/**
 * @file firebase-redirect-error-tails.test.js
 * @description Coverage tails for core/firebase.ts — the REJECTED
 * getRedirectResult arm in onAuthChange: a failed OAuth return leg
 * persists the real Firebase code under CMS_AUTH_ERROR and consumes the
 * CMS_AUTH_REDIRECT marker so the login view surfaces the diagnosis
 * instead of looping silently.
 */
import { describe, test, expect, jest } from '@jest/globals'
import { CACHE_STORAGE_KEYS } from '@core/tokens/data/storage.js'

const mockAuth = { currentUser: null, marker: 'auth-instance' }
const mockUnsub = jest.fn()

jest.unstable_mockModule('firebase/auth', () => ({
  getAuth: jest.fn(() => mockAuth),
  GoogleAuthProvider: jest.fn(() => ({ setCustomParameters: jest.fn() })),
  signInWithPopup: jest.fn(async () => ({ user: { uid: 'u1' } })),
  signInWithRedirect: jest.fn(async () => undefined),
  getRedirectResult: jest.fn(async () => {
    throw Object.assign(new Error('domain not authorized'), {
      code: 'auth/unauthorized-domain',
    })
  }),
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

describe('firebase redirect error tails', () => {
  test('a rejected redirect result stores the code and consumes the marker', async () => {
    sessionStorage.setItem(CACHE_STORAGE_KEYS.CMS_AUTH_REDIRECT, '1')

    const unsub = await firebase.onAuthChange(jest.fn())

    expect(sessionStorage.getItem(CACHE_STORAGE_KEYS.CMS_AUTH_ERROR)).toBe(
      'auth/unauthorized-domain'
    )
    expect(sessionStorage.getItem(CACHE_STORAGE_KEYS.CMS_AUTH_REDIRECT)).toBeNull()
    expect(unsub).toBe(mockUnsub)
  })
})
