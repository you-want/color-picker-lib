import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import ElementPlus from 'element-plus'
import ColorPicker from '../../src/ColorPicker/index.vue'
import { parseColorToRGBA, parseGradient, resolveColorWithOpacity } from '../../src/color-utils/ColorUtil'
import { resetRecentColors, useRecentColors } from '../../src/composables/useRecentColors'
import { useColorPickerSession } from '../../src/composables/useColorPickerSession'
import { closeAllPickers, pickerState } from '../../src/shared/ColorPickerState'
import { eventBus } from '../../src/shared/EventBus'
import type { EffectiveColor } from '../../src/shared/types'

const gradient = 'linear-gradient(90deg, rgba(255, 0, 0, 0.8) 0%, rgba(0, 255, 0, 0.6) 35%, rgba(0, 0, 255, 0.4) 100%)'
let wrapper: VueWrapper | undefined
beforeEach(() => {
  localStorage.clear(); resetRecentColors(); closeAllPickers(); eventBus.clear()
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  // jsdom 仅替换 vue-color 棋盘纹理边界；截图与边框像素另由真实 Chrome 验收。
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect: vi.fn(), translate: vi.fn() } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA6kAAAAASUVORK5CYII=')
})
afterEach(async () => {
  wrapper?.unmount(); wrapper = undefined
  await flushPromises()
  closeAllPickers(); eventBus.clear(); resetRecentColors(); vi.unstubAllGlobals(); vi.restoreAllMocks()
  document.body.innerHTML = ''
})

function render(value = gradient, initialOpacity = 100) {
  const color = ref(value)
  const opacity = ref(initialOpacity)
  const user = ref('alice')
  let session!: ReturnType<typeof useColorPickerSession>
  wrapper = mount(defineComponent({
    components: { ColorPicker },
    setup() {
      session = useColorPickerSession()
      return { color, opacity, getUserId: () => user.value, session }
    },
    template: `<ColorPicker id="requirement-picker" v-model="color" v-model:fill-opacity="opacity"
      :get-user-id="getUserId" @pick-request="session.onPickRequest" />
      <div v-if="session.pending.value" data-picking />`,
  }), { attachTo: document.body, global: { plugins: [ElementPlus] } })
  const picker = wrapper.findComponent(ColorPicker)
  return { color, opacity, user, picker, session }
}
async function toggle() {
  await wrapper!.find('button[aria-label="选择颜色"]').trigger('click')
  await flushPromises()
}
async function setOpacity(value: number) {
  const input = document.querySelector<HTMLInputElement>('input[aria-label="渐变整体透明度"]')!
  input.value = String(value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await flushPromises()
}
function alphas(color: string) {
  return parseGradient(color)!.colorStops.map(stop => parseColorToRGBA(stop.color).a)
}
function latest(picker: ReturnType<typeof render>['picker']): EffectiveColor {
  return picker.emitted('effectiveChange')!.at(-1)![0] as EffectiveColor
}

describe('需求 3.10：渐变整体透明度和可恢复历史', () => {
  it('初始有效颜色可直接用于渲染，源渐变和色标 alpha 保留', async () => {
    const { color, picker } = render(gradient, 50)
    await flushPromises()
    expect(latest(picker)).toMatchObject({ sourceColor: gradient, fillOpacity: 50 })
    expect(alphas(latest(picker).color)).toEqual([0.4, 0.3, 0.2])
    expect(color.value).toBe(gradient)
  })
  it('100 → 0 → 100 恢复全部色标，关闭前不写历史', async () => {
    const { color, opacity, picker } = render()
    await toggle()
    await setOpacity(0)
    expect(opacity.value).toBe(0)
    expect(alphas(latest(picker).color)).toEqual([0, 0, 0])
    expect(color.value).toBe(gradient)
    expect(localStorage.getItem('recenterlyUseColor:v2')).toBeNull()
    await setOpacity(100)
    expect(alphas(latest(picker).color)).toEqual([0.8, 0.6, 0.4])
    expect(parseGradient(latest(picker).color)!.colorStops.map(stop => stop.offset)).toEqual([0, 0.35, 1])
  })
  it('透明度编辑仅在关闭时提交最终有效色，第一格与第二格外观一致', async () => {
    const { picker } = render()
    await toggle(); await setOpacity(25); await setOpacity(50)
    const effective = latest(picker).color
    expect(picker.emitted('sessionCommit')).toBeUndefined()
    expect(document.querySelector('[aria-current="true"]')!.getAttribute('title')).toBe(effective)
    await toggle()
    expect(picker.emitted('sessionCommit')).toEqual([[effective]])
    expect(useRecentColors().findUserIdColors('alice')).toEqual([effective])
    await toggle()
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('button[title]')]
    expect(buttons.slice(0, 2).map(button => button.title)).toEqual([effective, effective])
  })
  it('选择全透明历史能恢复原始色标，重新提高透明度不会丢失颜色', async () => {
    const { color, opacity, picker } = render()
    await toggle(); await setOpacity(0); await toggle()
    color.value = 'linear-gradient(0deg, white, black)'; opacity.value = 100
    await flushPromises(); await toggle()
    document.querySelector<HTMLButtonElement>('button[aria-label^="历史颜色"]')!.click()
    await flushPromises()
    expect(color.value).toBe(gradient)
    expect(opacity.value).toBe(0)
    expect(alphas(latest(picker).color)).toEqual([0, 0, 0])
    await setOpacity(100)
    expect(alphas(latest(picker).color)).toEqual([0.8, 0.6, 0.4])
  })
  it('刷新后历史仍保留源色与透明度，按用户隔离；损坏快照不覆盖颜色', () => {
    const api = useRecentColors()
    const effective = resolveColorWithOpacity(gradient, 50)
    api.changeUseColor(effective, 'alice', { sourceColor: gradient, fillOpacity: 50 })
    api.changeUseColor('#abcdef', 'bob')
    resetRecentColors()
    const restored = useRecentColors()
    expect(restored.findColorSnapshot(effective, 'alice')).toEqual({ sourceColor: gradient, fillOpacity: 50 })
    expect(restored.findColorSnapshot(effective, 'bob')).toEqual({ sourceColor: effective, fillOpacity: 100 })
    restored.changeUseColor(effective, 'alice', { sourceColor: 'not-a-color', fillOpacity: Number.NaN })
    expect(restored.findUserIdColors('alice')).toEqual([effective])
    expect(restored.findColorSnapshot(effective, 'alice')).toEqual({ sourceColor: effective, fillOpacity: 100 })
  })
  it('旧字符串历史按 100% 恢复，避免与当前整体透明度重复相乘', async () => {
    useRecentColors().changeUseColor(gradient, 'alice')
    const { opacity, picker } = render('linear-gradient(0deg, white, black)', 20)
    await toggle()
    document.querySelector<HTMLButtonElement>('button[aria-label^="历史颜色"]')!.click()
    await flushPromises()
    expect(opacity.value).toBe(100)
    expect(alphas(latest(picker).color)).toEqual([0.8, 0.6, 0.4])
  })
  it('关闭面板时外部改变透明度会通知渲染，不制造历史提交', async () => {
    const { opacity, picker } = render()
    opacity.value = 50; await flushPromises()
    expect(alphas(latest(picker).color)).toEqual([0.4, 0.3, 0.2])
    expect(picker.emitted('sessionCommit')).toBeUndefined()
  })
})

describe('需求 3.10：用户切换的会话边界', () => {
  it('打开期间切换用户只向旧用户提交一次，关闭面板并更新历史身份', async () => {
    useRecentColors().changeUseColor('#abcdef', 'bob')
    const { user, picker } = render('#112233')
    await toggle()
    picker.vm.applyPickedColor('#ff0000'); await flushPromises()
    user.value = 'bob'; await flushPromises()
    expect(pickerState.activePickerId).toBeNull()
    expect(picker.emitted('sessionCommit')).toEqual([['rgba(255, 0, 0, 1)']])
    expect(useRecentColors().findUserIdColors('alice')).toEqual(['rgba(255, 0, 0, 1)'])
    expect(useRecentColors().findUserIdColors('bob')).toEqual(['#abcdef'])
    await toggle()
    expect(document.querySelector('button[aria-label^="历史颜色"]')!.getAttribute('title')).toBe('#abcdef')
  })
  it('用户与外部颜色在同一轮更新也不会把新颜色写入旧用户历史', async () => {
    const { color, user, picker } = render('#112233')
    await toggle(); picker.vm.applyPickedColor('#ff0000'); await flushPromises()
    color.value = '#00ff00'; user.value = 'bob'; await flushPromises()
    expect(useRecentColors().findUserIdColors('alice')).toEqual(['rgba(255, 0, 0, 1)'])
    expect(useRecentColors().findUserIdColors('bob')).toEqual([])
  })
  it('取色过程中切换身份会清理宿主 pending，取消结果不会进入新身份', async () => {
    const { user, session, picker } = render('#112233')
    await toggle()
    document.querySelector<HTMLButtonElement>('button[aria-label="画布取色"]')!.click()
    await flushPromises()
    expect(session.pending.value?.pickerId).toBe('requirement-picker')
    user.value = ''; await flushPromises()
    expect(session.pending.value).toBeNull()
    expect(pickerState.pickingPickerId).toBeNull()
    expect(session.onPickConfirm('#ff0000')).toBeNull()
    expect(picker.emitted('sessionCommit')).toBeUndefined()
  })
})
