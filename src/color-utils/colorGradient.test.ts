import { describe, expect, it } from 'vitest'
import { colorToRGBA, getColorOpacity, gradientAngleToDegrees, gradientWithOpacity, interpolateGradientColor, parseGradient } from './ColorUtil'

describe('渐变与透明度回归', () => {
  it('八位和四位 HEX 的透明度不会被取整', () => {
    expect(colorToRGBA('#ff000080')).toBe(`rgba(255, 0, 0, ${128 / 255})`)
    expect(Number(getColorOpacity('#f008'))).toBeCloseTo(8 / 15)
  })
  it('保留所有色标，均分连续缺省的中间位置', () => {
    const gradient = parseGradient(
      'linear-gradient(to right, #f008 10%, rgba(0, 255, 0, 0.25), hsla(200, 50%, 40%, 0.5), #00f 70%, white)',
    )!
    expect(gradient.colorStops.map(item => item.offset)).toEqual([0.1, 0.3, 0.5, 0.7, 1])
    expect(gradient.colorStops[2].color).toBe('hsla(200, 50%, 40%, 0.5)')
    expect(gradientAngleToDegrees(gradient.angle)).toBe(90)
    expect(gradientAngleToDegrees('0deg')).toBe(0)
  })
  it('中间色标不可逆序，首尾缺省位置为 0 和 1', () => {
    expect(parseGradient('linear-gradient(red, blue, green)')!.colorStops.map(stop => stop.offset)).toEqual([
      0,
      0.5,
      1,
    ])
    expect(parseGradient('linear-gradient(red 70%, blue 30%, green)')!.colorStops.map(stop => stop.offset)).toEqual([
      0.7,
      0.7,
      1,
    ])
  })
  it('整体透明度与每个色标相乘，并可从全透明恢复', () => {
    const source = 'linear-gradient(90deg, #ff000080 0%, rgba(0, 255, 0, 0.25) 40%, transparent 100%)'
    const half = parseGradient(gradientWithOpacity(source, 50))!
    expect(half.colorStops.map(stop => stop.color)).toEqual([
      'rgba(255, 0, 0, 0.25098)',
      'rgba(0, 255, 0, 0.125)',
      'rgba(0, 0, 0, 0)',
    ])
    expect(gradientWithOpacity(source, 0)).toContain('rgba(255, 0, 0, 0)')
    expect(gradientWithOpacity(source, 100)).toContain('rgba(0, 255, 0, 0.25)')
  })
  it('添加色标沿用当前位置的颜色和透明度，不插入白色', () => {
    expect(interpolateGradientColor([
      { position: 0, color: '#316BFF' },
      { position: 100, color: 'rgba(49,107,255,0)' },
    ], 50)).toBe('rgba(49, 107, 255, 0.5)')
    expect(interpolateGradientColor([
      { position: 0, color: '#ff0000' },
      { position: 100, color: '#0000ff' },
    ], 25)).toBe('rgba(191, 0, 64, 1)')
  })
  it('多色和相同位置色标按当前渐变顺序取色，保留透明色标的色相', () => {
    const stops = [
      { position: 0, color: 'rgba(255,0,0,0)' },
      { position: 40, color: 'rgba(0,255,0,0)' },
      { position: 40, color: 'rgba(0,0,255,0)' },
      { position: 100, color: 'rgba(0,0,255,0)' },
    ]
    expect(interpolateGradientColor(stops, 20)).toBe('rgba(128, 128, 0, 0)')
    expect(interpolateGradientColor(stops, 40)).toBe('rgba(0, 0, 255, 0)')
    expect(interpolateGradientColor(stops, 100)).toBe(stops[3].color)
  })
})
