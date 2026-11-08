/**
 * @file glsl.ts
 * @description Shared GLSL chunk library for the canvas widget/loader
 * shaders — the GLSL counterpart of rust/gpu-mini's WGSL library.
 * Every widget fragment/vertex source is composed from these chunks so
 * a fix to a vertex stage, precision preamble, SDF primitive, or hash
 * lands once instead of drifting across seven files. Widget-local
 * helpers stay in their own shaders.ts files.
 *
 * Conventions: chunk strings carry no leading indentation (consumers
 * interpolate them under their own prelude); a trailing newline keeps
 * template composition safe.
 */

/** Fullscreen-triangle vertex stage — `a_pos` clip-space passthrough,
 *  no UV varying (fullscreen widgets sample gl_FragCoord). Minified: the
 *  same bytes every widget already emitted. */
export const GLSL_VS_FULLSCREEN = 'attribute vec2 a_pos;void main(){gl_Position=vec4(a_pos,0.,1.);}'

/** Quad→UV vertex stage — `a_pos` −1..1 → `v_uv` 0..1, unflipped. */
export const GLSL_VS_QUAD_UV = `
  attribute vec2 a_pos;
  varying vec2 v_uv;
  void main() {
    v_uv = (a_pos + 1.0) * 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`

/** Quad→UV vertex stage with vertically flipped UVs — the media-upload
 *  blit inverts Y so DOM-source textures land right-side up. Uses the
 *  `a_position` attribute name the GPUAccelerator binds. */
export const GLSL_VS_QUAD_UV_FLIP = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = vec2(a_position.x * 0.5 + 0.5, 1.0 - (a_position.y * 0.5 + 0.5));
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

/** Fragment-precision auto preamble — highp where the GPU supports
 *  fragment high precision, mediump otherwise (mobile GPUs with coarse
 *  trig precision). */
export const GLSL_FS_PRECISION_AUTO = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif
`

/** Fragment-precision mediump preamble — widgets that never leave the
 *  low-frequency domain (fills, sheens) keep mediump everywhere. */
export const GLSL_FS_PRECISION_MEDIUMP = 'precision mediump float;'

/** Fragment-precision lowp preamble — blit/passthrough shaders only. */
export const GLSL_FS_PRECISION_LOWP = 'precision lowp float;'

/** `GL_OES_standard_derivatives` enable prelude — widgets that compile
 *  an AA/fwidth variant prepend this (and define HAS_DERIV for the
 *  shader's feature branch). */
export const GLSL_DERIV_PRELUDE =
  '#extension GL_OES_standard_derivatives : enable\n#define HAS_DERIV 1\n'

/** Signed distance to a capsule — segment SDF minus radius; the
 *  burger glyph's stroke primitive. */
export const GLSL_SDF_CAPSULE = `
  float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
  }
`

/** Distance to a segment (no radius term) — the slider widgets' track
 *  SDF; same math as lkDistSegment in CLOSE_PAINT_GLSL, which keeps its
 *  own copy under its test-coupled name. */
export const GLSL_SDF_SEGMENT = `
  float distCapsule(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
  }
`

/** Signed distance to a rounded box — centered at the origin, `b` the
 *  half-extent, `r` the corner radius (iq's canonical formula). */
export const GLSL_SDF_ROUND_BOX = `
  float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, vec2(0.0))) - r;
  }
`

/** Sine-hash — deterministic 2D→1D hash on the 127.1/311.7 seed (the
 *  same seed the WGSL library's hash_sin_2d uses, so WebGPU and WebGL
 *  fallbacks scatter identically). */
export const GLSL_HASH_SIN_2D = `
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
`

/** Interpolated value noise over `hash` — smoothstep-weighted bilinear
 *  mix of the four corner hashes (menu-background's fbm octave). */
export const GLSL_VALUE_NOISE = `
  float noise(vec2 p){
    vec2 i=floor(p),f=fract(p);
    f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),
               mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
  }
`
