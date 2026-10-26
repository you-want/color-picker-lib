import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import ElementPlus from 'element-plus'
import { SketchPicker } from 'vue-color'
import ColorPicker from '../../src/ColorPicker/index.vue'
import SliderColorSetting from '../../src/SliderColorSetting/index.vue'
import { resetRecentColors, useRecentColors } from '../../src/composables/useRecentColors'
import { useColorPickerSession } from '../../src/composables/useColorPickerSession'
import { closeAllPickers, pickerState } from '../../src/shared/ColorPickerState'
import { eventBus } from '../../src/shared/EventBus'
import { parseColorToRGBA, parseGradient } from '../../src/color-utils/ColorUtil'

let wrapper: VueWrapper | undefined
beforeEach(() => {
  localStorage.clear(); resetRecentColors(); closeAllPickers()
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect: vi.fn(), translate: vi.fn() } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA6kAAAAASUVORK5CYII=')
})
afterEach(async () => {
  wrapper?.unmount(); wrapper = undefined
  await flushPromises()
  eventBus.clear(); closeAllPickers(); resetRecentColors(); vi.unstubAllGlobals(); vi.restoreAllMocks()
  document.body.innerHTML = ''
})

function render(options: Record<string, unknown> = {}, value = '#112233', two = false, custom = false) {
  wrapper = mount(defineComponent({
    components: { ColorPicker },
    setup: () => ({ color: ref(value), other: ref('#abcdef'), options, getUserId: () => 'alice' }),
    template: `<ColorPicker id="audit-a" v-model="color" :get-user-id="getUserId" v-bind="options">${custom ? '<template #trigger><button data-custom>自定义触发器</button></template>' : ''}</ColorPicker>${two ? '<ColorPicker id="audit-b" v-model="other" :get-user-id="getUserId" />' : ''}`,
  }), { attachTo: document.body, global: { plugins: [ElementPlus] } })
  return wrapper.findComponent(ColorPicker)
}
async function open(index = 0) {
  await wrapper!.findAll('.picker-trigger, .half-picker-trigger')[index].trigger('click')
  await flushPromises()
}
function input(value: string, index = 0) {
  wrapper!.findAllComponents(SketchPicker)[index].vm.$emit('input', value)
}
function apply(value: string, index = 0) {
  const vm = wrapper!.findAllComponents(ColorPicker)[index].vm as unknown as { applyPickedColor: (color: string) => void }
  vm.applyPickedColor(value)
}
function palettes() {
  return [...document.querySelectorAll('.color-picker-popover')].filter(el => (el as HTMLElement).style.display !== 'none')
}

describe('真实 Element Plus / vue-color 集成（jsdom，无组件替身）', () => {
  it('HEX 输入切换到零度红色后同步色相面板，并保留输入焦点', async () => {
    render({}, '#00ff00'); await open()
    const hex = document.querySelector<HTMLInputElement>('input[aria-label="Hex"]')!
    hex.focus()
    hex.value = 'ff0000'
    hex.setSelectionRange(2, 4)
    hex.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    expect(document.querySelector('[aria-label="Hue"]')?.getAttribute('aria-valuenow')).toBe('0.0')
    const current = document.querySelector<HTMLInputElement>('input[aria-label="Hex"]')!
    await vi.waitFor(() => expect(document.activeElement).toBe(current))
    expect([current.selectionStart, current.selectionEnd]).toEqual([2, 4])
    current.value = 'ff0001'
    current.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    expect(document.querySelector('[aria-label="Hue"]')?.getAttribute('aria-valuenow')).toBe('359.8')
  })
  it('外部回填红色时色相同步，灰色仍保留原色相', async () => {
    render({}, '#00ff00'); await open()
    apply('#808080'); await flushPromises()
    expect(document.querySelector('[aria-label="Hue"]')?.getAttribute('aria-valuenow')).toBe('120.0')
    apply('#ff0000'); await flushPromises()
    expect(document.querySelector('[aria-label="Hue"]')?.getAttribute('aria-valuenow')).toBe('0.0')
  })
  it('点击打开真正的 popover 和 SketchPicker，取色按钮可见', async () => {
    render(); await open()
    expect(palettes()).toHaveLength(1)
    expect(document.querySelector('.vc-sketch-picker')).not.toBeNull()
    expect(document.querySelector('[aria-label="画布取色"]')).not.toBeNull()
  })
  it.each(['disabled', 'settingDisabled'])('%s 阻止展开', async prop => {
    render({ [prop]: true }); await open()
    expect(pickerState.activePickerId).toBeNull()
    expect(palettes()).toHaveLength(0)
  })
  it('showEyeDropper=false 隐藏入口', async () => {
    render({ showEyeDropper: false }); await open()
    expect(document.querySelector('[aria-label="画布取色"]')).toBeNull()
  })
  it('isNeedGradient=false 只显示纯色选项', async () => {
    render({ isNeedGradient: false }); await open()
    expect(palettes()[0].querySelectorAll('input[type="radio"]')).toHaveLength(1)
  })
  it('打开、修改、关闭后只提交一次最终色', async () => {
    const picker = render(); await open()
    input('#ff0000'); await nextTick(); input('#00ff00'); await flushPromises()
    await open()
    expect(picker.emitted('sessionCommit')).toEqual([['rgba(0, 255, 0, 1)']])
  })
  it('没有改动就关闭不提交', async () => {
    const picker = render(); await open(); await open()
    expect(picker.emitted('sessionCommit')).toBeUndefined()
  })
  it('卸载时提交尚未关闭的会话一次', async () => {
    const picker = render(); await open(); input('#123456'); await flushPromises()
    wrapper!.unmount(); wrapper = undefined
    expect(picker.emitted('sessionCommit')).toEqual([['rgba(18, 52, 86, 1)']])
    expect(pickerState.activePickerId).toBeNull()
  })
  it('两个真实 picker 切换时提交前一个会话', async () => {
    render({}, '#112233', true); await open(); input('#123456'); await flushPromises(); await open(1)
    expect(pickerState.activePickerId).toBe('audit-b')
    expect(wrapper!.findAllComponents(ColorPicker)[0].emitted('sessionCommit')).toHaveLength(1)
    expect((wrapper!.vm as unknown as { other: string }).other).toBe('#abcdef')
  })
  it('applyPickedColor 修改当前颜色并取消 picking 标记', async () => {
    const picker = render(); await open()
    document.querySelector<HTMLButtonElement>('[aria-label="画布取色"]')!.click()
    expect(picker.emitted('pick-request')?.[0]).toEqual([{ pickerId: 'audit-a', color: '#112233' }])
    apply('#abcdef80'); await flushPromises()
    expect(pickerState.pickingPickerId).toBeNull()
    expect(picker.props('modelValue')).toBe(`rgba(171, 205, 239, ${128 / 255})`)
  })
  it('旋转渐变保留三个色标', async () => {
    const picker = render({}, 'linear-gradient(90deg, red 0%, blue 30%, white 100%)'); await open()
    document.querySelector<HTMLButtonElement>('[aria-label="顺时针旋转90°"]')!.click()
    await flushPromises()
    expect(parseGradient(picker.props('modelValue')!)).toEqual({
      angle: '180deg',
      colorStops: [
        { color: 'red', offset: 0 }, { color: 'blue', offset: 0.3 }, { color: 'white', offset: 1 },
      ],
    })
  })
  it('[UI-01] 未登录也应发出公共 sessionCommit 事件', async () => {
    const picker = render({ getUserId: () => '' }); await open(); input('#ff0000'); await flushPromises(); await open()
    expect(picker.emitted('sessionCommit')).toEqual([['rgba(255, 0, 0, 1)']])
  })
  it('[UI-02] 调色板触发器支持键盘聚焦', () => {
    render()
    const trigger = wrapper!.find('.half-picker-trigger').element as HTMLElement
    expect(trigger.tabIndex).toBeGreaterThanOrEqual(0)
  })
  it('[UI-03] 自定义 trigger slot 可打开调色板', async () => {
    render({}, '#112233', false, true)
    await wrapper!.find('[data-custom]').trigger('click'); await flushPromises()
    expect(palettes()).toHaveLength(1)
  })
  it('[UI-04] 打开期间父组件更新渐变应同步色标', async () => {
    render({}, 'linear-gradient(90deg, red, blue)'); await open()
    ;(wrapper!.vm as unknown as { color: string }).color = 'linear-gradient(180deg, white, black)'
    await flushPromises()
    const slider = wrapper!.findComponent(SliderColorSetting)
    expect(slider.props('sliderButtons').map((s: { color: string }) => s.color)).toEqual(['white', 'black'])
  })
  it('[UI-05] 从纯色选择历史渐变后切换到渐变编辑模式', async () => {
    const picker = render()
    const history = useRecentColors(); history.setUserId('alice'); history.changeUseColor('linear-gradient(90deg, red, blue)')
    await open()
    document.querySelector<HTMLButtonElement>('button[aria-label^="历史颜色"]')!.click()
    await flushPromises()
    expect(picker.props('modelValue')).toBe('linear-gradient(90deg, red, blue)')
    expect(wrapper!.findComponent(SliderColorSetting).exists()).toBe(true)
  })
  it('Escape 关闭面板并将焦点还给默认触发器', async () => {
    render(); await open()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await flushPromises()
    const trigger = wrapper!.find('.half-picker-trigger').element
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)
  })
  it('取色期间 Escape 留给取色浮层处理', async () => {
    render(); await open()
    document.querySelector<HTMLButtonElement>('[aria-label="画布取色"]')!.click()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(wrapper!.find('.half-picker-trigger').attributes('aria-expanded')).toBe('true')
  })
  it('禁用状态下自定义 trigger 不会展开', async () => {
    render({ disabled: true }, '#112233', false, true)
    await wrapper!.find('[data-custom]').trigger('click'); await flushPromises()
    expect(palettes()).toHaveLength(0)
  })
  it('外部渐变更新不回写格式或制造用户提交', async () => {
    const picker = render({}, 'linear-gradient(90deg, red, blue)'); await open()
    const updates = picker.emitted('update:modelValue')?.length ?? 0
    const external = 'linear-gradient(to bottom, white, black)'
    ;(wrapper!.vm as unknown as { color: string }).color = external
    await flushPromises()
    expect(picker.props('modelValue')).toBe(external)
    expect(picker.emitted('update:modelValue')?.length ?? 0).toBe(updates)
    await open()
    expect(picker.emitted('sessionCommit')).toBeUndefined()
  })
  it('编辑过后外部撤销会恢复原值，不提交已撤销的颜色', async () => {
    const picker = render(); await open(); input('#ff0000'); await flushPromises()
    ;(wrapper!.vm as unknown as { color: string }).color = '#112233'
    await flushPromises(); await open()
    expect(picker.emitted('sessionCommit')).toBeUndefined()
  })
  it('HEX8 预览保留原 alpha，非法宿主色值仍能渲染并恢复', async () => {
    render({}, '#11223380')
    const right = wrapper!.find('.half-trigger-color.right').element as HTMLElement
    expect(parseColorToRGBA(right.style.backgroundColor).a).toBeCloseTo(128 / 255, 2)
    ;(wrapper!.vm as unknown as { color: string }).color = '#invalid'
    await flushPromises()
    expect(wrapper!.find('.half-picker-trigger').exists()).toBe(true)
    apply('#ff0000'); await flushPromises()
    expect((wrapper!.vm as unknown as { color: string }).color).toBe('rgba(255, 0, 0, 1)')
  })
  it('会话中的账号切换不把 Alice 的编辑写入 Bob 历史', async () => {
    let userId = 'alice'
    render({ getUserId: () => userId }); await open(); input('#ff0000'); await flushPromises()
    userId = 'bob'; await open(); await open()
    const api = useRecentColors()
    expect(api.findUserIdColors('alice')).toEqual(['rgba(255, 0, 0, 1)'])
    expect(api.findUserIdColors('bob')).toEqual([])
  })
})

describe('宿主取色 session 生命周期', () => {
  it('确认返回正确 pickerId 并清空 pending', () => {
    let session!: ReturnType<typeof useColorPickerSession>
    wrapper = mount(defineComponent({ setup() { session = useColorPickerSession(); return () => null } }))
    session.onPickRequest({ pickerId: 'a', color: '#fff' })
    expect(session.pending.value?.pickerId).toBe('a')
    expect(session.onPickConfirm('#123456')).toBe('a')
    expect(session.pending.value).toBeNull()
    expect(session.onPickConfirm('#fff')).toBeNull()
  })
  it('关闭和卸载都会清理未完成的 session', () => {
    let session!: ReturnType<typeof useColorPickerSession>
    wrapper = mount(defineComponent({ setup() { session = useColorPickerSession(); return () => null } }))
    session.onPickRequest({ pickerId: 'a', color: '#fff' }); session.onPickClose()
    expect(session.pending.value).toBeNull()
    session.onPickRequest({ pickerId: 'b', color: '#000' }); wrapper.unmount(); wrapper = undefined
    expect(session.pending.value).toBeNull()
  })
})
