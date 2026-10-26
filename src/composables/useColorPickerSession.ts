import { onBeforeUnmount, ref } from 'vue'
import { cancelPicking } from '../shared/ColorPickerState'

export interface PickRequest {
  pickerId: string
  color: string
}

/**
 * 宿主取色会话：接收 ColorPicker 的 pick-request，驱动 EyeDropper，
 * 拿到结果后回填当前 picker。包只管 UI 和自己的状态，
 * 画布/面板怎么消费颜色是宿主的事。
 */
export function useColorPickerSession() {
  const pending = ref<PickRequest | null>(null)

  function onPickRequest(req: PickRequest) {
    if (pending.value) cancelPicking(pending.value.pickerId)
    pending.value = req
    // 宿主在此挂载 <EyeDropper :target="canvasEl" @confirm="onPickConfirm" />
  }

  function onPickConfirm(color: string) {
    const req = pending.value
    pending.value = null
    if (req) {
      cancelPicking(req.pickerId)
      // 宿主调 pickerRef.applyPickedColor(color)
      return req.pickerId
    }
    return null
  }

  function onPickClose() {
    if (pending.value) cancelPicking(pending.value.pickerId)
    pending.value = null
  }

  onBeforeUnmount(onPickClose)

  return { pending, onPickRequest, onPickConfirm, onPickClose }
}
