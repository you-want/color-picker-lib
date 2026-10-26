import { eventBus } from '../../shared/EventBus'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import SliderColorSetting from '../index.vue'

let wrapper: ReturnType<typeof mount>
afterEach(() => {
  wrapper?.unmount()
  eventBus.clear()
})

describe('渐变色标条', () => {
  it('在垂直渐变中点击添加色标，保留当前色相、透明度和组件渐变方向', async () => {
    wrapper = mount(SliderColorSetting, {
      props: {
        degValue: 180,
        isReverseColor: false,
        colorType: 1,
        colorNormalization: 'linear-gradient(180deg, #316BFF, rgba(49,107,255,0))',
        sliderButtons: [
          { id: 'start', type: 'start', position: 0, color: '#316BFF', isActive: true },
          { id: 'end', type: 'end', position: 100, color: 'rgba(49,107,255,0)', isActive: false },
        ],
      },
      global: { stubs: { ElTooltip: { template: '<span><slot /></span>' } } },
    })
    const track = wrapper.find('[class*="slider-track"]')
    track.element.getBoundingClientRect = () => ({ left: 100, width: 200 }) as DOMRect
    await track.trigger('click', { clientX: 200 })
    expect(wrapper.emitted('updateSliderButtons')?.[0]?.[0]).toMatchObject({
      position: 50,
      color: 'rgba(49, 107, 255, 0.5)',
      isActive: true,
    })
    expect((wrapper as any).props('degValue')).toBe(180)
  })
})
