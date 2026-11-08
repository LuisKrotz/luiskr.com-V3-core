/**
 * @file switch-slider-shaders.ts
 * @description GLSL sources for SwitchSliderWebGL's animated toggle scene,
 * extracted from switch-slider.ts — vertex stage, precision preamble and
 * the capsule SDF come from the shared canvas/glsl library; every paint
 * color comes from CANVAS_PAINT_GLSL (tokens/canvas/paint.ts).
 */

import {
  GLSL_VS_QUAD_UV,
  GLSL_FS_PRECISION_MEDIUMP,
  GLSL_SDF_SEGMENT,
} from '@core/utils/canvas/glsl.js'
import { CANVAS_PAINT_GLSL as PAINT } from '@core/tokens/canvas/paint.js'

/** Fullscreen-quad vertex shader: a_pos in clip space, v_uv 0–1. */
export const SWITCH_SLIDER_VS = GLSL_VS_QUAD_UV

/** Toggle fragment shader: pill track, knob, per-context accents. */
export const SWITCH_SLIDER_FS = `
        ${GLSL_FS_PRECISION_MEDIUMP}
        varying vec2 v_uv;
        uniform vec2 u_resolution;
        uniform float u_time;
        uniform float u_progress;
        uniform float u_knob_x;
        uniform float u_context; // 0=stats, 1=grid, 2=motion, 3=contrast

        ${GLSL_SDF_SEGMENT}

        void main() {
          vec2 pixel = v_uv * u_resolution;
          vec2 centerA = vec2(14.0, 14.0);
          vec2 centerB = vec2(u_resolution.x - 14.0, 14.0);
          float trackDist = distCapsule(pixel, centerA, centerB);

          if (trackDist > 14.0) {
            discard;
          }

          float borderAA = 1.0 - smoothstep(13.2, 14.0, trackDist);

          // Base track background
          vec3 offTrack = ${PAINT.TRACK_OFF};
          vec3 onTrack;

          if (u_context < 0.5) {
            // Stats: Emerald green
            onTrack = ${PAINT.TRACK_STATS};
          } else if (u_context < 1.5) {
            // Grid: Cyan blueprint
            onTrack = ${PAINT.TRACK_GRID};
          } else if (u_context < 2.5) {
            // Motion: Violet / magenta
            onTrack = ${PAINT.TRACK_MOTION};
          } else {
            // Contrast: Warm amber
            onTrack = ${PAINT.TRACK_CONTRAST};
          }

          vec3 col = mix(offTrack, onTrack, u_progress);

          // Contextual Graphical Draw Elements
          if (u_context < 0.5) {
            // ── 0: STATS (Live ECG Oscilloscope / Pulse Wave) ──
            float waveX = pixel.x + u_time * 20.0;
            float pulse = sin(waveX * 0.35) * 2.5;

            // Heartbeat peak spike
            float spikePhase = mod(waveX, 36.0);
            if (spikePhase > 12.0 && spikePhase < 18.0) {
              pulse += (spikePhase - 15.0) * -2.8;
            }

            float waveY = 14.0 + pulse * (0.3 + 0.7 * u_progress);
            float dWave = abs(pixel.y - waveY);
            float waveGlow = 1.0 - smoothstep(0.0, 1.6, dWave);
            vec3 waveCol = mix(${PAINT.WAVE_OFF}, ${PAINT.WAVE_ON}, u_progress);
            col += waveCol * waveGlow * 0.85;

          } else if (u_context < 1.5) {
            // ── 1: GRID (Blueprint Column Grid Lines) ──
            float gridX = mod(pixel.x + u_time * 3.0, 8.0);
            float gridY = mod(pixel.y, 7.0);
            float isLineX = 1.0 - smoothstep(0.0, 1.0, abs(gridX - 4.0));
            float isLineY = 1.0 - smoothstep(0.0, 1.0, abs(gridY - 3.5));
            float gridPattern = clamp(isLineX + isLineY, 0.0, 1.0);
            vec3 gridCol = mix(${PAINT.GRID_OFF}, ${PAINT.GRID_ON}, u_progress);
            col += gridCol * gridPattern * (0.25 + 0.55 * u_progress);

          } else if (u_context < 2.5) {
            // ── 2: MOTION (Subtle Ambient Drift vs Calm Still Horizon) ──
            if (u_progress < 0.5) {
              // Full Motion (OFF): Soft, slow, subtle horizontal wind drift (speed 6.0)
              float streakY = mod(pixel.y, 7.0);
              float streakMove = mod(pixel.x - u_time * 6.0, 20.0);
              float lineY = 1.0 - smoothstep(0.0, 1.2, abs(streakY - 3.5));
              float lineFade = 1.0 - smoothstep(0.0, 12.0, streakMove);
              col += ${PAINT.STREAK} * lineY * lineFade * 0.45;
            } else {
              // Reduced Motion (ON): Calm, perfectly still horizontal centerline datum
              float lineY = 1.0 - smoothstep(0.0, 1.2, abs(pixel.y - 14.0));
              col += ${PAINT.DATUM} * lineY * 0.60;
            }
          } else {
            // ── 3: CONTRAST (Sweeping Luminance Split / Comparison Wipe) ──
            // A vertical seam travels the track on a slow sine (amplitude
            // ±17px around center — the wipe never parks at an edge);
            // left of it the track drops to near-black, right of it lifts
            // to near-white — the "before/after" split of a contrast
            // comparator. The 1px smoothstep keeps the edge crisp but
            // antialiased. Alpha (0.30 + 0.60·progress): the split fades
            // IN as high contrast turns on — a soft grey hint when off.
            float seamX = 27.0 + sin(u_time * 0.9) * 17.0;
            float side = smoothstep(seamX - 0.9, seamX + 0.9, pixel.x);
            vec3 wipeCol = mix(${PAINT.WIPE_DARK}, ${PAINT.SURFACE_NEAR_WHITE}, side);
            col = mix(col, wipeCol, 0.30 + 0.60 * u_progress);
            // Hot amber seam riding the boundary — the comparator's cursor.
            float seam = 1.0 - smoothstep(0.0, 1.0, abs(pixel.x - seamX));
            col += ${PAINT.SEAM} * seam * (0.30 + 0.50 * u_progress);
          }

          // Inset Track Border Bezel (antialiased)
          float bezel = smoothstep(11.5, 14.0, trackDist);
          col = mix(col, ${PAINT.BLACK}, bezel * 0.35);

          // 3D Knob with smooth anti-aliased shading
          vec2 knobCenter = vec2(u_knob_x, 14.0);
          float knobDist = length(pixel - knobCenter);
          float knobRadius = 11.0;

          // Knob drop shadow
          float kShadow = (1.0 - smoothstep(knobRadius, knobRadius + 2.5, knobDist)) * 0.35;
          col = mix(col, ${PAINT.BLACK}, kShadow);

          // 3D sphere gradient lighting
          float kSphere = 1.0 - clamp(knobDist / knobRadius, 0.0, 1.0) * 0.15;
          vec3 knobColor = ${PAINT.SURFACE_NEAR_WHITE} * kSphere;

          // Unified solid dot (radius 2.5) with smoothstep anti-aliasing
          float dDot = length(pixel - knobCenter);
          float dotLight = 1.0 - smoothstep(2.0, 2.7, dDot);

          vec3 dotCol;
          if (u_context < 0.5) {
            dotCol = mix(${PAINT.DOT_OFF}, ${PAINT.DOT_STATS}, u_progress);
          } else if (u_context < 1.5) {
            dotCol = mix(${PAINT.DOT_OFF}, ${PAINT.DOT_GRID}, u_progress);
          } else if (u_context < 2.5) {
            dotCol = mix(${PAINT.DOT_OFF}, ${PAINT.DOT_MOTION}, u_progress);
          } else {
            dotCol = mix(${PAINT.DOT_OFF}, ${PAINT.DOT_CONTRAST}, u_progress);
          }

          knobColor = mix(knobColor, dotCol, dotLight);

          // Ultra-smooth knob edge anti-aliasing (smoothstep across 1.0 pixel boundary)
          float knobAA = 1.0 - smoothstep(knobRadius - 0.6, knobRadius + 0.4, knobDist);
          col = mix(col, knobColor, knobAA);

          gl_FragColor = vec4(col * borderAA, borderAA);
        }
      `
