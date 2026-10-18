/**
 * @file utils/service-worker.ts — stale service-worker eviction shared by
 * every bundle entry (public site + CMS).
 *
 * A production visit (or a preview/prod build served on the same port a
 * dev server later occupies) leaves a Workbox registration alive on the
 * origin. That worker keeps intercepting navigation and module requests,
 * replaying precached chunk URLs that no longer exist under dev — dynamic
 * imports then reject on every load and the page never boots. Dev-mode
 * bundles call `dropStaleServiceWorkers()` at entry so a leftover SW can
 * never hijack a dev session.
 */

import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { SW_EVENTS, SW_STRINGS } from '@core/tokens/events/dom.js'

/**
 * Lifecycle hooks for `registerSiteServiceWorker` — local replacement
 * for the retired `register-service-worker` package (same callback
 * names, same ordering). Every hook is optional.
 */
export interface ServiceWorkerHooks {
  /** First registration resolved and the SW is controlling the page. */
  ready?: (registration: ServiceWorkerRegistration) => void
  /** `navigator.serviceWorker.register` resolved. */
  registered?: (registration: ServiceWorkerRegistration) => void
  /** First install finished — precache is warm (no prior controller). */
  cached?: (registration: ServiceWorkerRegistration) => void
  /** A new SW version started downloading. */
  updatefound?: (registration: ServiceWorkerRegistration) => void
  /** A new SW version installed — fresh content is ready. */
  updated?: (registration: ServiceWorkerRegistration) => void
  /** Window went offline. */
  offline?: () => void
  /** Window came back online. */
  online?: () => void
  /** Registration or the localhost validity probe failed. */
  error?: (error: unknown) => void
}

/** Fires a named hook when it exists — centralizes optional dispatch. */
const emit = <K extends keyof ServiceWorkerHooks>(
  hooks: ServiceWorkerHooks,
  key: K,
  ...args: unknown[]
): void => {
  const hook = hooks[key]

  if (typeof hook === TYPE_STRINGS.FUNCTION) {
    ;(hook as (...a: unknown[]) => void)(...args)
  }
}

/**
 * Wires a registration's install lifecycle to the hooks — the semantics
 * the retired package shipped: `updatefound` → watch `installing` → on
 * `installed`, `cached` when no prior controller else `updated`.
 */
function trackInstalling(hooks: ServiceWorkerHooks, registration: ServiceWorkerRegistration): void {
  registration.addEventListener(SW_EVENTS.UPDATE_FOUND, () => {
    emit(hooks, 'updatefound', registration)

    const installing = registration.installing

    if (!installing) return

    installing.addEventListener(SW_EVENTS.STATE_CHANGE, () => {
      if (installing.state !== SW_STRINGS.INSTALLED) return

      // A live controller means this install is an update, not the
      // first precache fill — same distinction the old package made.
      if (navigator.serviceWorker.controller) {
        emit(hooks, 'updated', registration)
      } else {
        emit(hooks, 'cached', registration)
      }
    })
  })
}

/**
 * Localhost probe — a dev server on the origin would serve the dev
 * index for `/service-worker.js`; registering that would hijack dev.
 * Verify the script exists and answers a JS mime before registering.
 */
async function isValidServiceWorker(swUrl: string): Promise<boolean> {
  try {
    const response = await fetch(swUrl, {
      headers: { [SW_STRINGS.PROBE_HEADER]: SW_STRINGS.PROBE_VALUE },
    })

    if (response.status === 404) return false

    const mime = response.headers.get(SW_STRINGS.CONTENT_TYPE)

    return mime?.includes(SW_STRINGS.SCRIPT_MIME) === true
  } catch {
    return false
  }
}

/**
 * True on local origins — localhost names, loopback IPs, and [::1].
 * The original package treated these as "probably dev" and probed
 * before registering; preserved identically.
 */
function isLocalhost(): boolean {
  const host = window.location.hostname

  return (
    host === 'localhost' ||
    host === '[::1]' ||
    /^127(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d?\d)){3}$/.test(host)
  )
}

/**
 * Registers `swUrl` and reports lifecycle through `hooks`. No-ops when
 * `navigator.serviceWorker` is unavailable. Local hosts get the
 * existence/mime probe first; a bad probe unregisters rather than
 * installing a dev-shell SW.
 */
export async function registerSiteServiceWorker(
  swUrl: string,
  hooks: ServiceWorkerHooks = {}
): Promise<void> {
  const sw = typeof navigator === TYPE_STRINGS.UNDEFINED ? undefined : navigator.serviceWorker

  if (!sw) return

  window.addEventListener(SW_EVENTS.OFFLINE, () => emit(hooks, 'offline'))
  window.addEventListener(SW_EVENTS.ONLINE, () => emit(hooks, 'online'))

  sw.ready
    .then((registration) => emit(hooks, 'ready', registration))
    .catch((error: unknown) => emit(hooks, 'error', error))

  if (isLocalhost()) {
    const valid = await isValidServiceWorker(swUrl)

    if (!valid) {
      const registration = await sw.getRegistration(swUrl)

      await registration?.unregister()
      emit(hooks, 'error', new Error(`service worker missing or invalid at ${swUrl}`))

      return
    }
  }

  try {
    const registration = await sw.register(swUrl)

    emit(hooks, 'registered', registration)
    trackInstalling(hooks, registration)
  } catch (error) {
    emit(hooks, 'error', error)
  }
}

/**
 * Unregisters every service worker bound to the current origin. No-op
 * outside browsers and where `getRegistrations` is unavailable; failures
 * are swallowed — this is best-effort cleanup, never a boot blocker.
 */
export function dropStaleServiceWorkers(): void {
  const sw = typeof navigator === TYPE_STRINGS.UNDEFINED ? undefined : navigator.serviceWorker

  if (!sw || typeof sw.getRegistrations !== TYPE_STRINGS.FUNCTION) return

  sw.getRegistrations()
    .then((registrations) => {
      for (const registration of registrations) {
        void registration.unregister()
      }
    })
    .catch(() => {})
}
