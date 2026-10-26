import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetRecentColors, useRecentColors } from '../../src/composables/useRecentColors'
import { cancelPicking, closeAllPickers, pickerState, setActivePickerId } from '../../src/shared/ColorPickerState'
import { eventBus } from '../../src/shared/EventBus'

beforeEach(() => { localStorage.clear(); resetRecentColors(); closeAllPickers(); eventBus.clear() })
afterEach(() => { vi.restoreAllMocks(); resetRecentColors(); closeAllPickers(); eventBus.clear() })

describe('最近颜色容错与历史限制', () => {
  it.each(['not-json', '{}', 'null', '[null, {}, {"userId":"u","colors":null}]'])('损坏存储 %s 不阻止初始化', stored => {
    localStorage.setItem('recenterlyUseColor:v2', stored)
    expect(useRecentColors().findUserIdColors('u')).toEqual([])
  })
  it('读取时剔除非法历史项，保留数字 userId 的旧数据', () => {
    localStorage.setItem('recenterlyUseColor:v2', JSON.stringify([{ userId: 7, colors: [null, '', 1, '#fff', '#ffffff', '#000'] }]))
    expect(useRecentColors().findUserIdColors('7')).toEqual(['#fff', '#000'])
  })
  it('只保留最近 15 个颜色，重用颜色移到首位', () => {
    const api = useRecentColors(); api.setUserId('u')
    for (let i = 0; i < 20; i++) api.changeUseColor(`#${i.toString(16).padStart(6, '0')}`)
    expect(api.userColors.value).toHaveLength(15)
    expect(api.userColors.value[0]).toBe('#000013')
    expect(api.userColors.value.at(-1)).toBe('#000005')
    api.changeUseColor('#00000a')
    expect(api.userColors.value[0]).toBe('#00000a')
    expect(api.userColors.value).toHaveLength(15)
  })
  it('存储额度耗尽时仍可保存本次内存历史', () => {
    const api = useRecentColors(); api.setUserId('u')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError') })
    expect(() => api.changeUseColor('#123')).not.toThrow()
    expect(api.userColors.value).toEqual(['#123'])
  })
  it('禁止读取 localStorage 时初始化安全降级', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('denied', 'SecurityError') })
    expect(useRecentColors().userColors.value).toEqual([])
  })
  it('resetRecentColors 不删除持久化历史', () => {
    const api = useRecentColors(); api.setUserId('u'); api.changeUseColor('#123')
    resetRecentColors()
    expect(useRecentColors().findUserIdColors('u')).toEqual(['#123'])
  })
  it('[STATE-01] 不同 storageKey 的历史独立持久化', () => {
    const a = useRecentColors({ storageKey: 'project-a', legacyKey: 'legacy-a' })
    const b = useRecentColors({ storageKey: 'project-b', legacyKey: 'legacy-b' })
    a.setUserId('u'); b.setUserId('u')
    a.changeUseColor('#123'); b.changeUseColor('#456')
    expect(a.findUserIdColors('u')).toEqual(['#123'])
    expect(b.findUserIdColors('u')).toEqual(['#456'])
    expect(localStorage.getItem('project-b')).toContain('#456')
  })
  it('[STATE-02] 不同实例的 getUserId 不覆盖另一个实例的当前用户', () => {
    const a = useRecentColors({ getUserId: () => 'alice' }); a.refreshUserId(); a.changeUseColor('#123')
    const b = useRecentColors({ getUserId: () => 'bob' }); b.refreshUserId(); b.changeUseColor('#456')
    expect(a.userId.value).toBe('alice')
    expect(a.userColors.value).toEqual(['#123'])
    expect(b.userColors.value).toEqual(['#456'])
  })
  it('相同存储键与用户仍实时共享历史', () => {
    const a = useRecentColors(); const b = useRecentColors()
    a.setUserId('u'); b.setUserId('u'); a.changeUseColor('#abc')
    expect(b.userColors.value).toEqual(['#abc'])
    b.changeUseColor('#def'); expect(a.userColors.value).toEqual(['#def', '#abc'])
  })
  it('不同存储键读取各自已有的持久化数据', () => {
    localStorage.setItem('a', JSON.stringify([{ userId: 'u', colors: ['#123'] }]))
    localStorage.setItem('b', JSON.stringify([{ userId: 'u', colors: ['#456'] }]))
    expect(useRecentColors({ storageKey: 'a' }).findUserIdColors('u')).toEqual(['#123'])
    expect(useRecentColors({ storageKey: 'b' }).findUserIdColors('u')).toEqual(['#456'])
  })
  it('同名色与不同角度单位语义去重', () => {
    const api = useRecentColors(); api.setUserId('u')
    api.changeUseColor('green'); api.changeUseColor('#008000')
    expect(api.userColors.value).toHaveLength(1)
    api.changeUseColor('linear-gradient(0.5turn, red, blue)')
    api.changeUseColor('linear-gradient(180deg, #f00, #00f)')
    expect(api.userColors.value).toHaveLength(2)
  })
})

describe('picker 协调和事件总线生命周期', () => {
  it('切换 picker 取消之前的取色状态', () => {
    setActivePickerId('a'); pickerState.pickingPickerId = 'a'; setActivePickerId('b')
    expect(pickerState.pickingPickerId).toBeNull()
    expect(pickerState.activePickerId).toBe('b')
  })
  it('取消其他 picker 不打断当前取色', () => {
    pickerState.pickingPickerId = 'a'; cancelPicking('b')
    expect(pickerState.pickingPickerId).toBe('a')
    cancelPicking('a'); expect(pickerState.pickingPickerId).toBeNull()
  })
  it('on/emit/off 保留多个参数且可解绑', () => {
    const handler = vi.fn(); eventBus.on('x', handler); eventBus.emit('x', 1, '#fff')
    expect(handler).toHaveBeenCalledWith(1, '#fff')
    eventBus.off('x', handler); eventBus.emit('x', 2)
    expect(handler).toHaveBeenCalledTimes(1)
  })
  it('[STATE-03] 同一个 handler 订阅不同事件后均可解绑', () => {
    const handler = vi.fn(); eventBus.on('a', handler); eventBus.on('b', handler)
    eventBus.off('a', handler); eventBus.off('b', handler)
    eventBus.emit('a', 'stale'); eventBus.emit('b', 'stale')
    expect(handler).not.toHaveBeenCalled()
  })
  it('解绑未注册 handler 不误删其他监听', () => {
    const active = vi.fn(); eventBus.on('x', active); eventBus.off('x', () => {})
    eventBus.emit('x'); expect(active).toHaveBeenCalledOnce()
  })
  it('重复注册可幂等解绑，clear 后允许重新注册', () => {
    const handler = vi.fn(); eventBus.on('x', handler); eventBus.on('x', handler)
    eventBus.emit('x'); expect(handler).toHaveBeenCalledOnce()
    eventBus.off('x', handler); eventBus.emit('x'); expect(handler).toHaveBeenCalledOnce()
    eventBus.on('x', handler); eventBus.clear(); eventBus.on('x', handler)
    eventBus.emit('x'); expect(handler).toHaveBeenCalledTimes(2)
  })
})
