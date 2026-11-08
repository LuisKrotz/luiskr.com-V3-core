/**
 * @file glsl-library.test.js
 * @description Coverage tail for the shared GLSL chunk library
 * (core/utils/canvas/glsl.ts) and the canvas paint-color tokens
 * (core/tokens/canvas/paint.ts) — asserts every exported chunk carries
 * the GLSL surface the widget shaders compose against (named stages,
 * preambles, SDFs, hashes) and that the paint tokens emit `vec3`/`vec4`
 * sources, so a bad chunk edit fails here before it breaks a shader
 * compile at runtime.
 */

import { describe, test, expect } from '@jest/globals'

import {
  GLSL_VS_FULLSCREEN,
  GLSL_VS_QUAD_UV,
  GLSL_VS_QUAD_UV_FLIP,
  GLSL_FS_PRECISION_AUTO,
  GLSL_FS_PRECISION_MEDIUMP,
  GLSL_FS_PRECISION_LOWP,
  GLSL_DERIV_PRELUDE,
  GLSL_SDF_SEGMENT,
  GLSL_SDF_CAPSULE,
  GLSL_SDF_ROUND_BOX,
  GLSL_HASH_SIN_2D,
  GLSL_VALUE_NOISE,
} from '@core/utils/canvas/glsl.js'

import { CANVAS_PAINT_GLSL, CANVAS_PAINT_CSS } from '@core/tokens/canvas/paint.js'

describe('canvas/glsl chunk library', () => {
  test('vertex stages emit gl_Position with the contracted attribute', () => {
    expect(GLSL_VS_FULLSCREEN).toContain('attribute vec2 a_pos')
    expect(GLSL_VS_FULLSCREEN).toContain('gl_Position')

    expect(GLSL_VS_QUAD_UV).toContain('varying vec2 v_uv')
    expect(GLSL_VS_QUAD_UV).toContain('gl_Position')

    // The accel blit binds `a_position` (not a_pos) and flips v vertically.
    expect(GLSL_VS_QUAD_UV_FLIP).toContain('attribute vec2 a_position')
    expect(GLSL_VS_QUAD_UV_FLIP).toContain('1.0 -')
  })

  test('precision preambles cover the three widget tiers', () => {
    expect(GLSL_FS_PRECISION_AUTO).toContain('GL_FRAGMENT_PRECISION_HIGH')
    expect(GLSL_FS_PRECISION_AUTO).toContain('precision highp float')
    expect(GLSL_FS_PRECISION_MEDIUMP).toContain('precision mediump float')
    expect(GLSL_FS_PRECISION_LOWP).toContain('precision lowp float')
  })

  test('deriv prelude enables OES_standard_derivatives + HAS_DERIV', () => {
    expect(GLSL_DERIV_PRELUDE).toContain('GL_OES_standard_derivatives')
    expect(GLSL_DERIV_PRELUDE).toContain('HAS_DERIV')
  })

  test('SDF chunks expose the function names widgets call', () => {
    expect(GLSL_SDF_SEGMENT).toContain('distCapsule')
    expect(GLSL_SDF_CAPSULE).toContain('sdCapsule')
    expect(GLSL_SDF_ROUND_BOX).toContain('sdRoundBox')
  })

  test('hash chunks keep the shared 127.1/311.7 seed', () => {
    expect(GLSL_HASH_SIN_2D).toContain('127.1')
    expect(GLSL_HASH_SIN_2D).toContain('311.7')
    expect(GLSL_VALUE_NOISE).toContain('hash')
  })
})

describe('canvas paint-color tokens', () => {
  test('every GLSL token is a vec3/vec4 source string', () => {
    for (const src of Object.values(CANVAS_PAINT_GLSL)) {
      expect(src).toMatch(/^vec[34]\(/)
    }
  })

  test('accent + divider tokens land on documented values', () => {
    expect(CANVAS_PAINT_GLSL.TURQUOISE_TOP).toBe('vec3(0.40, 0.988, 0.945)')
    expect(CANVAS_PAINT_GLSL.FLAG_DIVIDER).toBe('vec4(0.1, 0.1, 0.1, 1.0)')
    expect(CANVAS_PAINT_CSS.NEON_TEAL).toBe('#66fcf1')
  })
})
