/**
 * @file gpu-accel-shaders.ts
 * @description GLSL sources for the GPUAccelerator passthrough program —
 * a fullscreen-quad blit (attribute `a_position`, varying `v_uv`, one
 * `u_image` sampler) used to upload media frames into a GL texture.
 * Both stages come from the shared canvas/glsl chunk library.
 */

import { GLSL_VS_QUAD_UV_FLIP, GLSL_FS_PRECISION_LOWP } from '@core/utils/canvas/glsl.js'

/** Fullscreen-quad vertex shader emitting flipped-normalized UVs. */
export const GPU_ACCEL_VS = GLSL_VS_QUAD_UV_FLIP

/** Single-sampler fragment shader — blits the bound texture. */
export const GPU_ACCEL_FS = `
  ${GLSL_FS_PRECISION_LOWP}
  varying vec2 v_uv;
  uniform sampler2D u_image;
  void main() {
    gl_FragColor = texture2D(u_image, v_uv);
  }
`
