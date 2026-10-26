import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EyeDropper from '../index.vue'
import { samplePoint } from '../sampling'

const { toCanvas } = vi.hoisted(() => ({ toCanvas: vi.fn() }))
vi.mock('../captureCanvas', () => ({ captureCanvas: toCanvas }))
let wrapper: ReturnType<typeof mount> | undefined
let target: HTMLElement
const context = {
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([18, 52, 86, 255]) })),
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  strokeRect: vi.fn(),
}
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
  target = document.createElement('div')
  target.getBoundingClientRect = () => ({ left: 100, top: 50, width: 200, height: 100 }) as DOMRect
  const canvas = document.createElement('canvas')
  canvas.width = 400
  canvas.height = 200
  toCanvas.mockResolvedValue(canvas)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
  vi.clearAllMocks()
})
function overlay() {
  return document.querySelector('[role="dialog"]')!
}
describe('画布取色', () => {
  it('根据截图比例映射视口坐标，支持偏移、缩放和高分屏', () => {
    const rect = { left: 100, top: 50, width: 200, height: 100 }
    expect(samplePoint(125, 60, rect, 400, 200)).toEqual({ x: 50, y: 20 })
    expect(samplePoint(99, 60, rect, 400, 200)).toBeNull()
    expect(samplePoint(300, 60, rect, 400, 200)).toBeNull()
  })
  it('点击时同步采样当前位置，确认后关闭', async () => {
    wrapper = mount(EyeDropper, { props: { target } })
    await flushPromises()
    overlay().dispatchEvent(new MouseEvent('click', { clientX: 125, clientY: 60, bubbles: true }))
    expect(context.getImageData).toHaveBeenLastCalledWith(50, 20, 1, 1)
    expect(wrapper.emitted('confirm')).toEqual([['#123456']])
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(context.strokeRect).toHaveBeenCalledWith(140, 140, 14, 14)
  })
  it('未指定局部画布时可从网页属性栏等区域取色，并在圆内显示单行通道值', async () => {
    vi.spyOn(document.documentElement, 'getBoundingClientRect').mockReturnValue({
      left: 0,
top: 0,
width: 800,
height: 600,
    } as DOMRect)
    wrapper = mount(EyeDropper)
    await flushPromises()
    expect(toCanvas).toHaveBeenCalledWith(document.documentElement, undefined)
    overlay().dispatchEvent(new MouseEvent('click', { clientX: 720, clientY: 80, bubbles: true }))
    expect(context.getImageData).toHaveBeenLastCalledWith(360, 26, 1, 1)
    expect(wrapper.emitted('confirm')).toEqual([['#123456']])
    await flushPromises()
    expect(overlay().textContent).toContain('R:18 G:52 B:86 #123456')
  })
  it('esc 在截图未完成时也能取消，异步截图不会重新激活', async () => {
    let resolve!: (value: HTMLCanvasElement) => void
    toCanvas.mockReturnValue(
      new Promise<HTMLCanvasElement>((done) => {
        resolve = done
      }),
    )
    wrapper = mount(EyeDropper, { props: { target } })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    resolve(document.createElement('canvas'))
    await flushPromises()
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })
  it('右键取消，不提交默认黑色', async () => {
    wrapper = mount(EyeDropper, { props: { target } })
    await flushPromises()
    overlay().dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })
  it('点击画布外部取消，不提交上一次采样值', async () => {
    wrapper = mount(EyeDropper, { props: { target } })
    await flushPromises()
    overlay().dispatchEvent(new MouseEvent('click', { clientX: 20, clientY: 20, bubbles: true }))
    expect(wrapper.emitted('confirm')).toBeUndefined()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
  it('截图失败时展示错误及退出入口', async () => {
    toCanvas.mockRejectedValue(new Error('capture failed'))
    wrapper = mount(EyeDropper, { props: { target } })
    await flushPromises()
    expect(overlay().textContent).toContain('画布取色失败')
    expect(overlay().querySelector('button')!.textContent).toContain('退出取色')
  })
})
