<script setup lang="ts">
import type { CaptureCanvasOptions } from './captureCanvas'
import { captureCanvas } from './captureCanvas'
import style from './index.module.scss'
import { getNativeEyeDropperHint, isNativeEyeDropperSupported } from './nativeSupport'
import { samplePoint } from './sampling'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

defineOptions({ name: 'EyeDropper' })
const props = defineProps<{
  target?: HTMLElement
  /** 是否检测并提示原生 API 支持情况；取色交互始终使用截图放大镜。 */
  native?: boolean
  /** 截图选项透传。 */
  capture?: CaptureCanvasOptions
}>()
const emit = defineEmits<{
  (e: 'confirm', hex: string): void
  (e: 'close'): void
  (e: 'nativeUnsupported'): void
}>()

// 取样与显示半径一致：13×13 网格，每个网格代表 1 个 CSS 像素（对齐 V2.3 设计稿）。
const RADIUS = 6
const DISPLAY_RADIUS = 6
const STEP = 15
const LENS_SIZE = 200
type TargetRect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>
const sampleRadius = ref({ x: RADIUS, y: RADIUS })
const lensWidth = computed(() => (DISPLAY_RADIUS * 2 + 1) * STEP)
const lensHeight = computed(() => (DISPLAY_RADIUS * 2 + 1) * STEP)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const ready = ref(false)
const valid = ref(false)
const error = ref(false)
const inTarget = ref(false)
const hint = ref('')
const mouse = ref({ x: 0, y: 0 })
const color = ref({ r: 0, g: 0, b: 0, hex: '#000000' })
let disposed = false
let frame = 0
let snapshot: {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
} | null = null

const containerStyle = computed(() => {
  const viewportWidth = typeof window === 'undefined' ? 1024 : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? 768 : window.innerHeight
  let left = mouse.value.x + 20
  let top = mouse.value.y - LENS_SIZE - 16
  if (left + LENS_SIZE > viewportWidth - 8) {
    left = mouse.value.x - LENS_SIZE - 20
  }
  if (top < 8) {
    top = mouse.value.y + 24
  }
  return {
    left: `${Math.max(8, Math.min(left, viewportWidth - LENS_SIZE - 8))}px`,
    top: `${Math.max(8, Math.min(top, viewportHeight - LENS_SIZE - 8))}px`,
  }
})

// 光标三态：加载中等待、画布范围内吸管（默认）、范围外或失败恢复普通箭头。
const overlayClass = computed(() => [
  style['magnifier-overlay'],
  {
    [style['is-loading']]: !ready.value && !error.value,
    [style['is-outside']]: error.value || (ready.value && !inTarget.value),
  },
])

const overlayRef = ref<HTMLDivElement | null>(null)
function applyCursor() {
  const el = overlayRef.value
  const outside = error.value || (ready.value && !inTarget.value)
  const loading = !ready.value && !error.value && !outside
  // 仅改写 overlay 自身光标，不触碰宿主页面 body 光标。
  if (el) {
    el.style.cursor = loading ? 'progress' : outside ? 'default' : ''
  }
}

async function startPick() {
  try {
    const target = props.target || document.documentElement
    const rect = getTargetRect()
    const canvas = await captureCanvas(target, props.capture)
    if (disposed) {
      return
    }
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context || !canvas.width || !canvas.height || !rect.width || !rect.height) {
      throw new Error('无法读取截图像素')
    }
    snapshot = { canvas, context }
    // 采样范围固定为页面半径 6 CSS px（13×13 像素，与放大镜网格一一对应）；截图分辨率只影响源图采样半径。
    sampleRadius.value = {
      x: Math.max(1, Math.round(RADIUS * canvas.width / rect.width)),
      y: Math.max(1, Math.round(RADIUS * canvas.height / rect.height)),
    }
    ready.value = true
    applyCursor()
    // 浏览器不支持原生 API 时给一次提示，仅记录到 hint，不弹窗打扰。
    if (props.native !== false && !isNativeEyeDropperSupported()) {
      hint.value = getNativeEyeDropperHint()
      emit('nativeUnsupported')
    }
  } catch {
    if (!disposed) {
      error.value = true
      applyCursor()
    }
  }
}

function render(x: number, y: number, rect?: TargetRect) {
  if (!ready.value || !snapshot || disposed) {
    return false
  }
  const point = samplePoint(x, y, rect || getTargetRect(), snapshot.canvas.width, snapshot.canvas.height)
  valid.value = !!point
  // 光标状态仅在采样成功时更新为 true；失败时保留 handleMouseMove 已设置的值，
  // 避免 rAF 帧时序导致 inTarget 被错误地翻转回 true（鼠标已移出画布但仍显示吸管光标）。
  if (point) {
    inTarget.value = true
  }
  if (!point) {
    return false
  }
  try {
    const pixel = snapshot.context.getImageData(point.x, point.y, 1, 1).data
    const [r, g, b] = pixel
    color.value = { r, g, b, hex: `#${[r, g, b].map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase()}` }
    const context = canvasRef.value?.getContext('2d')
    if (context) {
      context.imageSmoothingEnabled = false
      const { x: radiusX, y: radiusY } = sampleRadius.value
      const width = lensWidth.value
      const height = lensHeight.value
      context.clearRect(0, 0, width, height)
      context.drawImage(snapshot.canvas, point.x - radiusX, point.y - radiusY, radiusX * 2 + 1, radiusY * 2 + 1, 0, 0, width, height)
      context.beginPath()
      context.strokeStyle = 'rgba(255, 255, 255, 0.35)'
      context.lineWidth = 2
      for (let i = 0; i <= width; i += STEP) {
        context.moveTo(i, 0)
        context.lineTo(i, height)
      }
      for (let i = 0; i <= height; i += STEP) {
        context.moveTo(0, i)
        context.lineTo(width, i)
      }
      context.stroke()
      context.strokeStyle = '#FFFFFF'
      context.lineWidth = 2
      context.strokeRect(DISPLAY_RADIUS * STEP, DISPLAY_RADIUS * STEP, STEP, STEP)
    }
    return true
  } catch {
    error.value = true
    valid.value = false
    applyCursor()
    return false
  }
}
function getTargetRect(): TargetRect {
  const target = props.target || document.documentElement
  const { left, top, width, height } = target.getBoundingClientRect()
  return { left, top, width, height }
}
function isWithinTarget(x: number, y: number, rect: TargetRect) {
  return x >= rect.left && x < rect.left + rect.width && y >= rect.top && y < rect.top + rect.height
}
function handleMouseMove(event: MouseEvent) {
  mouse.value = { x: event.clientX, y: event.clientY }
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => {
    const rect = getTargetRect()
    inTarget.value = isWithinTarget(mouse.value.x, mouse.value.y, rect)
    applyCursor()
    render(mouse.value.x, mouse.value.y, rect)
  })
}
function handleMouseLeave() {
  // 鼠标移出 overlay 时确保恢复默认光标
  inTarget.value = false
  applyCursor()
}
function confirm(event: MouseEvent) {
  mouse.value = { x: event.clientX, y: event.clientY }
  // 点击必须同步采样笔尖当前位置，不能提交上一帧或初始化的黑色。
  if (!render(event.clientX, event.clientY)) {
    if (ready.value && !error.value) {
      close()
    }
    return
  }
  emit('confirm', color.value.hex)
  close()
}
function close() {
  if (disposed) {
    return
  }
  disposed = true
  cancelAnimationFrame(frame)
  snapshot = null
  emit('close')
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopImmediatePropagation()
    close()
  }
}
onMounted(() => {
  window.addEventListener('keydown', onKeydown, true)
  applyCursor()
  startPick()
})
onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(frame)
  snapshot = null
  if (overlayRef.value) {
    overlayRef.value.style.cursor = ''
  }
  window.removeEventListener('keydown', onKeydown, true)
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="overlayRef"
      :class="overlayClass"
      data-eyedropper-overlay
      role="dialog"
      aria-modal="true"
      aria-label="画布取色，点击完成，Esc 或右键取消"
      @mousemove.stop="handleMouseMove"
      @mouseleave="handleMouseLeave"
      @click.stop="confirm"
      @contextmenu.stop.prevent="close"
      @pointerdown.stop
    >
      <div
        :class="style['pick-hint']"
        role="status"
      >
        <span v-if="error">画布取色失败，请退出后重试</span>
        <span v-else-if="!ready">正在准备取色…</span>
        <span v-else>点击画布取色，Esc 或右键取消</span>
        <span
          v-if="hint"
          :class="style['pick-hint-sub']"
        >
          {{ hint }}
        </span>
        <button
          type="button"
          @click.stop="close"
        >
          退出取色
        </button>
      </div>
      <div
        v-show="ready && valid && !error"
        :class="style['magnifier-container']"
        :style="containerStyle"
      >
        <canvas
          ref="canvasRef"
          :width="lensWidth"
          :height="lensHeight"
          :data-sample-radius-x="sampleRadius.x"
          :data-sample-radius-y="sampleRadius.y"
          :data-display-radius-x="DISPLAY_RADIUS"
          :data-display-radius-y="DISPLAY_RADIUS"
          :class="style['mag-canvas']"
        />
        <div :class="style['color-info-pill']">
          R:{{ color.r }} G:{{ color.g }} B:{{ color.b }} {{ color.hex }}
        </div>
      </div>
    </div>
  </Teleport>
</template>
