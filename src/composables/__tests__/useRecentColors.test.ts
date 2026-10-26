import { resetRecentColors, useRecentColors } from '../useRecentColors'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

beforeEach(() => {
  localStorage.clear()
  resetRecentColors()
})
afterEach(() => {
  resetRecentColors()
})

describe('useRecentColors（组合式最近颜色，无 pinia）', () => {
  it('提交颜色后写入历史并持久化，重新读取保持一致', () => {
    const api = useRecentColors()
    api.setUserId('u1')
    api.changeUseColor('#ff0000')
    api.changeUseColor('#00ff00')
    expect(api.findUserIdColors('u1')).toEqual(['#00ff00', '#ff0000'])
    const stored = JSON.parse(localStorage.getItem('recenterlyUseColor:v2') || '[]')
    expect(stored.find((item: any) => item.userId === 'u1').colors).toEqual(['#00ff00', '#ff0000'])
  })
  it('语义化去重：纯色同色不同格式只保留一条', () => {
    const api = useRecentColors()
    api.setUserId('u1')
    api.changeUseColor('#ff0000')
    api.changeUseColor('rgb(255, 0, 0)')
    expect(api.findUserIdColors('u1')).toHaveLength(1)
  })
  it('渐变去重基于方向+色标位置+颜色，忽略书写差异', () => {
    const api = useRecentColors()
    api.setUserId('u1')
    api.changeUseColor('linear-gradient(90deg, #ff0000 0%, #0000ff 100%)')
    api.changeUseColor('linear-gradient(90deg,#ff0000 0%,#0000ff 100%)')
    expect(api.findUserIdColors('u1')).toHaveLength(1)
  })
  it('旧 key（recenterlyUseColor）历史迁移到新 key，保留老用户记录', () => {
    localStorage.setItem('recenterlyUseColor', JSON.stringify([
      { userId: 'u1', colors: ['#222', '#111'] },
    ]))
    resetRecentColors()
    const api = useRecentColors()
    expect(api.findUserIdColors('u1')).toEqual(['#111', '#222'])
  })
  it('getUserId 注入的 userId 用于隔离不同用户历史', () => {
    const api = useRecentColors({ getUserId: () => 'alice' })
    api.refreshUserId()
    api.changeUseColor('#abc')
    const other = useRecentColors({ getUserId: () => 'bob' })
    other.refreshUserId()
    expect(other.findUserIdColors('bob')).toEqual([])
    expect(other.findUserIdColors('alice')).toEqual(['#abc'])
  })
  it('未设置 userId 时不写历史', () => {
    const api = useRecentColors()
    api.changeUseColor('#ff0000')
    expect(api.findUserIdColors('')).toEqual([])
    expect(localStorage.getItem('recenterlyUseColor:v2')).toBeNull()
  })
})
