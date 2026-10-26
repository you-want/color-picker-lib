import { snapdom } from '@zumer/snapdom'

const IMAGE_PROPERTIES = [
  'background-image',
  'border-image-source',
  'list-style-image',
  'border-image-slice',
  'border-image-width',
  'border-image-outset',
  'border-image-repeat',
]
const PSEUDO_ATTRIBUTE = 'data-snapdom-pseudo'

// 排除列表：项目内若有标尺、侧栏、属性面板、取色浮层等非画布元素，可加 data-eyedropper-exclude。
// 注意：不要排除 [data-eyedropper-overlay] 自身（它是浮层根，排除它会导致 toRaw 无有效内容）。
const EXCLUDE_SELECTOR = '[data-eyedropper-exclude]'

function matchesExclude(source: Element, exclude: string[]) {
  return exclude.some((selector) => {
    try {
      return !!source.matches?.(selector)
    } catch {
      return false
    }
  })
}

export function repairSnapshotStyles(original: Element, clone: Element, exclude: string[] = []) {
  const resources = new Map<string, string>()
  // snapdom 用额外的平移容器还原滚动位置；它不是原 DOM 的子节点。
  // 恢复样式时跳过该容器，保留其平移，避免把画布背景等样式写错层级。
  function contentRoot(source: Element, copy: Element) {
    const child = copy.firstElementChild as HTMLElement | null
    if ((source.scrollLeft || source.scrollTop) && copy.children.length === 1
      && child?.style.willChange === 'transform'
      && child.style.transform === `translate(${-source.scrollLeft}px, ${-source.scrollTop}px)`) {
      return child
    }
    return copy
  }
  function remember(source: Element, copy: Element) {
    if (matchesExclude(source, exclude)) {
      return
    }
    const computed = getComputedStyle(source)
    for (const property of IMAGE_PROPERTIES) {
      const value = computed.getPropertyValue(property)
      const inlined = (copy as HTMLElement).style?.getPropertyValue(property)
      if (value.includes('url(') && inlined?.includes('data:')) {
        resources.set(value, inlined)
      }
    }
    Array.from(source.children).forEach((child, i) => {
      const sibling = contentRoot(source, copy).children[i]
      if (sibling) {
        remember(child, sibling)
      }
    })
  }
  function restore(source: Element, copy: Element, pseudo?: string) {
    if (matchesExclude(source, exclude)) {
      // snapdom 把排除元素替换成 visibility:hidden 的同位置占位节点；
      // 不能把原元素的可见样式写回去，否则排除内容会在截图里复活。
      return
    }
    const computed = getComputedStyle(source, pseudo)
    const style = (copy as HTMLElement).style
    // 保留截图库对截图根节点的坐标归零；子节点使用当前计算样式。
    for (const property of Array.from(computed)) {
      const value = computed.getPropertyValue(property)
      const rootPosition = source === original && !pseudo
        && /^(?:position|top|left|right|bottom|z-index|float|clear|transform(?:-origin)?|margin.*|inset.*)$/.test(property)
      // 远程资源沿用截图库已生成的数据 URL。
      if (!rootPosition && !value.includes('url(')) {
        style?.setProperty(property, value)
      }
    }
    for (const property of [...IMAGE_PROPERTIES, 'background-color']) {
      const value = computed.getPropertyValue(property)
      style?.setProperty(property, resources.get(value) || value)
    }
    if (pseudo) {
      return
    }
    const content = contentRoot(source, copy)
    if (content !== copy) {
      style?.setProperty('overflow', 'hidden')
    }
    const children = Array.from(content.children)
    children.filter(child => child.hasAttribute(PSEUDO_ATTRIBUTE)).forEach((child) => {
      const selector = child.getAttribute(PSEUDO_ATTRIBUTE)!
      const content = getComputedStyle(source, selector).content
      if (content === 'none' || content === 'normal') {
        child.remove()
      } else {
        restore(source, child, selector)
      }
    })
    const elements = children.filter(child => !child.hasAttribute(PSEUDO_ATTRIBUTE))
    Array.from(source.children).forEach((child, i) => {
      if (elements[i]) {
        restore(child, elements[i])
      }
    })
  }
  remember(original, clone)
  restore(original, clone)
}

export interface CaptureCanvasOptions {
  /** 是否跳过截图库的空闲调度立即截图（取色场景启动更快）。 */
  fast?: boolean
  /** 排除选择器列表，默认排除标记了 data-eyedropper-exclude 的元素。 */
  exclude?: string[]
}

export async function captureCanvas(
  target: HTMLElement,
  options: CaptureCanvasOptions = {},
): Promise<HTMLCanvasElement> {
  const { fast = true, exclude = [EXCLUDE_SELECTOR] } = options
  const toRawOptions = {
    compress: false,
    scale: 1,
    fast,
    exclude,
  }
  const raw = await snapdom.toRaw(target, toRawOptions)
  const svgString = decodeURIComponent(raw.slice(raw.indexOf(',') + 1))
  const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml')
  const svg = doc.querySelector('svg')
  const clone = svg?.querySelector('foreignObject')?.lastElementChild
  if (!clone) {
    throw new Error('无法生成画布截图')
  }
  // snapdom@1.9.9 按原节点缓存样式快照且无清理入口，改色后二次截图仍渲染旧颜色；
  // 伪元素转 span 后背景内联也可能写到相邻节点。截图副本统一按实时计算样式修复，
  // 排除节点跳过回写以保留截图库生成的隐藏占位。
  repairSnapshotStyles(target, clone, exclude)
  // 全网页取色时不把取色浮层、放大镜和提示本身截进样本。
  clone.querySelectorAll('[data-eyedropper-overlay]').forEach(element => element.remove())
  return renderToCanvas(svg!)
}

async function renderToCanvas(svg: SVGElement): Promise<HTMLCanvasElement> {
  const image = new Image()
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`
  await image.decode()
  const ratio = window.devicePixelRatio || 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(image.naturalWidth * ratio)
  canvas.height = Math.ceil(image.naturalHeight * ratio)
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('无法生成画布截图')
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas
}
