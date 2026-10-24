/**
 * @file tokens/starfield/music.js
 * @description Ambient playlist for the Star Field experiment — the MP3
 * track list uploaded under
 * `${CDN_URLS.CDN_BASE}experiments/star-field/music/`. Each entry's
 * display title reads `Title — Artist` (the attribution line under the
 * track's provider filename). Sole declaration site — consumers import
 * members from this frozen map rather than re-declaring the literals
 * (zero-hardcoding rule).
 * @type {Readonly<Record<string, string>>}
 */

import { CDN_URLS } from '../media/urls.js'

/** CDN root the star-field soundtrack set uploads under. */
const _CDN = `${CDN_URLS.CDN_BASE}experiments/star-field/music`

/** One playlist entry — a CDN MP3 asset plus its display title. */
export interface SFMusicTrack {
  /** Absolute CDN URL of the MP3 asset. */
  src: string
  /** Display title shown in the playlist (`Title — Artist`). */
  title: string
}

/**
 * Frozen ambient-playlist track list — declaration order is the play
 * order; the player's `ended` handler auto-advances and wraps back to
 * the first track so the soundtrack runs continuously once started.
 */
export const SF_MUSIC_TRACKS: readonly SFMusicTrack[] = Object.freeze([
  Object.freeze({ src: `${_CDN}/mondamusic-space-589110.mp3`, title: 'Space — MondaMusic' }),
  Object.freeze({
    src: `${_CDN}/sigmamusicart-space-space-music-597916.mp3`,
    title: 'Space Music — SigmaMusicArt',
  }),
  Object.freeze({ src: `${_CDN}/the_mountain-space-438391.mp3`, title: 'Space — The Mountain' }),
  Object.freeze({
    src: `${_CDN}/the_mountain-space-study-146969.mp3`,
    title: 'Space Study — The Mountain',
  }),
])

/**
 * Frozen transport-button glyphs — the compact play/pause/prev/next/
 * repeat icons rendered inside the playlist controls row (JSX decodes
 * the literal directly; aria-labels carry the localized name).
 */
export const SF_MUSIC_GLYPHS = Object.freeze({
  PLAY: '▶',
  PAUSE: '⏸',
  PREV: '⏮',
  NEXT: '⏭',
  REPEAT: '↻',
})
