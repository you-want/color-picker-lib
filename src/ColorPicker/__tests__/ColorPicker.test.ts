import type { ComponentPublicInstance } from 'vue'
import { pickerState, setActivePickerId } from '../../shared/ColorPickerState'
import { eventBus } from '../../shared/EventBus'
import { resetRecentColors, useRecentColors } from '../../composables/useRecentColors'
import { parseGradient } from '../../color-utils/ColorUtil'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref, watch } from 'vue'
import ColorPicker from '../index.vue'

type PickerVm = ComponentPublicInstance<{
  stops: { position: number, color: string, isActive: boolean }[]
}>

// 宿主登录态演示：模拟从 localStorage 的 auth-token 解析出 userId（真实宿主里换成你的登录态来源）
function getUserId(): string {
  try {
    const token = localStorage.getItem('auth-token') || ''
    const payload = token.split('.')[1]
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const data = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')))
    const id = data?.data?.id
    return id == null ? '' : String(id)
  } catch {
    return ''
  }
}

vi.mock('vue-color', () => ({
  SketchPicker: {
    name: 'SketchPicker',
    props: ['value', 'presetColors'],
    emits: ['input'],
    template:
      '<div class="sketch-stub"><div class="field_double"><div class="vc-editable-input"><input class="vc-input-input" /></div></div></div>',
  },
}))
const PopoverStub = defineComponent({
  name: 'ElPopover',
  props: ['visible'],
  emits: ['show', 'hide'],
  setup(props, { emit }) {
    watch(
      () => props.visible,
      value => emit(value ? 'show' : 'hide'),
    )
  },
  template: '<div><div v-if="visible" class="popover-content"><slot /></div><slot name="reference" /></div>',
})
const RadioStub = defineComponent({
  name: 'ElRadioGroup',
  props: ['modelValue'],
  emits: ['change', 'update:modelValue'],
  template: '<div><slot /></div>',
})
let wrapper: VueWrapper
beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('auth-token', `header.${btoa(JSON.stringify({ data: { id: 'alice' } }))}.signature`)
  resetRecentColors()
  pickerState.activePickerId = null
  pickerState.pickingPickerId = null
})
afterEach(() => {
  wrapper?.unmount()
  eventBus.clear()
  pickerState.activePickerId = null
  pickerState.pickingPickerId = null
})
function render(value = '#112233') {
  wrapper = mount(
    defineComponent({
      components: { ColorPicker },
      setup() {
        return { color: ref(value), stops: ref([]), getUserId }
      },
      template:
        '<ColorPicker id="picker-1" v-model="color" :fill-opacity="100" :slider-buttons="stops" :get-user-id="getUserId" @change-color-set="stops = $event" />',
    }),
    {
      global: {
        stubs: {
          ElPopover: PopoverStub,
          ElRadioGroup: RadioStub,
          ElRadio: { template: '<span><slot /></span>' },
          ElTooltip: { template: '<span><slot /></span>' },
          VinsIcon: true,
          SliderColorSetting: true,
        },
        provide: { pageKey: ref('page-1'), getUserId },
      },
    },
  )
  return wrapper.findComponent(ColorPicker)
}
async function toggle() {
  await wrapper.find('.picker-trigger, .half-picker-trigger').trigger('click')
  await flushPromises()
}
function pickerInput(value: string) {
  wrapper.findComponent({ name: 'SketchPicker' }).vm.$emit('input', value)
}
function stops(): { position: number, color: string, isActive: boolean }[] {
  return (wrapper.vm as unknown as PickerVm).stops
}
function history() {
  return useRecentColors({ getUserId }).findUserIdColors('alice')
}

describe('调色板颜色会话（解耦版）', () => {
  it('连续选择颜色只更新实时格，关闭时只提交最后一次，重新打开显示在第二格', async () => {
    const picker = render()
    await toggle()
    pickerInput('#ff0000')
    await nextTick()
    pickerInput('#0000ff80')
    await flushPromises()
    expect(history()).toEqual([])
    expect(wrapper.find('[aria-current="true"]').attributes('title')).toContain('0.5019607843137255')
    await toggle()
    expect(history()).toEqual(['rgba(0, 0, 255, 0.5019607843137255)'])
    await toggle()
    const colors = wrapper.findAll('button[title]')
    expect(
      colors.map(button => button.attributes('title')).filter(title => title?.startsWith('rgba')),
    ).toHaveLength(2)
    expect(picker.props('modelValue')).toBe('rgba(0, 0, 255, 0.5019607843137255)')
  })
  it('点击外部关闭并提交最终颜色', async () => {
    render()
    await toggle()
    pickerInput('#123456')
    await nextTick()
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(wrapper.find('.popover-content').exists()).toBe(false)
    expect(history()).toEqual(['rgba(18, 52, 86, 1)'])
  })
  it('在调色板内部按下鼠标不会关闭面板', async () => {
    render()
    await toggle()
    wrapper.find('.sketch-stub').element.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(wrapper.find('.popover-content').exists()).toBe(true)
  })
  it('合法的带透明度 HEX 在失焦后不会被重置', async () => {
    const picker = render('#11223380')
    await toggle()
    const hex = wrapper.find('.field_double .vc-input-input')
    await hex.setValue('11223380')
    await hex.trigger('blur')
    expect(picker.props('modelValue')).toBe('#11223380')
    expect((hex.element as HTMLInputElement).value).toBe('11223380')
  })
  it('未修改就关闭不会产生历史记录', async () => {
    render()
    await toggle()
    await toggle()
    expect(history()).toEqual([])
  })
  it('重新打开恢复三个色标，编辑中间颜色仍保留完整渐变和透明度', async () => {
    const picker = render('linear-gradient(to right, #ff000080 0%, rgba(0, 255, 0, 0.4) 35%, #0000ff 100%)')
    await toggle()
    expect(stops()).toHaveLength(3)
    expect(stops().map(stop => stop.position)).toEqual([0, 35, 100])
    stops().forEach((stop, i) => {
      stop.isActive = i === 1
    })
    pickerInput('#ffff0080')
    await flushPromises()
    const result = parseGradient(picker.props('modelValue')!)!
    expect(result.angle).toBe('90deg')
    expect(result.colorStops).toHaveLength(3)
    expect(result.colorStops[0].color).toBe('#ff000080')
    expect(result.colorStops[1].offset).toBe(0.35)
    expect(result.colorStops[1].color).toContain('0.5019607843137255')
    await toggle()
    await toggle()
    expect(stops()).toHaveLength(3)
    expect(history()).toHaveLength(1)
  })
  it('从纯色生成同色相不透明到透明的渐变，打开时默认选择左侧色标', async () => {
    const picker = render('#316BFF80')
    await toggle()
    const group = wrapper.findComponent({ name: 'ElRadioGroup' })
    group.vm.$emit('update:modelValue', 1)
    group.vm.$emit('change', 1)
    await flushPromises()
    expect(parseGradient(picker.props('modelValue')!)!.colorStops.map(stop => stop.color)).toEqual([
      'rgba(49, 107, 255, 1)',
      'rgba(49, 107, 255, 0)',
    ])
    stops().forEach((stop, i) => {
      stop.isActive = i === 1
    })
    await toggle()
    await toggle()
    expect(stops().map(stop => stop.isActive)).toEqual([true, false])
  })
  it('取色链路：点击取色按钮 emit pick-request，applyPickedColor 回填仅当前 picker', async () => {
    const picker = render()
    await toggle()
    pickerInput('#aabbcc')
    await nextTick()
    await wrapper.find('[aria-label="画布取色"]').trigger('click')
    const pickRequest = picker.emitted('pick-request')![0]![0] as { pickerId: string, color: string }
    expect(pickRequest.pickerId).toBe('picker-1')
    expect(pickRequest.color).toBe('rgba(170, 187, 204, 1)')
    ;(picker.vm as unknown as { applyPickedColor: (color: string) => void }).applyPickedColor('#123456')
    await flushPromises()
    expect(picker.props('modelValue')).toBe('rgba(18, 52, 86, 1)')
  })
  it('多实例串色：其他 picker 取色不影响本 picker', async () => {
    const picker = render()
    await toggle()
    eventBus.emit('finallColor', { pickerId: 'other-picker', color: '#ff0000' })
    await flushPromises()
    expect(picker.props('modelValue')).toBe('#112233')
    expect(wrapper.find('.popover-content').exists()).toBe(true)
    eventBus.emit('finallColor', { pickerId: 'picker-1', color: '#123456' })
    await flushPromises()
    expect(picker.props('modelValue')).toBe('rgba(18, 52, 86, 1)')
  })
  it('取色中收到画布关闭事件保持面板可见', async () => {
    const picker = render()
    await toggle()
    await wrapper.find('[aria-label="画布取色"]').trigger('click')
    eventBus.emit('closeColorPopver', false)
    eventBus.emit('finallColor', { pickerId: 'other-picker', color: '#ff0000' })
    await flushPromises()
    expect(picker.props('modelValue')).toBe('#112233')
    expect(wrapper.find('.popover-content').exists()).toBe(true)
  })
  it('切换其他 picker 时关闭面板（模块级 pickerState）', async () => {
    render()
    await toggle()
    pickerInput('#aabbcc')
    await nextTick()
    setActivePickerId('picker-2')
    await flushPromises()
    expect(wrapper.find('.popover-content').exists()).toBe(false)
  })
  it('退出时 emit sessionCommit，且旧 key 历史迁移到新 key', async () => {
    localStorage.setItem('recenterlyUseColor', JSON.stringify([{ userId: 'alice', colors: ['#abc'] }]))
    resetRecentColors()
    const picker = render()
    await toggle()
    pickerInput('#ff0000')
    await nextTick()
    await toggle()
    const commitEmit = picker.emitted('sessionCommit')
    expect(commitEmit?.[0]).toEqual(['rgba(255, 0, 0, 1)'])
    expect(history()).toEqual(['rgba(255, 0, 0, 1)', '#abc'])
  })
})
