import type { Emitter } from 'mitt'
import mitt from 'mitt'

// 库内部专用事件总线：解耦 7 个事件协议（渐变角度/色标同步、画布取色回写等），
// 不依赖宿主的全局 eventBus，宿主无需安装 mitt。
interface Events {
  [event: string | symbol]: any
}

const rawEmitter: Emitter<Events> = mitt<Events>()
const handlerMap = new WeakMap<(...args: any[]) => void, (args: any[]) => void>()

export const eventBus = {
  emit(event: string | symbol, ...args: any[]) {
    rawEmitter.emit(event, args)
  },
  on(event: string | symbol, handler: (...args: any[]) => void) {
    const wrapped = (args: any[]) => handler(...(Array.isArray(args) ? args : [args]))
    handlerMap.set(handler, wrapped)
    rawEmitter.on(event, wrapped)
  },
  off(event: string | symbol, handler: (...args: any[]) => void) {
    const wrapped = handlerMap.get(handler)
    rawEmitter.off(event, wrapped as (args: any[]) => void)
  },
  clear() {
    ;(rawEmitter as any).all.clear()
  },
}

export default eventBus
