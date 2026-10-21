/**
 * @file burger-button-shaders.ts
 * @description GLSL sources for BurgerButtonWebGL, extracted from
 * burger-button-webgl.ts — shared quad vertex shader plus the liquid
 * metaball fragment shader (four rounded squares that pool toward the
 * center on hover and morph into the close X on open, theme-aware
 * ink/glow mix).
 */

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

      void main() {
        // Square-normalized centered coords: both axes share the smaller
        // dimension so the 2x2 grid never stretches on a non-square box.
        vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);
        float t = u_time;

        // Rest geometry: a 2x2 grid of rounded squares — cell offset
        // 0.165, half-extent 0.075, corner radius 0.03 → the four dots
        // read as a chunky "grid of apps" glyph inside the round button.
        float cell = 0.165;
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
        vec2 c4 = mix(vec2( cell,  cell) + w4, vec2(0.0), u_hover);

        float k = 0.10;
        float sA = smin(sdRoundBox(p - c1, vec2(sq), cr),
                        sdRoundBox(p - c2, vec2(sq), cr), k);
        float sB = smin(sdRoundBox(p - c3, vec2(sq), cr),
                        sdRoundBox(p - c4, vec2(sq), cr), k);
        float blob = smin(sA, sB, k);

        // Open: the pooled droplet pours into THE close X — the same
        // strokes the menu's close button paints: bars reaching ±0.19
        // of the box (its 21px arm on the 55px disc) at a ~2px hairline
        // thickness (stroke radius 0.018). Interpolating the distance
        // fields (not the pixels) makes the morph read as fluid reshape.
        float open = smoothstep(0.0, 1.0, u_open);
        float reach = mix(0.05, 0.19, open);
        float xr = mix(0.06, 0.018, open);
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

        // The opened icon IS the existing close button — its strokes are
        // white over its own grey disc, so the ink converges to white and
        // the canvas fills in that disc (vec3(0.22,0.23,0.27) is the close
        // button's painted background) behind whatever the X doesn't cover.
        col = mix(col, vec3(1.0), open);

        // Glow stays in the ink's own hue family — a saturated tinted halo
        // produces a chromatic fringe that reads as broken anti-aliasing,
        // so both themes use a desaturated ink tint.
        vec3 glowDark = vec3(0.55, 0.58, 0.65);
        vec3 glowLight = vec3(0.15, 0.15, 0.22);
        vec3 glowCol = mix(glowLight, glowDark, u_dark);

        vec3 finalCol = col * alpha + glowCol * glow;
        float finalAlpha = max(alpha, glow * 0.25);

        float disc = open * (1.0 - smoothstep(0.47, 0.49, length(p)));

        finalCol = mix(finalCol, vec3(0.22, 0.23, 0.27), disc * (1.0 - alpha));
        finalAlpha = max(finalAlpha, disc);

        gl_FragColor = vec4(finalCol, finalAlpha);
      }
    `

/** Full FS source for the current GL capability set. */
export const burgerFsSource = (hasDeriv: boolean): string =>
  (hasDeriv ? BURGER_DERIV_PRELUDE : '') + BURGER_FS_BODY
