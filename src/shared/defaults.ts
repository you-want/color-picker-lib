// 预设色板常量，原 @/common/Common 的 DEFAULT_COLORS。抽包后作为默认 prop 值。
export const DEFAULT_COLORS = [
  'transparent',
  '#257AE0',
  '#04C160',
  '#FAAD14',
  '#775DDE',
  '#FF3333',
  '#FE6A49',
  '#B620E0',
  '#45D7B6',
  '#3176FF',
  '#FFA19D',
  '#CED3DF',
  '#D7F41C',
  '#07AB58',
  '#000000',
  '#FFFFFF',
]

// 取色器排除选择器：项目内若有标尺、侧栏、属性面板、取色浮层等非画布元素，可加 data-eyedropper-exclude。
// 注意：不要排除 [data-eyedropper-overlay] 自身（它是浮层根，排除它会导致截图无有效内容、浮层无法显示）。
export const EXCLUDE_SELECTOR = '[data-eyedropper-exclude]'

// 生成取色色标唯一 id。原 uuid（v4 去横线小写）。
export function uuid(): string {
  const crypto = globalThis.crypto
  if (crypto?.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').toLowerCase()
  }
  // 无 Web Crypto 时的回退
  const bytes = new Uint8Array(16)
  crypto?.getRandomValues?.(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}
