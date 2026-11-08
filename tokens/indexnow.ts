/**
 * @file tokens/indexnow.ts
 * @description IndexNow protocol tokens — the Bing/IndexNow API key,
 * key-file names, host scope and endpoint shared by the build-time submit
 * script (`shared/scripts/build/submit-indexnow.mjs`) and the governance
 * tests. Self-contained on purpose: plain-node build scripts import this
 * module through native type stripping, so no relative imports may be
 * added here.
 */

/**
 * IndexNow API key — generated in Bing Webmaster Tools and hosted as the
 * root key file so participating search engines can verify domain
 * ownership before accepting submissions.
 */
const _INDEXNOW_KEY = '3485cfd81cf54b1fb45ab7df0fc757b1'

/**
 * Host every submission is scoped to — the protocol rejects URLs that do
 * not belong to the declared host.
 */
const _INDEXNOW_HOST = 'luiskr.com'

/**
 * Frozen IndexNow protocol map — sole declaration site for these tokens;
 * consumers read members and never re-declare the strings (zero-hardcoding
 * rules 4–5). Object.freeze makes the token contract immutable at
 * runtime.
 */
export const INDEXNOW = Object.freeze({
  /** Ownership key — also the body of the root-hosted key file. */
  KEY: _INDEXNOW_KEY,
  /** Protocol host scope — submitted URLs must sit under this host. */
  HOST: _INDEXNOW_HOST,
  /** Key-file basename served at the site root (`/<key>.txt`). */
  KEY_FILE: `${_INDEXNOW_KEY}.txt`,
  /** Absolute keyLocation sent with every submission payload and param. */
  KEY_LOCATION: `https://${_INDEXNOW_HOST}/${_INDEXNOW_KEY}.txt`,
  /**
   * IndexNow endpoint — accepts both JSON `POST` bodies (host/key/
   * keyLocation/urlList) and single-URL `GET` submissions via the
   * `url`, `key` and `keyLocation` query params.
   */
  API: 'https://api.indexnow.org/indexnow',
})
