import { gradientAngleToDegrees, parseColorToRGBA, parseGradient } from '../color-utils/ColorUtil'
import { computed, reactive, ref, type Ref } from 'vue'

interface UserColors {
  userId: string
  colors: string[]
}
// 第 1 格是实时颜色，剩下 15 格是已提交的历史。
const HISTORY_LIMIT = 15

function solidColorKey(value: string): string {
  const color = value.trim()
  // 只归一化可完整解析的格式，未知格式保留原文，避免错误合并为默认色。
  if (color) {
    try {
      const { r, g, b, a } = parseColorToRGBA(color)
      if ([r, g, b, a].every(Number.isFinite)) {
        return JSON.stringify([r, g, b, a])
      }
    } catch {
      // 不支持的 CSS 颜色语法仍可作为独立历史项使用。
    }
  }
  return `raw:${color}`
}

function colorKey(value: string): string {
  const gradient = parseGradient(value)
  if (!gradient) {
    return solidColorKey(value)
  }
  const angle = gradient.angle.trim().toLowerCase().replace(/\s+/g, ' ')
  // CSS 的对角方向随容器宽高比变化，不能当成固定 45° 合并。
  const direction = /(?:deg|grad|rad|turn)$/.test(angle) || /^to (?:top|right|bottom|left)$/.test(angle)
    ? ((gradientAngleToDegrees(angle) % 360) + 360) % 360
    : angle
  return JSON.stringify([
    direction,
    gradient.colorStops.map(stop => [solidColorKey(stop.color), stop.offset]),
  ])
}

function uniqueColors(values: unknown[]): string[] {
  const keys = new Set<string>()
  return values.filter((value): value is string => {
    if (typeof value !== 'string' || !value.trim()) {
      return false
    }
    const key = colorKey(value)
    if (keys.has(key)) {
      return false
    }
    keys.add(key)
    return true
  }).slice(0, HISTORY_LIMIT)
}

function readColors(storageKey: string, legacyKey: string): UserColors[] {
  try {
    const current = localStorage.getItem(storageKey)
    const parsed: unknown = JSON.parse(current || localStorage.getItem(legacyKey) || '[]')
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed
      .filter(item => item && ['string', 'number'].includes(typeof item.userId) && Array.isArray(item.colors))
      .map(item => ({
        userId: String(item.userId),
        // 旧 key 是倒序写入的（最新在前），迁移到新 key 时反转回"最新在前"。
        colors: uniqueColors(current ? item.colors : [...item.colors].reverse()),
      }))
  } catch {
    return []
  }
}

export interface RecentColorsApi {
  /** 当前用户的历史颜色（最新在前，最多 15 条）。 */
  userColors: Ref<string[]>
  /** 当前登录用户 id，未登录为空串。 */
  userId: Ref<string>
  /** 提交一次颜色到历史（退出调色板时调用）。 */
  changeUseColor: (value: string, id?: string) => void
  /** 手动设置 userId。 */
  setUserId: (value: string) => void
  /** 依据 getUserId 重新解析当前用户。 */
  refreshUserId: () => void
  findUserIdColors: (id: string) => string[]
}

export interface UseRecentColorsOptions {
  /** 由宿主提供登录态解析，替代原组件内写死的 JWT 取 userId 逻辑。 */
  getUserId?: () => string
  /** localStorage 键，默认 recenterlyUseColor:v2。 */
  storageKey?: string
  /** 旧 key，用于一次性迁移老用户历史，默认 recenterlyUseColor。 */
  legacyKey?: string
}

/**
 * 组合式最近使用颜色，无 pinia 依赖。语义化去重（颜色值+方向+色标位置）
 * 与旧 key 迁移逻辑与原 RecenterlyUseColor store 保持一致。
 * 相同 storageKey 共享历史；每个调用实例有独立的用户上下文。
 */
interface HistoryState {
  colors: UserColors[]
  initialized: boolean
}
const histories = new Map<string, HistoryState>()

function ensureInit(storageKey: string, legacyKey: string): HistoryState {
  // SSR 不在不同请求间共享历史；浏览器内按存储键共享。
  let state = typeof window === 'undefined' ? undefined : histories.get(storageKey)
  if (!state) {
    state = { colors: reactive<UserColors[]>([]), initialized: false }
    if (typeof window !== 'undefined') histories.set(storageKey, state)
  }
  if (!state.initialized) {
    state.colors.splice(0, state.colors.length, ...readColors(storageKey, legacyKey))
    state.initialized = true
  }
  return state
}

export function useRecentColors(options: UseRecentColorsOptions = {}): RecentColorsApi {
  const storageKey = options.storageKey ?? 'recenterlyUseColor:v2'
  const legacyKey = options.legacyKey ?? 'recenterlyUseColor'
  const sharedState = ensureInit(storageKey, legacyKey).colors
  const userId = ref('')

  const userColors = computed(() =>
    sharedState.find(item => item.userId === userId.value)?.colors || [],
  )

  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(sharedState))
    } catch {
      // 隐私模式或存储额度已满时仍可在本次会话中使用。
    }
  }

  function addRecenterlyUserColor(id: string) {
    if (id && !sharedState.some(item => item.userId === id)) {
      sharedState.push({ userId: id, colors: [] })
    }
  }

  function changeUseColor(value: string, id?: string) {
    const targetId = id ?? userId.value
    if (!targetId || !value?.trim()) {
      return
    }
    addRecenterlyUserColor(targetId)
    const entry = sharedState.find(item => item.userId === targetId)!
    // 重新使用已有颜色时移到最前，不重复占用历史位置。
    entry.colors = uniqueColors([value, ...entry.colors])
    persist()
  }

  function setUserId(value: string) {
    userId.value = value
    addRecenterlyUserColor(value)
  }

  function refreshUserId() {
    const id = options.getUserId ? options.getUserId() : ''
    setUserId(id || '')
  }

  function findUserIdColors(id: string): string[] {
    return sharedState.find(item => item.userId === id)?.colors || []
  }

  return {
    userColors,
    userId,
    changeUseColor,
    setUserId,
    refreshUserId,
    findUserIdColors,
  }
}

/** 测试或宿主重置历史（仅清空内存，不动 localStorage）。 */
export function resetRecentColors() {
  for (const state of histories.values()) {
    state.colors.splice(0, state.colors.length)
    state.initialized = false
  }
}
