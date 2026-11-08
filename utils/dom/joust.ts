/**
 * @file utils/dom/joust.ts
 * @description "Joust" — the click-to-reveal contract for round icon
 * chips (`joust` root → `joust-label` span → `joust--open` modifier).
 * On hover-less input (the `(hover: none)` media query — phones/tablets)
 * a chip has no `:hover` to pour its label out through, so the first
 * pointer tap jousts the label open instead of firing the action, and
 * the next tap — anywhere on the chip, label included — fires it.
 * Hover-capable pointers and keyboard/programmatic activations skip the
 * gate entirely: the label is already revealed by the `:hover` /
 * `:focus-visible` styles, so the click stays single-shot.
 *
 * Single-open per page: jousting one chip collapses the previous pin,
 * and outside presses / Escape collapse without firing. The module owns
 * the pin set + the document dismissal listeners; callers only run the
 * gate inside their click handlers (`joustClick` for DOM events,
 * `joustChip` for event-less activations like canvas widget callbacks).
 */

import { JOUST_CLASSES } from '@core/tokens/classes/joust.js'
import { MEDIA_QUERIES, KEYS } from '@core/tokens/primitives.js'
import { KEYBOARD_EVENTS, POINTER_EVENTS } from '@core/tokens/events/dom.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'

/** Chips currently pinned open by a joust tap — one member in practice (single-open). */
const _open = new Set<Element>()

/**
 * Hover-less-primary check — `(hover: none)` marks devices whose primary
 * input can't hold `:hover`, the only context where a tap must reveal
 * the label before it can activate. A missing `window`/`matchMedia`
 * (SSR, bare test shims) counts as hover-capable so scripted `.click()`s
 * and keyboard activations keep firing single-shot.
 * @returns True when the gate should intercept pointer taps.
 */
const _hoverless = (): boolean =>
  typeof window !== TYPE_STRINGS.UNDEFINED &&
  typeof window.matchMedia === TYPE_STRINGS.FUNCTION &&
  window.matchMedia(MEDIA_QUERIES.HOVER_NONE).matches === true

/**
 * Whether the event is a real pointer click. Only `MouseEvent` with a
 * positive `detail` (click count) counts — keyboard/programmatic clicks
 * carry `detail` 0, and plain `Event('click')` dispatches are scripted
 * by definition (same discrimination armResidualInputGuard applies).
 * @param e The activation event, if one exists.
 * @returns True when the activation came from a physical pointer click/tap.
 */
const _pointerish = (e: Event | null | undefined): boolean =>
  typeof MouseEvent !== TYPE_STRINGS.UNDEFINED && e instanceof MouseEvent && e.detail > 0

/** Removes the pin modifier + set membership from one chip. */
const _release = (chip: Element): void => {
  chip.classList.remove(JOUST_CLASSES.JOUST_OPEN)

  _open.delete(chip)
}

/**
 * Arms the dismissal listeners — identical addEventListener signatures
 * dedupe natively, so repeat pins never stack the sweep.
 */
const _arm = (): void => {
  if (typeof document === TYPE_STRINGS.UNDEFINED) return

  document.addEventListener(POINTER_EVENTS.POINTERDOWN, _onPress, true)

  document.addEventListener(KEYBOARD_EVENTS.KEYDOWN, _onKey)
}

/** Disarms the dismissal listeners — a no-op when they were never armed. */
const _disarm = (): void => {
  if (typeof document === TYPE_STRINGS.UNDEFINED) return

  document.removeEventListener(POINTER_EVENTS.POINTERDOWN, _onPress, true)

  document.removeEventListener(KEYBOARD_EVENTS.KEYDOWN, _onKey)
}

/**
 * Collapses every pinned chip and disarms the listeners — also called
 * when an owning surface takes over the screen (menu open, host destroy)
 * so no stale label stays poured behind it.
 */
export const joustCollapseAll = (): void => {
  for (const chip of _open) _release(chip)

  _disarm()
}

/**
 * Capture-phase press sweep: any pointerdown lands BEFORE the click it
 * produces, so this runs ahead of the gate — a press outside a pinned
 * chip collapses it (the following click then jousts its own chip), a
 * press inside keeps it (the following click activates). Detached chips
 * — a re-render replaced them — are pruned on the same sweep.
 * `composedPath` is required because chip clicks bubble out of the
 * shadow root retargeted to `<app-nav>`; `e.target` alone would read
 * every inside-chip press as outside. The `Node.contains` fallback
 * covers environments without `composedPath`.
 * @param e The pointerdown event.
 */
const _onPress = (e: Event): void => {
  for (const chip of _open) {
    const inside =
      (typeof e.composedPath === TYPE_STRINGS.FUNCTION && e.composedPath().includes(chip)) ||
      (e.target instanceof Node && chip.contains(e.target))

    if (!chip.isConnected || !inside) _release(chip)
  }

  if (_open.size === 0) _disarm()
}

/** Escape collapses every pinned chip without firing — same dismissal as an outside press. */
const _onKey = (e: Event): void => {
  if ((e as KeyboardEvent).key === KEYS.ESCAPE) joustCollapseAll()
}

/**
 * The joust gate for a chip element — returns `true` when the chip's
 * action should fire, `false` when this tap was consumed to pour the
 * label. `chip` may be the `joust` root itself or any descendant
 * (icon, label span, canvas) — the root resolves through `closest`.
 * `pointerInitiated` distinguishes physical taps from scripted calls:
 * pass `false` for keyboard, programmatic or test activations, which
 * always fire single-shot.
 * @param chip Element the activation landed on (or null — no chip → fire).
 * @param pointerInitiated True for real pointer presses.
 * @returns True = run the action; false = the click jousted the label open.
 */
export const joustChip = (chip: Element | null | undefined, pointerInitiated = true): boolean => {
  const root = chip?.closest?.(`.${JOUST_CLASSES.JOUST}`) ?? null

  // Outside any joust chip, on hover-capable input, or for non-pointer
  // activations → fire immediately; the reveal is hover/focus's job there.
  if (!root || !_hoverless() || !pointerInitiated) return true

  // Second tap on an already-pinned chip → release + activate.
  if (_open.has(root)) {
    _release(root)

    _disarm()

    return true
  }

  joustCollapseAll()

  _open.add(root)

  root.classList.add(JOUST_CLASSES.JOUST_OPEN)

  _arm()

  return false
}

/**
 * Event-flavored gate for DOM click handlers — resolves the chip from
 * `currentTarget` and derives pointer-vs-keyboard from `detail`, so a
 * single call slots in front of an existing handler:
 * `if (!joustClick(e)) return`.
 * @param e The click event (undefined for programmatic calls → fires).
 * @returns True = run the action; false = the click jousted the label open.
 */
export const joustClick = (e: Event | null | undefined): boolean =>
  joustChip(e?.currentTarget as Element | null | undefined, _pointerish(e))
