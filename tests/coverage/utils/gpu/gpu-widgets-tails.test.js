/**
 * @file coverage/utils/gpu/gpu-widgets-tails.test.js
 * @description Coverage tail for tokens/motion/gpu-widgets — the
 * JS-side mirror of the rust/<slug>/ widget crates. Asserts the
 * discriminants, artifact registry, and uniform sizes stay ordered
 * with the Rust workspace (both sides are bumped together on change).
 */
import { jest } from '@jest/globals'
import {
  GPU_WIDGET_KINDS,
  GPU_WIDGET_ARTIFACTS,
  GPU_WIDGET_UNIFORM_F32S,
  GPU_FLAG_ANIMS,
} from '@core/tokens/motion/gpu-widgets.js'

jest.unstable_mockModule('@core/devlog.js', () => ({ devWarn: jest.fn(), devLog: jest.fn() }))

const { mountWebGpuWidget } = await import('@core/utils/gpu/webgpu-widget.js')

describe('gpu-widgets tokens', () => {
  it('widget kinds mirror the rust/ crate ordering', () => {
    expect(Object.values(GPU_WIDGET_KINDS)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('artifact registry covers every kind with url+cls and only skeleton eager', () => {
    for (const kind of Object.values(GPU_WIDGET_KINDS)) {
      const spec = GPU_WIDGET_ARTIFACTS[kind]

      expect(spec.url).toMatch(/^\/wasm\/[a-z-]+\/luiskr_[a-z_]+\.js$/)
      expect(spec.cls).toMatch(/^[A-Z][A-Za-z]+$/)
      expect(spec.eager).toBe(kind === GPU_WIDGET_KINDS.SKELETON)
    }
  })

  it('uniform f32 counts match each widget UNIFORM_F32S in the crates', () => {
    expect(GPU_WIDGET_UNIFORM_F32S[GPU_WIDGET_KINDS.BURGER]).toBe(8)
    expect(GPU_WIDGET_UNIFORM_F32S[GPU_WIDGET_KINDS.FLAG]).toBe(12)
    expect(GPU_WIDGET_UNIFORM_F32S[GPU_WIDGET_KINDS.SWITCH_SLIDER]).toBe(12)
    expect(GPU_WIDGET_UNIFORM_F32S[GPU_WIDGET_KINDS.THEME_SLIDER]).toBe(12)
    expect(GPU_WIDGET_UNIFORM_F32S[GPU_WIDGET_KINDS.CLOSE_BUTTON]).toBe(12)
    expect(GPU_WIDGET_UNIFORM_F32S[GPU_WIDGET_KINDS.MENU_BACKGROUND]).toBe(16)
    expect(GPU_WIDGET_UNIFORM_F32S[GPU_WIDGET_KINDS.SKELETON]).toBe(12)
  })

  it('flag personalities cover every shipped locale pair', () => {
    expect(Object.keys(GPU_FLAG_ANIMS)).toEqual([
      'EN',
      'PT',
      'ES',
      'DE',
      'HRK',
      'CAS',
      'RIV',
      'GN',
      'IT',
      'RU',
      'FR',
      'TLN',
    ])
    expect(Object.values(GPU_FLAG_ANIMS)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  })

  it('mount wires a widget artifact and exposes it on the handle', async () => {
    navigator.gpu = {}

    const canvas = document.createElement('canvas')
    const widget = {
      init: async () => widget,
      resize: () => {},
      set_size: () => {},
      frame: () => {},
      set_state: (...a) => (widget.seen = a),
    }

    const h = await mountWebGpuWidget(GPU_WIDGET_KINDS.BURGER, canvas, async () => ({
      default: async () => ({}),
      Burger: function () {
        return widget
      },
    }))

    expect(h.canvas).toBe(canvas)
    expect(h.widget).toBe(widget)

    h.widget.set_state(0.5, 0, 0, 0.5)
    expect(widget.seen[0]).toBe(0.5)
    h.destroy()
  })
})
