# luiskr.com V3 — core

The shared UI/browser platform — the layer every other module builds on. `core`
provides the JSX runtime, the component base class, the reactive store, the router,
the token registries (the vocabulary the zero-hardcoding rule enforces), the i18n
system, the WebGL/canvas widget infrastructure, the WASM worker pool, and every
utility shared by the website, CMS, and experiments.

`core` has no routes and no pages — it is **the platform**. Nothing in `website/`,
`cms/`, or `experiments/` re-implements what lives here.

## Architecture at a glance

```text
tokens/        the vocabulary — every class, event, attribute, string, route, id
Component.ts   base custom element — shadow DOM, scoped ?inline SCSS, lifecycle
jsx.ts         JSX pragma → native DOM (no VDOM, no framework)
store/         tiny reactive state container + mutations
router/        hash-free history router, localized slugs
i18n.ts        locale registry, route slugs, flags
utils/         canvas/WebGL widgets, WASM pool, GPU helpers, data layer, motion
browser/       detection table shared by runtime + build manifest + browser loader
safari/        WebKit-specific patches (isolated, gated)
legacy-polyfills/  guard-gated API shims for ES2022-era engine gaps
```

## Source map

### Root files

| File             | What it does                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Component.ts`   | `BaseComponent` — the base class every custom element extends: shadow root, scoped `?inline` SCSS adoption, reactive state, lifecycle hooks (`onMounted`/`onDestroy`/`onUpdate`), cleanup bookkeeping. |
| `constants.ts`   | Single source of truth for shared constants — the zero-hardcoding rule resolves here. Re-exports the full `tokens/` tree.                                                                              |
| `devlog.ts`      | Diagnostic logger — the only sanctioned logging surface (zero `console.*` rule). Ring buffer on `globalThis`; inspect via `__lkDevLog()`, assert via `getDevLog()`.                                    |
| `firebase.ts`    | Split public-site/CMS Firebase bootstrap — lazy Auth/Database SDK loading so public visitors never pay for the admin surface.                                                                          |
| `i18n.ts`        | Locale registry — supported locales, route slugs, language options, flag metadata.                                                                                                                     |
| `index.ts`       | Barrel — one import surface for the whole platform.                                                                                                                                                    |
| `jsx.ts`         | Native-DOM JSX pragma (`h`, `Fragment`) — props become attributes, properties, listeners, or namespaced SVG per the `tokens/jsx` dictionaries.                                                         |
| `store.ts`       | The reactive store — `getState`/`commit`/`subscribe` with mutation namespaced by the `MUTATIONS` tokens.                                                                                               |
| `types.ts`       | Shared structural types — store shape, translation nodes, route records.                                                                                                                               |
| `utils.ts`       | Utility barrel — re-exports `utils/` helpers.                                                                                                                                                          |
| `vite.config.js` | Library build — emits `core/dist/core.js` (ES module); sibling and npm specifiers stay external.                                                                                                       |

### `browser/` — detection

| File                  | What it does                                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `browser/browsers.ts` | Shared browser-detection table — used by runtime code, the build manifest, and the inline browser loader's feature ladder. |
| `browser/index.ts`    | Barrel for the browser module.                                                                                             |

### `debug/` — dev tooling

| File              | What it does                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `debug/params.ts` | `?debug=` URL parameter parser — every supported debug flag (e.g. `webGLMode:fallback`, `sendNotificationTest`) resolved at boot. |

### `legacy-polyfills/` — guard-gated API shims

Polyfills the browser loader fetches only when a runtime guard reports the
API missing — `fetch`, `IntersectionObserver`, `ResizeObserver`,
`customElements`, `structuredClone`, `Array/String .at`, `Object.hasOwn`,
`inert`, CSS custom properties. The ES2022 floor (iOS 16+) means modern
engines pass every guard and never fetch the files; they exist so the
remaining API-gap edge cases degrade instead of breaking.

### `locale/` — localization runtime

| File                 | What it does                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `locale/fallback.ts` | Baked translation snapshot — the `virtual:i18n-*` build-time data every SWR fetch seeds from, so first paint never waits on Firebase. |
| `locale/index.ts`    | Barrel.                                                                                                                               |
| `locale/slugs.ts`    | Localized route-slug resolution — maps a URL's locale prefix + slug to a route name.                                                  |

### `router/` — client-side routing

| File               | What it does                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `router/index.ts`  | History-API router — localized slug matching, `navigate()`, `onRoute` subscription, lazy route-chunk triggering. |
| `router/routes.ts` | Route table — name → localized path tokens + view-element tag.                                                   |
| `router/types.ts`  | Route record + navigation types.                                                                                 |
| `router/utils.ts`  | Path helpers — slug parsing, locale-prefix stripping.                                                            |

### `safari/` — WebKit patches

| File                           | What it does                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `safari/index.ts`              | Safari patch orchestrator — gated per-feature, applied only on WebKit.                                 |
| `safari/patches/`              | Individual patches — scroll, rendering, media quirks — each one self-contained with its own detection. |
| `safari/patches/media-figure/` | Media-figure-specific fixes (video decode, image swap timing).                                         |

### `store/` — reactive state

| File               | What it does                                                         |
| ------------------ | -------------------------------------------------------------------- |
| `store/index.ts`   | Store factory — `commit`/`subscribe`/`getState`, subscriber cleanup. |
| `store/types.ts`   | State + mutation types.                                              |
| `store/mutations/` | Per-domain mutation modules — app, modal, prefs, route, session.     |

### `tokens/` — the vocabulary

The token tree is the enforcement mechanism behind the zero-hardcoding rule:
every class name, event, attribute, tag, route, string, color hook, and layout
constant is declared **once** here and imported everywhere. Each `tokens/*.ts`
barrel is decomposed into per-domain group objects under `tokens/<domain>/` —
import the group directly for tree-shaking.

| Barrel                 | Domain                                                                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tokens/classes.ts`    | Every CSS class — decomposed under `tokens/classes/` (app, carousel, cms, dialogs, docs, footer, home, media, nav, playground, starfield, states, widgets…) |
| `tokens/attrs.ts`      | DOM attribute names — `data-*`, `aria-*`, `role`, input types — decomposed under `tokens/attrs/`.                                                           |
| `tokens/css.ts`        | CSS custom-property names (`--menu-*`, `--skel-*`, `--genie-*`) + CSS-value tokens.                                                                         |
| `tokens/elements.ts`   | DOM tag names — custom-element tags + native tags.                                                                                                          |
| `tokens/events.ts`     | DOM event names, custom event names, store mutation ids.                                                                                                    |
| `tokens/ids.ts`        | Element ids — mount points, dialog titles, dynamically-created ids.                                                                                         |
| `tokens/layout.ts`     | Spatial tokens — Fibonacci scale, breakpoints, grid padding, masonry table.                                                                                 |
| `tokens/locales.ts`    | The 16 supported locale codes — RTDB keys + URL prefixes.                                                                                                   |
| `tokens/media.ts`      | Media pipeline — CDN filename suffixes, `sizes` strings, dimensions, URLs, cache config.                                                                    |
| `tokens/motion.ts`     | Animation — easings, carousel timing, skeleton field, GPU classifiers, prefetch.                                                                            |
| `tokens/playground.ts` | Earth-playground registries — actions, music URLs, `data-param` keys, textures, `DEFAULT_SP_GUI`.                                                           |
| `tokens/routes.ts`     | Routing — path segments, route names, title prefixes, legacy aliases.                                                                                       |
| `tokens/selectors.ts`  | Composed `querySelector` patterns — derived from the class/tag registries.                                                                                  |
| `tokens/starfield.ts`  | Star-field registries — textures, lazy-data paths, taxonomy, params (see below).                                                                            |
| `tokens/strings.ts`    | Primitive string vocabulary — `typeof` results, MIME types, punctuation, units.                                                                             |
| `tokens/styles.ts`     | `BASE_HOST_STYLES` — the compiled-in sheet injected into every component's shadow root.                                                                     |
| `tokens/theme.ts`      | Theme/preference tokens — dark/light/system, reduced-motion, switch ids, arrow directions.                                                                  |
| `tokens/data.ts`       | Data-layer tokens — storage keys, CMS node paths, UI copy keys, WASM actions, notify levels.                                                                |

#### `tokens/starfield/params/` — the star-field tuning surface

| File                | What it does                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `params.ts`         | Engine parameters barrel — camera rig, fly-to timing, approach thresholds, procedural palette. |
| `params/bodies.ts`  | Per-body tuning — Sgr A* composite, belts, LOD radii, photo-masks, halos, coronae.             |
| `params/camera.ts`  | Camera rig + navigation — FOV, far/near, tween, idle drift, orbit bounds.                      |
| `params/catalog.ts` | Catalog-facing params — body ids, procedural material palette (spectral tints, greys, hues).   |
| `params/post.ts`    | Post chain — bloom/vignette/grain RenderPipeline tuning.                                       |
| `params/scale.ts`   | Astronomical scale — three-tier distance compression, Milky Way disc, solar shrink.            |
| `params/scene.ts`   | Scene shells + 2D fallback field tuning.                                                       |
| `params/spiral.ts`  | Spiral-galaxy point-cloud params — golden-ratio arms, pitch, knots, dust.                      |
| `params/weather.ts` | Living-planet params — cloud field, jet streams, ITCZ, hurricanes, aurorae, solar wind.        |
| `params/worker.ts`  | Worker-dispatch + deep-field layer tuning — packed HYG/Hipparcos format.                       |

### `utils/` — the utility belt

| File                      | What it does                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| `utils/index.ts`          | Barrel for the shared utilities.                                                                         |
| `utils/aspect.ts`         | Aspect-ratio math — keeps media boxes proportional for skeletons/placeholders.                           |
| `utils/dom.ts`            | Shadow-piercing DOM queries + SVG placeholder helper — app code can reach inside component shadow trees. |
| `utils/notify.ts`         | Notification service — native Notification when allowed, `<site-toast>` pill as guaranteed fallback.     |
| `utils/schema.ts`         | JSON-LD builders (Organization, WebSite, ItemList, Article, VideoObject) + `updateJsonLd()`.             |
| `utils/service-worker.ts` | Stale service-worker eviction — shared by every bundle entry.                                            |
| `utils/string.ts`         | Pure string transforms — HTML stripping, slug/case helpers.                                              |
| `utils/media.ts`          | Media-URL builders — the single place the CDN filename grammar is assembled.                             |

#### `utils/canvas/` — the WebGL widget infrastructure

Every animated canvas widget on the site — flag, burger, sliders, skeleton,
menu background, close buttons — runs through this shared pipeline: one GL
context-pool manager, shared program boilerplate, context-loss plumbing, and a
single `webglAllowed()` choke point (which `?debug=webGLMode:fallback` flips).

| File                     | What it does                                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `canvas/css-color.ts`    | CSS-color parser → 0–1 RGB triples for shader uniforms.                                                                          |
| `canvas/dom-font.ts`     | DOM-faithful `ctx.font` builder for text re-rasterization.                                                                       |
| `canvas/gl-lifecycle.ts` | Context-loss + release plumbing — never `preventDefault` a loss, always `loseContext()` on destroy.                              |
| `canvas/gl-program.ts`   | Shared quad-shader boilerplate — compile, link, upload, blend.                                                                   |
| `canvas/webgl-mode.ts`   | `webglAllowed()`/`webglContext()` — the single WebGL choke point; `?debug=webGLMode:fallback` forces every path to CSS/2D.       |
| `canvas/webgl-pool.ts`   | Lifecycle pool for shared GL contexts — IntersectionObserver purges offscreen contexts, restores on re-entry (browsers cap ~16). |

#### `utils/canvas/loaders/` — visual loading states

| File                               | What it does                                                                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `loaders/intro-loader.ts`          | Boot overlay — glow veil + ring + percent + brand, honors reduced motion.                                                     |
| `loaders/menu-background-webgl.ts` | Nav-menu fullscreen FBM contour field (Iris van Herpen–inspired isolines), theme-aware ink, CSS moiré fallback.               |
| `loaders/skeleton-webgl.ts`        | WebGL skeleton shimmer — pooled renderer draws organic shimmer over placeholder geometry; CSS fallback on software renderers. |

#### `utils/canvas/widgets/` — the WebGL UI widgets

| File                             | What it does                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| `widgets/burger-button-webgl.ts` | Animated hamburger icon — three waving rounded bars, CSS fallback button.                  |
| `widgets/carousel-controls.ts`   | Carousel arrow — circular progress ring + arrow morph, play/pause variant, pooled.         |
| `widgets/close-button.ts`        | Animated X button — liquid-fill close, Canvas2D fallback, facade over `close-button/`.     |
| `widgets/flag-webgl.ts`          | Waving-flag renderer — per-locale flags as animated shader (split/hybrid flags supported). |
| `widgets/switch-slider.ts`       | Toggle switch — SDF pill + knob, spring easing, 2D fallback.                               |
| `widgets/theme-slider.ts`        | Three-position theme slider — sun→monitor→moon morph, drag + tap + keyboard.               |

Each widget's heavy internals live under `widgets/<name>/` — shaders, init,
render loop, fallback painters, theme sampling.

#### `utils/data/` — the data layer

| File                  | What it does                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `data/db.ts`          | SWR-style data layer over Firebase RTDB — translation nodes resolve instantly from the baked snapshot, then silently revalidate live. |
| `data/legal-links.ts` | Builds the bundled legal link list per locale (shared by footer + awards).                                                            |
| `data/sanitize.ts`    | Dependency-free HTML sanitizer — DOMParser + allowlist walk; protects CMS/i18n HTML.                                                  |

#### `utils/gpu/` — GPU helpers

| File                       | What it does                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `gpu/gpu-accel.ts`         | Lazily-created offscreen WebGL2 pipeline for media uploads + compositor promotion. |
| `gpu/gpu-accel-shaders.ts` | The passthrough blit shader.                                                       |
| `gpu/gpu-info.ts`          | GPU capability probe — renderer string classification, `powerPreference` hints.    |
| `gpu/npu-predict.ts`       | Hardware-tiered prefetch predictor — WebNN NPU → WebGL → WASM fallback.            |

#### `utils/motion/` — motion + transitions

| File                     | What it does                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| `motion/genie.ts`        | "Genie" dialog transition — dialog scales from its trigger via `--genie-x/y`, zooms back on close. |
| `motion/route-warmer.ts` | Post-load route-chunk warming — idle-imports each route bundle so navigation is instant.           |
| `motion/scroll-state.ts` | Global scrolling flag + `onScrollStop()` — defers expensive work until scroll settles.             |

#### `utils/perf/` — stats

| File                                          | What it does                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| `perf/stats-engine.ts`                        | Live metrics collector for the stats HUD — FPS, network, longtask CPU, heap, latency. |
| `perf/stats/flush.ts`, `fps.ts`, `network.ts` | The per-domain samplers.                                                              |

#### `utils/wasm/` — the WASM worker pool

Batch CPU work (layout math, hashing, image decode, easing curves) routes through
a lazily-spawned pool of `wasm-worker.js` Web Workers — zero-copy transfers where
possible, structuredClone otherwise, JS fallback everywhere.

| File                         | What it does                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| `wasm/wasm-pool.ts`          | Round-robin dispatcher over the worker pool — transferables auto-detected, `null` on every failure path. |
| `wasm/wasm-css.ts`           | Dynamic CSS injector — owns the `<style id="wasm-dynamic-css">` node.                                    |
| `wasm/wasm-image-decoder.ts` | Image decode → `createImageBitmap` → GPU upload pipeline.                                                |
| `wasm/wasm-layout.ts`        | Layout/animation math with WASM fast path + identical JS fallback.                                       |
| `wasm/wasm-media-threads.ts` | Off-main-thread media pipeline — decode, probe, prefetch, byte-range fetch.                              |
| `wasm/wasm-scroll.ts`        | rAF smooth scroller using the WASM ease curve.                                                           |

## Commands

```bash
yarn dev      # module dev server (library mode)
yarn test     # jest suite for core
yarn build    # emits core/dist/core.js
```

The root `yarn dev` mounts this module through the app shell; a standalone
`yarn dev` here runs only the library entry.

---

Submodule of [luiskr.com-V3](https://github.com/LuisKrotz/luiskr.com-V3). Install
deps from the superproject (`yarn install` at the root), then run `yarn dev` /
`yarn test` / `yarn build` in this folder — see `package.json` scripts.

License: [MPL-2.0](https://github.com/LuisKrotz/luiskr.com-V3/blob/development/LICENSE)
