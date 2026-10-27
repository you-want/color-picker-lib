// 组件
export { default as ColorPicker } from './ColorPicker/index.vue'
export { default as EyeDropper } from './EyeDropper/index.vue'
export { default as SliderColorSetting } from './SliderColorSetting/index.vue'
export type { ColorStop, ColorSnapshot, EffectiveColor } from './shared/types'
export { horizontalGradientBorderStyle } from './gradient-border'

// 组合式 / 工具
export { useRecentColors, resetRecentColors } from './composables/useRecentColors'
export type { UseRecentColorsOptions, RecentColorsApi } from './composables/useRecentColors'
export { useColorPickerSession, type PickRequest } from './composables/useColorPickerSession'
export {
  cancelPicking,
  closeAllPickers,
  pickerState,
  setActivePickerId,
} from './shared/ColorPickerState'
export { eventBus } from './shared/EventBus'
export { DEFAULT_COLORS, EXCLUDE_SELECTOR, uuid } from './shared/defaults'

// 类型 / 纯函数
export type { CaptureCanvasOptions } from './EyeDropper/captureCanvas'
export { captureCanvas, repairSnapshotStyles } from './EyeDropper/captureCanvas'
export { isNativeEyeDropperSupported, getNativeEyeDropperHint } from './EyeDropper/nativeSupport'
export { samplePoint } from './EyeDropper/sampling'
export * from './color-utils/ColorUtil'
