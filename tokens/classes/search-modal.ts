/**
 * @file tokens/classes/search-modal.js
 * @description BEM class tokens for <search-modal> — the nav search
 * dialog that hosts the standalone <route-search> component.
 */

import { _B_SEARCH_MODAL } from '../base.js'

/**
 * Frozen class-name map — sole declaration site for these tokens; consumers
 * read members and never re-declare the strings (zero-hardcoding rules 4–5).
 */
export const SEARCH_MODAL_CLASSES = Object.freeze({
  /** Root wrapper — always rendered; content mounts only while open. */
  SEARCH_MODAL: _B_SEARCH_MODAL,
  /** `-open` modifier — the dialog is visible. */
  SEARCH_MODAL_OPEN: `${_B_SEARCH_MODAL}--open`,
  /** Fullscreen backdrop — click-away dismisses the dialog. */
  SEARCH_MODAL_BACKDROP: `${_B_SEARCH_MODAL}-backdrop`,
  /** `--enter` modifier — genie fly-in: backdrop + panel start collapsed. */
  SEARCH_MODAL_BACKDROP_ENTER: `${_B_SEARCH_MODAL}-backdrop--enter`,
  /** `--leave` modifier — genie collapse back into the trigger control. */
  SEARCH_MODAL_BACKDROP_LEAVE: `${_B_SEARCH_MODAL}-backdrop--leave`,
  /** The centered dialog panel. */
  SEARCH_MODAL_PANEL: `${_B_SEARCH_MODAL}-panel`,
  /** The dialog's sr-only heading (landmark for AT). */
  SEARCH_MODAL_TITLE: `${_B_SEARCH_MODAL}-title`,
  /** Close button in the panel header — hosts the WebGL liquid-×. */
  SEARCH_MODAL_CLOSE_BTN: `${_B_SEARCH_MODAL}-close-btn`,
  /** The liquid-fill ✕ canvas inside the close button. */
  SEARCH_MODAL_CLOSE_CANVAS: `${_B_SEARCH_MODAL}-close-canvas`,
  /** The hosted search surface wrapper. */
  SEARCH_MODAL_BODY: `${_B_SEARCH_MODAL}-body`,
})
