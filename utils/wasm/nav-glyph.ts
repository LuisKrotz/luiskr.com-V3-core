/**
 * @file nav-glyph.ts
 * @description Bridge for the nav glyph hover motion. Lazy-loads the
 * nav-glyph wasm module once (Rust particle pool, see rust/nav-glyph), then
 * for each icon runs one 2D canvas driven by the wasm output buffer: the
 * wasm side owns the physics (activity easing, emission, the swoosh curve),
 * the canvas side only paints the records it reads from linear memory. The
 * frame loop sleeps when idle, wakes on pointer/focus enter of the owning
 * chip, and never runs under reduced motion or when the module can't load —
 * the icon's CSS loops stay the visible fallback.
 */

import { NAV_CLASSES } from '@core/tokens/classes/nav.js'
import { NAV_GLYPH } from '@core/tokens/data/nav-glyph.js'
import { FOCUS_EVENTS, POINTER_EVENTS } from '@core/tokens/events/dom.js'
import { MEDIA_QUERIES } from '@core/tokens/primitives.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'

/** Methods the wasm GlyphFx exposes to the bridge. */
interface GlyphHandle {
  set_active(on: boolean): void
  step(dt: number): void
  alive(): number
  energy(): number
  data_ptr(): number
  data_len(): number
  free(): void
}

/** Shape of the wasm-pack glue module the bridge imports. */
interface GlyphModule {
  default: () => Promise<{ memory: WebAssembly.Memory }>
  GlyphFx: new (kind: number, seed: number) => GlyphHandle
}

/** Loaded module + its linear memory — null when the artifact is unavailable. */
interface GlyphRuntime {
  memory: WebAssembly.Memory
  GlyphFx: GlyphModule['GlyphFx']
}

/** A live glyph animation — destroy() detaches listeners, loop and wasm memory. */
export interface NavGlyphSession {
  destroy(): void
}

/** Cached runtime-load promise — null until first glyph mount, resolves
 *  once so concurrent mounts share a single wasm instantiation. */
let runtime: Promise<GlyphRuntime | null> | null = null

/** Default glue loader — dynamic-imports the wasm-pack module from the
 *  public artifacts dir (never resolvable under jest). */
const loadGlueModule = (): Promise<GlyphModule> =>
  import(/* @vite-ignore */ NAV_GLYPH.GLUE_URL) as Promise<GlyphModule>

/**
 * Loads the wasm glue once and resolves the shared runtime; any failure
 * (missing artifact, blocked fetch) resolves null so callers stay on CSS.
 * @param load Injectable glue importer — tests substitute a stub so the
 *   runtime-merge arms run without the artifact (same contract as
 *   wasm-diagram's injectable loader).
 * @returns the runtime, or null when wasm can't be loaded
 */
const loadRuntime = (load: () => Promise<GlyphModule>): Promise<GlyphRuntime | null> => {
  if (!runtime) {
    runtime = load()
      .then(async (m: GlyphModule) => ({ memory: (await m.default()).memory, GlyphFx: m.GlyphFx }))
      .catch(() => null)
  }

  return runtime
}

/**
 * Mounts the animated glyph on an icon element: finds its canvas in the
 * shadow root, wakes the emitter on the owning chip's pointer/focus, and
 * paints the wasm particle records each frame in the two palette colors read
 * from the icon's own computed neon tokens.
 * @param host the <nav-*-icon> element that owns the canvas
 * @param kind NAV_GLYPH.KIND_STREAK or NAV_GLYPH.KIND_SWOOSH
 * @param colorProps the two --nav-neon-* custom properties to paint with
 * @param loadModule Injectable glue importer — tests substitute a stub
 *   so the whole bridge runs without the wasm artifact (the default
 *   latches `loadRuntime`, same contract as wasm-diagram's loader).
 * @returns a session handle, or null when wasm, the canvas or reduced motion rule it out
 */
export const mountNavGlyph = async (
  host: HTMLElement,
  kind: number,
  colorProps: [string, string],
  loadModule: () => Promise<GlyphModule> = loadGlueModule
): Promise<NavGlyphSession | null> => {
  const canvas = host.shadowRoot?.querySelector<HTMLCanvasElement>(
    `.${NAV_CLASSES.NAV_GLYPH_CANVAS}`
  )
  const trigger = host.closest('button')

  if (!canvas || !trigger || typeof window === TYPE_STRINGS.UNDEFINED) return null

  if (window.matchMedia && window.matchMedia(MEDIA_QUERIES.PREFERS_REDUCED_MOTION).matches) {
    return null
  }

  const rt = await loadRuntime(loadModule)
  const ctx = canvas.getContext('2d')

  if (!rt || !ctx) return null

  const fx = new rt.GlyphFx(kind, NAV_GLYPH.SEED)
  const view = new Float32Array(rt.memory.buffer, fx.data_ptr(), fx.data_len())

  // Palette snapshot — re-read on each wake so a theme flip between
  // hovers repaints in the new theme's inks; getComputedStyle stays off
  // the frame loop entirely.
  const readColors = (): string[] =>
    colorProps.map((p) => getComputedStyle(host).getPropertyValue(p).trim())

  let colors = readColors()

  let raf = 0
  let last = 0

  const size = (): number => {
    const dpr = window.devicePixelRatio || 1
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr))

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }

    return canvas.width / NAV_GLYPH.FRAME_SPAN
  }

  const draw = (s: number): void => {
    const origin = NAV_GLYPH.FRAME_ORIGIN * s

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (let i = 0; i < NAV_GLYPH.POOL; i++) {
      const b = i * NAV_GLYPH.STRIDE
      const alpha = view[b + 2]

      if (alpha <= 0) continue

      const x = view[b] * s + origin
      const y = view[b + 1] * s + origin
      const len = view[b + 3] * s
      const color = colors[view[b + 4] < NAV_GLYPH.HUE_SPLIT ? 0 : 1]

      ctx.globalAlpha = alpha
      ctx.strokeStyle = color
      ctx.fillStyle = color

      if (kind === NAV_GLYPH.KIND_STREAK) {
        ctx.lineWidth = NAV_GLYPH.STREAK_WIDTH * s
        ctx.beginPath()
        ctx.moveTo(x - len, y)
        ctx.lineTo(x, y)
        ctx.stroke()
      } else {
        ctx.beginPath()
        ctx.arc(x, y, len, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    ctx.globalAlpha = 1
  }

  const frame = (now: number): void => {
    raf = 0

    fx.step((now - last) / 1000)

    last = now

    draw(size())

    if (fx.energy() > NAV_GLYPH.SLEEP_EPS || fx.alive() > 0) {
      raf = requestAnimationFrame(frame)
    }
  }

  const wake = (): void => {
    if (raf) return

    last = performance.now()
    raf = requestAnimationFrame(frame)
  }

  const onEnter = (): void => {
    colors = readColors()
    fx.set_active(true)
    wake()
  }

  const onLeave = (): void => {
    colors = readColors()
    fx.set_active(false)
    wake()
  }

  trigger.addEventListener(POINTER_EVENTS.POINTERENTER, onEnter, { passive: true })
  trigger.addEventListener(POINTER_EVENTS.POINTERLEAVE, onLeave, { passive: true })
  trigger.addEventListener(FOCUS_EVENTS.FOCUSIN, onEnter, { passive: true })
  trigger.addEventListener(FOCUS_EVENTS.FOCUSOUT, onLeave, { passive: true })

  return {
    destroy(): void {
      trigger.removeEventListener(POINTER_EVENTS.POINTERENTER, onEnter)
      trigger.removeEventListener(POINTER_EVENTS.POINTERLEAVE, onLeave)
      trigger.removeEventListener(FOCUS_EVENTS.FOCUSIN, onEnter)
      trigger.removeEventListener(FOCUS_EVENTS.FOCUSOUT, onLeave)
      cancelAnimationFrame(raf)
      fx.free()
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    },
  }
}
