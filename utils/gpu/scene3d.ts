/**
 * @file utils/gpu/scene3d.ts — the JS facade over the rust/scene3d
 * artifact (`Surface3d`). Scene surfaces are NOT uniform widgets — the
 * engine owns a scene graph, materials, textures, a camera rig, and a
 * post chain behind a flat u32-id API — so it mounts through its own
 * loader instead of `mountWebGpuWidget`. The artifact URL still comes
 * from `GPU_WIDGET_ARTIFACTS[SCENE3D]` (single-sourced token home).
 *
 * Contract mirrors `rust/scene3d/src/wasm.rs`:
 *   mount(canvas, deviceW, deviceH) → Surface3d (async — adapter +
 *   device + surface configure); every failure arm resolves null so
 *   the caller's three.js/CSS renderer stays the render path. The
 *   facade owns the ResizeObserver (device-px `resize`); the caller
 *   owns the frame clock (`surface.frame(time, dpr)`) — engines drive
 *   their own tick with controls/picking between frames, so there is
 *   exactly one rAF source.
 */
import { GPU_WIDGET_ARTIFACTS, GPU_WIDGET_KINDS } from '@core/tokens/motion/gpu-widgets.js'
import { TYPE_STRINGS } from '@core/tokens/strings/types.js'
import { devWarn } from '@core/devlog.js'
import { getSharedGpuDevice, hasWebGpu } from './webgpu-widget.js'
import { wasmImageDecoder } from '@core/utils/wasm/wasm-image-decoder.js'

/**
 * `u32::MAX` — the wasm registry's sentinel for "none": attach a node
 * to the scene root (`parent`), or bind no texture to a material
 * (`tex`). One constant serves both slots since the Rust registry
 * types share the id space.
 */
export const SCENE3D_NONE = 4294967295

/**
 * The wasm-pack `Surface3d` handle — one method per `pub fn` in
 * `rust/scene3d/src/wasm.rs`, flat scalars + typed-array views only
 * (no serde structs, ~64B/call boundary cost). Geometry/material/
 * texture/node ids are u32 registry indices; stale ids no-op inside
 * the engine. Declared here rather than imported from the artifact
 * `.d.ts` so core/ stays standalone.
 */
export interface Scene3dSurface {
  /** Backing-store resize in DEVICE px — depth + surface re-configure. */
  resize(w: number, h: number): void
  /** CSS size — retained for contract parity (no-op on the engine). */
  set_size(w: number, h: number): void
  /** UV-sphere generator → geometry id (`asPoints` = point expansion). */
  gen_sphere(radius: number, ws: number, hs: number, asPoints: boolean): number
  /** Plane generator → geometry id. */
  gen_plane(w: number, h: number, asPoints: boolean): number
  /** Flat ring generator → geometry id. */
  gen_ring(inner: number, outer: number, segments: number, asPoints: boolean): number
  /** Box generator → geometry id. */
  gen_box(w: number, h: number, d: number, asPoints: boolean): number
  /** Cylinder/cone generator → geometry id. */
  gen_cylinder(rt: number, rb: number, h: number, segs: number, asPoints: boolean): number
  /** Torus generator → geometry id. */
  gen_torus(
    radius: number,
    tube: number,
    radial: number,
    tubular: number,
    asPoints: boolean
  ): number
  /** Icosahedron generator → geometry id (`detail` subdivides). */
  gen_icosahedron(radius: number, detail: number, asPoints: boolean): number
  /** Tetrahedron generator → geometry id. */
  gen_tetrahedron(radius: number, asPoints: boolean): number
  /**
   * Custom geometry upload — SoA typed arrays (positions 3n, normals
   * 3n, uvs 2n, indices 3k) → geometry id.
   */
  upload_geometry(
    positions: Float32Array,
    normals: Float32Array,
    uvs: Float32Array,
    indices: Uint32Array,
    asPoints: boolean
  ): number
  /** Decoded bitmap → texture id (GPU→GPU upload, zero readback). */
  upload_texture(bitmap: ImageBitmap, w: number, h: number): number
  /** Unlit texel·color material → material id. */
  add_material_basic(r: number, g: number, b: number, a: number, tex: number): number
  /** Blinn-Phong lit material → material id. */
  add_material_standard(
    r: number,
    g: number,
    b: number,
    a: number,
    roughness: number,
    metalness: number,
    tex: number
  ): number
  /** Billboard sprite material → material id. */
  add_material_sprite(r: number, g: number, b: number, a: number, tex: number): number
  /** Expanded-quad point-sprite material → material id. */
  add_material_points(r: number, g: number, b: number, a: number, size: number, tex: number): number
  /**
   * Pipeline flags on a registered material — side 0=front/1=back/
   * 2=double, blending 0=normal/1=additive, plus transparent +
   * depth-write toggles.
   */
  set_material_flags(
    mat: number,
    side: number,
    blending: number,
    transparent: boolean,
    depthWrite: boolean
  ): void
  /** Additive self-lit tint on a material. */
  set_emissive(mat: number, r: number, g: number, b: number, a: number): void
  /**
   * Base rgba on a material — alpha is the opacity slot for per-frame
   * fade/highlight arms (one uniform-pack row per write).
   */
  set_color(mat: number, r: number, g: number, b: number, a: number): void
  /** Triangle mesh node under `parent` (SCENE3D_NONE = root) → node id. */
  add_mesh(parent: number, geo: number, mat: number): number
  /** Points node → node id. */
  add_points(parent: number, geo: number, mat: number): number
  /** Billboard sprite node → node id. */
  add_sprite(parent: number, mat: number): number
  /** Instanced-mesh node with a fixed instance capacity → node id. */
  add_instanced(parent: number, geo: number, mat: number, capacity: number): number
  /** Transform-only group node → node id. */
  add_group(parent: number): number
  /** LOD switch node → node id (children carry `set_lod_range`s). */
  add_lod(parent: number): number
  /** Distance range at which an LOD child is drawn. */
  set_lod_range(node: number, near: number, far: number): void
  /** Detaches + drops a node subtree. */
  remove(node: number): void
  /** Local-space position write. */
  set_position(node: number, x: number, y: number, z: number): void
  /** Local-space euler rotation write (radians). */
  set_euler(node: number, x: number, y: number, z: number): void
  /** Local-space scale write. */
  set_scale(node: number, x: number, y: number, z: number): void
  /** Orients the node's -Z (or billboard normal) at a world target. */
  node_look_at(node: number, x: number, y: number, z: number): void
  /** Subtree visibility toggle. */
  set_visible(node: number, visible: boolean): void
  /** Layer bitmask write (camera masks cull against it). */
  set_layers(node: number, mask: number): void
  /** Painter-order tiebreak inside a pass. */
  set_render_order(node: number, order: number): void
  /** Opaque f64 user slot (body ids, catalog indices). */
  set_user_data(node: number, data: number): void
  /** Reads the user slot back. */
  user_data(node: number): number
  /** Writes one 16-f32 instance matrix on an instanced node. */
  set_instance(node: number, i: number, m: Float32Array): void
  /** World-space position of a node → [x, y, z]. */
  world_position(node: number): Float32Array
  /** Camera eye position. */
  set_camera(x: number, y: number, z: number): void
  /** Camera look-at target. */
  camera_look_at(x: number, y: number, z: number): void
  /**
   * Orbit rig — target + distance + yaw/pitch; once set, the camera
   * derives its eye each frame from the orbit state (the JS input
   * controller writes these six scalars per gesture).
   */
  set_orbit(tx: number, ty: number, tz: number, distance: number, yaw: number, pitch: number): void
  /** Vertical field of view, degrees. */
  set_fov(deg: number): void
  /** Near/far clip planes. */
  set_clip(near: number, far: number): void
  /** Camera layer mask — culls nodes whose mask doesn't intersect. */
  set_camera_layers(mask: number): void
  /** The single scene point light — position + rgb + intensity. */
  set_light(
    x: number,
    y: number,
    z: number,
    r: number,
    g: number,
    b: number,
    intensity: number
  ): void
  /** Clear color rgba 0-1 (transparent black composites over the page). */
  set_clear(r: number, g: number, b: number, a: number): void
  /** Post-chain amounts — film grain, chromatic aberration, bloom. */
  set_post(film: number, chroma: number, bloom: number): void
  /**
   * One engine tick — `time` is the caller's scene clock in seconds,
   * `dpr` the device pixel ratio for resolution-scaled passes. The
   * caller's rAF loop is the only clock (frame-budget rule).
   */
  frame(time: number, dpr: number): void
  /**
   * Screen→world picking ray → [ox, oy, oz, dx, dy, dz]. Per-pick,
   * never per-frame — JS intersects it against body bounds itself.
   */
  ray_at(sx: number, sy: number, sw: number, sh: number): Float32Array
  /** Drops the surface + every GPU resource it owns. */
  destroy(): void
}

/**
 * The generated wasm-pack glue module shape for the scene3d crate:
 * the async wasm initializer plus the `mount` async constructor that
 * returns the engine handle.
 */
export interface Scene3dModule {
  /** Async initializer returning the wasm exports. */
  default: (input?: RequestInfo) => Promise<unknown>
  /**
   * Engine constructor — binds the canvas to the shared GPUDevice and
   * configures the surface. Sync under the hood (no promises left in
   * wasm init); `await` tolerates the plain return unchanged.
   */
  mount: (
    canvas: HTMLCanvasElement,
    device: GPUDevice,
    w: number,
    h: number
  ) => Promise<Scene3dSurface>
}

/** Live scene handle returned by `mountScene3d`. */
export interface Scene3dHandle {
  /** The canvas the engine draws into (the caller's element). */
  canvas: HTMLCanvasElement
  /** The wasm `Surface3d` — call its flat id-API directly. */
  surface: Scene3dSurface
  /** Disconnects the ResizeObserver + drops the surface. */
  destroy(): void
}

/**
 * Default module loader — dynamic-imports the wasm-pack glue at the
 * registry URL. `@vite-ignore` keeps vite from resolving the
 * build-optional artifact; a 404 rejects and the caller falls back.
 * Injectable for tests.
 * @param url Artifact glue URL.
 */
async function loadModuleDefault(url: string): Promise<Scene3dModule> {
  return (await import(/* @vite-ignore */ url)) as Scene3dModule
}

/**
 * Pushes the canvas's current device-px size into the engine — the
 * same DPR-aware measurement the widget bridge performs, shared by the
 * mount path and the ResizeObserver arm.
 * @param surface The live engine handle.
 * @param canvas The host canvas.
 */
export function resizeScene3d(surface: Scene3dSurface, canvas: HTMLCanvasElement): void {
  const w = Math.max(1, canvas.clientWidth)
  const h = Math.max(1, canvas.clientHeight)
  const dpr = typeof window === TYPE_STRINGS.UNDEFINED ? 1 : window.devicePixelRatio || 1

  surface.resize(Math.max(1, Math.round(w * dpr)), Math.max(1, Math.round(h * dpr)))
}

/**
 * Mounts the scene3d engine on `canvas`: loads the artifact, runs the
 * async mount (adapter + device + configure), wires a ResizeObserver
 * feeding device-px `resize`, and returns the live handle. Resolves
 * null on ANY capability/artifact/init failure — the caller keeps its
 * existing renderer, so mounting can never regress the page.
 * @param canvas The scene's dedicated canvas element.
 * @param loadModule Injectable module loader (tests substitute a stub).
 */
export async function mountScene3d(
  canvas: HTMLCanvasElement,
  loadModule: (url: string) => Promise<Scene3dModule> = loadModuleDefault
): Promise<Scene3dHandle | null> {
  const spec = GPU_WIDGET_ARTIFACTS[GPU_WIDGET_KINDS.SCENE3D]

  if (!spec || !hasWebGpu() || typeof document === TYPE_STRINGS.UNDEFINED) {
    return null
  }

  let mod: Scene3dModule

  try {
    mod = await loadModule(spec.url)
  } catch {
    devWarn('scene3d: artifact unavailable — three.js fallback')
    return null
  }

  try {
    const device = await getSharedGpuDevice()

    // No usable device — the engine would init-trap on the dead
    // handle; three.js keeps rendering instead.
    if (!device) return null

    await mod.default()

    const surface = await mod.mount(
      canvas,
      device,
      Math.max(1, canvas.clientWidth),
      Math.max(1, canvas.clientHeight)
    )

    resizeScene3d(surface, canvas)

    const ro =
      typeof ResizeObserver !== TYPE_STRINGS.UNDEFINED
        ? new ResizeObserver(() => resizeScene3d(surface, canvas))
        : null

    ro?.observe(canvas)

    return {
      canvas,
      surface,
      destroy: () => {
        ro?.disconnect()
        surface.destroy()
      },
    }
  } catch {
    devWarn('scene3d: mount failed — three.js fallback')
    return null
  }
}

/**
 * Decodes `url` through the shared wasm image pipeline (fetch → worker
 * createImageBitmap → GPU texture, zero CPU readback) and uploads it —
 * the texture half of `THREE.TextureLoader.loadAsync`. Resolves the
 * registry texture id, or null when decode/upload fails so the caller
 * falls back to a procedural color (same contract as the engines'
 * missing-texture arm).
 * @param surface The live engine handle.
 * @param url CDN image URL.
 * @param targetW GPU resize-hint width.
 * @param targetH GPU resize-hint height.
 */
export async function loadScene3dTexture(
  surface: Scene3dSurface,
  url: string,
  targetW: number,
  targetH: number
): Promise<number | null> {
  const bitmap = await wasmImageDecoder.decodeImageWASM(url, targetW, targetH)

  if (!bitmap) return null

  try {
    return surface.upload_texture(bitmap, bitmap.width, bitmap.height)
  } catch {
    return null
  }
}
