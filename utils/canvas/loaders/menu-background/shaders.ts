/**
 * @file menu-background-shaders.ts
 * @description GLSL sources for MenuBackgroundWebGL, extracted from
 * menu-background-webgl.ts — vertex stage, derivatives prelude,
 * precision preamble and the hash/value-noise helpers come from the
 * shared canvas/glsl library. The domain-warped fbm contour-field
 * fragment shader (Iris van Herpen-like flowing isolines) prefixes the
 * OES_standard_derivatives prelude only when the extension exists,
 * enabling pixel-constant line width.
 */

import {
  GLSL_DERIV_PRELUDE,
  GLSL_VS_FULLSCREEN,
  GLSL_FS_PRECISION_AUTO,
  GLSL_HASH_SIN_2D,
  GLSL_VALUE_NOISE,
} from '@core/utils/canvas/glsl.js'

/** Extension prelude enabling pixel-space isoline AA (WebGL1 only). */
export const MENU_BG_DERIV_PRELUDE = GLSL_DERIV_PRELUDE

/** Shared fullscreen-quad vertex shader. */
export const MENU_BG_VS = GLSL_VS_FULLSCREEN

/** Contour-field fragment shader body (prefix with the deriv prelude). */
export const MENU_BG_FS_BODY = `
        // highp avoids the hash/noise banding that tears the field on
        // mobile GPUs (mediump trig precision); falls back where absent.
        ${GLSL_FS_PRECISION_AUTO}
        uniform float u_time;
        uniform vec2 u_res;
        uniform vec3 u_color;
        uniform vec3 u_color2;
        uniform float u_reveal;
        uniform float u_alpha;

        ${GLSL_HASH_SIN_2D}
        ${GLSL_VALUE_NOISE}
        float fbm(vec2 p){
          float v=0.,a=0.5;
          mat2 m=mat2(0.8,0.6,-0.6,0.8);
          for(int i=0;i<4;i++){v+=a*noise(p);p=m*p*2.03;a*=0.5;}
          return v;
        }

        void main(){
          // Centered, aspect-corrected coords: p spans ~[-0.5,0.5] on the
          // short axis so contours stay circular on any viewport shape.
          vec2 p=(gl_FragCoord.xy-0.5*u_res)/min(u_res.x,u_res.y);
          float t=u_time*0.018;

          // Domain-warped field: q warps p, r warps q's output, f warps by
          // r — double warping produces the flowing, fabric-like shapes
          // (IQ's classic fbm-warp technique). t*0.018 ≈ 35s per cycle —
          // the drift is deliberately glacial so the field feels alive
          // rather than animated.
          vec2 q=vec2(fbm(p*1.6+t),fbm(p*1.6-t*0.7+3.1));
          vec2 r=vec2(fbm(p*1.6+2.2*q+vec2(1.7,9.2)+t*0.6),fbm(p*1.6+2.2*q+vec2(8.3,2.8)-t*0.4));
          float f=fbm(p*1.6+2.0*r);

          // Isolines: quantize the field into 14 level bands — a sparse
          // set so the field reads as delicate fabric folds rather than a
          // dense screen-wide texture. fract() measures distance to the
          // nearest contour boundary.
          // With derivatives available, convert band-space distance to
          // *pixel* distance (d / |∇q|) so every contour is a consistent
          // ~1px hairline with a proper AA falloff — no crawling or
          // width pumping as the field drifts. Without them, fall back to
          // the fixed-width smoothstep band (softened by supersampling).
          float levels=14.;
          float band=f*levels;
          float v=fract(band);
          float d=min(v,1.-v);
          #ifdef HAS_DERIV
          float grad=max(fwidth(band),1e-4);
          float dpx=d/grad;
          float line=1.-smoothstep(0.45,1.05,dpx);
          float majorLine=1.-smoothstep(0.7,1.5,dpx);
          #else
          float line=1.-smoothstep(0.,0.028,d);
          float majorLine=1.-smoothstep(0.,0.045,d);
          #endif
          float major=step(mod(floor(band),6.),0.5);
          line=mix(line,max(line,majorLine*0.9),major);

          // Reveal: vign fades lines toward the edges and rev multiplies
          // alpha for a soft global fade — the field itself stays stable;
          // no radial window, so open/close never reads as a zoom.
          // The vignette reaches in further (0.15→0.7 of the half-frame)
          // than a generic edge fade so contours concentrate around the
          // link column like pleated fabric instead of covering the
          // viewport uniformly.
          float len=length(p);
          float vign=1.-smoothstep(0.15,0.7,len);
          float rev=smoothstep(0.,1.,u_reveal);
          float a=line*vign*rev*u_alpha;

          // Contour ink drifts between the two theme inks across the field —
          // in light mode this blends deep→light blue like moving water
          float wm=smoothstep(0.2,0.8,f);
          vec3 ink=mix(u_color,u_color2,wm);

          gl_FragColor=vec4(ink,a);
        }
      `

/** Full FS source for the current GL capability set. */
export const menuBgFsSource = (hasDeriv: boolean): string =>
  (hasDeriv ? MENU_BG_DERIV_PRELUDE : '') + MENU_BG_FS_BODY
