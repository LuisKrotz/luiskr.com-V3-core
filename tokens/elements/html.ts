/**
 * @file tokens/elements/html.js
 * @description Native HTML tag-name tokens — token group.
 */

import { _B_NAV, _K_DIALOG, _K_INPUT, _K_STYLE, _K_TITLE } from '../base.js'

/**
 * Frozen html element tag-name map — sole declaration site for these tokens; consumers read
 * members and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes
 * the token contract immutable at runtime.
 */
export const HTML_TAGS = Object.freeze({
  FIGURE: 'figure',
  ARTICLE: 'article',
  VIDEO: 'video',
  AUDIO: 'audio',
  IMG: 'img',
  IFRAME: 'iframe',
  BUTTON: 'button',
  LINK: 'link',
  META: 'meta',
  STYLE: _K_STYLE,
  DIV: 'div',
  SPAN: 'span',
  A: 'a',
  P: 'p',
  CANVAS: 'canvas',
  PICTURE: 'picture',
  SOURCE: 'source',
  SELECT: 'select',
  OPTION: 'option',
  INPUT: _K_INPUT,
  TEXTAREA: 'textarea',
  LABEL: 'label',
  H2: 'h2',
  H3: 'h3',
  NAV: _B_NAV,
  ASIDE: 'aside',
  HEADER: 'header',
  MAIN: 'main',
  DIALOG: _K_DIALOG,
  TITLE: _K_TITLE,
  H1: 'h1',
  HTML: 'html',
  BODY: 'body',
})

/**
 * Frozen phrasing/text-bearing host map — elements whose textContent
 * would absorb an injected sibling text node, polluting the host's
 * accessible name and visible-text extraction. Sole declaration site
 * for these tags; strings shared with `HTML_TAGS` are referenced, not
 * redeclared (zero-hardcoding rules 4–5).
 */
export const HTML_PHRASING_TAGS = Object.freeze({
  H1: HTML_TAGS.H1,
  H2: HTML_TAGS.H2,
  H3: HTML_TAGS.H3,
  H4: 'h4',
  H5: 'h5',
  H6: 'h6',
  P: HTML_TAGS.P,
  A: HTML_TAGS.A,
  BUTTON: HTML_TAGS.BUTTON,
  LABEL: HTML_TAGS.LABEL,
  SPAN: HTML_TAGS.SPAN,
  LI: 'li',
  DT: 'dt',
  DD: 'dd',
  FIGCAPTION: 'figcaption',
  LEGEND: 'legend',
  BLOCKQUOTE: 'blockquote',
  EM: 'em',
  STRONG: 'strong',
  SMALL: 'small',
  B: 'b',
  I: 'i',
  U: 'u',
  S: 's',
  MARK: 'mark',
  TIME: 'time',
  CODE: 'code',
  ABBR: 'abbr',
  CITE: 'cite',
  Q: 'q',
  DFN: 'dfn',
  INS: 'ins',
  DEL: 'del',
  SUB: 'sub',
  SUP: 'sup',
  KBD: 'kbd',
  SAMP: 'samp',
  VAR: 'var',
  OUTPUT: 'output',
  BDI: 'bdi',
  BDO: 'bdo',
  RUBY: 'ruby',
  DATA: 'data',
  PRE: 'pre',
})
