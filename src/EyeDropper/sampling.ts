/** 将视口坐标映射到截图像素，不叠加滚动量或假定 devicePixelRatio。 */
export function samplePoint(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  width: number,
  height: number,
) {
  if (
    rect.width <= 0
    || rect.height <= 0
    || clientX < rect.left
    || clientY < rect.top
    || clientX >= rect.left + rect.width
    || clientY >= rect.top + rect.height
  ) {
    return null
  }
  return {
    x: Math.min(width - 1, Math.floor(((clientX - rect.left) * width) / rect.width)),
    y: Math.min(height - 1, Math.floor(((clientY - rect.top) * height) / rect.height)),
  }
}
