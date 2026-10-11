/**
 * @file firebase.js
 * @description Firebase client bootstrap — split between the site (read-only)
 * and the CMS (auth + writes).
 *
 * The firebase/app core is imported eagerly (tiny), while firebase/auth and
 * firebase/database load lazily behind getAuthInstance()/getDbInstance() so
 * the public site never pays for SDK code it doesn't use.
 *
 * Reads go through fetchFirebaseDb(): a plain REST `.json` GET with a
 * sessionStorage + in-flight-promise cache — zero WebSockets, zero unload
 * listeners — falling back to the SDK only if REST fails.
 */

import { ATTR_VALUES } from '@core/tokens/attrs/values.js'
import {
  AUTH_DOMAIN_DEFAULT,
  AUTH_REDIRECT_FALLBACK_CODES,
  AUTH_SELF_HOSTS,
  AUTH_STRINGS,
} from '@core/tokens/strings/auth.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { initializeApp } from 'firebase/app'
import type { Auth, User, Unsubscribe, UserCredential } from 'firebase/auth'
import type { Database } from 'firebase/database'
import { CDN_URLS } from '@core/tokens/media/urls.js'
import { CACHE_STORAGE_KEYS } from '@core/tokens/data/storage.js'
import { devWarn } from '@core/devlog.js'

/**
 * Resolves the API key from the build env (VITE_FIREBASE_API_KEY) or the
 * base64-encoded fallback baked at build time. Firebase API keys identify
 * the project, not a secret — but the fallback still avoids a plaintext
 * literal for casual scraping.
 */
const getApiKey = () => {
  if (
    typeof import.meta !== TYPE_STRINGS.UNDEFINED &&
    import.meta.env &&
    import.meta.env.VITE_FIREBASE_API_KEY
  ) {
    return import.meta.env.VITE_FIREBASE_API_KEY
  }
  if (typeof atob === TYPE_STRINGS.FUNCTION) {
    return atob('QUl6YVN5RGVEcjNMRGRjMzRJREJBUWMtNkJpVU9lSTMyX0hkN0hJ')
  }
  return ATTR_VALUES.EMPTY
}

/**
 * Resolves the authDomain — the host that serves `/__/auth/handler` and
 * `/__/auth/iframe`. Priority: VITE_FIREBASE_AUTH_DOMAIN env override →
 * the app's own host when it can serve the helper over https (every
 * Firebase-Hosting-connected domain does, and the dev server proxies the
 * path when CMS_AUTH_HTTPS is on) → the firebaseapp.com default.
 *
 * Same-origin authDomain is the structural fix for the modern-browser
 * breakage: the OAuth event relay lives in the helper iframe's web
 * storage, which becomes first-party when the iframe shares the app's
 * origin — third-party storage partitioning/blocking can no longer drop
 * the event between the handler write and the iframe read. On plain http
 * dev the https-only helper can't be same-origin, so the firebaseapp.com
 * fallback keeps the previous behavior.
 */
const getAuthDomain = () => {
  if (
    typeof import.meta !== TYPE_STRINGS.UNDEFINED &&
    import.meta.env &&
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
  ) {
    return import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
  }

  if (
    typeof window !== TYPE_STRINGS.UNDEFINED &&
    window.location?.protocol === 'https:' &&
    AUTH_SELF_HOSTS.includes(window.location.hostname)
  ) {
    return window.location.host
  }

  return AUTH_DOMAIN_DEFAULT
}

/**
 * Firebase project configuration. apiKey resolves at runtime; the rest are
 * public project identifiers (auth domain, RTDB URL, project id, storage
 * bucket, sender id, app id, analytics measurement id).
 */
const firebaseConfig = {
  apiKey: getApiKey(),
  authDomain: getAuthDomain(),
  databaseURL: CDN_URLS.FIREBASE_DB,
  projectId: 'luiskr-com',
  storageBucket: 'luiskr-com.appspot.com',
  messagingSenderId: '967717102790',
  appId: '1:967717102790:web:eea19f216fd097a08163c7',
  measurementId: 'G-66F5L8CS9F',
}

/**
 * The shared Firebase App — initialized eagerly from firebaseConfig; auth
 * and database SDKs attach to it lazily.
 */
export const app = initializeApp(firebaseConfig)

// Dynamic App Check loader — the project enforces App Check on Identity
// Toolkit, so without a token every auth endpoint (createAuthUri,
// signInWith*) 401s and the SDK reports the opaque auth/internal-error.
/** In-flight app-check init — concurrent callers share one import. */
let _appCheckPromise: Promise<unknown> | null = null

/**
 * Lazily initializes Firebase App Check once, gated by env config:
 * VITE_FIREBASE_APPCHECK_SITE_KEY carries the reCAPTCHA site key
 * (v3 by default, Enterprise when VITE_FIREBASE_APPCHECK_PROVIDER is
 * 'enterprise'), and VITE_FIREBASE_APPCHECK_DEBUG supplies the
 * console-issued debug token so localhost dev can mint valid tokens.
 * With no site key configured the init is a no-op — the 401 cause then
 * surfaces through the recorded popup detail instead of hanging.
 * @returns The AppCheck instance, or null when unconfigured/failed.
 */
const ensureAppCheck = () => {
  if (!_appCheckPromise) {
    const env = import.meta.env as Record<string, string> | undefined
    const siteKey = env?.VITE_FIREBASE_APPCHECK_SITE_KEY

    // No site key → resolve immediately without fetching the app-check
    // chunk: unconfigured envs (tests, non-CMS pages) must not pay the
    // import cost on every auth/db init.
    _appCheckPromise = siteKey
      ? import('firebase/app-check')
          .then(({ initializeAppCheck, ReCaptchaV3Provider, ReCaptchaEnterpriseProvider }) => {
            const debugToken = env?.VITE_FIREBASE_APPCHECK_DEBUG

            if (debugToken && typeof self !== TYPE_STRINGS.UNDEFINED) {
              ;(self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
                debugToken
            }

            const provider =
              env?.VITE_FIREBASE_APPCHECK_PROVIDER === AUTH_STRINGS.APPCHECK_PROVIDER_ENTERPRISE
                ? new ReCaptchaEnterpriseProvider(siteKey)
                : new ReCaptchaV3Provider(siteKey)

            return initializeAppCheck(app, {
              provider,
              isTokenAutoRefreshEnabled: true,
            })
          })
          .catch((err) => {
            // A failed init must not poison later calls — drop the cache
            // and let the auth path proceed unprotected rather than
            // deadlocking.
            devWarn('App Check init failed', err)
            _appCheckPromise = null

            return null
          })
      : Promise.resolve(null)
  }

  return _appCheckPromise
}

// Dynamic Auth loader (loaded only for Admin/CMS)
/** Memoized Auth instance — populated on first getAuthInstance() call. */
let _authInstance: Auth | null = null
/** In-flight auth-chunk promise — concurrent callers share one import. */
let _authPromise: Promise<Auth> | null = null

/**
 * Lazily imports firebase/auth once and returns the shared Auth instance.
 * Concurrent callers share _authPromise so the chunk is fetched exactly once.
 * @returns The Auth instance bound to `app`.
 */
export async function getAuthInstance() {
  if (_authInstance) return _authInstance
  if (!_authPromise) {
    _authPromise = ensureAppCheck()
      .then(() => import('firebase/auth'))
      .then(({ getAuth }) => {
        _authInstance = getAuth(app)
        return _authInstance
      })
    // A rejected chunk/getAuth must not poison every later call — drop the
    // cached promise so the next attempt re-imports.
    _authPromise.catch(() => {
      _authPromise = null
    })
  }
  return await _authPromise
}

// Dynamic Database loader for CMS admin writes
/** Memoized RTDB instance — populated on first getDbInstance() call. */
let _dbInstance: Database | null = null
/** In-flight database-chunk promise — concurrent callers share one import. */
let _dbPromise: Promise<Database> | null = null

/**
 * Lazily imports firebase/database once and returns the shared RTDB
 * instance. Only needed by the CMS write path — public reads use REST.
 * @returns The Database instance bound to `app`.
 */
export async function getDbInstance() {
  if (_dbInstance) return _dbInstance
  if (!_dbPromise) {
    _dbPromise = ensureAppCheck()
      .then(() => import('firebase/database'))
      .then(({ getDatabase }) => {
        _dbInstance = getDatabase(app)
        return _dbInstance
      })
  }
  return await _dbPromise
}

/**
 * CMS login — Google OAuth popup. `prompt: 'select_account'` forces the
 * account chooser so a CMS editor isn't silently signed into a wrong Google account.
 * When the environment can't complete the popup handshake (popup blockers,
 * COOP window.closed blocking, partitioned web storage, unsupported
 * contexts — the AUTH_REDIRECT_FALLBACK_CODES set), retries transparently
 * via signInWithRedirect, which navigates away and never resolves.
 * @returns The SDK UserCredential, or nothing when the redirect fallback fires.
 */
export async function signInWithGoogle(): Promise<UserCredential | void> {
  const auth = await getAuthInstance()
  const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = await import('firebase/auth')
  const provider = new GoogleAuthProvider()

  provider.setCustomParameters({ prompt: 'select_account' })

  try {
    return await signInWithPopup(auth, provider)
  } catch (err) {
    const e = err as { code?: string; message?: string }
    const code = e?.code
    const detail = e?.message || ATTR_VALUES.EMPTY

    // auth/internal-error also wraps backend rejections (App-Check
    // 401s, config failures) — a redirect round-trip would hit the same
    // wall, so only fall back for genuinely environmental failures.
    const backendRejection = detail.includes(AUTH_STRINGS.APPCHECK_MARKER)

    if (code && AUTH_REDIRECT_FALLBACK_CODES.includes(code) && !backendRejection) {
      devWarn('Popup sign-in unavailable, falling back to redirect', code)

      // Mark the redirect leg so the login can tell "returned but no
      // session" (blocked cross-site storage) apart from a fresh visit —
      // and preserve the REAL popup-leg code + detail so the view names
      // the original failure rather than guessing.
      try {
        sessionStorage.setItem(CACHE_STORAGE_KEYS.CMS_AUTH_REDIRECT, '1')
        sessionStorage.setItem(CACHE_STORAGE_KEYS.CMS_AUTH_POPUP_ERROR, code)
        sessionStorage.setItem(CACHE_STORAGE_KEYS.CMS_AUTH_POPUP_DETAIL, detail)
      } catch {
        /* storage itself may be the blocker — the redirect still runs */
      }

      return await signInWithRedirect(auth, provider)
    }

    throw err
  }
}

/** Signs the CMS user out via the lazily-loaded auth SDK. */
export async function logoutUser() {
  const auth = await getAuthInstance()
  const { signOut } = await import('firebase/auth')
  return await signOut(auth)
}

/** Upper bound on Firebase auth bootstrap — the SDK's own init can hang. */
const _AUTH_INIT_TIMEOUT_MS = 8000
/** Upper bound on the redirect-event wait — the iframe relay can stall. */
const _AUTH_EVENT_TIMEOUT_MS = 6000

/**
 * Persists the OAuth-return failure code for the login view and consumes
 * the redirect marker — storage itself may be the blocker, so every write
 * is guarded.
 * @param code Firebase-style error code (or a synthetic `auth/*` code).
 */
function recordAuthFailure(code: string): void {
  try {
    sessionStorage.setItem(CACHE_STORAGE_KEYS.CMS_AUTH_ERROR, code)
    sessionStorage.removeItem(CACHE_STORAGE_KEYS.CMS_AUTH_REDIRECT)
  } catch {
    /* storage itself unavailable */
  }
}

/**
 * Persists an "auth failed but not via the OAuth return" signal used to
 * distinguish a null getRedirectResult with an outstanding marker (event
 * lost to blocked third-party storage) from a plain first visit.
 * @param code Firebase-style error code.
 */
function flagAuthError(code: string): void {
  try {
    sessionStorage.setItem(CACHE_STORAGE_KEYS.CMS_AUTH_ERROR, code)
  } catch {
    /* storage itself unavailable */
  }
}

/** Races a promise against a timeout that rejects with a synthetic auth code. */
function raceTimeout<T>(promise: Promise<T>, ms: number, code: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) =>
      setTimeout(() => reject(Object.assign(new Error(code), { code })), ms)
    ),
  ])
}

/**
 * Subscribes to auth state after lazily loading firebase/auth.
 * First resolves a pending redirect sign-in (the signInWithGoogle popup
 * fallback) so the callback fires with the fresh session on return — a
 * failed redirect logs the error and falls through to the normal listener.
 *
 * Both the SDK init and the redirect-event wait are bounded: when
 * third-party storage is blocked (the firebaseapp.com auth iframe can't
 * persist/relay the OAuth event) the SDK promises never settle, which
 * previously left the page hanging with the stale redirect marker. On a
 * timeout or failure the real diagnosis is recorded for the login view,
 * while a best-effort background subscribe still wires the listener so a
 * late-arriving event can still sign in.
 * @param callback Invoked with the User (or null on sign-out) on every auth transition.
 * @returns {Promise<Function>} the SDK's unsubscribe function
 */
export async function onAuthChange(callback: (_user: User | null) => void): Promise<Unsubscribe> {
  let auth: Auth

  try {
    auth = await raceTimeout(
      getAuthInstance(),
      _AUTH_INIT_TIMEOUT_MS,
      AUTH_STRINGS.ERR_AUTH_INIT_TIMEOUT
    )
  } catch (err) {
    // Init itself stalled — the iframe relay or persistence layer is
    // blocked. Record the diagnosis, then keep trying in the background so
    // a late resolution still wires the listener.
    recordAuthFailure((err as { code?: string })?.code || 'auth/auth-init-failed')

    devWarn('Auth init timed out or failed', err)

    getAuthInstance()
      .then(async (readyAuth) => {
        const { onAuthStateChanged } = await import('firebase/auth')

        onAuthStateChanged(readyAuth, callback)
      })
      .catch((lateErr) => devWarn('Late auth subscribe failed', lateErr))

    return () => {}
  }

  const { getRedirectResult, onAuthStateChanged } = await import('firebase/auth')

  try {
    const result = await raceTimeout(
      getRedirectResult(auth),
      _AUTH_EVENT_TIMEOUT_MS,
      AUTH_STRINGS.ERR_REDIRECT_EVENT_TIMEOUT
    )

    // A completed redirect consumed the marker — clear it so a later
    // sign-out doesn't re-report a failure that never happened.
    if (result?.user) {
      try {
        sessionStorage.removeItem(CACHE_STORAGE_KEYS.CMS_AUTH_REDIRECT)
      } catch {
        /* ignore */
      }
    } else {
      // Null result WITH an outstanding marker: the redirect leg ran but
      // the OAuth event was lost — the firebaseapp.com iframe's storage is
      // blocked (third-party site data). Without the marker the null is a
      // plain first visit, which is not an error.
      try {
        if (sessionStorage.getItem(CACHE_STORAGE_KEYS.CMS_AUTH_REDIRECT)) {
          flagAuthError(AUTH_STRINGS.ERR_NO_REDIRECT_EVENT)
          sessionStorage.removeItem(CACHE_STORAGE_KEYS.CMS_AUTH_REDIRECT)
        }
      } catch {
        /* storage itself unavailable */
      }
    }
  } catch (err) {
    // The return leg actively FAILED (unauthorized domain, expired auth
    // event, network) — persist the Firebase code so the login view can
    // show the real diagnosis instead of the generic blocked-storage
    // guess, and consume the redirect marker.
    recordAuthFailure((err as { code?: string })?.code || 'auth/redirect-resolution-failed')

    devWarn('Redirect sign-in resolution failed', err)
  }

  return onAuthStateChanged(auth, callback)
}

/** Snapshot-shaped result matching the SDK's DataSnapshot read API. */
export interface DbSnapshot {
  exists: () => boolean
  val: () => unknown
}

// In-flight promise dedup map — parallel calls to the same path share one fetch.
const _fetchCache = new Map<string, Promise<DbSnapshot>>()

/**
 * Lightweight HTTP REST reader for the Realtime Database: GETs
 * `<db>/<path>.json` and wraps the payload in a snapshot-shaped
 * { exists(), val() } object so callers match the SDK API.
 *
 * Cache order: in-flight promise map → sessionStorage (survives route
 * changes within the tab) → network → SDK get() fallback on REST failure.
 * @param path RTDB path — leading slash stripped for URL safety.
 * @returns Snapshot-shaped {exists, val} wrapping the JSON payload.
 */
export async function fetchFirebaseDb(path: string): Promise<DbSnapshot> {
  const cleanPath = (path || '').toString().replace(/^\//, '')
  const url = `${firebaseConfig.databaseURL}/${cleanPath}.json`

  if (_fetchCache.has(url)) {
    return await (_fetchCache.get(url) as Promise<DbSnapshot>)
  }

  // Fast sessionStorage cache lookup for zero latency
  try {
    const cached = sessionStorage.getItem(CACHE_STORAGE_KEYS.SESSION_FB_CACHE_PREFIX + cleanPath)
    if (cached) {
      const data = JSON.parse(cached)
      const cachedResult = Promise.resolve({
        exists: () => data !== null && data !== undefined,
        val: () => data,
      })
      _fetchCache.set(url, cachedResult)
      return await cachedResult
    }
  } catch {
    /* ignore */
  }

  const promise = (async () => {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      try {
        if (data !== null && data !== undefined) {
          sessionStorage.setItem(
            CACHE_STORAGE_KEYS.SESSION_FB_CACHE_PREFIX + cleanPath,
            JSON.stringify(data)
          )
        }
      } catch {
        /* ignore */
      }
      return {
        exists: () => data !== null && data !== undefined,
        val: () => data,
      }
    } catch (err) {
      devWarn('REST DB fetch failed, falling back to SDK', err)
      const { ref, child, get } = await import('firebase/database')
      const db = await getDbInstance()
      return (await get(child(ref(db), cleanPath))) as unknown as DbSnapshot
    }
  })()

  _fetchCache.set(url, promise)
  return await promise
}

/** Drops the in-memory REST cache (sessionStorage entries persist). */
export function clearDbCache() {
  _fetchCache.clear()
}
