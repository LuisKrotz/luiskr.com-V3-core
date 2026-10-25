/**
 * @file tokens/data/storage.js
 * @description localStorage/sessionStorage key tokens split by scope —
 * grouped subsets of STORAGE_KEYS.
 */

/**
 * localStorage/sessionStorage key tokens split by scope. Sole declaration site — consumers import members
 * from this frozen map rather than re-declaring the literals
 * (zero-hardcoding rule).
 */
export const PREF_STORAGE_KEYS = Object.freeze({
  VIDEO_AUTOPLAY: 'videoAutoplay',
  LOCALE: 'locale',
  REDUCED_MOTION: 'reducedMotion',
  HIGH_CONTRAST: 'highContrast',
  THEME: 'theme',
  STATS_FOR_NERDS: 'statsForNerds',
  SHOW_GRID: 'showGrid',
  COOKIE: 'cookie',
  SPACE_PLAYGROUND: 'spacePlayground',
})

/**
 * Caches storage keys.
 */
export const CACHE_STORAGE_KEYS = Object.freeze({
  FB_CACHE_PREFIX: 'fb_',
  SESSION_FB_CACHE_PREFIX: 'fb_cache_',
  /** Docs 3D-scene camera pose + rotation-off flag (session-scoped). */
  DOCS_SCENE_STATE: 'docs_scene_state',
  /** Boot loader shown-once flag (session-scoped). */
  INTRO_SHOWN: 'lk_intro_shown',
  /**
   * Boot-loader animation start stamp — a `window` field (not storage)
   * written by the index.html head script at parse time so the veil's
   * duration budget measures the whole boot, not just post-mount.
   */
  INTRO_T0: 'lk_intro_t0',
  /**
   * CMS OAuth-redirect marker (session-scoped) — set just before the
   * signInWithRedirect navigation; still present when the login mounts
   * means the return leg couldn't restore a session (blocked storage),
   * so the login surfaces the failure instead of silently re-prompting.
   */
  CMS_AUTH_REDIRECT: 'cms_auth_redirect',
  /**
   * CMS OAuth-return error code (session-scoped) — written when
   * getRedirectResult rejects after the redirect leg, so the login view
   * can show the real Firebase code (auth/unauthorized-domain,
   * auth/network-request-failed, …) instead of only guessing "browser
   * blocked storage".
   */
  CMS_AUTH_ERROR: 'cms_auth_error',
  /**
   * CMS popup-leg error code (session-scoped) — the real Firebase code
   * that made signInWithPopup fail and triggered the redirect fallback
   * (e.g. auth/web-storage-unsupported). Persisted across the redirect
   * navigation so the login view can name the ORIGINAL failure instead
   * of only the synthetic no-redirect-event inference.
   */
  CMS_AUTH_POPUP_ERROR: 'cms_auth_popup_error',
  /**
   * CMS popup-leg error detail (session-scoped) — the full error message
   * that accompanied CMS_AUTH_POPUP_ERROR. Firebase wraps backend
   * rejections inside auth/internal-error (e.g. the 401 "Firebase App
   * Check token is invalid" from createAuthUri), so the message carries
   * the real cause that the bare code hides.
   */
  CMS_AUTH_POPUP_DETAIL: 'cms_auth_popup_detail',
})
