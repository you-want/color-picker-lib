import { COLOR_NAMES } from './colorNames'

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
    normalizedOpacity = clamp(normalizedOpacity, 0, 1)

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
  if (!color || parseGradient(color)) {
    return color || '#FFFFFF'
  }
  let parsed: ReturnType<typeof parseColorToRGBA>
  try {
    parsed = parseColorToRGBA(color)
  } catch {
    return color || '#FFFFFF'
  }
  const clean = color.trim().toLowerCase()
  const explicitAlpha = clean === 'transparent'
    || /^#?(?:[\da-f]{4}|[\da-f]{8})$/i.test(clean)
    || (/^(?:rgba?|hsla?)\(/.test(clean) && (clean.includes('/') || clean.split(',').length === 4))
  const alpha = explicitAlpha ? parsed.a : clamp(fillOpacityPercent / 100, 0, 1)
  return `rgba(${Math.round(parsed.r)}, ${Math.round(parsed.g)}, ${Math.round(parsed.b)}, ${alpha})`
}

/** vue-color SketchPicker @input  payload → 带透明度的 rgba / hex 字符串 */
export function sketchPickerInputToColorString(colors: unknown): string {
  try {
    if (typeof colors === 'string') return colorToRGBA(colors)
    if (!colors || typeof colors !== 'object') return ''
    const payload = colors as { hex?: string, hex8?: string, a?: number, rgba?: RGBAColor }
    if (payload.rgba) {
      const { r, g, b, a } = payload.rgba
      if (![r, g, b, a].every(value => typeof value === 'number' && Number.isFinite(value))) return ''
      return formatColor({ r: Math.round(clamp(r, 0, 255)), g: Math.round(clamp(g, 0, 255)), b: Math.round(clamp(b, 0, 255)), a: clamp(a, 0, 1) })
    }
    if (payload.hex8) return colorToRGBA(payload.hex8)
    if (payload.hex) return colorToRGBA(payload.hex, payload.a ?? null)
  } catch {
    // 输入过程中的不完整 payload 不提交给宿主。
  }
  return ''
}

export function colorToRGBA(colorString: string, alpha: number | null = null): string {
  if (!colorString || typeof colorString !== 'string') throw new Error('Invalid color string')
  const color = colorString.trim().toLowerCase()
  const parsed = parseColorToRGBA(color)
  return formatColor({ ...parsed, a: alpha === null ? parsed.a : clamp(alpha, 0, 1) })
}
/**
 * HSV 转 RGBA
 */
export function hsvToRGBA(hsvString: string, alpha = 1): string {
  return formatColor({ ...hsvStringToRGBA(hsvString.trim().toLowerCase()), a: clamp(alpha, 0, 1) })
}

/** HSVA 转 RGBA，未显式覆盖 alpha 时保留原值。 */
export function hsvaToRGBA(hsvaString: string, alpha: number | null = null): string {
  const parsed = hsvStringToRGBA(hsvaString.trim().toLowerCase())
  return formatColor({ ...parsed, a: alpha === null ? parsed.a : clamp(alpha, 0, 1) })
}
/**
 * 处理 RGB/RGBA 颜色
 */
export function handleRGB(rgbString: string, alpha: number | null = null): string {
  const parsed = rgbStringToRGBA(rgbString.trim().toLowerCase())
  return formatColor({ ...parsed, a: alpha === null ? parsed.a : clamp(alpha, 0, 1) })
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
export function hexToRGBA(hexString: string, alpha: number | null = null): string {
  const parsed = hexToRGBAObj(hexString.trim())
  return formatColor({ ...parsed, a: alpha === null ? parsed.a : clamp(alpha, 0, 1) })
}
/**
 * 解析颜色字符串为RGBA对象
 */
export function parseColorToRGBA(colorStr: string, fallbackColor = '#000000'): RGBAColor {
  if (!colorStr || typeof colorStr !== 'string' || !colorStr.trim()) {
    if (!fallbackColor?.trim()) throw new Error('Invalid fallback color')
    colorStr = fallbackColor
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
  if (color.startsWith('hsv')) return hsvStringToRGBA(color)

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
const CSS_NUMBER = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?'
const NUMBER_TOKEN = new RegExp(`^${CSS_NUMBER}(%)?$`, 'i')
const ANGLE_TOKEN = new RegExp(`^(${CSS_NUMBER})(deg|grad|rad|turn)?$`, 'i')

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) throw new Error('Color channels must be finite')
  return Math.max(min, Math.min(max, value))
}

function channel(token: string, max: number): number {
  const match = token.match(NUMBER_TOKEN)
  if (!match) throw new Error(`Invalid color channel: ${token}`)
  return clamp(Number.parseFloat(token) * (match[1] ? max / 100 : 1), 0, max)
}

function angleDegrees(value: string): number {
  const match = value.trim().match(ANGLE_TOKEN)
  if (!match) throw new Error(`Invalid angle: ${value}`)
  const number = Number(match[1])
  const unit = match[2]?.toLowerCase()
  const degrees = number * (unit === 'turn' ? 360 : unit === 'grad' ? 0.9 : unit === 'rad' ? 180 / Math.PI : 1)
  if (!Number.isFinite(degrees)) throw new Error(`Invalid angle: ${value}`)
  return degrees
}

function functionChannels(value: string, kind: 'rgb' | 'hsl' | 'hsv'): string[] {
  const match = value.match(new RegExp(`^${kind}a?\\(([^()]*)\\)$`, 'i'))
  if (!match) throw new Error(`Invalid ${kind} color: ${value}`)
  const body = match[1].trim()
  const tokens = body.includes(',') ? body.split(/\s*,\s*/) : body.split(/\s*\/\s*/)
  const parts = body.includes(',') ? tokens : [...tokens[0].split(/\s+/), ...tokens.slice(1)]
  if (!body.includes(',') && tokens[0].split(/\s+/).length !== 3) throw new Error(`Invalid ${kind} channels: ${value}`)
  if (tokens.length > (body.includes(',') ? 4 : 2) || ![3, 4].includes(parts.length) || parts.some(part => !part)) {
    throw new Error(`Invalid ${kind} channels: ${value}`)
  }
  return parts
}

function hexToRGBAObj(hex: string): RGBAColor {
  let clean = hex.replace(/^#/, '')
  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(clean)) {
    throw new Error(`无效的十六进制颜色: ${hex}`)
  }
  if (clean.length <= 4) clean = [...clean].map(c => c + c).join('')
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
    a: clean.length === 8 ? Number.parseInt(clean.slice(6, 8), 16) / 255 : 1,
  }
}

function rgbStringToRGBA(value: string): RGBAColor {
  const parts = functionChannels(value, 'rgb')
  return {
    r: Math.round(channel(parts[0], 255)),
    g: Math.round(channel(parts[1], 255)),
    b: Math.round(channel(parts[2], 255)),
    a: parts[3] === undefined ? 1 : channel(parts[3], 1),
  }
}

function hslStringToRGBA(value: string): RGBAColor {
  const parts = functionChannels(value, 'hsl')
  if (!parts[1].endsWith('%') || !parts[2].endsWith('%')) throw new Error(`Invalid HSL percentages: ${value}`)
  const hue = ((angleDegrees(parts[0]) % 360) + 360) % 360
  return {
    ...hslToRGB(hue / 360, channel(parts[1], 1), channel(parts[2], 1)),
    a: parts[3] === undefined ? 1 : channel(parts[3], 1),
  }
}

function hsvStringToRGBA(value: string): RGBAColor {
  const parts = functionChannels(value, 'hsv')
  if (!parts[1].endsWith('%') || !parts[2].endsWith('%')) throw new Error(`Invalid HSV percentages: ${value}`)
  return {
    ...hsvToRGB(angleDegrees(parts[0]), channel(parts[1], 100), channel(parts[2], 100)),
    a: parts[3] === undefined ? 1 : channel(parts[3], 1),
  }
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
function colorNameToRGBA(colorName: string): RGBAColor | null {
  if (colorName === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
  const hex = Object.prototype.hasOwnProperty.call(COLOR_NAMES, colorName) ? COLOR_NAMES[colorName] : undefined
  return hex ? hexToRGBAObj(hex) : null
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
    const hex = Math.round(clamp(num, 0, 255)).toString(16)
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
  const value = angle.trim().toLowerCase().replace(/\s+/g, ' ')
  return Object.prototype.hasOwnProperty.call(directions, value) ? directions[value] : angleDegrees(value)
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
      if (depth < 0) return null
    }
    if (char === ',' && depth === 0) {
      parts.push(match[1].slice(start, i).trim())
      start = i + 1
    }
  }
  if (depth !== 0) return null
  parts.push(match[1].slice(start).trim())
  let angle = '180deg'
  if (/^(?:[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:deg|grad|rad|turn)|to [a-z ]+)$/i.test(parts[0])) {
    angle = parts.shift()!
    try { gradientAngleToDegrees(angle) } catch { return null }
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
  if (!colorStr || parseGradient(colorStr)) return
  const parsed = parseColorToRGBA(colorStr)
  return {
    opaqueHex: rgbToHex(parsed.r, parsed.g, parsed.b).toUpperCase(),
    alphaHex: rgbToHex(parsed.r, parsed.g, parsed.b, true, parsed.a).toUpperCase(),
    rgba: parsed,
  }
}

/** 统一按颜色解析器检测透明度；无效输入使用不透明回退。 */
export function analyzeTransparency(colorString: string) {
  if (!colorString || typeof colorString !== 'string') {
    return { isTransparent: false, alphaValue: 1, rawString: colorString, message: '无效的颜色字符串' }
  }
  const color = colorString.trim().toLowerCase()
  const alphaValue = getColorOpacity(color)
  const isTransparent = alphaValue < 0.001
  const format = color.startsWith('#') ? 'hex'
    : color.match(/^(rgba?|hsla?)\(/)?.[1]
      ?? (Object.prototype.hasOwnProperty.call(COLOR_NAMES, color) || color === 'transparent' ? 'named' : 'unknown')
  return {
    isTransparent, alphaValue, format, rawString: colorString,
    description: isTransparent ? '完全透明' : `透明度: ${(1 - alphaValue).toFixed(2)}`,
  }
}

/** 提取 alpha，支持 HEX / RGB(A) / HSL(A) 及百分比、斜杠语法。 */
export function getColorOpacity(color: string): number {
  if (!color?.trim()) return 1
  try { return parseColorToRGBA(color).a } catch { return 1 }
}
