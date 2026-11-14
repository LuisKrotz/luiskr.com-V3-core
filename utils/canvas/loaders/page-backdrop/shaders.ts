/**
 * @file page-backdrop-shaders.ts
 * @description GLSL sources for PageBackdropWebGL — the grained lobe
 * field rendered behind every route. The fragment stage evaluates
 * twelve overlapping elliptical colour lobes plus a right-side key
 * light and a lower-left counter-shade in 32-bit float, composites them
 * over the theme's base surface, and ONLY THEN quantizes to 8-bit
 * through a per-pixel, per-frame white-noise grain. That
 * ordering is the whole point: CSS gradients are rasterized straight to
 * 8-bit, so a 1–2% alpha ramp across hundreds of pixels lands as
 * one-level staircases whose risers read as thin lines (worse at 2×
 * DPR, where every step is twice as long). Grain before the round
 * spreads each riser into sub-threshold noise — the field is band-free
 * at any resolution, and the same noise doubles as the fine stock
 * texture both themes carry.
 */

import { GLSL_FS_PRECISION_AUTO, GLSL_VS_FULLSCREEN } from '@core/utils/canvas/glsl.js'
import { PAGE_BACKDROP } from '@core/tokens/motion/page-backdrop.js'

/** Shared fullscreen-quad vertex shader. */
export const PAGE_BACKDROP_VS = GLSL_VS_FULLSCREEN

/** Number of field hue slots in `u_col` — matches FIELD_CSS_PROP_LIST. */
export const PAGE_BACKDROP_COLOR_SLOTS = 7

/**
 * Angular frequency (rad/s) for a drift period in seconds, emitted as a
 * GLSL float literal — the three layer periods come from the motion
 * tokens so the shader and any docs agree on the cycle lengths.
 * @param period - drift period in seconds
 * @returns `2π / period` formatted with a decimal point for GLSL
 */
const omega = (period: number): string => ((2 * Math.PI) / period).toFixed(6)

/**
 * Lobe-field fragment shader.
 *
 * Coordinates: `uv` is 0..1 across the canvas with y DOWN (CSS
 * convention) because every lobe centre/radius below was authored as a
 * CSS `radial-gradient(ellipse W H at X Y)` on a 150%-oversized layer;
 * the constants are those values mapped into viewport space
 * (`c·1.5 − 0.25`, `r·1.5·0.85`) so the GL field matches the approved
 * CSS composition pixel-for-pixel in layout, minus the banding.
 *
 * Falloff: `k = 1 − d²` (d = normalized elliptical distance) is C¹ at
 * the rim; raising it to the 8th power zeroes slope and curvature there
 * (the field is C² everywhere — no derivative break exists for a Mach
 * band to form on) AND reproduces the authored CSS taper: relative
 * alpha ≈ 0.79 / 0.37 / 0.14 / 0.05 at d = 0.17 / 0.34 / 0.47 / 0.56
 * against the CSS stops' 0.62 / 0.34 / 0.21 / 0.10 — same visual weight,
 * continuous derivative.
 *
 * Drift: each of the three layers wanders on a slow Lissajous path —
 * sinusoids are smooth and the periods (16/21/27 s, pairwise coprime)
 * never phase-lock, so the pose sequence never visibly repeats.
 * Amplitudes (±0.12 / ±0.08 viewport) match the former CSS keyframes'
 * ±9%/6% travel of a 150% layer.
 *
 * Key light: a specular pool parked off the RIGHT edge (u_key, white in
 * both themes) drifting on its own 23s coprime period with a slow
 * luminance pulse — the animated studio light the section stages used
 * to fake in CSS. The counter-shade (u_shade, the ink pole) pools the
 * lower-left, so the field carries the same key-lit composition as the
 * fallback ramps — in float.
 *
 * Grain: a sine-free per-pixel hash (Hoskins hash13) — uniform white
 * noise with no spatial lattice, so the grain reads as film speckle and
 * can never stripe the way a regular dither matrix (IGN, Bayer) does
 * on a near-black field. Two decorrelated taps sum to a triangular
 * distribution — soft grain, no salt-and-pepper extremes — and the
 * golden-ratio stride keeps it temporally decorrelated so the eye
 * integrates past 8-bit. Amplitude is PAGE_BACKDROP.GRAIN_LSB plus a
 * luminance-proportional lift (GRAIN_LUM_LSB): the triangular tail
 * clears the ±1 LSB TPDF floor that dithers every 8-bit boundary, and
 * the luminance term keeps the speckle equally visible on the bright
 * paper field — very fine stock grain on both themes, never lines.
 */
export const PAGE_BACKDROP_FS = `
  ${GLSL_FS_PRECISION_AUTO}
  uniform float u_time;
  uniform vec2 u_res;
  uniform vec3 u_base;
  uniform vec3 u_col[${PAGE_BACKDROP_COLOR_SLOTS}];
  uniform float u_gain;
  uniform vec4 u_key;
  uniform vec4 u_shade;

  float lobe(vec2 uv, vec2 c, vec2 r) {
    vec2 q = (uv - c) / r;
    float k = clamp(1.0 - dot(q, q), 0.0, 1.0);
    float k2 = k * k;
    float k4 = k2 * k2;
    return k4 * k4;
  }

  // Hoskins hash13 — sine-free white-noise hash, precision-safe in
  // mediump (no large-arg sin, no integer ops). Uniform per pixel with
  // no lattice the eye can catch.
  float hash13(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_res;
    uv.y = 1.0 - uv.y;

    float t = u_time;
    vec2 o1 = vec2(0.12 * sin(t * ${omega(PAGE_BACKDROP.PERIOD_1)}),
                   0.08 * cos(t * ${omega(PAGE_BACKDROP.PERIOD_1)} * 0.73));
    vec2 o2 = vec2(-0.11 * sin(t * ${omega(PAGE_BACKDROP.PERIOD_2)} + 1.3),
                   0.07 * sin(t * ${omega(PAGE_BACKDROP.PERIOD_2)} * 0.81));
    vec2 o3 = vec2(0.09 * cos(t * ${omega(PAGE_BACKDROP.PERIOD_3)} * 0.67),
                   -0.06 * sin(t * ${omega(PAGE_BACKDROP.PERIOD_3)} + 2.1));
    // Key-light wander — smaller amplitude: the specular pool grazes the
    // right edge rather than roaming the field (a roaming key reads as a
    // wandering spotlight, a grazing one reads as a studio softbox).
    vec2 o4 = vec2(0.05 * sin(t * ${omega(PAGE_BACKDROP.PERIOD_KEY)} + 0.6),
                   0.09 * sin(t * ${omega(PAGE_BACKDROP.PERIOD_KEY)} * 0.77));
    // Slow luminance pulse — the key breathes ±14% over the same period
    // (offset phase) so the right edge visibly lives.
    float keyPulse = 0.86 + 0.14 * sin(t * ${omega(PAGE_BACKDROP.PERIOD_KEY)} * 1.7 + 1.9);

    float g = u_gain;
    vec3 col = u_base;

    // Layer 1 — emerald family (green core top-left, azure top-right,
    // teal low-left, violet low-right).
    col = mix(col, u_col[0], g * 0.29 * lobe(uv, vec2(-0.04, -0.13) + o1, vec2(1.22, 0.99)));
    col = mix(col, u_col[2], g * 0.22 * lobe(uv, vec2(1.01, -0.10) + o1, vec2(1.07, 0.87)));
    col = mix(col, u_col[1], g * 0.23 * lobe(uv, vec2(-0.13, 1.04) + o1, vec2(1.03, 0.91)));
    col = mix(col, u_col[3], g * 0.20 * lobe(uv, vec2(1.07, 1.01) + o1, vec2(0.91, 0.75)));

    // Layer 2 — violet/magenta fringe zone with an emerald counter-lobe.
    col = mix(col, u_col[4], g * 0.18 * lobe(uv, vec2(0.50, 1.22) + o2, vec2(1.19, 0.83)));
    col = mix(col, u_col[5], g * 0.16 * lobe(uv, vec2(0.80, -0.01) + o2, vec2(0.83, 0.64)));
    col = mix(col, u_col[4], g * 0.14 * lobe(uv, vec2(-0.19, 0.56) + o2, vec2(0.71, 0.83)));
    col = mix(col, u_col[6], g * 0.14 * lobe(uv, vec2(1.13, 0.59) + o2, vec2(0.75, 0.64)));
    col = mix(col, u_col[0], g * 0.20 * lobe(uv, vec2(0.38, 0.71) + o2, vec2(0.94, 0.71)));

    // Layer 3 — faint counter-drifting colour veil.
    col = mix(col, u_col[0], g * 0.14 * lobe(uv, vec2(0.80, 0.65) + o3, vec2(1.15, 0.87)));
    col = mix(col, u_col[2], g * 0.12 * lobe(uv, vec2(0.17, 0.23) + o3, vec2(0.94, 0.75)));
    col = mix(col, u_col[3], g * 0.11 * lobe(uv, vec2(0.65, 0.08) + o3, vec2(0.83, 0.71)));

    // Key light — specular pool grazing in from the right edge. The lobe
    // is wider than tall so it spreads as a vertical light curtain.
    col = mix(col, u_key.rgb,
              u_key.a * keyPulse * lobe(uv, vec2(1.06, 0.38) + o4, vec2(0.62, 0.78)));
    // Counter-shade — the dark pool the key throws on the lower-left.
    col = mix(col, u_shade.rgb,
              u_shade.a * lobe(uv, vec2(-0.10, 1.12) + o2 * 0.5, vec2(0.85, 0.62)));

    // Grain — two decorrelated hash taps averaged into a triangular
    // distribution (TPDF): the speckle stays unstructured (no matrix
    // lines) while the soft peak keeps it fine rather than gritty.
    // The tail must clear ±1 LSB or an 8-bit boundary survives as a
    // contour line — GRAIN_LSB is set past that floor. A luminance
    // term lifts the amplitude on the bright paper field where an
    // absolute step carries less contrast, so both themes show the
    // same very-fine stock grain.
    float fr = mod(floor(u_time * 60.0), 64.0);
    vec3 seed = vec3(gl_FragCoord.xy + fr * 5.588238, fr * 0.618034);
    float n = (hash13(seed) + hash13(seed + 19.19)) * 0.5 - 0.5;
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col += n * (${PAGE_BACKDROP.GRAIN_LSB.toFixed(4)} + lum * ${PAGE_BACKDROP.GRAIN_LUM_LSB.toFixed(4)}) / 255.0;

    gl_FragColor = vec4(col, 1.0);
  }
`
