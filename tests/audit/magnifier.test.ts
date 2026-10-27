import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EyeDropper from '../../src/EyeDropper/index.vue'

const { capture } = vi.hoisted(() => ({ capture: vi.fn() }))
vi.mock('../../src/EyeDropper/captureCanvas', () => ({ captureCanvas: capture }))
let wrapper: VueWrapper | undefined
const context = {
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([18, 52, 86, 255]) })),
  clearRect: vi.fn(), drawImage: vi.fn(), beginPath: vi.fn(),
  moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), strokeRect: vi.fn(),
}
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
})
afterEach(() => { wrapper?.unmount(); vi.restoreAllMocks(); vi.clearAllMocks() })

describe('需求 3.10：放大镜覆盖页面半径 10 CSS px', () => {
  it.each([[1, 1], [2, 2], [1.5, 1.5], [2, 3]])('截图比例 %s × %s 时网格逐像素显示，中心与取色点一致', async (scaleX, scaleY) => {
    const target = document.createElement('div')
    target.getBoundingClientRect = () => ({ left: 100, top: 50, width: 200, height: 100 }) as DOMRect
    const screenshot = document.createElement('canvas')
    screenshot.width = 200 * scaleX; screenshot.height = 100 * scaleY
    capture.mockResolvedValue(screenshot)
    wrapper = mount(EyeDropper, { props: { target } })
    await flushPromises()
    document.querySelector('[data-eyedropper-overlay]')!.dispatchEvent(new MouseEvent('click', { clientX: 150, clientY: 80, bubbles: true }))
    const radiusX = 10 * scaleX; const radiusY = 10 * scaleY
    expect(context.getImageData).toHaveBeenCalledWith(50 * scaleX, 30 * scaleY, 1, 1)
    expect(context.drawImage).toHaveBeenCalledWith(screenshot,
      50 * scaleX - radiusX, 30 * scaleY - radiusY, radiusX * 2 + 1, radiusY * 2 + 1,
      0, 0, (radiusX * 2 + 1) * 14, (radiusY * 2 + 1) * 14)
    expect(context.strokeRect).toHaveBeenCalledWith(radiusX * 14, radiusY * 14, 14, 14)
    expect(wrapper.emitted('confirm')).toEqual([['#123456']])
  })
})
