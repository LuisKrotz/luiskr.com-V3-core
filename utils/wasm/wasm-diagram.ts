/**
 * @file core/utils/wasm/wasm-diagram.ts
 * @description Lazy loader for the `rust/diagram` wasm engine — the
 * local mermaid replacement. The wasm-pack `--target web` glue lives
 * under `/wasm/diagram/` (public dir, immutable-cacheable); its `init()`
 * locates the sibling `.wasm` through `import.meta.url`, so a bare call
 * works once the glue itself loads.
 *
 * Why a separate module: `experiments/docs/mermaid.ts` must stay
 * jest-mockable — dynamic `import(url)` can't be module-mocked, so
 * tests substitute THIS module (`__mocks__/wasm-diagram.js` via the
 * preset mapper) instead of the wasm URL.
 *
 * Contract mirrors `mermaid.render()`: diagram source + theme in,
 * SVG string out — or a thrown error the caller degrades on.
 */

import { ASSET_PATHS } from '@core/tokens/routes/paths.js'

/** wasm-pack glue module URL — resolved lazily, never at import time. */
const GLUE_URL = `${ASSET_PATHS.WASM_DIAGRAM_PREFIX}luiskr_diagram.js`

/**
 * The generated glue's surface — `default` is `init()` and the named
 * export is the renderer from `rust/diagram/src/lib.rs`.
 */
interface DiagramModule {
  /** Instantiates the .wasm next to the glue file. */
  default: (
    input?: RequestInfo | URL | Response | BufferSource | WebAssembly.Module
  ) => Promise<unknown>
  /** source + theme JSON → `<svg>` markup; throws on unsupported input. */
  render_diagram: (source: string, themeJson: string) => string
}

/** Cached engine promise — the ~130KB wasm loads at most once. */
let engine: Promise<DiagramModule> | null = null

/**
 * Default glue loader — dynamic-imports the wasm-pack module from
 * `/wasm/diagram/`. `/* @vite-ignore *` keeps vite from resolving the
 * public-dir URL at build time.
 * @returns The glue module (`default` = init, `render_diagram` = draw).
 */
const loadDiagramModule = async (): Promise<DiagramModule> =>
  (await import(/* @vite-ignore */ GLUE_URL)) as DiagramModule

/**
 * Loads (once) and runs the diagram engine.
 * @param source Raw mermaid source — `flowchart`/`graph`/`sequenceDiagram`.
 * @param themeJson `Theme::from_json` payload — `{font,fontSize,fg,bg,line,accent,surface}`.
 * @param loadModule Injectable glue loader — tests substitute a stub so
 *   the success path runs without a real .wasm artifact.
 * @returns SVG markup string, ready for `innerHTML`.
 * @throws Whatever the engine throws (parse/layout errors, missing artifact,
 *   instantiation failure) — callers restore the source block on rejection.
 */
export const renderDiagram = async (
  source: string,
  themeJson: string,
  loadModule: () => Promise<DiagramModule> = loadDiagramModule
): Promise<string> => {
  // `??=` latches the FIRST attempt's promise — concurrent callers share
  // one download. A rejected load clears the latch so a transient 404
  // doesn't permanently disable diagrams for the session.
  engine ??= loadModule().then(async (mod) => {
    await mod.default()

    return mod
  })

  let mod: DiagramModule

  try {
    mod = await engine
  } catch (err) {
    engine = null

    throw err
  }

  return mod.render_diagram(source, themeJson)
}
