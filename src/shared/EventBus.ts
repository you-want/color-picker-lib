import type { Emitter } from 'mitt'
import mitt from 'mitt'

// 库内部专用事件总线：解耦 7 个事件协议（渐变角度/色标同步、画布取色回写等），
// 不依赖宿主的全局 eventBus，宿主无需安装 mitt。
interface Events {
  [event: string | symbol]: any
}

const rawEmitter: Emitter<Events> = mitt<Events>()
type Handler = (...args: any[]) => void
const handlerMap = new Map<string | symbol, Map<Handler, (args: any[]) => void>>()

export const eventBus = {
  emit(event: string | symbol, ...args: any[]) {
    rawEmitter.emit(event, args)
  },
  on(event: string | symbol, handler: (...args: any[]) => void) {
    let handlers = handlerMap.get(event)
    if (!handlers) {
      handlers = new Map()
      handlerMap.set(event, handlers)
    }
    if (handlers.has(handler)) return
    const wrapped = (args: any[]) => handler(...(Array.isArray(args) ? args : [args]))
    handlers.set(handler, wrapped)
    rawEmitter.on(event, wrapped)
  },
  off(event: string | symbol, handler: (...args: any[]) => void) {
    const handlers = handlerMap.get(event)
    const wrapped = handlers?.get(handler)
    if (!wrapped) return
    rawEmitter.off(event, wrapped)
    handlers!.delete(handler)
    if (!handlers!.size) handlerMap.delete(event)
  },
  clear() {
    rawEmitter.all.clear()
    handlerMap.clear()
  },
}

export default eventBus
