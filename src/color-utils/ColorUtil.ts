export interface RGBAColor {
  r: number
  g: number
  b: number
  a: number
}

/**
 * 根据现有的颜色字符串以及透明度数字进行组合生成新的颜色字符串
 * @param {string} colorStr - 原始颜色字符串（支持hex、rgb、rgba、hsl、hsla、颜色名等）
 * @param {number} opacity - 透明度（0-100 或 0-1）
 * @param {object} options - 配置选项
 * @returns {string} - 新的颜色字符串
 */
export function combineColorWithOpacity(colorStr: string, opacity: number, options = {}) {
  const defaults = {
    normalizeOpacity: true, // 是否将0-100的透明度转换为0-1
    outputFormat: 'rgba', // 输出格式: 'rgba', 'hex', 'hex8', 'hsl', 'hsla'
    fallbackColor: '#000000', // 解析失败时的回退颜色
  }

  const config = { ...defaults, ...options }

  // 渐变色无法按纯色 RGBA 解析，保持原值返回，避免无意义告警
  if (typeof colorStr === 'string' && colorStr.trim().toLowerCase().includes('linear-gradient(')) {
    return colorStr
  }

  try {
    // 解析颜色字符串为RGBA对象
    const rgba = parseColorToRGBA(colorStr, config.fallbackColor)

    // 处理透明度
    let normalizedOpacity = opacity
    if (config.normalizeOpacity && opacity > 1) {
      normalizedOpacity = opacity / 100
    }
    normalizedOpacity = Math.max(0, Math.min(1, normalizedOpacity))

    // 更新透明度
    rgba.a = normalizedOpacity
    // 根据输出格式返回
    return formatColor(rgba, config.outputFormat)
  } catch (error: unknown) {
    const errorMessage = (error as { message?: string })?.message || ''
    console.warn('颜色解析失败:', errorMessage)
    return config.fallbackColor
  }
}
/**
 * 将各种颜色格式转换为 RGBA
 * @param {string} colorString - 颜色字符串 (HSV, HSVA, 十六进制, 十六进制+透明度)
 * @param {number} alpha - 可选的透明度值 (0-1)，如果提供则覆盖原透明度
 * @returns {string} RGBA 颜色字符串
 */
/**
 * 转为 SketchPicker 的 :value（必须用 rgba 且 a 为 0–1，否则 hex8 时 A 框会固定显示 1）
 */
export function toSketchPickerColorValue(color: string, fillOpacityPercent = 100): string {
  if (!color || color.includes('linear-gradient')) {
    return color || '#FFFFFF'
  }
  let parsed: ReturnType<typeof parseColorToRGBA>
  try {
    parsed = parseColorToRGBA(color)
  } catch {
    return color || '#FFFFFF'
  }
  const clean = color.replace(/\s+/g, '')
  let alpha = parsed.a
  // 6 位 hex / rgb：透明度来自右侧面板 fillOpacity
  if (
    (clean.startsWith('#') && clean.length === 7)
    || (clean.startsWith('rgb(') && !clean.startsWith('rgba('))
  ) {
    alpha = Math.max(0, Math.min(1, fillOpacityPercent / 100))
  }
  return `rgba(${Math.round(parsed.r)}, ${Math.round(parsed.g)}, ${Math.round(parsed.b)}, ${alpha})`
}

/** vue-color SketchPicker @input  payload → 带透明度的 rgba / hex 字符串 */
export function sketchPickerInputToColorString(colors: unknown): string {
  if (typeof colors === 'string') {
    return colorToRGBA(colors)
  }
  if (!colors || typeof colors !== 'object') {
    return ''
  }
  const payload = colors as {
    hex?: string
    hex8?: string
    a?: number
    rgba?: { r: number, g: number, b: number, a: number }
  }
  if (payload.rgba) {
    const { r, g, b, a } = payload.rgba
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`
  }
  if (payload.hex8) {
    return colorToRGBA(payload.hex8)
  }
  if (payload.hex) {
    const alpha = payload.a ?? 1
    if (alpha < 1) {
      const base = parseColorToRGBA(payload.hex)
      return `rgba(${base.r}, ${base.g}, ${base.b}, ${alpha})`
    }
    return colorToRGBA(payload.hex)
  }
  return ''
}

export function colorToRGBA(colorString: string, alpha = null) {
  if (!colorString || typeof colorString !== 'string') {
    throw new Error('Invalid color string')
  }

  // 统一处理为小写并去除空格
  colorString = colorString.trim().toLowerCase()
  // 处理 transparent 关键字
  if (colorString === 'transparent') {
    return 'rgba(0, 0, 0, 0)'
  }
  // HSV 格式: hsv(240, 100%, 100%)
  if (colorString.startsWith('hsv(')) {
    return hsvToRGBA(colorString, 1)
  }
  // --- 新增: HSL 和 HSLA 格式 ---
  // 同时匹配 hsl( 和 hsla(
  if (colorString.startsWith('hsl(') || colorString.startsWith('hsla(')) {
    return hslToRGBA(colorString, alpha)
  }

  // HSVA 格式: hsva(240, 100%, 100%, 0.5)
  if (colorString.startsWith('hsva(')) {
    return hsvaToRGBA(colorString, alpha)
  }

  // 十六进制格式: #ff0000 或 #ff0000ff（带透明度）
  if (colorString.startsWith('#')) {
    return hexToRGBA(colorString, alpha)
  }

  // 如果已经是 RGBA 或 RGB，直接返回或添加透明度
  if (colorString.startsWith('rgba(') || colorString.startsWith('rgb(')) {
    return handleRGB(colorString, alpha)
  }

  throw new Error(`Unsupported color format: ${colorString}`)
}
/**
 * 新增辅助函数: 解析 HSL/HSLA 字符串并转换为 RGBA
 * 例如: hsl(17, 80%, 45%) -> rgba(206, 75, 23, 1)
 */
function hslToRGBA(hslString: string, alphaOverride: number | null): string {
  // 正则匹配:
  // 1. 捕获 hue (数字)
  // 2. 捕获 saturation (数字，忽略%)
  // 3. 捕获 lightness (数字，忽略%)
  // 4. 可选捕获 alpha (数字)
  const match = hslString.match(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+))?\s*\)/)

  if (!match) {
    throw new Error(`Invalid HSL format: ${hslString}`)
  }

  const h = Number.parseFloat(match[1]) // Hue (0-360)
  const s = Number.parseFloat(match[2]) / 100 // Saturation (0-1)
  const l = Number.parseFloat(match[3]) / 100 // Lightness (0-1)

  // 优先使用传入的 alpha，其次使用字符串里的 alpha，最后默认为 1
  let a = 1
  if (alphaOverride !== null) {
    a = alphaOverride
  } else if (match[4]) {
    a = Number.parseFloat(match[4])
  }

  // HSL 转 RGB 算法
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2

  let r = 0
  let g = 0
  let b = 0

  if (h >= 0 && h < 60) {
    r = c
    g = x
    b = 0
  } else if (h >= 60 && h < 120) {
    r = x
    g = c
    b = 0
  } else if (h >= 120 && h < 180) {
    r = 0
    g = c
    b = x
  } else if (h >= 180 && h < 240) {
    r = 0
    g = x
    b = c
  } else if (h >= 240 && h < 300) {
    r = x
    g = 0
    b = c
  } else if (h >= 300 && h < 360) {
    r = c
    g = 0
    b = x
  }

  // 转为 0-255 并取整
  const finalR = Math.round((r + m) * 255)
  const finalG = Math.round((g + m) * 255)
  const finalB = Math.round((b + m) * 255)

  return `rgba(${finalR}, ${finalG}, ${finalB}, ${a})`
}
/**
 * HSV 转 RGBA
 */
export function hsvToRGBA(hsvString: string, alpha = 1) {
  const match = hsvString.match(/hsv\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/)
  if (!match) {
    throw new Error('Invalid HSV color format. Expected: hsv(240, 100%, 100%)')
  }

  const h = Number.parseInt(match[1]) // 0-360
  const s = Number.parseInt(match[2]) // 0-100
  const v = Number.parseInt(match[3]) // 0-100

  const rgb = hsvToRGB(h, s, v)
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

/**
 * HSVA 转 RGBA
 */
export function hsvaToRGBA(hsvaString: string, alpha = null) {
  const match = hsvaString.match(/hsva\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*,\s*([\d.]+)\s*\)/)
  if (!match) {
    throw new Error('Invalid HSVA color format. Expected: hsva(240, 100%, 100%, 0.5)')
  }

  const h = Number.parseInt(match[1])
  const s = Number.parseInt(match[2])
  const v = Number.parseInt(match[3])
  const a = alpha !== null ? alpha : Number.parseFloat(match[4])

  const rgb = hsvToRGB(h, s, v)
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`
}
/**
 * 处理 RGB/RGBA 颜色
 */
export function handleRGB(rgbString: string, alpha = null) {
  // RGBA 格式
  const rgbaMatch = rgbString.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/)
  if (rgbaMatch) {
    const r = rgbaMatch[1]
    const g = rgbaMatch[2]
    const b = rgbaMatch[3]
    const a = alpha !== null ? alpha : Number.parseFloat(rgbaMatch[4])
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }

  // RGB 格式
  const rgbMatch = rgbString.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/)
  if (rgbMatch) {
    const r = rgbMatch[1]
    const g = rgbMatch[2]
    const b = rgbMatch[3]
    const a = alpha !== null ? alpha : 1
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }

  throw new Error('Invalid RGB color format')
}

/**
 * HSV 颜色空间转 RGB
 */
export function hsvToRGB(h: number, s: number, v: number) {
  // 将 HSV 值规范化
  h = h % 360
  if (h < 0) {
    h += 360
  }
  s = Math.max(0, Math.min(100, s)) / 100
  v = Math.max(0, Math.min(100, v)) / 100

  const c = v * s
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = v - c

  let r, g, b

  if (h >= 0 && h < 60) {
    [r, g, b] = [c, x, 0]
  } else if (h >= 60 && h < 120) {
    [r, g, b] = [x, c, 0]
  } else if (h >= 120 && h < 180) {
    [r, g, b] = [0, c, x]
  } else if (h >= 180 && h < 240) {
    [r, g, b] = [0, x, c]
  } else if (h >= 240 && h < 300) {
    [r, g, b] = [x, 0, c]
  } else {
    [r, g, b] = [c, 0, x]
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  }
}
/**
 * 十六进制转 RGBA
 */
export function hexToRGBA(hexString: string, alpha = null) {
  // 移除 # 号
  let hex = hexString.replace('#', '')

  // 处理 3位十六进制 (#rgb)
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  }

  // 处理 4位十六进制 (#rgba) - 包含透明度
  if (hex.length === 4) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
  }

  // 处理 6位十六进制 (#rrggbb)
  if (hex.length === 6) {
    const r = Number.parseInt(hex.substr(0, 2), 16)
    const g = Number.parseInt(hex.substr(2, 2), 16)
    const b = Number.parseInt(hex.substr(4, 2), 16)
    const a = alpha !== null ? alpha : 1
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }

  // 处理 8位十六进制 (#rrggbbaa) - 包含透明度
  if (hex.length === 8) {
    const r = Number.parseInt(hex.substr(0, 2), 16)
    const g = Number.parseInt(hex.substr(2, 2), 16)
    const b = Number.parseInt(hex.substr(4, 2), 16)
    const a = alpha !== null ? alpha : Number.parseInt(hex.substr(6, 2), 16) / 255
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }

  throw new Error('Invalid hex color format. Expected: #rgb, #rgba, #rrggbb, or #rrggbbaa')
}
/**
 * 解析颜色字符串为RGBA对象
 */
export function parseColorToRGBA(colorStr: string, fallbackColor = '#000000'): RGBAColor {
  if (!colorStr || typeof colorStr !== 'string') {
    return parseColorToRGBA(fallbackColor)
  }

  const color = colorStr.trim().toLowerCase()

  // 十六进制颜色
  if (color.startsWith('#')) {
    return hexToRGBAObj(color)
  }

  // rgb/rgba颜色
  if (color.startsWith('rgb') || color.startsWith('rgba')) {
    return rgbStringToRGBA(color)
  }

  // hsl/hsla颜色
  if (color.startsWith('hsl')) {
    return hslStringToRGBA(color)
  }

  // 颜色名称
  const namedColor = colorNameToRGBA(color)
  if (namedColor) {
    return namedColor
  }

  // 默认尝试解析为十六进制（无#前缀）
  if (/^[0-9a-f]{3,8}$/i.test(color)) {
    return hexToRGBAObj(`#${color}`)
  }

  throw new Error(`无法解析的颜色格式: ${colorStr}`)
}

/**
 * 十六进制转RGBA
 */
function hexToRGBAObj(hex: string) {
  let hexClean = hex.replace(/^#/, '')

  // 处理简写格式
  if (hexClean.length === 3) {
    hexClean = hexClean.split('').map(c => c + c).join('')
  } else if (hexClean.length === 4) {
    hexClean = hexClean.split('').map(c => c + c).join('')
  }

  // 验证长度
  if (![6, 8].includes(hexClean.length)) {
    throw new Error(`无效的十六进制颜色: ${hex}`)
  }

  const r = Number.parseInt(hexClean.substring(0, 2), 16)
  const g = Number.parseInt(hexClean.substring(2, 4), 16)
  const b = Number.parseInt(hexClean.substring(4, 6), 16)
  let a = 1

  if (hexClean.length === 8) {
    a = Number.parseInt(hexClean.substring(6, 8), 16) / 255
  }

  return { r, g, b, a }
}

/**
 * RGB字符串转RGBA
 */
function rgbStringToRGBA(rgbString: string) {
  const match = rgbString.match(
    /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)/i,
  )

  if (!match) {
    throw new Error(`无效的RGB颜色: ${rgbString}`)
  }

  const r = Math.min(255, Number.parseInt(match[1], 10))
  const g = Math.min(255, Number.parseInt(match[2], 10))
  const b = Math.min(255, Number.parseInt(match[3], 10))
  const a = match[4] ? Number.parseFloat(match[4]) : 1

  return { r, g, b, a }
}

/**
 * HSL字符串转RGBA
 */
function hslStringToRGBA(hslString: string) {
  const match = hslString.match(
    /hsla?\(\s*(\d{1,3})\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)\s*)?\)/i,
  )

  if (!match) {
    throw new Error(`无效的HSL颜色: ${hslString}`)
  }

  const h = Number.parseInt(match[1], 10) / 360
  const s = Number.parseInt(match[2], 10) / 100
  const l = Number.parseInt(match[3], 10) / 100
  const a = match[4] ? Number.parseFloat(match[4]) : 1

  // HSL转RGB
  const rgb = hslToRGB(h, s, l)
  return { ...rgb, a }
}

/**
 * HSL转RGB
 */
function hslToRGB(h: number, s: number, l: number) {
  let r, g, b

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) {
        t += 1
      }
      if (t > 1) {
        t -= 1
      }
      if (t < 1 / 6) {
        return p + (q - p) * 6 * t
      }
      if (t < 1 / 2) {
        return q
      }
      if (t < 2 / 3) {
        return p + (q - p) * (2 / 3 - t) * 6
      }
      return p
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q

    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  }
}

/**
 * 颜色名称转RGBA
 */
function colorNameToRGBA(colorName: string) {
  const colors: Record<string, RGBAColor> = {
    black: { r: 0, g: 0, b: 0, a: 1 },
    white: { r: 255, g: 255, b: 255, a: 1 },
    red: { r: 255, g: 0, b: 0, a: 1 },
    green: { r: 0, g: 255, b: 255, a: 1 },
    blue: { r: 0, g: 0, b: 255, a: 1 },
    yellow: { r: 255, g: 255, b: 0, a: 1 },
    cyan: { r: 0, g: 255, b: 255, a: 1 },
    magenta: { r: 255, g: 0, b: 255, a: 1 },
    gray: { r: 128, g: 128, b: 128, a: 1 },
    grey: { r: 128, g: 128, b: 128, a: 1 },
    transparent: { r: 0, g: 0, b: 0, a: 0 },
  }

  return colors[colorName.toLowerCase()] || null
}

/**
 * 格式化颜色为指定格式
 */
function formatColor(rgba: RGBAColor, format = 'rgba'): string {
  const { r, g, b, a } = rgba

  switch (format.toLowerCase()) {
    case 'rgba':
      return `rgba(${r}, ${g}, ${b}, ${a})`

    case 'rgb':
      return `rgb(${r}, ${g}, ${b})`

    case 'hex':
      return rgbToHex(r, g, b)

    case 'hex8':
      return rgbToHex(r, g, b, true, a)

    case 'hsl': {
      const hsl = rgbToHSL(r, g, b)
      return `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`
    }

    case 'hsla': {
      const hsl2 = rgbToHSL(r, g, b)
      return `hsla(${Math.round(hsl2.h)}, ${Math.round(hsl2.s)}%, ${Math.round(hsl2.l)}%, ${a})`
    }

    default:
      return `rgba(${r}, ${g}, ${b}, ${a})`
  }
}

/**
 * RGB转十六进制
 */
export function rgbToHex(r: number, g: number, b: number, includeAlpha = false, a?: number) {
  const toHex = (num: number) => {
    const hex = Math.round(num).toString(16)
    return hex.length === 1 ? `0${hex}` : hex
  }

  let hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`

  if (includeAlpha && a !== undefined) {
    const alpha = Math.round(a * 255)
    hex += toHex(alpha)
  }

  return hex
}

/**
 * RGB转HSL
 */
function rgbToHSL(r: number, g: number, b: number) {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max === min) {
    h = s = 0
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }

    h /= 6
  }

  return {
    h: h * 360,
    s: s * 100,
    l: l * 100,
  }
}

/**
 * 简化版：生成rgba颜色（最常用）
 */
export function rgba(color: string, opacity = 1) {
  return combineColorWithOpacity(color, opacity, {
    outputFormat: 'rgba',
    normalizeOpacity: true,
  })
}
/**
 * 简化版：生成hex8颜色（带透明度的十六进制）
 */
export function hexWithAlpha(color: string, opacity = 1) {
  return combineColorWithOpacity(color, opacity, {
    outputFormat: 'hex8',
    normalizeOpacity: true,
  })
}
/** CSS 角度：0 向上，90 向右，180 向下。 */
export function gradientAngleToDegrees(angle: string): number {
  const directions: Record<string, number> = {
    'to top': 0,
    'to right': 90,
    'to bottom': 180,
    'to left': 270,
    'to top right': 45,
    'to right top': 45,
    'to bottom right': 135,
    'to right bottom': 135,
    'to bottom left': 225,
    'to left bottom': 225,
    'to top left': 315,
    'to left top': 315,
  }
  return directions[angle.trim().toLowerCase()] ?? (Number.parseFloat(angle) || 0)
}

export function parseGradient(str: string) {
  const match = str.match(/^\s*linear-gradient\(([\s\S]*)\)\s*$/i)
  if (!match) {
    return null
  }
  // 只在括号外分割，保留 rgba/hsla 函数中的逗号。
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < match[1].length; i++) {
    const char = match[1][i]
    if (char === '(') {
      depth++
    }
    if (char === ')') {
      depth--
    }
    if (char === ',' && depth === 0) {
      parts.push(match[1].slice(start, i).trim())
      start = i + 1
    }
  }
  parts.push(match[1].slice(start).trim())
  let angle = '180deg'
  if (/^(?:[+-]?(?:\d+(?:\.\d+)?|\.\d+)deg|to [a-z ]+)$/i.test(parts[0])) {
    angle = parts.shift()!
  }
  const colorStops = parts.map((part) => {
    const stop = part.match(/^(\S(?:.*\S)?)\s+([+-]?(?:\d+(?:\.\d+)?|\.\d+))%$/)
    return { color: stop ? stop[1] : part, offset: stop ? Number(stop[2]) / 100 : (null as number | null) }
  })
  if (colorStops.length < 2 || colorStops.some(stop => !stop.color)) {
    return null
  }
  // CSS 缺省位置规则：首尾补齐，中间色标在相邻显式位置间均分。
  colorStops[0].offset ??= 0
  colorStops[colorStops.length - 1].offset ??= 1
  let previous = 0
  for (let i = 1; i < colorStops.length; i++) {
    if (colorStops[i].offset === null) {
      continue
    }
    colorStops[i].offset = Math.max(colorStops[previous].offset!, colorStops[i].offset!)
    for (let j = previous + 1; j < i; j++) {
      colorStops[j].offset
        = colorStops[previous].offset!
        + ((colorStops[i].offset! - colorStops[previous].offset!) * (j - previous)) / (i - previous)
    }
    previous = i
  }
  return { angle, colorStops }
}

/** 渐变整体透明度与各色标的 alpha 相乘，保留透明色标及原始多色数据。 */
export function gradientWithOpacity(color: string, opacityPercent = 100): string {
  const gradient = parseGradient(color)
  if (!gradient) {
    return color
  }
  const opacity = Math.max(0, Math.min(1, opacityPercent / 100))
  const stops = gradient.colorStops.map((stop) => {
    const c = parseColorToRGBA(stop.color)
    return `rgba(${c.r}, ${c.g}, ${c.b}, ${Number((c.a * opacity).toFixed(6))}) ${stop.offset! * 100}%`
  })
  return `linear-gradient(${gradient.angle}, ${stops.join(', ')})`
}

/** 新增色标沿用当前位置的渐变颜色，使用预乘 alpha 插值，避免插入白色造成跳变。 */
export function interpolateGradientColor(stops: { position: number, color: string }[], position: number): string {
  const sorted = [...stops].sort((a, b) => a.position - b.position)
  if (!sorted.length) {
    return '#316BFF'
  }
  const right = sorted.findIndex(stop => stop.position > position)
  if (right < 0) {
    return sorted[sorted.length - 1].color
  }
  if (right === 0) {
    return sorted[0].color
  }
  const left = sorted[right - 1]
  const next = sorted[right]
  const ratio = (position - left.position) / (next.position - left.position)
  const a = parseColorToRGBA(left.color)
  const b = parseColorToRGBA(next.color)
  const alpha = a.a + (b.a - a.a) * ratio
  const channels = (['r', 'g', 'b'] as const).map(key => Math.round(alpha > 0
    ? (a[key] * a.a * (1 - ratio) + b[key] * b.a * ratio) / alpha
    : a[key] + (b[key] - a[key]) * ratio))
  return `rgba(${channels.join(', ')}, ${Number(alpha.toFixed(6))})`
}
// 纯JS版本（不依赖DOM，支持常见格式）
export function extractColorHexStringsPureJS(colorStr: string) {
  if (!colorStr || (colorStr && colorStr.includes('linear-gradient'))) {
    return
  }
  // 颜色关键字映射
  const colorKeywords: any = {
    red: '#FF0000',
    green: '#00FF00',
    blue: '#0000FF',
    white: '#FFFFFF',
    black: '#000000',
    gray: '#808080',
    yellow: '#FFFF00',
    cyan: '#00FFFF',
    magenta: '#FF00FF',
    silver: '#C0C0C0',
    maroon: '#800000',
    olive: '#808000',
    lime: '#00FF00',
    aqua: '#00FFFF',
    teal: '#008080',
    navy: '#000080',
    fuchsia: '#FF00FF',
    purple: '#800080',
  }

  let r
  let g
  let b
  let a = 1

  // 处理颜色关键字
  const lowerColorStr = colorStr.toLowerCase().trim()
  if (colorKeywords[lowerColorStr]) {
    const hex = colorKeywords[lowerColorStr]
    r = Number.parseInt(hex.slice(1, 3), 16)
    g = Number.parseInt(hex.slice(3, 5), 16)
    b = Number.parseInt(hex.slice(5, 7), 16)
  } else if (/^#?[0-9a-f]{3,4}$/i.test(colorStr)) {
    // 处理 #RGB 或 #RGBA 格式
    const hex = colorStr.replace('#', '')
    const is3Digit = hex.length === 3
    r = Number.parseInt(hex[0] + (is3Digit ? hex[0] : hex[0]), 16)
    g = Number.parseInt(hex[1] + (is3Digit ? hex[1] : hex[1]), 16)
    b = Number.parseInt(hex[2] + (is3Digit ? hex[2] : hex[2]), 16)
    if (hex.length === 4) {
      a = Number.parseInt(hex[3] + hex[3], 16) / 255
    }
  } else if (/^#?[0-9a-f]{6,8}$/i.test(colorStr)) {
    // 处理 #RRGGBB 或 #RRGGBBAA 格式
    const hex = colorStr.replace('#', '')
    r = Number.parseInt(hex.slice(0, 2), 16)
    g = Number.parseInt(hex.slice(2, 4), 16)
    b = Number.parseInt(hex.slice(4, 6), 16)
    if (hex.length === 8) {
      a = Number.parseInt(hex.slice(6, 8), 16) / 255
    }
  } else if (/^rgba?\(/i.test(colorStr)) {
    // 处理 rgb() 或 rgba() 格式
    const match = colorStr.match(/(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/)
    if (match) {
      r = Number.parseInt(match[1])
      g = Number.parseInt(match[2])
      b = Number.parseInt(match[3])
      if (match[4]) {
        a = Number.parseFloat(match[4])
      }
    }
  } else {
    throw new Error('不支持的颜色格式')
    // return
  }

  // 确保值在范围内
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
  r = clamp(r!, 0, 255)
  g = clamp(g!, 0, 255)
  b = clamp(b!, 0, 255)
  a = clamp(a!, 0, 1)

  // 转换函数
  const toHex = (n: number) => {
    const hex = Math.round(n).toString(16)
    return hex.length === 1 ? `0${hex}` : hex
  }

  // 六位十六进制（无透明度）
  const opaqueHex = `#${toHex(r)}${toHex(g)}${toHex(b)}`

  // 八位十六进制（带透明度）
  const alphaValue = Math.round(a * 255)
  const alphaHex = `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(alphaValue)}`

  return {
    opaqueHex: opaqueHex.toUpperCase(),
    alphaHex: alphaHex.toUpperCase(),
    rgba: { r, g, b, a },
  }
}
/**
 * 高级版本：检测颜色字符串的透明度，返回透明度值
 * @param {string} colorString - 颜色字符串
 * @returns {object} - 包含透明度信息和原始透明度值
 */
export function analyzeTransparency(colorString: string) {
  if (!colorString || typeof colorString !== 'string') {
    return {
      isTransparent: false,
      alphaValue: 1,
      rawString: colorString,
      message: '无效的颜色字符串',
    }
  }

  const color = colorString.toLowerCase().trim()
  let alphaValue = 1 // 默认完全不透明
  let isTransparent = false
  let format = 'unknown'

  // 处理十六进制
  if (color.startsWith('#')) {
    format = 'hex'
    const hex = color.slice(1)

    if (hex.length === 8) {
      // #RRGGBBAA 格式
      const alphaHex = hex.slice(6, 8)
      alphaValue = Number.parseInt(alphaHex, 16) / 255
    } else if (hex.length === 4) {
      // #RGBA 格式
      const alphaHex = hex.slice(3, 4)
      alphaValue = Number.parseInt(alphaHex + alphaHex, 16) / 255
    }
    // 其他十六进制格式默认alpha为1

    isTransparent = alphaValue < 0.001
  } else if (color.startsWith('rgb')) {
    format = color.startsWith('rgba') ? 'rgba' : 'rgb'
    const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/)

    if (rgbMatch && rgbMatch[4]) {
      alphaValue = Number.parseFloat(rgbMatch[4])
    }
    // RGB格式默认alpha为1

    isTransparent = Math.abs(alphaValue) < 0.001
  } else if (color === 'transparent') {
    format = 'named'
    alphaValue = 0
    isTransparent = true
  }
  return {
    isTransparent,
    alphaValue,
    format,
    rawString: colorString,
    description: isTransparent ? '完全透明' : `透明度: ${(1 - alphaValue).toFixed(2)}`,
  }
}
/**
 * 提取颜色字符串中的透明度 (Alpha值)
 * @param {string} color - 颜色字符串 (如 #ff0000, rgba(0,0,0,0.5), #00000080)
 * @returns {number} 透明度值 (0 - 1 之间)，如果无法解析则返回 1
 */
export function getColorOpacity(color: string) {
  if (!color) {
    return 1
  }

  // 1. 移除所有空格并转为小写，便于处理
  const cleanColor = color.replace(/\s+/g, '').toLowerCase()

  // 2. 特殊关键字处理
  if (cleanColor === 'transparent') {
    return 0
  }

  // 3. 处理 Hex 格式 (例如: #fff, #ffffff, #fff8, #ffffff80)
  if (cleanColor.startsWith('#')) {
    const hex = cleanColor.slice(1) // 去掉 #

    // #RRGGBBAA (8位)
    if (hex.length === 8) {
      const alphaHex = hex.slice(6, 8)
      const alphaDecimal = Number.parseInt(alphaHex, 16)
      // 保留2位小数，并转回数字类型（如果需要字符串则去掉 Number()）
      return Number((alphaDecimal / 255).toFixed(2))
    }
    // #RGBA (4位)
    if (hex.length === 4) {
      return Number.parseInt(hex.slice(3, 4), 16) / 15
    }
    // #RGB 或 #RRGGBB (没有透明度位)
    return 1
  }

  // 4. 处理 RGBA 或 HSLA 格式
  // 匹配 rgba(...) 或 hsla(...) 中的最后一个数值
  // 支持逗号分隔 rgba(0,0,0,0.5) 或 CSS4 斜杠语法 rgba(0 0 0 / 0.5)
  if (cleanColor.startsWith('rgba') || cleanColor.startsWith('hsla')) {
    // 尝试匹配括号内最后一个数值
    // 逻辑：查找最后一个逗号或斜杠后的数字
    const match = cleanColor.match(/([0-9.]+)\)$/)
    // 也可以使用更通用的分割法：
    // const parts = cleanColor.split(/[,/]/);

    if (match && match[1]) {
      const alpha = Number.parseFloat(match[1])

      // 如果是百分比 (例如 50%)，转换为小数
      if (cleanColor.includes('%') && match[0].includes('%')) { // 简单判断，严谨需更复杂正则
        // 注意：标准CSS中rgba的alpha通常不带%，但hsla的s和l带。
        // 这里的正则取出的通常是纯数字，除非包含%字符
      }

      // 修正范围 (防止无效输入)
      return Math.min(1, Math.max(0, alpha))
    }
  }

  // 5. RGB, HSL 或其他无法识别的格式，默认视为不透明
  return 1
}
