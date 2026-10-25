/**
 * @file tokens/strings/chars.js
 * @description Punctuation, unit and single-character string tokens —
 * token group.
 */

/**
 * Punctuation, unit and single-character string tokens. Sole declaration site — consumers import members
 * from this frozen map rather than re-declaring the literals
 * (zero-hardcoding rule).
 */
export const CHAR_STRINGS = Object.freeze({
  EMPTY: '',
  SLASH: '/',
  DOUBLE_SLASH: '//',
  COLON: ':',
  SEMICOLON: ';',
  COMMA: ',',
  DOT: '.',
  DASH: '-',
  EM_DASH: '—',
  ELLIPSIS: '…',
  UNDERSCORE: '_',
  EQUALS: '=',
  QUESTION: '?',
  AMPERSAND: '&',
  HASH: '#',
  PERCENT: '%',
  PIPE_SEP: '|',
  DOT_SEP: '•',
  COPYRIGHT: '©',
  /** Keycap glyph rows for shortcut documentation (arrows + Escape). */
  ARROW_KEYS: '← → ↑ ↓',
  ESC_KEYCAP: 'Esc',
  /** Zoom/expand control glyph (diagonal arrows to corners). */
  EXPAND_GLYPH: '⤢',
  /** Dismiss/close control glyph (multiplication cross). */
  CLOSE_GLYPH: '✕',
  /** Playback toggle glyphs for ambient-media controls (triangle / pause bars). */
  PLAY_GLYPH: '▶',
  PAUSE_GLYPH: '❚❚',
  SPACE_CHAR: ' ',
  NBSP: ' ',
  ZERO: '0',
  ONE: '1',
  MINUS_ONE: '-1',
  DELAY_8: '8',
  DELAY_30: '30',
  PERCENT_100: '100%',
  ONE_EM: '1em',
  PX: 'px',
  REM: 'rem',
  VW_100: '100vw',
  VH_100: '100vh',
  DVH_100: '100dvh',
  JSON_EXT: '.json',
})
