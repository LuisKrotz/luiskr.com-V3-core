/**
 * @file burger-button-shaders.ts
 * @description GLSL sources for BurgerButtonWebGL, extracted from
 * burger-button-webgl.ts — shared quad vertex shader plus the liquid
 * metaball fragment shader (four rounded squares that pool toward the
 * center on hover and morph into THE close button on open — same disc,
 * water fill, rotating X and click shockwave, painted by the shared
 * CLOSE_PAINT_GLSL library so both controls can never drift apart).
 */

import { CLOSE_PAINT_GLSL } from '../close-button/shaders.js'

/** Extension prelude enabling pixel-space SDF AA (WebGL1 only). */
export const BURGER_DERIV_PRELUDE =
  '#extension GL_OES_standard_derivatives : enable\n#define HAS_DERIV 1\n'

/** Shared fullscreen-quad vertex shader. */
export const BURGER_VS = 'attribute vec2 a_pos;void main(){gl_Position=vec4(a_pos,0.,1.);}'

/** Liquid menu-icon fragment shader body (prefix with the deriv prelude). */
export const BURGER_FS_BODY = `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      uniform float u_time;
      uniform vec2 u_res;
      uniform float u_dark;
      uniform float u_hover;
      uniform float u_open;
      // Close-state channels — identical in meaning to CloseButtonWebGL:
      // u_liquid is the turquoise pour level, u_rot the X's half-turn on
      // hover, u_click_time the last press timestamp (shockwave window).
      uniform float u_liquid;
      uniform float u_rot;
      uniform float u_click_time;
      // High-contrast flag (0/1) — when set, every shade the icon paints
      // collapses to the two poles (pure black / pure white) so the glyph
      // survives --border-color going pitch black or pure white. u_dark
      // then carries the DISC's pole (1 = dark disc → light ink).
      uniform float u_hc;
      // Backing-store supersample factor: the buffer is CSS px × DPR ×
      // u_ss — dividing by it converts buffer px into "close px" so the
      // shared paint library sees the same pixel basis as the real
      // close button (radius, stroke widths, bubbles all authored there).
      uniform float u_ss;

      float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
        vec2 pa = p - a, ba = b - a;
        float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        return length(pa - ba * h) - r;
      }

      float sdRoundBox(vec2 p, vec2 b, float r) {
        vec2 q = abs(p) - b + r;
        return min(max(q.x, q.y), 0.0) + length(max(q, vec2(0.0))) - r;
      }

      // Polynomial smooth-min — the liquid merge: two approaching SDFs
      // blend across a k-wide band instead of meeting at a hard union
      // seam, which is what makes the squares pool like droplets.
      float smin(float a, float b, float k) {
        float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
        return mix(b, a, h) - k * h * (1.0 - h);
      }

      ${CLOSE_PAINT_GLSL}

      void main() {
        // Square-normalized centered coords: both axes share the smaller
        // dimension so the 2x2 grid never stretches on a non-square box.
        float minRes = min(u_res.x, u_res.y);
        vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / minRes;
        float t = u_time;

        // "Close px" basis — the pixel space the close-button paint
        // library is authored in (buffer px ÷ supersample). All
        // pixel-derived constants (disc edge, X reach, stroke width)
        // are computed from it so the open state matches a real close
        // button at ANY disc size, not just the one it was tuned on.
        float closeRes = minRes / u_ss;
        vec2 pClose = p * closeRes;

        // Rest geometry: a 2x2 grid of rounded squares — cell offset
        // 0.145 (≈5px on the 34px disc, matching the CSS fallback's
        // --space-sm corner offsets), half-extent 0.075 (≈5px squares),
        // corner radius 0.03 → a chunky "grid of apps" glyph.
        float cell = 0.145;
        float sq = 0.075;
        float cr = 0.03;

        // Organic drift: every square wanders a few mils on its own
        // phase (the "water" idle — liquid never sits perfectly still).
        // calm damps the drift as the pieces converge so the pooled
        // blob settles instead of twitching.
        float calm = 1.0 - 0.72 * max(u_hover, u_open);

        vec2 w1 = vec2(sin(t * 0.90),        cos(t * 0.72))        * 0.009 * calm;
        vec2 w2 = vec2(sin(t * 0.72 + 1.7),  cos(t * 0.88 + 0.6))  * 0.009 * calm;
        vec2 w3 = vec2(sin(t * 0.82 + 3.1),  cos(t * 0.64 + 2.2))  * 0.009 * calm;
        vec2 w4 = vec2(sin(t * 0.66 + 4.4),  cos(t * 0.80 + 3.7))  * 0.009 * calm;

        // Hover: each square migrates toward the center — the smin field
        // welds them into one droplet as the gaps close.
        vec2 c1 = mix(vec2(-cell,  cell) + w1, vec2(0.0), u_hover);
        vec2 c2 = mix(vec2( cell,  cell) + w2, vec2(0.0), u_hover);
        vec2 c3 = mix(vec2(-cell, -cell) + w3, vec2(0.0), u_hover);
        vec2 c4 = mix(vec2( cell, -cell) + w4, vec2(0.0), u_hover);

        float k = 0.10;
        float sA = smin(sdRoundBox(p - c1, vec2(sq), cr),
                        sdRoundBox(p - c2, vec2(sq), cr), k);
        float sB = smin(sdRoundBox(p - c3, vec2(sq), cr),
                        sdRoundBox(p - c4, vec2(sq), cr), k);
        float blob = smin(sA, sB, k);

        // Open: the pooled droplet pours into THE close X — the same
        // strokes every close button paints: halfLen = radius*0.38 of
        // the disc (in close px, (0.5 - 1/closeRes) * 0.38 normalized),
        // its stroke a ~1.3px hairline (1.3/closeRes). Interpolating
        // the distance fields (not the pixels) makes the morph read as
        // fluid reshape.
        float open = smoothstep(0.0, 1.0, u_open);
        float reach = mix(0.05, (0.5 - 1.0 / closeRes) * 0.38, open);
        float xr = mix(0.06, 1.3 / closeRes, open);
        float xa = sdCapsule(p, -vec2(reach), vec2(reach), xr);
        float xb = sdCapsule(p, vec2(-reach, reach), vec2(reach, -reach), xr);
        float xShape = min(xa, xb);

        float icon = mix(blob, xShape, open);

        // Anti-aliased edge: with derivatives, convert the SDF distance to
        // pixel distance so the edge falloff spans ~2.2px — deliberately
        // wider than a standard 1px band; on the x4-supersampled buffer
        // this yields a very soft, heavily anti-aliased edge after the
        // CSS downsample adds a second smoothing pass.
        #ifdef HAS_DERIV
        float px = max(fwidth(icon), 1e-4);
        float alpha = 1.0 - smoothstep(-px * 1.1, px * 1.1, icon);
        float glow = (1.0 - smoothstep(0.0, px * 5.5, icon)) * 0.2;
        #else
        float alpha = smoothstep(0.02, 0.0, icon);
        float glow = smoothstep(0.06, 0.0, icon) * 0.2;
        #endif

        // Barely-there breathing: ±2% luminance over ~12s. A stronger pulse
        // reads as brightness flicker — the eye interprets it as the AA
        // edge shimmering, not as intentional motion.
        float pulse = 0.98 + 0.02 * sin(t * 0.5);

        // Color based on theme:
        // Dark theme: crisp bright white/ice
        // Light theme: dark slate/charcoal (never invisible white on light background!)
        vec3 colDark = vec3(0.95, 0.97, 1.0) * pulse;
        vec3 colLight = vec3(0.10, 0.10, 0.14) * pulse;
        vec3 col = mix(colLight, colDark, u_dark);

        // HC: the themed slates are shades — the ink snaps to the pole
        // opposite the disc (u_dark=1 means a dark disc → pure white ink).
        col = mix(col, vec3(u_dark), u_hc);

        // The opened icon IS the existing close button — its strokes paint
        // in the ink pole (white normally; under HC, u_dark on the black
        // disc / black on the white disc) and the canvas fills in that
        // disc (vec3(0.22,0.23,0.27) is the close button's painted
        // background; the shared lkClosePaint below owns the final disc
        // edge/borderAA fade).
        vec3 openInk = mix(vec3(1.0), vec3(u_dark), u_hc);
        col = mix(col, openInk, open);

        // Glow stays in the ink's own hue family — a saturated tinted halo
        // produces a chromatic fringe that reads as broken anti-aliasing,
        // so both themes use a desaturated ink tint. Under HC the halo is
        // a shade and dies entirely.
        vec3 glowDark = vec3(0.55, 0.58, 0.65);
        vec3 glowLight = vec3(0.15, 0.15, 0.22);
        vec3 glowCol = mix(glowLight, glowDark, u_dark);
        glow *= 1.0 - u_hc;

        vec3 finalCol = col * alpha + glowCol * glow;
        float finalAlpha = max(alpha, glow * 0.25);

        // The opened disc edge matches the close button's: radius is
        // (min-center − 1px) with a 1px borderAA fade — in normalized
        // coords, 0.5 − 1/closeRes and 0.5 − 2/closeRes. Under HC the disc
        // snaps to its pole (1.0 − u_dark).
        float disc = open * (1.0 - smoothstep(0.5 - 2.0 / closeRes, 0.5 - 1.0 / closeRes, length(p)));

        finalCol = mix(finalCol, mix(vec3(0.22, 0.23, 0.27), vec3(1.0 - u_dark), u_hc), disc * (1.0 - alpha));
        finalAlpha = max(finalAlpha, disc);

        // Fully opened, this IS a CloseButtonWebGL: the shared paint
        // library draws the disc, the turquoise liquid pour with foam
        // crest and bubbles, the rotating X, and the click shockwave —
        // identical to the standalone close widget (u_draw = 1: the
        // metaball morph above already delivered the draw-in). Mixing
        // by open crossfades the morph into the real close paint.
        vec4 closePx = lkClosePaint(
          pClose, closeRes, u_time, u_liquid, 1.0, u_rot, u_click_time,
          u_hc, u_dark
        );

        finalCol = mix(finalCol, closePx.rgb, open * closePx.a);
        finalAlpha = mix(finalAlpha, closePx.a, open);

        gl_FragColor = vec4(finalCol, finalAlpha);
      }
    `

/** Full FS source for the current GL capability set. */
export const burgerFsSource = (hasDeriv: boolean): string =>
  (hasDeriv ? BURGER_DERIV_PRELUDE : '') + BURGER_FS_BODY
