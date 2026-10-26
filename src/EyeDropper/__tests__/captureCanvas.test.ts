import { afterEach, describe, expect, it, vi } from 'vitest'
import { captureCanvas, repairSnapshotStyles } from '../captureCanvas'

const { toRaw } = vi.hoisted(() => ({ toRaw: vi.fn() }))
vi.mock('@zumer/snapdom', () => ({ snapdom: { toRaw } }))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('截图伪元素样式恢复', () => {
  it('保留滚动画布的平移容器，背景与组件样式恢复到对应层级', () => {
    const source = document.createElement('div')
    source.scrollLeft = 600
    source.scrollTop = 300
    source.style.overflow = 'auto'
    source.innerHTML = '<div style="background-color:rgb(32,36,59)"><div style="background-color:red"></div></div>'
    const copy = document.createElement('div')
    copy.innerHTML = '<div style="transform:translate(-600px, -300px);will-change:transform"><div><div></div></div></div>'
    repairSnapshotStyles(source, copy)
    const wrapper = copy.firstElementChild as HTMLElement
    expect(wrapper.style.transform).toBe('translate(-600px, -300px)')
    expect(wrapper.style.backgroundColor).toBe('')
    expect(copy.style.overflow).toBe('hidden')
    expect((wrapper.firstElementChild as HTMLElement).style.backgroundColor).toBe('rgb(32, 36, 59)')
    expect((wrapper.firstElementChild!.firstElementChild as HTMLElement).style.backgroundColor).toBe('rgb(255, 0, 0)')
  })
  it('伪元素不占用原始子节点索引，背景和图片资源恢复到正确节点', () => {
    const source = document.createElement('div')
    source.innerHTML = '<div style="background-image:url(https://example.test/tile.png);background-color:blue"></div><div style="background-color:green"></div>'
    const copy = document.createElement('div')
    copy.innerHTML = '<span data-snapdom-pseudo="::before" style="background-image:url(data:image/png;base64,AAAA);background-color:blue"></span><div style="background-color:green"></div><div></div>'
    const getStyle = window.getComputedStyle.bind(window)
    const pseudo = document.createElement('span')
    pseudo.style.setProperty('content', '""')
    pseudo.style.backgroundColor = 'transparent'
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, selector) => selector ? pseudo.style : getStyle(element))
    repairSnapshotStyles(source, copy)
    expect((copy.children[0] as HTMLElement).style.backgroundColor).toBe('transparent')
    expect((copy.children[1] as HTMLElement).style.backgroundColor).toBe('rgb(0, 0, 255)')
    expect((copy.children[1] as HTMLElement).style.backgroundImage).toContain('data:image/png;base64,AAAA')
    expect((copy.children[2] as HTMLElement).style.backgroundColor).toBe('rgb(0, 128, 0)')
  })
  it('不生成 content:none 的伪元素，不修改原始画布', () => {
    const source = document.createElement('div')
    source.innerHTML = '<div style="background-color:blue"></div>'
    const original = source.innerHTML
    const copy = document.createElement('div')
    copy.innerHTML = '<span data-snapdom-pseudo="::before"></span><div></div>'
    const getStyle = window.getComputedStyle.bind(window)
    const pseudo = document.createElement('span')
    pseudo.style.setProperty('content', 'none')
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, selector) => selector ? pseudo.style : getStyle(element))
    repairSnapshotStyles(source, copy)
    expect(copy.querySelector('[data-snapdom-pseudo]')).toBeNull()
    expect(source.innerHTML).toBe(original)
    expect((copy.firstElementChild as HTMLElement).style.backgroundColor).toBe('rgb(0, 0, 255)')
  })
  it('整页截图包含调色板，但排除取色浮层，且不修改页面 DOM', async () => {
    const source = document.createElement('div')
    source.innerHTML = '<div id="palette">调色板</div><div data-eyedropper-overlay>取色浮层</div>'
    const original = source.innerHTML
    toRaw.mockResolvedValue(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><foreignObject width="800" height="600"><div xmlns="http://www.w3.org/1999/xhtml">${original}</div></foreignObject></svg>`,
    )}`)
    let imageSrc = ''
    vi.stubGlobal('Image', class {
      naturalWidth = 800
      naturalHeight = 600
      set src(value: string) {
        imageSrc = value
      }

      get src() {
        return imageSrc
      }

      async decode() {}
    })
    const context = { drawImage: vi.fn() }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
    const result = await captureCanvas(source)
    const svg = decodeURIComponent(imageSrc.slice(imageSrc.indexOf(',') + 1))
    expect(svg).toContain('调色板')
    expect(svg).not.toContain('取色浮层')
    expect(svg).not.toContain('data-eyedropper-overlay')
    expect(source.innerHTML).toBe(original)
    expect(result.width).toBe(800 * window.devicePixelRatio)
    expect(result.height).toBe(600 * window.devicePixelRatio)
  })
  it('改色后二次取色重新截图并按实时样式修复，排除项以数组传给截图库', async () => {
    toRaw.mockClear()
    const buildSvg = (color: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><foreignObject width="800" height="600"><div xmlns="http://www.w3.org/1999/xhtml"><div style="background-color:${color}"></div></div></foreignObject></svg>`,
    )}`
    const source = document.createElement('div')
    source.innerHTML = '<div style="background-color:rgb(255,0,0)"></div>'
    toRaw.mockResolvedValue(buildSvg('rgb(255, 0, 0)'))
    let imageSrc = ''
    vi.stubGlobal('Image', class {
      naturalWidth = 800
      naturalHeight = 600
      set src(value: string) {
        imageSrc = value
      }

      get src() {
        return imageSrc
      }

      async decode() {}
    })
    const context = { drawImage: vi.fn() }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
    await captureCanvas(source)
    expect(toRaw).toHaveBeenCalledTimes(1)
    expect(toRaw).toHaveBeenCalledWith(source, expect.objectContaining({ exclude: ['[data-eyedropper-exclude]'] }))
    // 模拟用户改色：同一个元素变成绿色，截图库仍返回旧红色快照（模拟其内部样式缓存）
    source.innerHTML = '<div style="background-color:rgb(0,128,0)"></div>'
    await captureCanvas(source)
    expect(toRaw).toHaveBeenCalledTimes(2)
    const svg = decodeURIComponent(imageSrc.slice(imageSrc.indexOf(',') + 1))
    expect(svg).toContain('rgb(0, 128, 0)')
    expect(svg).not.toContain('rgb(255, 0, 0)')
  })
  it('被排除的元素保持隐藏占位，样式修复不会让排除内容复活', async () => {
    const source = document.createElement('div')
    source.innerHTML = '<div>画布内容</div><div data-eyedropper-exclude style="background-color:rgb(255,0,0)">敏感区</div>'
    // 模拟 snapdom：排除元素被替换成同位置的 visibility:hidden 占位节点
    toRaw.mockResolvedValue(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><foreignObject width="800" height="600"><div xmlns="http://www.w3.org/1999/xhtml"><div>画布内容</div><div style="display:inline-block;width:100px;height:50px;visibility:hidden;"></div></div></foreignObject></svg>`,
    )}`)
    let imageSrc = ''
    vi.stubGlobal('Image', class {
      naturalWidth = 800
      naturalHeight = 600
      set src(value: string) {
        imageSrc = value
      }

      get src() {
        return imageSrc
      }

      async decode() {}
    })
    const context = { drawImage: vi.fn() }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
    await captureCanvas(source)
    const svg = decodeURIComponent(imageSrc.slice(imageSrc.indexOf(',') + 1))
    // 占位节点保留隐藏样式，原元素的可见性、背景色、文本都不会被写回
    expect(svg).toContain('visibility:hidden')
    expect(svg).not.toContain('rgb(255, 0, 0)')
    expect(svg).not.toContain('敏感区')
  })
  it('显式传入 fast:false 会透传给截图库', async () => {
    toRaw.mockClear()
    const source = document.createElement('div')
    toRaw.mockResolvedValue(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><foreignObject width="100" height="100"><div xmlns="http://www.w3.org/1999/xhtml"></div></foreignObject></svg>`,
    )}`)
    vi.stubGlobal('Image', class {
      naturalWidth = 100
      naturalHeight = 100
      set src(_value: string) {}

      get src() {
        return ''
      }

      async decode() {}
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D)
    await captureCanvas(source, { fast: false })
    expect(toRaw).toHaveBeenCalledWith(source, expect.objectContaining({ fast: false }))
  })
})
