import { describe, expect, it } from 'vitest'
import {
  analyzeTransparency, colorToRGBA, extractColorHexStringsPureJS,
  getColorOpacity, gradientAngleToDegrees, gradientWithOpacity,
  hexToRGBA, interpolateGradientColor, parseColorToRGBA, parseGradient,
  rgbToHex, sketchPickerInputToColorString, toSketchPickerColorValue,
  hsvToRGBA, hsvaToRGBA,
} from '../../src/color-utils/ColorUtil'
import { samplePoint } from '../../src/EyeDropper/sampling'

describe('颜色公共 API：标准输入', () => {
  it.each([
    ['#f00', [255, 0, 0, 1]], ['#0f08', [0, 255, 0, 8 / 15]],
    ['#123456', [18, 52, 86, 1]], ['#12345680', [18, 52, 86, 128 / 255]],
    ['rgb(1, 2, 3)', [1, 2, 3, 1]], ['rgba(1, 2, 3, 0)', [1, 2, 3, 0]],
    ['hsl(120, 100%, 50%)', [0, 255, 0, 1]],
    ['hsla(240, 100%, 50%, 0.25)', [0, 0, 255, 0.25]],
    ['transparent', [0, 0, 0, 0]], ['white', [255, 255, 255, 1]],
    ['  #ABC  ', [170, 187, 204, 1]],
  ] as const)('解析 %s', (input, expected) => {
    const c = parseColorToRGBA(input)
    expect([c.r, c.g, c.b, c.a]).toEqual([...expected])
  })

  it('256 组 RGBA → HEX8 → RGBA 往返保持字节精度', () => {
    for (let i = 0; i < 256; i++) {
      const c = parseColorToRGBA(rgbToHex(i, 255 - i, (i * 17) % 256, true, i / 255))
      expect(c).toEqual({ r: i, g: 255 - i, b: (i * 17) % 256, a: i / 255 })
    }
  })
  it.each([0, 0.25, 0.5, 1])('SketchPicker 保留 alpha=%s', a => {
    expect(sketchPickerInputToColorString({ rgba: { r: 12, g: 34, b: 56, a } }))
      .toBe(`rgba(12, 34, 56, ${a})`)
  })
  it('HEX8 自身透明度优先于面板 fillOpacity', () => {
    expect(toSketchPickerColorValue('#ff000080', 20)).toBe(`rgba(255, 0, 0, ${128 / 255})`)
  })
  it('无效 SketchPicker payload 不产生色值', () => {
    expect(sketchPickerInputToColorString(null)).toBe('')
    expect(sketchPickerInputToColorString({})).toBe('')
  })
  it('空/单色渐变插值不崩溃', () => {
    expect(interpolateGradientColor([], 50)).toBe('#316BFF')
    expect(interpolateGradientColor([{ position: 20, color: '#f00' }], 50)).toBe('#f00')
  })
  it('负角度及超出首尾的渐变色标被保留', () => {
    const parsed = parseGradient('linear-gradient(-90deg, red -20%, blue 120%)')!
    expect(parsed.angle).toBe('-90deg')
    expect(parsed.colorStops.map(s => s.offset)).toEqual([-0.2, 1.2])
  })
  it('渐变透明度限制到 0–100%', () => {
    expect(gradientWithOpacity('linear-gradient(red, blue)', -10)).toContain('rgba(255, 0, 0, 0)')
    expect(gradientWithOpacity('linear-gradient(red, blue)', 110)).toContain('rgba(255, 0, 0, 1)')
  })
})

describe('颜色公共 API：缺陷复现（按正确结果断言）', () => {
  it('[COLOR-01] CSS green 应为 #008000', () => {
    expect(parseColorToRGBA('green')).toEqual({ r: 0, g: 128, b: 0, a: 1 })
  })
  it('[COLOR-01] HEX 提取也遵循 CSS green 定义', () => {
    expect(extractColorHexStringsPureJS('green')?.opaqueHex).toBe('#008000')
  })
  it('[COLOR-02] HSL 360° 与 0° 同为红色', () => {
    expect(colorToRGBA('hsl(360, 100%, 50%)')).toBe('rgba(255, 0, 0, 1)')
  })
  it('[COLOR-03] HSL 小数饱和度不应截断为整数', () => {
    expect(parseColorToRGBA('hsl(0, 50.5%, 50.5%)')).toEqual({ r: 193, g: 65, b: 65, a: 1 })
  })
  it.each(['#gggggg', '#12zz34'])('[COLOR-04] 非法 HEX %s 明确拒绝，避免 NaN 色值', value => {
    expect(() => parseColorToRGBA(value)).toThrow()
  })
  it('[COLOR-04] hexToRGBA 不接受非十六进制字符', () => {
    expect(() => hexToRGBA('#zzzzzz')).toThrow()
  })
  it('[COLOR-05] RGB 尾随垃圾字符不可当作合法颜色', () => {
    expect(() => parseColorToRGBA('rgb(1, 2, 3)garbage')).toThrow()
  })
  it('[COLOR-06] CSS 斜杠百分比 alpha 可正确提取', () => {
    expect(getColorOpacity('rgba(10 20 30 / 50%)')).toBe(0.5)
  })
  it('[COLOR-07] HSLA 透明度分析与 RGBA 一致', () => {
    expect(analyzeTransparency('hsla(120, 100%, 50%, 0)').isTransparent).toBe(true)
  })
  it('[COLOR-08] turn 角度转换为度', () => {
    expect(gradientAngleToDegrees('0.5turn')).toBe(180)
  })
  it('[COLOR-08] 合法 turn 角度不应变成第三个色标', () => {
    expect(parseGradient('linear-gradient(0.5turn, red, blue)')?.colorStops).toHaveLength(2)
  })
})

describe('取色坐标边界', () => {
  const rect = { left: 10, top: 20, width: 100, height: 50 }
  it.each([
    [10, 20, { x: 0, y: 0 }], [109.99, 69.99, { x: 199, y: 99 }],
    [110, 20, null], [10, 70, null], [9, 20, null], [10, 19, null],
  ])('(%s, %s) 映射符合左闭右开边界', (x, y, expected) => {
    expect(samplePoint(x as number, y as number, rect, 200, 100)).toEqual(expected)
  })
  it('不可见目标不返回坐标', () => {
    expect(samplePoint(10, 20, { ...rect, width: 0 }, 200, 100)).toBeNull()
  })
  it('无效坐标或截图尺寸不会传递负数/NaN 像素', () => {
    expect(samplePoint(NaN, 20, rect, 200, 100)).toBeNull()
    expect(samplePoint(10, 20, rect, 0, 100)).toBeNull()
    expect(samplePoint(10, 20, rect, 200, 0)).toBeNull()
    expect(samplePoint(10, 20, rect, Infinity, 100)).toBeNull()
  })
})

describe('修复后的颜色边界回归', () => {
  it.each([
    ['rebeccapurple', '#663399'], ['orange', '#FFA500'], ['lime', '#00FF00'],
    ['aqua', '#00FFFF'], ['navy', '#000080'], ['DarkSlateGray', '#2F4F4F'],
  ])('CSS 名称 %s 在所有转换入口保持一致', (value, hex) => {
    expect(extractColorHexStringsPureJS(value)?.opaqueHex).toBe(hex)
    expect(colorToRGBA(value)).toBe(colorToRGBA(hex))
  })
  it.each([
    ['rgb(100% 0% 0% / 50%)', { r: 255, g: 0, b: 0, a: 0.5 }],
    ['RGB(300, -20, 0)', { r: 255, g: 0, b: 0, a: 1 }],
    ['hsl(-120deg 100% 50% / 25%)', { r: 0, g: 0, b: 255, a: 0.25 }],
    ['hsl(1.5turn, 100%, 50%)', { r: 0, g: 255, b: 255, a: 1 }],
    ['hsl(200grad 100% 50%)', { r: 0, g: 255, b: 255, a: 1 }],
  ])('解析现代及越界 CSS 输入 %s', (value, expected) => {
    expect(parseColorToRGBA(value)).toEqual(expected)
  })
  it.each([
    '#12345', '#1234567', 'rgba(1 2 3 0.5)', 'hsl(120,50,50)',
    'rgb(1,,3)', 'rgb(1,2,3,1.2.3)', 'rgb(Infinity 0 0)', 'rgb(1e999 0 0)',
    'constructor', 'toString', 'hsl(0,100%,50%)junk',
  ])('非法输入 %s 不返回伪造或 NaN 通道', value => {
    expect(() => parseColorToRGBA(value)).toThrow()
    expect(sketchPickerInputToColorString(value)).toBe('')
  })
  it('HSV/HSVA 共用规范化色相、透明度覆盖和严格校验', () => {
    expect(hsvToRGBA('hsv(-120, 100%, 100%)')).toBe('rgba(0, 0, 255, 1)')
    expect(hsvaToRGBA('hsva(360, 100%, 100%, 0.25)')).toBe('rgba(255, 0, 0, 0.25)')
    expect(hsvaToRGBA('hsva(360, 100%, 100%, 0.25)', 0)).toBe('rgba(255, 0, 0, 0)')
    expect(() => hsvToRGBA('hsv(0,100%,100%)junk')).toThrow()
  })
  it('带斜杠 alpha 的 rgb 不被 fillOpacity 覆盖', () => {
    expect(toSketchPickerColorValue('rgb(255 0 0 / 50%)', 100)).toBe('rgba(255, 0, 0, 0.5)')
    expect(toSketchPickerColorValue('red', 25)).toBe('rgba(255, 0, 0, 0.25)')
  })
  it('无效 SketchPicker 对象不会产生 NaN 色值或抛出异常', () => {
    for (const payload of [{ rgba: {} }, { rgba: { r: NaN, g: 0, b: 0, a: 1 } }, { hex: '#zzzzzz' }, { hex: '#fff', a: Infinity }]) {
      expect(sketchPickerInputToColorString(payload)).toBe('')
    }
  })
  it('角度单位 rad/grad/turn 均不进入色标列表', () => {
    expect(gradientAngleToDegrees(`${Math.PI}rad`)).toBeCloseTo(180)
    expect(gradientAngleToDegrees('200grad')).toBe(180)
    for (const value of ['200grad', '0.5turn', '3.14159rad']) {
      expect(parseGradient(`linear-gradient(${value}, red, blue)`)?.colorStops).toHaveLength(2)
    }
  })
  it('无效角度和不平衡渐变括号安全拒绝', () => {
    expect(() => gradientAngleToDegrees('constructor')).toThrow()
    expect(() => gradientAngleToDegrees('90px')).toThrow()
    for (const value of ['linear-gradient(to nowhere, red, blue)', 'linear-gradient(rgb(1,2,3), blue))', 'linear-gradient(rgb(1,2,3, blue)']) {
      expect(parseGradient(value)).toBeNull()
    }
  })
})
