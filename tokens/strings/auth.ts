/**
 * @file tokens/strings/auth.ts
 * @description Firebase Auth error-code string tokens — token group.
 * The `auth/*` codes are Firebase SDK error identifiers, not UI copy —
 * declared once here so sign-in fallbacks and UI handlers compare against
 * the same constants (zero-hardcoding rules 4–5).
 */

/**
 * Frozen auth string map — sole declaration site for these tokens; consumers read members and
 * never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes the token
 * contract immutable at runtime.
 */
export const AUTH_STRINGS = Object.freeze({
  // User actions — silent, not failures
  ERR_CANCELLED_POPUP: 'auth/cancelled-popup-request',
  ERR_POPUP_CLOSED: 'auth/popup-closed-by-user',
  // Environment failures — popup flow cannot complete → redirect fallback
  ERR_POPUP_BLOCKED: 'auth/popup-blocked',
  ERR_INTERNAL: 'auth/internal-error',
  ERR_STORAGE_UNSUPPORTED: 'auth/web-storage-unsupported',
  ERR_ENV_UNSUPPORTED: 'auth/operation-not-supported-in-this-environment',
  // Return-leg failures — the OAuth event never reached the app
  ERR_AUTH_INIT_TIMEOUT: 'auth/auth-init-timeout',
  ERR_REDIRECT_EVENT_TIMEOUT: 'auth/redirect-event-timeout',
  ERR_NO_REDIRECT_EVENT: 'auth/no-redirect-event',
})

/**
 * Codes whose root cause is blocked third-party site data — the
 * firebaseapp.com auth iframe can't store/read the OAuth event. The login
 * view uses this set to show the "allow site data" guidance instead of the
 * authorized-domains copy.
 */
export const AUTH_BLOCKED_STORAGE_CODES: readonly string[] = Object.freeze([
  AUTH_STRINGS.ERR_AUTH_INIT_TIMEOUT,
  AUTH_STRINGS.ERR_REDIRECT_EVENT_TIMEOUT,
  AUTH_STRINGS.ERR_NO_REDIRECT_EVENT,
  AUTH_STRINGS.ERR_STORAGE_UNSUPPORTED,
])

/**
 * Codes where the popup handshake cannot run in the current browser
 * environment (popup blockers, COOP window.closed blocking, partitioned
 * storage, unsupported contexts) — these retry via signInWithRedirect.
 * User-cancellation codes are deliberately excluded.
 */
export const AUTH_REDIRECT_FALLBACK_CODES: readonly string[] = Object.freeze([
  AUTH_STRINGS.ERR_POPUP_BLOCKED,
  AUTH_STRINGS.ERR_INTERNAL,
  AUTH_STRINGS.ERR_STORAGE_UNSUPPORTED,
  AUTH_STRINGS.ERR_ENV_UNSUPPORTED,
])
