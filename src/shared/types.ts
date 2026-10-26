/** 颜色渐变色标。id 应在拖拽、改色和重渲染之间保持稳定。 */
export interface ColorStop {
  position: number
  type?: string
  isActive: boolean
  id: string
  color: string
}
