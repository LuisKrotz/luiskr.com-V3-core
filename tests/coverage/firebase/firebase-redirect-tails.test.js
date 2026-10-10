/**
 * @file firebase-redirect-tails.test.js
 * @description Coverage tails for core/firebase.ts — the completed-redirect
 * arm in onAuthChange: a redirect result that carries a user clears the
 * CMS_AUTH_REDIRECT marker before the auth-state listener is wired.
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
  getRedirectResult: jest.fn(async () => ({ user: { uid: 'u1' } })),
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

describe('firebase redirect tails', () => {
  test('a completed redirect clears the pending marker before subscribing', async () => {
    sessionStorage.setItem(CACHE_STORAGE_KEYS.CMS_AUTH_REDIRECT, '1')

    const unsub = await firebase.onAuthChange(jest.fn())

    expect(sessionStorage.getItem(CACHE_STORAGE_KEYS.CMS_AUTH_REDIRECT)).toBeNull()
    expect(unsub).toBe(mockUnsub)
  })

})
