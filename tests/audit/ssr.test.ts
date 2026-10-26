// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import ElementPlus, { ID_INJECTION_KEY, ZINDEX_INJECTION_KEY } from 'element-plus'
import ColorPicker from '../../src/ColorPicker/index.vue'
import EyeDropper from '../../src/EyeDropper/index.vue'
import { useRecentColors } from '../../src/composables/useRecentColors'

describe('无 DOM 的 SSR', () => {
  it('ColorPicker 首屏渲染无需 localStorage/window', async () => {
    const app = createSSRApp(ColorPicker, { id: 'ssr', modelValue: '#112233' }).use(ElementPlus)
    app.provide(ID_INJECTION_KEY, { prefix: 1024, current: 0 })
    app.provide(ZINDEX_INJECTION_KEY, { current: 0 })
    expect(await renderToString(app)).toContain('选择颜色')
  })
  it('EyeDropper 渲染不会读取未定义的 window', async () => {
    expect(await renderToString(createSSRApp(EyeDropper))).toContain('teleport')
  })
  it('不同服务端请求不共享用户历史', () => {
    const a = useRecentColors(); a.setUserId('u'); a.changeUseColor('#123')
    const b = useRecentColors(); b.setUserId('u')
    expect(b.userColors.value).toEqual([])
  })
})
