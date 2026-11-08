/**
 * @file tokens/attrs/aria.js
 * @description ARIA attribute + role-value tokens — token group.
 */

import { _K_DIALOG } from '../base.js'

/**
 * Frozen aria attribute-name map — sole declaration site for these tokens; consumers read
 * members and never re-declare the strings (zero-hardcoding rules 4–5). Object.freeze makes
 * the token contract immutable at runtime.
 */
export const ARIA_ATTRS = Object.freeze({
  ARIA_LABEL: 'aria-label',
  ARIA_EXPANDED: 'aria-expanded',
  ARIA_CONTROLS: 'aria-controls',
  ARIA_LABELLEDBY: 'aria-labelledby',
  ARIA_DESCRIBEDBY: 'aria-describedby',
  ARIA_MODAL: 'aria-modal',
  ARIA_DESCRIPTION: 'aria-description',
  ARIA_HIDDEN: 'aria-hidden',
  ARIA_LIVE: 'aria-live',
  ARIA_PRESSED: 'aria-pressed',
  ARIA_CHECKED: 'aria-checked',
  ARIA_ACTIVEDESCENDANT: 'aria-activedescendant',
  ARIA_AUTOCOMPLETE: 'aria-autocomplete',
  ARIA_HASPOPUP: 'aria-haspopup',
  POLITE: 'polite',
  ROLE: 'role',
  ROLE_DIALOG: _K_DIALOG,
  ROLE_GROUP: 'group',
  ROLE_SWITCH: 'switch',
  ROLE_BUTTON: 'button',
  ROLE_NAVIGATION: 'navigation',
  ROLE_ALERT: 'alert',
  ROLE_STATUS: 'status',
  ROLE_REGION: 'region',
  /** `tree`/`treeitem`/`none` — the ARIA treeview contract for the docs nav. */
  ROLE_TREE: 'tree',
  ROLE_TREEITEM: 'treeitem',
  ROLE_NONE: 'none',
  ROLE_IMG: 'img',
  /** `application` — the only widget role ARIA permits on <video>. */
  ROLE_APPLICATION: 'application',
  /** Combobox autocomplete pattern — input + popup listbox + options. */
  ROLE_COMBOBOX: 'combobox',
  ROLE_LISTBOX: 'listbox',
  ROLE_OPTION: 'option',
  /** `list` — aria-autocomplete value: a popup lists suggestions. */
  AUTOCOMPLETE_LIST: 'list',
  TABINDEX: 'tabindex',
})
