import { reactive } from 'vue'

// 原 ColorPickerStore（pinia）内部化：多实例协调 + 取色请求分发。
// 模块级组合式状态，不要求宿主装 pinia；取色结果通过 expose 的 applyPickedColor 回填。
export const pickerState = reactive({
  activePickerId: null as string | null,
  pickingPickerId: null as string | null,
})

export function setActivePickerId(id: string | null) {
  if (pickerState.activePickerId !== id) {
    pickerState.pickingPickerId = null
  }
  pickerState.activePickerId = id
}

export function cancelPicking(id: string) {
  if (pickerState.pickingPickerId === id) {
    pickerState.pickingPickerId = null
  }
}

export function closeAllPickers() {
  pickerState.pickingPickerId = null
  pickerState.activePickerId = null
}
