import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import EyeDropper from '../index.vue'
import { samplePoint } from '../sampling'

const { toCanvas } = vi.hoisted(() => ({ toCanvas: vi.fn() }))
vi.mock('../captureCanvas', () => ({ captureCanvas: toCanvas }))
let wrapper: ReturnType<typeof mount> | undefined
let target: HTMLElement
let bodyCursor = ''
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
  bodyCursor = document.body.style.cursor
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
  document.body.style.cursor = bodyCursor
})
function overlay() {
  return document.querySelector('[role="dialog"]')!
}
function nextFrame() {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
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
    // 采样范围仍覆盖 10 CSS px；显示网格固定为 13×13 格。
    expect(context.drawImage).toHaveBeenLastCalledWith(expect.any(HTMLCanvasElement), 30, 0, 41, 41, 0, 0, 195, 195)
    expect(context.strokeRect).toHaveBeenCalledWith(90, 90, 15, 15)
    const lens = document.querySelector('[class*=mag-canvas]') as HTMLCanvasElement
    expect(lens.width).toBe(195)
    expect(lens.dataset.displayRadiusX).toBe('6')
    expect(lens.dataset.displayRadiusY).toBe('6')
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
    const lens = document.querySelector('[class*=mag-canvas]') as HTMLCanvasElement
    expect(lens.width).toBe(195)
    expect(context.strokeRect).toHaveBeenLastCalledWith(90, 90, 15, 15)
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
  it('截图准备期间展示加载态，完成后移除加载类', async () => {
    let resolve!: (value: HTMLCanvasElement) => void
    toCanvas.mockReturnValue(
      new Promise<HTMLCanvasElement>((done) => {
        resolve = done
      }),
    )
    wrapper = mount(EyeDropper, { props: { target } })
    expect(overlay().className).toContain('is-loading')
    expect(overlay().className).not.toContain('is-outside')
    resolve(Object.assign(document.createElement('canvas'), { width: 400, height: 200 }))
    await flushPromises()
    expect(overlay().className).not.toContain('is-loading')
  })
  it('鼠标移出取色范围后恢复普通光标，范围内显示吸管光标', async () => {
    wrapper = mount(EyeDropper, { props: { target } })
    await flushPromises()
    overlay().dispatchEvent(new MouseEvent('mousemove', { clientX: 125, clientY: 60, bubbles: true }))
    await nextFrame()
    await nextTick()
    expect(overlay().className).not.toContain('is-outside')
    overlay().dispatchEvent(new MouseEvent('mousemove', { clientX: 20, clientY: 20, bubbles: true }))
    await nextFrame()
    await nextTick()
    expect(overlay().className).toContain('is-outside')
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })
  it('同一动画帧内合并鼠标移动的目标矩形读取', async () => {
    wrapper = mount(EyeDropper, { props: { target } })
    await flushPromises()
    const getRect = vi.spyOn(target, 'getBoundingClientRect')
    getRect.mockClear()

    overlay().dispatchEvent(new MouseEvent('mousemove', { clientX: 120, clientY: 60, bubbles: true }))
    overlay().dispatchEvent(new MouseEvent('mousemove', { clientX: 125, clientY: 60, bubbles: true }))
    overlay().dispatchEvent(new MouseEvent('mousemove', { clientX: 130, clientY: 60, bubbles: true }))
    await nextFrame()

    expect(getRect).toHaveBeenCalledTimes(1)
    expect(context.getImageData).toHaveBeenLastCalledWith(60, 20, 1, 1)
  })
  it('目标移动后按最新矩形映射采样坐标', async () => {
    let left = 100
    target.getBoundingClientRect = () => ({ left, top: 50, width: 200, height: 100 }) as DOMRect
    wrapper = mount(EyeDropper, { props: { target } })
    await flushPromises()

    left = 200
    overlay().dispatchEvent(new MouseEvent('click', { clientX: 225, clientY: 60, bubbles: true }))

    expect(context.getImageData).toHaveBeenLastCalledWith(50, 20, 1, 1)
    expect(wrapper.emitted('confirm')).toEqual([['#123456']])
  })
  it('取色期间不改写页面 body 光标', async () => {
    document.body.style.cursor = 'row-resize'
    wrapper = mount(EyeDropper, { props: { target } })
    await flushPromises()
    overlay().dispatchEvent(new MouseEvent('mousemove', { clientX: 20, clientY: 20, bubbles: true }))

    expect(document.body.style.cursor).toBe('row-resize')
    wrapper.unmount()
    wrapper = undefined
    expect(document.body.style.cursor).toBe('row-resize')
  })
  it('截图完成前的移动不会让光标与放大镜状态脱节，就绪后随首次采样恢复', async () => {
    let resolve!: (value: HTMLCanvasElement) => void
    toCanvas.mockReturnValue(
      new Promise<HTMLCanvasElement>((done) => {
        resolve = done
      }),
    )
    wrapper = mount(EyeDropper, { props: { target } })
    // 加载中移动到画布中心：此时仅加载态，无范围外光标
    overlay().dispatchEvent(new MouseEvent('mousemove', { clientX: 125, clientY: 60, bubbles: true }))
    await nextTick()
    expect(overlay().className).toContain('is-loading')
    expect(overlay().className).not.toContain('is-outside')
    resolve(Object.assign(document.createElement('canvas'), { width: 400, height: 200 }))
    await flushPromises()
    // 等待 mousemove 调度的 rAF 渲染帧执行
    await nextFrame()
    await nextTick()
    expect(overlay().className).not.toContain('is-loading')
    expect(overlay().className).not.toContain('is-outside')
    const magnifier = document.querySelector('[class*=magnifier-container]') as HTMLElement | null
    expect(magnifier?.style.display).not.toBe('none')
  })
})
