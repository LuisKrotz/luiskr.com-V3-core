/**
 * @file theme-slider/shaders.ts
 * @description GLSL sources for ThemeSliderWebGL's day/night scene,
 * extracted from theme-slider.ts — vertex stage, precision preamble and
 * the capsule SDF come from the shared canvas/glsl library; every paint
 * color comes from CANVAS_PAINT_GLSL (tokens/canvas/paint.ts).
 */

import {
  GLSL_VS_QUAD_UV,
  GLSL_FS_PRECISION_AUTO,
  GLSL_SDF_SEGMENT,
} from '@core/utils/canvas/glsl.js'
import { CANVAS_PAINT_GLSL as PAINT } from '@core/tokens/canvas/paint.js'

/** Fullscreen-quad vertex shader: a_pos in clip space, v_uv 0–1. */
export const THEME_SLIDER_VS = GLSL_VS_QUAD_UV

/** Day/night scene fragment shader (sun, moon, aurora, knob). The star
 *  hash keeps its own 12.9898/78.233 seed — switching to the shared
 *  127.1/311.7 seed would re-roll every star position. */
export const THEME_SLIDER_FS = `
        ${GLSL_FS_PRECISION_AUTO}

        varying vec2 v_uv;
        uniform vec2 u_resolution;
        uniform float u_time;
        uniform float u_progress;
        uniform float u_knob_x;
        uniform float u_ripple_time;
        uniform float u_ripple_pos;

        ${GLSL_SDF_SEGMENT}

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 437.585453);
        }

        void main() {
          float aspect = u_resolution.x / u_resolution.y;
          vec2 p = vec2(v_uv.x * aspect, v_uv.y);

          // Stadium ends centered at (0.5, 0.5) and (aspect - 0.5, 0.5) with radius 0.5
          vec2 cA = vec2(0.5, 0.5);
          vec2 cB = vec2(aspect - 0.5, 0.5);
          float trackDist = distCapsule(p, cA, cB);

          if (trackDist > 0.5) {
            discard;
          }

          float borderAA = 1.0 - smoothstep(0.485, 0.5, trackDist);

          // Sky gradient mapped by height
          float h = p.y;
          vec3 nightSky = mix(${PAINT.SKY_NIGHT_A}, ${PAINT.SKY_NIGHT_B}, h);
          vec3 sysSky   = mix(${PAINT.SKY_SYS_A}, ${PAINT.SKY_SYS_B}, h);
          vec3 daySky   = mix(${PAINT.SKY_DAY_A}, ${PAINT.SKY_DAY_B}, h);

          vec3 sky;
          if (u_progress <= 1.0) {
            sky = mix(nightSky, sysSky, u_progress);
          } else {
            sky = mix(sysSky, daySky, u_progress - 1.0);
          }

          vec3 col = sky;

          // Twinkling stars (Night / Twilight)
          float starAlpha = 1.0 - smoothstep(0.2, 1.1, u_progress);
          if (starAlpha > 0.01) {
            vec2 starGrid = floor(p * 20.0);
            float rnd = hash(starGrid);
            if (rnd > 0.72) {
              vec2 sPos = (starGrid + 0.5) / 20.0;
              float dStar = length(p - sPos);
              float twinkle = 0.5 + 0.5 * sin(u_time * 3.5 + rnd * 6.28);
              float sGlow = (1.0 - smoothstep(0.0, 0.022, dStar)) * twinkle * starAlpha;
              col += ${PAINT.INK_WHITE} * sGlow;
            }
          }

          // Rising Sun with Concentric Glowing Rings and Rotating Animated Rays (Left mesa)
          float sunAlpha = smoothstep(0.3, 1.8, u_progress);
          if (sunAlpha > 0.01) {
            vec2 sunPos = vec2(0.80, 0.62);
            float dSun = length(p - sunPos);
            float coronaPulse = 0.012 * sin(u_time * 2.8);
            float core = 1.0 - smoothstep(0.135 + coronaPulse, 0.165 + coronaPulse, dSun);
            float ring1 = (1.0 - smoothstep(0.22, 0.26, dSun)) * 0.45;
            float ring2 = (1.0 - smoothstep(0.30, 0.35, dSun)) * 0.28;
            float ring3 = (1.0 - smoothstep(0.39, 0.45, dSun)) * 0.16;

            // Rotating solar corona rays
            float sunAngle = atan(p.y - sunPos.y, p.x - sunPos.x);
            float sunRays = 0.5 + 0.5 * sin(sunAngle * 10.0 + u_time * 0.85);
            float rayGlow = (1.0 - smoothstep(0.14, 0.44, dSun)) * sunRays * 0.28;

            vec3 sunCream = ${PAINT.SUN_CREAM};
            vec3 ringCol = mix(${PAINT.RING_INNER}, ${PAINT.RING_OUTER}, clamp(dSun / 0.45, 0.0, 1.0));
            float totalSun = clamp(core + ring1 + ring2 + ring3 + rayGlow, 0.0, 1.0);
            col = mix(col, mix(ringCol, sunCream, core), totalSun * sunAlpha);
          }

          // System Mode: Shifting Twilight Auroral Waves (Mid Position)
          float sysFactor = 1.0 - min(1.0, abs(u_progress - 1.0) * 1.6);
          if (sysFactor > 0.01) {
            float auroraWave = sin(p.x * 2.6 + sin(p.y * 3.8 + u_time * 1.4) + u_time * 1.6) * 0.5 + 0.5;
            float auroraBand = smoothstep(0.35, 0.75, p.y) * (1.0 - smoothstep(0.70, 0.95, p.y));
            vec3 auroraCol = mix(${PAINT.AURORA_COOL}, ${PAINT.AURORA_WARM}, sin(p.x * 1.8 + u_time * 0.9) * 0.5 + 0.5);
            col += auroraCol * auroraWave * auroraBand * 0.38 * sysFactor;
          }

          // Crescent Moon in Upper Right (Night / Twilight)
          vec2 moonPos = vec2(2.58, 0.60);
          float dMoonOut = length(p - moonPos);
          float dMoonIn = length(p - (moonPos + vec2(-0.052, 0.042)));
          float moonOut = 1.0 - smoothstep(0.16, 0.18, dMoonOut);
          float moonIn = smoothstep(0.138, 0.174, dMoonIn);
          float crescent = moonOut * moonIn;
          float crescentAlpha = 1.0 - smoothstep(0.1, 1.2, u_progress);
          col = mix(col, ${PAINT.INK_WHITE}, clamp(crescent, 0.0, 1.0) * crescentAlpha * 0.95);

          // Canyon Mesas & Ridges with Multi-Layer Parallax and Heat Shimmer
          float parallax = (u_progress - 1.0) * 0.12;
          float px = p.x + parallax;
          float dayAlpha = smoothstep(1.0, 1.9, u_progress);
          float heatShimmer = sin(p.x * 14.0 + u_time * 2.8) * 0.005 * dayAlpha;

          float mesa1 = 0.33 + 0.14 * sin(px * 2.6) + 0.09 * cos(px * 5.4);
          float plateau1 = (1.0 - smoothstep(0.0, 0.3, abs(px - 1.72))) * 0.16;
          float plateau2 = (1.0 - smoothstep(0.0, 0.24, abs(px - 2.68))) * 0.18;
          float backHeight = mesa1 + plateau1 + plateau2 + heatShimmer * 0.5;

          vec3 mBackNight = ${PAINT.MESA_BACK_NIGHT};
          vec3 mBackSys   = ${PAINT.MESA_BACK_SYS};
          vec3 mBackDay   = ${PAINT.MESA_BACK_DAY};
          vec3 mBackCol;
          if (u_progress <= 1.0) {
            mBackCol = mix(mBackNight, mBackSys, u_progress);
          } else {
            mBackCol = mix(mBackSys, mBackDay, u_progress - 1.0);
          }

          float duneBackAA = 1.0 - smoothstep(backHeight - 0.015, backHeight + 0.005, p.y);
          col = mix(col, mBackCol, duneBackAA);

          // Front rolling desert dunes with atmospheric heat shimmer
          float frontHeight = 0.21 + 0.09 * sin((p.x - parallax * 0.5) * 2.4 + 0.8) + 0.05 * cos(p.x * 3.8) + heatShimmer;
          vec3 mFrontNight = ${PAINT.MESA_FRONT_NIGHT};
          vec3 mFrontSys   = ${PAINT.MESA_FRONT_SYS};
          vec3 mFrontDay   = ${PAINT.MESA_FRONT_DAY};
          vec3 mFrontCol;
          if (u_progress <= 1.0) {
            mFrontCol = mix(mFrontNight, mFrontSys, u_progress);
          } else {
            mFrontCol = mix(mFrontSys, mFrontDay, u_progress - 1.0);
          }

          float duneFrontAA = 1.0 - smoothstep(frontHeight - 0.015, frontHeight + 0.005, p.y);
          col = mix(col, mFrontCol, duneFrontAA);

          // Inset Track Border Bezel
          float bezel = smoothstep(0.46, 0.50, trackDist);
          col = mix(col, col * 0.65, bezel * 0.55);

          // Interactive Energy Ripple
          float rippleElapsed = u_time - u_ripple_time;
          if (rippleElapsed >= 0.0 && rippleElapsed < 0.6) {
            float rX = (u_ripple_pos / u_resolution.x) * aspect;
            float rDist = length(p - vec2(rX, 0.5));
            float rRadius = rippleElapsed * 1.0;
            float rWave = (1.0 - smoothstep(0.0, 0.08, abs(rDist - rRadius))) * (1.0 - rippleElapsed / 0.6);
            col += ${PAINT.RIPPLE} * rWave * 0.55;
          }

          // 3D Knob (radius ~ 0.38)
          float knobXNorm = (u_knob_x / u_resolution.x) * aspect;
          vec2 knobCenter = vec2(knobXNorm, 0.5);
          float knobDist = length(p - knobCenter);
          float knobRadius = 0.38;

          float knobShadow = (1.0 - smoothstep(knobRadius, knobRadius + 0.07, knobDist)) * 0.38;
          col = mix(col, ${PAINT.KNOB_SHADOW}, knobShadow);

          vec3 moonColor = ${PAINT.SURFACE_NEAR_WHITE};
          vec3 sysColor  = ${PAINT.KNOB_SYS};
          vec3 sunColor  = ${PAINT.KNOB_SUN};

          vec3 baseKnob;
          if (u_progress <= 1.0) {
            baseKnob = mix(moonColor, sysColor, u_progress);
          } else {
            baseKnob = mix(sysColor, sunColor, u_progress - 1.0);
          }

          // Crater Spots on Lunar Moon (Position 0 / Night)
          float craterFactor = 1.0 - smoothstep(0.1, 0.9, u_progress);
          if (craterFactor > 0.01) {
            vec2 kp = p - knobCenter;
            float c1 = 1.0 - smoothstep(0.075, 0.095, length(kp - vec2(-0.13, 0.12)));
            float c2 = 1.0 - smoothstep(0.053, 0.071, length(kp - vec2(-0.11, -0.11)));
            float c3 = 1.0 - smoothstep(0.041, 0.059, length(kp - vec2(0.12, -0.07)));
            float c4 = 1.0 - smoothstep(0.059, 0.077, length(kp - vec2(0.09, 0.11)));
            float c5 = 1.0 - smoothstep(0.024, 0.042, length(kp - vec2(-0.01, 0.02)));
            float anyCrater = clamp(c1 + c2 + c3 + c4 + c5, 0.0, 1.0);
            vec3 craterColor = ${PAINT.CRATER};
            baseKnob = mix(baseKnob, craterColor, anyCrater * craterFactor * 0.75);
          }

          // Sphere 3D lighting
          float sphere3D = 1.0 - (knobDist / knobRadius) * 0.14;
          vec3 litKnob = baseKnob * sphere3D;

          // Smoothstep knob edge
          float knobAA = 1.0 - smoothstep(knobRadius - 0.02, knobRadius + 0.005, knobDist);
          col = mix(col, litKnob, knobAA);

          // Animated Knob Corona Aura in Light and System positions
          if (dayAlpha > 0.01) {
            float sunKnobHalo = (1.0 - smoothstep(knobRadius, knobRadius + 0.08 + 0.02 * sin(u_time * 3.0), knobDist)) * 0.42 * dayAlpha;
            col += ${PAINT.HALO_SUN} * sunKnobHalo;
          }
          if (sysFactor > 0.01) {
            float sysKnobHalo = (1.0 - smoothstep(knobRadius, knobRadius + 0.07 + 0.015 * sin(u_time * 2.4), knobDist)) * 0.35 * sysFactor;
            col += ${PAINT.HALO_SYS} * sysKnobHalo;
          }

          gl_FragColor = vec4(col * borderAA, borderAA);
        }
      `
