/**
 * @file service-worker-tails.test.js
 * @description Coverage tail for utils/service-worker.ts — the local
 * registration lifecycle that replaced `register-service-worker`. Drives
 * every hook path with a stubbed navigator.serviceWorker: ready,
 * registered, cached-vs-updated via controller presence, updatefound
 * with and without an installing worker, localhost probe accept/reject,
 * registration failure, and the online/offline window relays.
 */
import { describe, test, expect, jest, afterEach } from '@jest/globals'
import { SW_EVENTS, SW_STRINGS, WINDOW_EVENTS } from '@core/tokens/events/dom.js'
import { registerSiteServiceWorker, dropStaleServiceWorkers } from '@core/utils/service-worker.js'

/** Stashed property descriptors restored after each test. */
const stash = new Map()

const saveKey = (key, holder = globalThis) => {
  const id = `${holder === window ? 'w' : 'g'}:${key}`

  if (!stash.has(id)) {
    stash.set(id, { key, holder, desc: Object.getOwnPropertyDescriptor(holder, key) })
  }
}

afterEach(() => {
  for (const { key, holder, desc } of stash.values()) {
    try {
      if (desc) Object.defineProperty(holder, key, desc)
      else delete holder[key]
    } catch {
      /* non-configurable shims stay installed */
    }
  }

  stash.clear()
})

/** Installs a fake navigator.serviceWorker + hostname for one test. */
const stubSw = (sw, hostname = 'luiskr.com') => {
  saveKey('serviceWorker', navigator)
  Object.defineProperty(navigator, 'serviceWorker', { value: sw, configurable: true })

  saveKey('hostname', window.location)
  Object.defineProperty(window.location, 'hostname', { value: hostname, configurable: true })
}

/** Builds a registration stub with controllable install lifecycle. */
const makeRegistration = () => {
  const listeners = {}
  const installing = { state: 'installing', listeners: {} }

  return {
    installing,
    listeners,
    addEventListener: (type, cb) => {
      listeners[type] = cb
    },
    fireUpdatefound() {
      listeners[SW_EVENTS.UPDATE_FOUND]?.(this)
    },
    fireInstalled() {
      installing.state = SW_STRINGS.INSTALLED
      installing.listeners[SW_EVENTS.STATE_CHANGE]?.()
    },
    attachInstalling() {
      installing.addEventListener = (type, cb) => {
        installing.listeners[type] = cb
      }
    },
  }
}

describe('registerSiteServiceWorker', () => {
  test('no-ops when navigator.serviceWorker is unavailable', async () => {
    saveKey('serviceWorker', navigator)
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true })

    await expect(registerSiteServiceWorker('/sw.js')).resolves.toBeUndefined()
  })

  test('registers on a public host and relays every lifecycle hook', async () => {
    const registration = makeRegistration()
    const sw = {
      ready: Promise.resolve(registration),
      register: jest.fn(async () => registration),
      controller: null,
    }
    const hooks = {
      ready: jest.fn(),
      registered: jest.fn(),
      cached: jest.fn(),
      updatefound: jest.fn(),
      updated: jest.fn(),
      offline: jest.fn(),
      online: jest.fn(),
      error: jest.fn(),
    }

    stubSw(sw)
    await registerSiteServiceWorker('/sw.js', hooks)
    await Promise.resolve()

    expect(sw.register).toHaveBeenCalledWith('/sw.js')
    expect(hooks.registered).toHaveBeenCalledWith(registration)
    expect(hooks.ready).toHaveBeenCalledWith(registration)

    // updatefound → install watcher; installed without controller = cached.
    registration.attachInstalling()
    registration.fireUpdatefound()
    expect(hooks.updatefound).toHaveBeenCalledWith(registration)
    registration.fireInstalled()
    expect(hooks.cached).toHaveBeenCalledWith(registration)
    expect(hooks.updated).not.toHaveBeenCalled()

    // A live controller flips the same transition to `updated`.
    sw.controller = {}
    registration.fireInstalled()
    expect(hooks.updated).toHaveBeenCalledWith(registration)

    window.dispatchEvent(new window.Event(SW_EVENTS.OFFLINE))
    window.dispatchEvent(new window.Event(SW_EVENTS.ONLINE))
    expect(hooks.offline).toHaveBeenCalled()
    expect(hooks.online).toHaveBeenCalled()
  })

  test('updatefound with no installing worker still emits the event', async () => {
    const registration = makeRegistration()
    const hooks = { updatefound: jest.fn() }

    stubSw({ ready: Promise.resolve(registration), register: jest.fn(async () => registration) })
    await registerSiteServiceWorker('/sw.js', hooks)

    // Real registrations expose `installing: null` once activation ends.
    registration.installing = null
    registration.fireUpdatefound()
    expect(hooks.updatefound).toHaveBeenCalled()
  })

  test('localhost probe accepts a JS response and registers', async () => {
    const registration = makeRegistration()
    const sw = {
      ready: Promise.resolve(registration),
      register: jest.fn(async () => registration),
    }

    stubSw(sw, 'localhost')
    saveKey('fetch')
    globalThis.fetch = jest.fn(async () => ({
      status: 200,
      headers: { get: () => 'text/javascript' },
    }))

    await registerSiteServiceWorker('/sw.js', {})

    expect(sw.register).toHaveBeenCalled()
  })

  test('localhost probe rejects non-JS/404 and unregisters', async () => {
    const unregister = jest.fn(async () => true)
    const sw = {
      ready: Promise.resolve({}),
      register: jest.fn(async () => ({})),
      getRegistration: jest.fn(async () => ({ unregister })),
    }
    const hooks = { error: jest.fn() }

    stubSw(sw, 'localhost')
    saveKey('fetch')
    globalThis.fetch = jest.fn(async () => ({
      status: 404,
      headers: { get: () => null },
    }))

    await registerSiteServiceWorker('/sw.js', hooks)

    expect(unregister).toHaveBeenCalled()
    expect(hooks.error).toHaveBeenCalled()
    expect(sw.register).not.toHaveBeenCalled()
  })

  test('probe fetch failure fails closed (localhost → error path)', async () => {
    const sw = {
      ready: Promise.resolve({}),
      register: jest.fn(async () => ({})),
      getRegistration: jest.fn(async () => undefined),
    }
    const hooks = { error: jest.fn() }

    stubSw(sw, '127.0.0.1')
    saveKey('fetch')
    globalThis.fetch = jest.fn(async () => Promise.reject(new Error('down')))

    await registerSiteServiceWorker('/sw.js', hooks)

    expect(hooks.error).toHaveBeenCalled()
  })

  test('register() rejection routes to the error hook', async () => {
    const hooks = { error: jest.fn() }

    stubSw({
      ready: Promise.resolve({}),
      register: jest.fn(async () => Promise.reject(new Error('denied'))),
    })

    await registerSiteServiceWorker('/sw.js', hooks)

    expect(hooks.error).toHaveBeenCalled()
  })

  test('ready rejection routes to the error hook', async () => {
    const hooks = { error: jest.fn() }

    stubSw({
      ready: Promise.reject(new Error('no sw')),
      register: jest.fn(async () => ({})),
    })

    await registerSiteServiceWorker('/sw.js', hooks)
    await Promise.resolve()

    expect(hooks.error).toHaveBeenCalled()
  })
})

describe('dropStaleServiceWorkers', () => {
  test('unregisters every live registration', async () => {
    const unregister = jest.fn(async () => true)

    stubSw({ getRegistrations: async () => [{ unregister }, { unregister }] })
    dropStaleServiceWorkers()
    await Promise.resolve()

    expect(unregister).toHaveBeenCalledTimes(2)
  })
})
