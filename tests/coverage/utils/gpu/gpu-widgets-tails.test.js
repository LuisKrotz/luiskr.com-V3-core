/**
 * @file coverage/utils/gpu/gpu-widgets-tails.test.js
 * @description Coverage tail for tokens/motion/gpu-widgets — the
 * JS-side mirror of `widgets::kinds` in rust/overlay. Asserts the
 * discriminants, uniform sizes, and flag personalities stay ordered
 * with the Rust crate (both sides are bumped together on change).
 */
import { jest } from '@jest/globals'
import {
  GPU_WIDGET_KINDS,
  GPU_WIDGET_UNIFORM_F32S,
  GPU_FLAG_ANIMS,
} from '@core/tokens/motion/gpu-widgets.js'

jest.unstable_mockModule('@core/devlog.js', () => ({ devWarn: jest.fn(), devLog: jest.fn() }))

const { mountWebGpuOverlay } = await import('@core/utils/gpu/webgpu-overlay.js')

describe('gpu-widgets tokens', () => {
  it('widget kinds mirror rust/overlay/widgets/mod.rs ordering', () => {
    expect(Object.values(GPU_WIDGET_KINDS)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('uniform f32 counts match each widget UNIFORM_F32S in the crate', () => {
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

  it('registerWidget forwards kind + rect through the handle', async () => {
    navigator.gpu = {}

    const CAP = 1024
    const REC = 4
    const memory = { buffer: new ArrayBuffer((CAP * REC + 2) * 4 + 64) }
    const overlay = {
      input_buffer_ptr: () => 0,
      input_meta_ptr: () => CAP * REC * 4,
      init: async () => overlay,
      resize: () => {},
      set_css_size: () => {},
      frame: () => {},
      hover_group: () => 0,
      register_widget: (...a) => ((overlay.seen = a), 3),
      register_media: () => 0,
      set_widget_rect: () => {},
      set_widget_uniform: () => {},
      unregister_widget: () => {},
      upload_flag_textures: () => {},
      write_skel_sheet: () => {},
      upload_media_image: () => false,
      push_video_frame: () => {},
      burn_set_letters: () => {},
      burn_set_ink: () => {},
      burn_set_colors: () => {},
      burn_set_dir: () => {},
      burn_set_stage: () => {},
    }

    const h = await mountWebGpuOverlay(document.body, async () => ({
      default: async () => ({ memory }),
      Overlay: function () {
        return overlay
      },
    }))

    expect(h.registerWidget(GPU_WIDGET_KINDS.BURGER, { x: 0, y: 0, width: 36, height: 14 })).toBe(3)
    expect(overlay.seen[0]).toBe(GPU_WIDGET_KINDS.BURGER)
    h.destroy()
  })
})
