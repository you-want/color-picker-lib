import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import SliderColorSetting from '../../src/SliderColorSetting/index.vue'
import { eventBus } from '../../src/shared/EventBus'

let wrapper: VueWrapper | undefined
afterEach(() => { wrapper?.unmount(); eventBus.clear(); document.body.innerHTML = '' })
function render(disabled = false) {
  wrapper = mount(SliderColorSetting, {
    attachTo: document.body,
    props: {
      colorType: 1, colorNormalization: '', isReverseColor: false, disabled, step: 5,
      sliderButtons: [
        { id: 'start', type: 'start', position: 0, color: '#f00', isActive: false },
        { id: 'middle', type: 'middle', position: 50, color: '#fff', isActive: true },
        { id: 'end', type: 'end', position: 100, color: '#00f', isActive: false },
      ],
    },
    global: { stubs: { ElTooltip: { template: '<span><slot /></span>' } } },
  })
  return wrapper.findAll('[role="slider"]')
}

describe('渐变滑块键盘和外部输入隔离', () => {
  it('方向键按 step 调整当前色标并生成渐变', async () => {
    const handles = render(); await handles[1].trigger('focus'); await handles[1].trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper!.props('sliderButtons')[1].position).toBe(55)
    expect(wrapper!.emitted('gradientUpdate')?.at(-1)?.[0]).toContain('#fff 55%')
  })
  it('Home/End 和方向键保持 0–100 边界', async () => {
    const handles = render(); await handles[1].trigger('focus')
    await handles[1].trigger('keydown', { key: 'Home' }); await handles[1].trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper!.props('sliderButtons')[1].position).toBe(0)
    await handles[1].trigger('keydown', { key: 'End' }); await handles[1].trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper!.props('sliderButtons')[1].position).toBe(100)
  })
  it('Delete 仅删除当前聚焦的中间色标', async () => {
    const handles = render(); await handles[1].trigger('focus'); await handles[1].trigger('keydown', { key: 'Delete' })
    expect(wrapper!.emitted('updateSliderButtons')).toEqual([[1]])
  })
  it('端点不被 Delete 删除', async () => {
    const handles = render(); await handles[0].trigger('focus'); await handles[0].trigger('keydown', { key: 'Delete' })
    expect(wrapper!.emitted('updateSliderButtons')).toBeUndefined()
  })
  it('宿主输入框的 Backspace 不删除选中的色标', async () => {
    render()
    const input = document.createElement('input'); document.body.append(input); input.focus()
    const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true })
    input.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(wrapper!.emitted('updateSliderButtons')).toBeUndefined()
  })
  it('禁用时不能聚焦或键盘修改', async () => {
    const handles = render(true); await handles[1].trigger('focus'); await handles[1].trigger('keydown', { key: 'ArrowRight' })
    expect(handles[1].attributes('tabindex')).toBe('-1')
    expect(wrapper!.props('sliderButtons')[1].position).toBe(50)
  })
})
