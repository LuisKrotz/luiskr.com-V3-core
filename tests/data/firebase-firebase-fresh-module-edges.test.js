/**
 * @file firebase-firebase-fresh-module-edges.test.js
 * @description Split from firebase.test.js — covers the "firebase — fresh module edges" describe.
 */
import { describe, test, expect, jest } from '@jest/globals'
import { APP_IDS } from '@core/tokens/ids/app.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'

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

const _firebase = await import('@core/firebase.js')

describe('firebase — fresh module edges', () => {
  test('concurrent getAuthInstance/getDbInstance share the pending promise', async () => {
    jest.resetModules()

    const fresh = await import('@core/firebase.js')
    const [a1, a2] = await Promise.all([fresh.getAuthInstance(), fresh.getAuthInstance()])
    const [d1, d2] = await Promise.all([fresh.getDbInstance(), fresh.getDbInstance()])

    expect(a1).toBe(a2)
    expect(d1).toBe(d2)
  })

  test('getApiKey falls back to empty when atob is unavailable', async () => {
    const origAtob = globalThis.atob

    delete globalThis.atob
    jest.resetModules()

    const fresh = await import('@core/firebase.js')

    expect(fresh.app.config.apiKey).toBe(CHAR_STRINGS.EMPTY)

    globalThis.atob = origAtob
  })

  test('getApiKey prefers the build-time env value when present', async () => {
    const origEnv = globalThis.__VITE_ENV__

    globalThis.__VITE_ENV__ = { VITE_FIREBASE_API_KEY: 'env-key-1' }
    jest.resetModules()

    const fresh = await import('@core/firebase.js')

    expect(fresh.app.config.apiKey).toBe('env-key-1')

    globalThis.__VITE_ENV__ = origEnv
  })

  test('getAuthDomain prefers the build-time env override', async () => {
    const origEnv = globalThis.__VITE_ENV__

    globalThis.__VITE_ENV__ = { VITE_FIREBASE_AUTH_DOMAIN: 'auth.example.com' }
    jest.resetModules()

    const fresh = await import('@core/firebase.js')

    expect(fresh.app.config.authDomain).toBe('auth.example.com')

    globalThis.__VITE_ENV__ = origEnv
  })

  test('getAuthDomain self-hosts on an https authorized domain', async () => {
    const { protocol, hostname, host } = window.location

    Object.defineProperty(window.location, 'protocol', { value: 'https:', configurable: true })
    Object.defineProperty(window.location, 'hostname', { value: 'luiskr.com', configurable: true })
    Object.defineProperty(window.location, 'host', { value: 'luiskr.com', configurable: true })
    jest.resetModules()

    const fresh = await import('@core/firebase.js')

    expect(fresh.app.config.authDomain).toBe('luiskr.com')

    Object.defineProperty(window.location, 'protocol', { value: protocol, configurable: true })
    Object.defineProperty(window.location, 'hostname', { value: hostname, configurable: true })
    Object.defineProperty(window.location, 'host', { value: host, configurable: true })
  })

  test('getAuthDomain self-hosts with the port on https localhost', async () => {
    const { protocol, host } = window.location

    Object.defineProperty(window.location, 'protocol', { value: 'https:', configurable: true })
    Object.defineProperty(window.location, 'host', { value: 'localhost:5173', configurable: true })
    jest.resetModules()

    const fresh = await import('@core/firebase.js')

    expect(fresh.app.config.authDomain).toBe('localhost:5173')

    Object.defineProperty(window.location, 'protocol', { value: protocol, configurable: true })
    Object.defineProperty(window.location, 'host', { value: host, configurable: true })
  })

  test('getAuthDomain falls back on https non-authorized hosts', async () => {
    const { protocol, hostname, host } = window.location

    Object.defineProperty(window.location, 'protocol', { value: 'https:', configurable: true })
    Object.defineProperty(window.location, 'hostname', {
      value: 'elsewhere.example',
      configurable: true,
    })
    Object.defineProperty(window.location, 'host', {
      value: 'elsewhere.example',
      configurable: true,
    })
    jest.resetModules()

    const fresh = await import('@core/firebase.js')

    expect(fresh.app.config.authDomain).toBe('luiskr-com.firebaseapp.com')

    Object.defineProperty(window.location, 'protocol', { value: protocol, configurable: true })
    Object.defineProperty(window.location, 'hostname', { value: hostname, configurable: true })
    Object.defineProperty(window.location, 'host', { value: host, configurable: true })
  })
})
