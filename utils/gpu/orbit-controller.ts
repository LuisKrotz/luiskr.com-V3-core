/**
 * @file utils/gpu/orbit-controller.ts — the OrbitControls replacement
 * for scene3d surfaces. OrbitControls ships inside three; once a scene
 * renders through `Surface3d` the camera rig has to live somewhere —
 * this module owns the input math and pushes six scalars per frame
 * (target + distance + yaw/pitch) into `surface.set_orbit`.
 *
 * Frame-budget contract: every listener is passive, pointermove goes
 * through `getCoalescedEvents` (only the last sample matters for a
 * drag delta), all gesture state is preallocated scalars, and the
 * per-frame `update(dt)` is allocation-free — the only writes are the
 * damped pose fields. Wheel zoom is passive too (the governance gate
 * forbids non-passive scroll-blockers), so scroll suppression over the
 * canvas is the host's CSS concern (`overscroll-behavior` /
 * `touch-action`), not a preventDefault here.
 *
 * Event contract mirrors OrbitControls so consumers port 1:1 —
 * `addEventListener(ORBIT_EVENTS.START|END|CHANGE, fn)`; START fires
 * on the first captured pointer, END when the last lifts, CHANGE per
 * `update` that actually moved the pose.
 */
import { MOUSE_EVENTS, POINTER_EVENTS } from '@core/tokens/events/dom.js'
import { ORBIT_EVENTS } from '@core/tokens/events/dom.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'

/** Default pitch clamp — π/2 minus a sliver so the poles never flip. */
const PITCH_LIMIT = Math.PI / 2 - 0.001

/** Settle epsilon — damped channels snap below this so idle frames stop writing. */
const SETTLE_EPS = 1e-5

/** Gesture spec for `bindOrbit` — OrbitControls-faithful where feasible. */
export interface OrbitSpec {
  /** World point the camera circles (default origin). */
  target?: readonly [number, number, number]
  /** Eye→target distance (default 10). */
  distance?: number
  /** Initial yaw about +Y, radians (default 0). */
  yaw?: number
  /** Initial pitch/elevation, radians (default 0). */
  pitch?: number
  /** Distance clamps (defaults 0.1 / 1e5). */
  minDistance?: number
  maxDistance?: number
  /** Pitch clamps (defaults ±(π/2 − ε)). */
  minPitch?: number
  maxPitch?: number
  /** Idle auto-rotation, radians per second (default 0 = off). */
  autoRotateSpeed?: number
  /**
   * Damped-lerp factor per 60Hz slice (OrbitControls' dampingFactor
   * ≈0.05–0.1). Internally converted to a frame-rate-independent
   * rate so 120/240Hz surfaces damp identically.
   */
  damping?: number
  /** Radians per CSS px of drag (default ≈ full turn per 800px). */
  rotateSpeed?: number
  /** Distance multiplier per wheel deltaY unit (default 0.0015). */
  zoomStep?: number
  /** Wheel/pinch zoom toggle (default true). */
  enableZoom?: boolean
}

/** Listener signature for the START/END/CHANGE contract. */
export type OrbitListener = () => void

/** Live orbit rig returned by `bindOrbit`. */
export interface OrbitController {
  /** Gesture latch — false stops the idle drift (OrbitControls.autoRotate). */
  autoRotate: boolean
  /** Damped current pose — feed `surface.set_orbit` after update(). */
  readonly tx: number
  readonly ty: number
  readonly tz: number
  readonly distance: number
  readonly yaw: number
  readonly pitch: number
  /**
   * One frame of integration — auto-rotate advances the target while
   * no pointer is captured, then every channel damps toward its
   * target. Allocation-free. Returns true when the pose changed (the
   * caller pushes `set_orbit` + fires CHANGE consumers).
   * @param dt Frame delta in seconds.
   */
  update(dt: number): boolean
  /** Current damped distance — the label-fade/zoom-reveal input. */
  getDistance(): number
  /** Moves the orbit target (world point). */
  setTarget(x: number, y: number, z: number): void
  /** Jumps the pose (save/restore arms — targets AND currents snap). */
  setPose(distance: number, yaw: number, pitch: number): void
  /** Registers a START/END/CHANGE listener. */
  addEventListener(type: string, fn: OrbitListener): void
  /** Removes a registered listener. */
  removeEventListener(type: string, fn: OrbitListener): void
  /** Unbinds every listener + clears pointer state. */
  dispose(): void
}

/**
 * Binds pointer/wheel input on `canvas` to a damped orbit rig. The rig
 * never touches the camera itself — consumers read the pose fields
 * after `update(dt)` and push them into the engine (`set_orbit`) or a
 * three camera (the math is backend-agnostic by design).
 * @param canvas The scene's input surface.
 * @param spec Gesture + clamp options.
 */
export function bindOrbit(canvas: HTMLCanvasElement, spec: OrbitSpec = {}): OrbitController {
  const minDist = spec.minDistance ?? 0.1
  const maxDist = spec.maxDistance ?? 1e5
  const minPitch = spec.minPitch ?? -PITCH_LIMIT
  const maxPitch = spec.maxPitch ?? PITCH_LIMIT
  const damping = spec.damping ?? 0.08
  const rotateSpeed = spec.rotateSpeed ?? (Math.PI * 2) / 800
  const zoomStep = spec.zoomStep ?? 0.0015
  const enableZoom = spec.enableZoom ?? true

  const t = spec.target ?? [0, 0, 0]
  const clampDist = (v: number) => Math.min(maxDist, Math.max(minDist, v))
  const clampPitch = (v: number) => Math.min(maxPitch, Math.max(minPitch, v))

  // Targets are written by events instantly; currents damp toward them.
  let tx = t[0],
    ty = t[1],
    tz = t[2]
  let targetDistance = clampDist(spec.distance ?? 10)
  let targetYaw = spec.yaw ?? 0
  let targetPitch = clampPitch(spec.pitch ?? 0)
  let distance = targetDistance
  let yaw = targetYaw
  let pitch = targetPitch

  /** Pose-dirty latch — setTarget/setPose change the pushed pose even
      when the damped channels are already settled. */
  let dirty = true

  /** Pointers currently captured on the canvas (1 = drag, 2 = pinch). */
  const pointers = new Map<number, { x: number; y: number }>()

  /** Span between the first two captured pointers — the pinch baseline. */
  let pinchSpan = 0

  /** The distance at pinch start — multiplied by the live ratio. */
  let pinchDistance = 0

  const listeners = new Map<string, Set<OrbitListener>>()

  const fire = (type: string) => {
    listeners.get(type)?.forEach((fn) => fn())
  }

  const span = () => {
    const [a, b] = [...pointers.values()]

    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  const onPointerDown = (e: PointerEvent) => {
    if (pointers.size === 0) fire(ORBIT_EVENTS.START)

    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.size === 2) {
      pinchSpan = span()
      pinchDistance = targetDistance
    }
  }

  const onPointerMove = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId)

    if (!p) return

    const samples =
      typeof e.getCoalescedEvents === TYPE_STRINGS.FUNCTION ? e.getCoalescedEvents() : [e]
    const last = samples[samples.length - 1] ?? e

    const dx = last.clientX - p.x
    const dy = last.clientY - p.y

    p.x = last.clientX
    p.y = last.clientY

    if (pointers.size === 2 && enableZoom) {
      const live = span()

      if (pinchSpan > 0 && live > 0) {
        targetDistance = clampDist(pinchDistance * (pinchSpan / live))
      }

      return
    }

    targetYaw -= dx * rotateSpeed
    targetPitch = clampPitch(targetPitch - dy * rotateSpeed)
  }

  const release = (e: PointerEvent) => {
    if (!pointers.delete(e.pointerId)) return

    if (pointers.size === 0) fire(ORBIT_EVENTS.END)
  }

  const onWheel = (e: WheelEvent) => {
    if (!enableZoom) return

    targetDistance = clampDist(targetDistance * Math.exp(e.deltaY * zoomStep))
  }

  canvas.addEventListener(POINTER_EVENTS.POINTERDOWN, onPointerDown, { passive: true })
  canvas.addEventListener(POINTER_EVENTS.POINTERMOVE, onPointerMove, { passive: true })
  canvas.addEventListener(POINTER_EVENTS.POINTERUP, release, { passive: true })
  canvas.addEventListener(POINTER_EVENTS.POINTERCANCEL, release, { passive: true })
  canvas.addEventListener(MOUSE_EVENTS.WHEEL, onWheel, { passive: true })

  const ctl: OrbitController = {
    autoRotate: false,
    get tx() {
      return tx
    },
    get ty() {
      return ty
    },
    get tz() {
      return tz
    },
    get distance() {
      return distance
    },
    get yaw() {
      return yaw
    },
    get pitch() {
      return pitch
    },

    update(dt: number) {
      if (ctl.autoRotate && pointers.size === 0) {
        targetYaw += (spec.autoRotateSpeed ?? 0) * dt
      }

      // Frame-rate-independent damping: k is the per-60Hz-slice lerp —
      // 1-(1-damping)^(dt*60) converges identically at 60/120/240Hz.
      const k = damping >= 1 ? 1 : 1 - Math.pow(1 - damping, dt * 60)
      const dyaw = (targetYaw - yaw) * k
      const dpitch = (targetPitch - pitch) * k
      const ddist = (targetDistance - distance) * k
      const moved =
        Math.abs(dyaw) > SETTLE_EPS || Math.abs(dpitch) > SETTLE_EPS || Math.abs(ddist) > SETTLE_EPS

      yaw += dyaw
      pitch += dpitch
      distance += ddist

      if (!moved && !dirty) return false

      if (!moved) {
        yaw = targetYaw
        pitch = targetPitch
        distance = targetDistance
      }

      dirty = false
      fire(ORBIT_EVENTS.CHANGE)

      return true
    },

    getDistance: () => distance,

    setTarget(x: number, y: number, z: number) {
      tx = x
      ty = y
      tz = z
      dirty = true
    },

    setPose(d: number, y: number, p: number) {
      targetDistance = clampDist(d)
      targetYaw = y
      targetPitch = clampPitch(p)
      distance = targetDistance
      yaw = targetYaw
      pitch = targetPitch
      dirty = true
    },

    addEventListener(type: string, fn: OrbitListener) {
      let set = listeners.get(type)

      if (!set) {
        set = new Set()
        listeners.set(type, set)
      }

      set.add(fn)
    },

    removeEventListener(type: string, fn: OrbitListener) {
      listeners.get(type)?.delete(fn)
    },

    dispose() {
      canvas.removeEventListener(POINTER_EVENTS.POINTERDOWN, onPointerDown)
      canvas.removeEventListener(POINTER_EVENTS.POINTERMOVE, onPointerMove)
      canvas.removeEventListener(POINTER_EVENTS.POINTERUP, release)
      canvas.removeEventListener(POINTER_EVENTS.POINTERCANCEL, release)
      canvas.removeEventListener(MOUSE_EVENTS.WHEEL, onWheel)
      pointers.clear()
      listeners.clear()
    },
  }

  return ctl
}
