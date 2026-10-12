/**
 * @file tokens/starfield/params.js
 * @description Star-field engine parameters — camera rig, fly-to tween
 * timing, approach thresholds that trigger the lazy dossier fetch, and
 * the procedural material palette used for bodies without real imagery
 * (dwarf planets, exoplanets, stars, nebulae, galaxies). Sole declaration
 * site — consumers import members (zero-hardcoding rule). The parameter
 * bags are split across `./params/*.ts` by domain (camera/scale/bodies/
 * spiral/worker/catalog/scene); this module re-exports them all so
 * existing `@core/tokens/starfield/params.js` imports stay stable.
 */

export { SF_CAMERA, SF_MOTION, SF_APPROACH, SF_ZOOM, SF_KEYS, SF_TIP } from './params/camera.js'
export { SF_SCALE, SF_STRUCTURE } from './params/scale.js'
export { SF_BH, SF_BELT, SF_LOD, SF_DETAIL } from './params/bodies.js'
export { SF_SPIRAL } from './params/spiral.js'
export { SF_WORKER, SF_STAR_CLOUD } from './params/worker.js'
export { SF_BODY_IDS, SF_COLORS } from './params/catalog.js'
export { SF_FALLBACK, SF_SCENE } from './params/scene.js'
