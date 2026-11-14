/**
 * @file close-button-shaders.ts
 * @description GLSL sources for CloseButtonWebGL, extracted from
 * close-button.ts — vertex stage and precision preamble come from the
 * shared canvas/glsl library; paint colors come from CANVAS_PAINT_GLSL
 * (tokens/canvas/paint.ts). lkDistSegment/lkClosePaint keep their `lk`
 * names — burger-liquid-tails tests assert on them.
 */

import { GLSL_VS_QUAD_UV, GLSL_FS_PRECISION_AUTO } from '@core/utils/canvas/glsl.js'
import { CANVAS_PAINT_GLSL as PAINT } from '@core/tokens/canvas/paint.js'

/** Fullscreen quad vertex shader — passes a_pos through as v_uv 0..1. */
export const CLOSE_BUTTON_VS = GLSL_VS_QUAD_UV

/**
 * GLSL helper library for the close-button look — shared between
 * CLOSE_BUTTON_FS (the dedicated close widget) and the burger's open
 * state, which morphs into this exact control and must paint it
 * pixel-identically (turquoise pour, foam crest, rising bubbles, inset
 * rim, rotating X strokes, click shockwave).
 *
 * `lkClosePaint` works in "close pixels": the same pixel basis the
 * close widget's backing store uses (CSS box × capped DPR). Callers on
 * supersampled buffers divide fragcoord/res by their supersample factor
 * before calling so one unit here is always one close-widget pixel.
 *
 * @param pRel Fragment position relative to the disc center, in close px.
 * @param minRes Shorter canvas dimension in close px — derives the disc
 *   radius (`minRes/2 - 1`) exactly like the standalone close shader.
 * @param hc High-contrast flag (0/1) — when set, every shade collapses to
 *   the two poles so the control survives `--border-color` going pitch
 *   black / pure white.
 * @param dark Disc-pole flag under HC (0/1): 1 = the chip disc paints at
 *   the DARK pole (black disc, white ink), 0 = white disc, black ink.
 *   Ignored when `hc` is 0.
 * @returns vec4 — premultiplied=false rgba; alpha is the disc's borderAA
 *   mask (0 outside the disc edge — no discard inside, so callers can
 *   composite other layers around the disc).
 */
export const CLOSE_PAINT_GLSL = `
        float lkDistSegment(vec2 p, vec2 a, vec2 b) {
          vec2 pa = p - a;
          vec2 ba = b - a;
          float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
          return length(pa - ba * h);
        }

        vec4 lkClosePaint(vec2 pRel, float minRes, float u_time, float u_liquid, float u_draw, float u_rot, float u_click_time, float u_hc, float u_dark) {
          float radius = minRes * 0.5 - 1.0;
          float d = length(pRel);
          float borderAA = 1.0 - smoothstep(radius - 1.0, radius, d);

          // Neutral background — under HC the disc snaps to its pole:
          // pitch black when the disc pole is dark (u_dark=1), pure white
          // otherwise, so the chip stays one solid pole of the pair.
          vec3 baseBg = mix(${PAINT.DISC_BG}, vec3(1.0 - u_dark), u_hc);
          vec3 col = baseBg;

          // Ink pole — opposite of the disc under HC (white ink on a black
          // disc, black ink on a white disc); the plain white strokes the
          // normal path paints when u_hc is 0.
          vec3 inkPole = vec3(u_dark);

          // Slower liquid wave filling from bottom
          float targetY = (u_liquid * 2.2 - 1.1) * radius;
          float wave = sin(pRel.x * 0.28 + u_time * 4.0) * 1.6 * min(u_liquid * 2.5, 1.0)
                     + cos(pRel.x * 0.45 - u_time * 2.8) * 1.0 * min(u_liquid * 2.5, 1.0);
          float surfaceY = targetY + wave;

          if (pRel.y <= surfaceY && u_liquid > 0.01) {
            float depth = clamp((surfaceY - pRel.y) / (radius * 2.0), 0.0, 1.0);
            vec3 deepSilver = ${PAINT.SILVER_DEEP};
            vec3 topSilver  = ${PAINT.SILVER_TOP};
            vec3 liquidColor = mix(topSilver, deepSilver, depth);

            // HC: the pour becomes a flat ink-pole flood — the silver
            // ramp and its crest/bubble highlights are decorative shades.
            liquidColor = mix(liquidColor, inkPole, u_hc);

            // Glowing foam crest
            float crestDist = abs(pRel.y - surfaceY);
            float crest = 1.0 - smoothstep(0.0, 2.0, crestDist);
            liquidColor += ${PAINT.FOAM_CREST} * crest * 0.75 * (1.0 - u_hc);

            // Procedural rising bubbles inside liquid
            for (int i = 0; i < 4; i++) {
              float fi = float(i);
              float bSpeed = 12.0 + fi * 4.0;
              float bX = -8.0 + fi * 5.5 + sin(u_time * 2.5 + fi * 1.7) * 2.5;
              float bY = mod(u_time * bSpeed + fi * 9.0, radius * 2.2) - radius;
              vec2 bPos = vec2(bX, bY);
              float bRad = 1.2 + mod(fi, 2.0) * 0.7;

              if (bY <= surfaceY && bY > -radius) {
                float dBubble = length(pRel - bPos);
                float bRing = (1.0 - smoothstep(bRad - 0.4, bRad + 0.4, dBubble)) * smoothstep(bRad - 1.2, bRad - 0.3, dBubble);
                float bSpot = 1.0 - smoothstep(0.0, 0.6, length(pRel - (bPos + vec2(0.4, 0.4))));
                liquidColor += ${PAINT.BUBBLE_HI} * (bRing * 0.55 + bSpot * 0.75) * (1.0 - u_hc);
              }
            }

            col = mix(col, liquidColor, borderAA);
          }

          // Inset rim shadow — suppressed under HC (a shade of the disc
          // pole would soften the silhouette edge).
          float rim = smoothstep(radius - 3.0, radius, d);
          col = mix(col, col * 0.7, rim * 0.35 * (1.0 - u_hc));

          // Rotating X lines (auto-drawing, ultra-crisp antialiasing, zero blur)
          vec2 pRot = vec2(
            pRel.x * cos(u_rot) - pRel.y * sin(u_rot),
            pRel.x * sin(u_rot) + pRel.y * cos(u_rot)
          );

          float halfLen = radius * 0.38;
          float progress = clamp(u_draw, 0.0, 1.0);

          vec2 l1A = vec2(-halfLen, -halfLen);
          vec2 l1B = l1A + vec2(halfLen * 2.0, halfLen * 2.0) * progress;
          float d1 = lkDistSegment(pRot, l1A, l1B);

          vec2 l2A = vec2(-halfLen, halfLen);
          vec2 l2B = l2A + vec2(halfLen * 2.0, -halfLen * 2.0) * progress;
          float d2 = lkDistSegment(pRot, l2A, l2B);

          // Sharp vector-like 1.8px stroke width with crisp 0.7px AA edge
          float stroke1 = (1.0 - smoothstep(0.9, 1.7, d1)) * step(0.01, progress);
          float stroke2 = (1.0 - smoothstep(0.9, 1.7, d2)) * step(0.01, progress);
          float totalX = clamp(stroke1 + stroke2, 0.0, 1.0);

          col = mix(col, mix(${PAINT.INK_WHITE}, inkPole, u_hc), totalX * borderAA);

          // Click shockwave — the silver ripple is a decorative tint,
          // dropped under HC.
          float clickElapsed = u_time - u_click_time;
          if (clickElapsed >= 0.0 && clickElapsed < 0.4) {
            float waveRad = clickElapsed * 45.0;
            float waveShock = (1.0 - smoothstep(0.0, 2.5, abs(d - waveRad))) * (1.0 - clickElapsed / 0.4);
            col += ${PAINT.SILVER_TOP} * waveShock * 0.8 * (1.0 - u_hc);
          }

          return vec4(col, borderAA);
        }
      `

/** Liquid-fill fragment shader (see class docblock for the effect layers). */
export const CLOSE_BUTTON_FS = `
        ${GLSL_FS_PRECISION_AUTO}

        varying vec2 v_uv;
        uniform vec2 u_resolution;
        uniform float u_time;
        uniform float u_liquid;
        uniform float u_draw;
        uniform float u_rot;
        uniform float u_click_time;
        // HC channels — pole collapse + which pole the chip disc takes.
        uniform float u_hc;
        uniform float u_dark;
        ${CLOSE_PAINT_GLSL}

        void main() {
          vec2 pixel = v_uv * u_resolution;
          vec2 center = u_resolution * 0.5;
          vec2 pRel = pixel - center;
          float radius = min(center.x, center.y) - 1.0;

          if (length(pRel) > radius) {
            discard;
          }

          gl_FragColor = lkClosePaint(
            pRel, min(u_resolution.x, u_resolution.y),
            u_time, u_liquid, u_draw, u_rot, u_click_time,
            u_hc, u_dark
          );
        }
      `
