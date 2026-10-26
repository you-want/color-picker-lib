import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import ElementPlus from 'element-plus'
import ColorPicker from '../../src/ColorPicker/index.vue'
import EyeDropper from '../../src/EyeDropper/index.vue'
import { useColorPickerSession } from '../../src/composables/useColorPickerSession'
import { closeAllPickers, pickerState } from '../../src/shared/ColorPickerState'
import { resetRecentColors } from '../../src/composables/useRecentColors'
import { eventBus } from '../../src/shared/EventBus'

const { capture } = vi.hoisted(() => ({ capture: vi.fn() }))
vi.mock('../../src/EyeDropper/captureCanvas', () => ({ captureCanvas: capture }))
let wrapper: VueWrapper | undefined
const context = {
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([18, 52, 86, 255]) })),
  clearRect: vi.fn(), fillRect: vi.fn(), translate: vi.fn(), drawImage: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), strokeRect: vi.fn(),
}

beforeEach(() => {
  localStorage.clear(); resetRecentColors(); closeAllPickers()
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA6kAAAAASUVORK5CYII=')
  const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 200
  capture.mockResolvedValue(canvas)
})
afterEach(async () => {
  wrapper?.unmount(); wrapper = undefined; await flushPromises()
  vi.restoreAllMocks(); vi.unstubAllGlobals(); capture.mockReset()
  closeAllPickers(); eventBus.clear(); document.body.innerHTML = ''
})

async function start() {
  const target = document.createElement('div')
  target.getBoundingClientRect = () => ({ left: 100, top: 50, width: 200, height: 100 }) as DOMRect
  wrapper = mount(defineComponent({
    components: { ColorPicker, EyeDropper },
    setup() {
      const color = ref('#abcdef')
      const picker = ref<InstanceType<typeof ColorPicker>>()
      const session = useColorPickerSession()
      const confirm = (value: string) => {
        if (session.onPickConfirm(value)) picker.value?.applyPickedColor(value)
      }
      return { color, picker, session, confirm, target, getUserId: () => 'u' }
    },
    template: '<ColorPicker id="flow" ref="picker" v-model="color" :get-user-id="getUserId" @pick-request="session.onPickRequest" /><EyeDropper v-if="session.pending.value" :target="target" @confirm="confirm" @close="session.onPickClose" />',
  }), { attachTo: document.body, global: { plugins: [ElementPlus] } })
  await wrapper.find('.half-picker-trigger').trigger('click'); await flushPromises()
  document.querySelector<HTMLButtonElement>('[aria-label="画布取色"]')!.click(); await flushPromises()
}
function outside() { document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })) }

describe('宿主 → 调色板 → 取色浮层完整链路（截图边界替身）', () => {
  it('确认采样回填，移除浮层，外部关闭后提交一次最终色', async () => {
    await start()
    document.querySelector('[data-eyedropper-overlay]')!.dispatchEvent(new MouseEvent('click', { clientX: 125, clientY: 60, bubbles: true }))
    await flushPromises()
    const picker = wrapper!.findComponent(ColorPicker)
    expect(picker.props('modelValue')).toBe('rgba(18, 52, 86, 1)')
    expect(document.querySelector('[data-eyedropper-overlay]')).toBeNull()
    expect(pickerState.pickingPickerId).toBeNull()
    outside(); await flushPromises()
    expect(picker.emitted('sessionCommit')).toEqual([['rgba(18, 52, 86, 1)']])
  })
  it('Escape 取消后保留颜色，外部点击仍能正常关闭调色板', async () => {
    await start()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await flushPromises()
    expect(document.querySelector('[data-eyedropper-overlay]')).toBeNull()
    expect(pickerState.pickingPickerId).toBeNull()
    expect(wrapper!.findComponent(ColorPicker).props('modelValue')).toBe('#abcdef')
    expect(wrapper!.find('.half-picker-trigger').attributes('aria-expanded')).toBe('true')
    outside(); await flushPromises()
    expect(wrapper!.find('.half-picker-trigger').attributes('aria-expanded')).toBe('false')
  })
  it('截图失败退出后可重新启动并确认取色', async () => {
    capture.mockRejectedValueOnce(new Error('capture failed'))
    await start()
    const overlay = document.querySelector('[data-eyedropper-overlay]')!
    expect(overlay.textContent).toContain('画布取色失败')
    overlay.querySelector<HTMLButtonElement>('button')!.click(); await flushPromises()
    expect(pickerState.pickingPickerId).toBeNull()
    document.querySelector<HTMLButtonElement>('[aria-label="画布取色"]')!.click(); await flushPromises()
    document.querySelector('[data-eyedropper-overlay]')!.dispatchEvent(new MouseEvent('click', { clientX: 125, clientY: 60, bubbles: true })); await flushPromises()
    expect(wrapper!.findComponent(ColorPicker).props('modelValue')).toBe('rgba(18, 52, 86, 1)')
  })
})
