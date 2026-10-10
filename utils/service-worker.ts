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
