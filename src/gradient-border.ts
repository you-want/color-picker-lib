import type { CSSProperties } from 'vue'
import { interpolateGradientColor, parseGradient } from './color-utils/ColorUtil'

/**
 * 矩形边框的横向渐变：上下边独立按同一方向展开，左右边使用对应端点颜色。
 * 只设置背景层，不改写源渐变。宿主给内容留出 borderWidth 对应的内边距即可。
 */
export function horizontalGradientBorderStyle(color: string, borderWidth = 8): CSSProperties {
  const width = Number.isFinite(borderWidth) ? Math.max(0, borderWidth) : 8
  const gradient = parseGradient(color)
  const stops = gradient?.colorStops.map(stop => ({ position: stop.offset! * 100, color: stop.color }))
  const horizontal = stops
    ? `linear-gradient(90deg, ${stops.map(stop => `${stop.color} ${stop.position}%`).join(', ')})`
    : `linear-gradient(${color}, ${color})`
  const left = stops ? interpolateGradientColor(stops, 0) : color
  const right = stops ? interpolateGradientColor(stops, 100) : color
  return {
    backgroundImage: `${horizontal}, ${horizontal}, linear-gradient(${left}, ${left}), linear-gradient(${right}, ${right})`,
    backgroundPosition: 'left top, left bottom, left center, right center',
    // 左右边不覆盖上下边，避免半透明色在四角重复叠加。
    backgroundSize: `100% ${width}px, 100% ${width}px, ${width}px calc(100% - ${width * 2}px), ${width}px calc(100% - ${width * 2}px)`,
    backgroundRepeat: 'no-repeat',
  }
}
