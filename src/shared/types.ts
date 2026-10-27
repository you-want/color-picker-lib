/** 颜色渐变色标。id 应在拖拽、改色和重渲染之间保持稳定。 */
export interface ColorStop {
  position: number
  type?: string
  isActive: boolean
  id: string
  color: string
}

/** 可恢复的颜色编辑数据；color 为乘入整体透明度后的渲染值。 */
export interface ColorSnapshot {
  sourceColor: string
  fillOpacity: number
}

export interface EffectiveColor extends ColorSnapshot {
  color: string
}
