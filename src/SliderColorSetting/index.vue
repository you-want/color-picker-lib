<script setup lang="ts">
import type { Props } from './typeDefine.ts'
import { interpolateGradientColor } from '../color-utils/ColorUtil'
// import useDesignerStore from '@/stores/DesignerStore.ts'
import { eventBus } from '../shared/EventBus'
import { uuid } from '../shared/defaults'
import style from './index.module.scss'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

defineOptions({ name: 'SliderColorSetting' })

// 定义props
const props = withDefaults(defineProps<Props>(), {
  degValue: 90,
  step: 1,
  disabled: false,
  size: 'small',
  colorType: 0,
})
// 定义emit事件
const emit = defineEmits<{
  (e: 'sliderPoint', slider: SliderButton): void
  (e: 'updateSliderButtons', payload: SliderButton | number | SliderButton[]): void
  (e: 'gradientUpdate', newValue: string): void
}>()
interface SliderButton {
  position: number
  type: string
  isActive: boolean
  id: string
  color: string
}
let currentHighSliderId: string = ''
// 使用Store
// const pageKey = inject('pageKey') as Ref<string>
const sliderTrackRef = ref<HTMLElement | null>(null)
// const modelValue = defineModel<any[]>({ default: () => [] })
// const moduleValue = defineModel<any[]>()
const qipanBackground
  = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAL0lEQVQ4T2N89uzZfwY8QFJSEp80A+OoAcMiDP4DAb6Ifv78Of50MGoAA+PQDwMAuX5VedFT3cEAAAAASUVORK5CYII='
// 拖拽状态
const isDragging = ref(false)
// 记录拖拽开始时的位置信息
// const selectedWidgetId = computed(() => useDesignerStore().selectedWidgetId(pageKey.value))
// const selectWidgetOptions = computed(() => {
//   if (selectedWidgetId.value) {
//     return useDesignerStore().widget(pageKey.value, selectedWidgetId.value)?.options || {}
//   }
//   return {}
// })
// 计算属性：按位置从小到大排序
const sortedSliderButtons = computed(() => {
  return [...props.sliderButtons].sort((a, b) => a.position - b.position)
})
// 生成最终的渐变色字符串
const finalGradientColorValue = computed(() => {
  let colorStr = `linear-gradient(${props.degValue}deg,`
  if (sortedSliderButtons.value.length > 0) {
    sortedSliderButtons.value.forEach((item, index) => {
      if (index === sortedSliderButtons.value.length - 1) {
        colorStr += `${item.color} ${item.position}%)`
      } else {
        colorStr += `${item.color} ${item.position}%,`
      }
    })
    return colorStr
  } else {
    return ''
  }
})

// 容器样式
const containerStyle = computed(() => {
  return {
    width: '100%',
    height: '12px',
  }
})

// 包装器样式
const wrapperStyle = computed(() => {
  const styleObj: any = {
    width: '100%',
    height: '12px',
    cursor: 'pointer',
    opacity: props.disabled ? 0.6 : 1,
  }

  return styleObj
})

// 轨道样式
const trackStyle = computed(() => {
  const styleObj: any = {
    // height: '100%',
    width: '100%',
    cursor: props.disabled ? 'not-allowed' : 'pointer',
    position: 'relative',
    display: 'flex',
  }
  return styleObj
})
// 轨道背景承载样式
const trackBackgroundStyle = computed(() => {
  const objStyle: any = {}
  objStyle.background = `url(${qipanBackground})`
  objStyle.border = 'none'
  return objStyle
})
// 填充区域样式
const fillStyle = computed(() => {
  return {
    width: '100%',
    // 色标条始终按左到右预览，组件实际渐变仍使用 degValue。
    backgroundImage: sortedSliderButtons.value.length
      ? `linear-gradient(90deg, ${sortedSliderButtons.value.map(item => `${item.color} ${item.position}%`).join(', ')})`
      : '',
  }
})

// 滑块手柄样式
const handleStyle = computed(() => {
  const sizeMap = {
    small: { width: '14px', height: '14px' },
    medium: { width: '36px', height: '36px' },
    large: { width: '48px', height: '48px' },
  }

  return props.sliderButtons.map((item: any) => {
    const baseStyle: any = {
      width: sizeMap[props.size].width,
      height: sizeMap[props.size].height,
      cursor: props.disabled
        ? 'not-allowed'
        : isDragging.value && currentHighSliderId === item.id
          ? 'grabbing'
          : 'grab',
      transition: 'all 0.1s ease',
      backgroundColor: item.color,
      position: 'absolute',
      borderRadius: '50%',
      border: '2px solid #fff',
      boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.2)',
      boxSizing: 'border-box',
      transform: 'translate(-50%, -50%)',
    }

    // 水平模式：左右定位
    baseStyle.left = props.size === 'small'
      ? `calc(${item.position}% + ${7 - item.position * 0.14}px)`
      : `${item.position}%`
    baseStyle.top = '50%'
    return baseStyle
  })
})
// 计算滑块在轨道内的位置
// function calculateSliderPosition(value: number, type: 'start' | 'end' | 'middle') {
//   if (!sliderTrackRef.value) {
//     return 0
//   }
//   if (type === 'start') {
//     // 起点：滑块边缘对齐轨道起点
//     return 0
//   } else if (type === 'end') {
//     // 终点：滑块边缘对齐轨道终点
//     return 100
//   } else {
//     // 中间位置
//     return Math.max(0, Math.min(100, value))
//   }
// }

// 滑块点击
function handleClick(slider: any) {
  // 更新Store中的当前高亮滑块
  currentHighSliderId = slider.id
  // 更新滑块激活状态
  props.sliderButtons.forEach((item: any) => {
    item.isActive = false
    if (item.id === slider.id) {
      item.isActive = true
    }
  })
  emit('sliderPoint', slider)
}

// 处理轨道点击
function handleTrackClick(event: MouseEvent) {
  if (props.disabled || !sliderTrackRef.value) {
    return
  }

  const rect = sliderTrackRef.value.getBoundingClientRect()
  const percentage = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * 100

  // 检查是否有滑块在附近
  const existingSlider = props.sliderButtons.find((item: any) => Math.abs(item.position - percentage) < 5)

  if (!existingSlider) {
    // 取消其他滑块的激活状态
    props.sliderButtons.forEach((item: any) => {
      item.isActive = false
    })

    const id = uuid()
    // 更新Store
    currentHighSliderId = id
    emit('updateSliderButtons', {
      position: Math.round(percentage),
      type: 'middle',
      isActive: true,
      id,
      color: interpolateGradientColor(props.sliderButtons, Math.round(percentage)),
    })
    // props.sliderButtons.push({
    //   position: Math.round(percentage),
    //   type: 'middle',
    //   isActive: true,
    //   id,
    //   color: '#fff',
    // })
  }
}

// 开始拖拽
function startDrag(event: MouseEvent, slider: any) {
  if (props.disabled) {
    return
  }

  currentHighSliderId = slider.id
  handleClick(slider) // 激活当前拖拽的滑块

  event.preventDefault()
  isDragging.value = true

  // 添加事件监听
  document.addEventListener('mousemove', handleDrag, { passive: false })
  document.addEventListener('mouseup', stopDrag)

  // 立即更新一次位置
  // requestAnimationFrame(() => {
  //   updateHandlePosition(event)
  // })
}

// 处理拖拽
function handleDrag(event: MouseEvent) {
  if (!isDragging.value) {
    return
  }

  event.preventDefault()

  requestAnimationFrame(() => {
    updateHandlePosition(event)
  })
}

// 更新手柄位置
function updateHandlePosition(event: MouseEvent) {
  if (!sliderTrackRef.value) {
    return
  }

  const rect = sliderTrackRef.value.getBoundingClientRect()
  // 后续可能会用到移动端
  // if (props.vertical) {
  //   clientPos = event.touches[0].clientY
  //   percentage = Math.max(0, Math.min(1, (rect.bottom - clientPos) / rect.height)) * 100
  // } else {
  //   clientPos = event.touches[0].clientX
  //   percentage = Math.max(0, Math.min(1, (clientPos - rect.left) / rect.width)) * 100
  // }
  const clientPos = (event as MouseEvent).clientX
  const percentage = Math.max(0, Math.min(1, (clientPos - rect.left) / rect.width)) * 100

  // 更新当前拖拽的滑块位置
  const currentId = currentHighSliderId
  if (currentId) {
    const findSlider = props.sliderButtons.find((item: any) => item.id === currentId)
    if (findSlider) {
      findSlider.position = Math.round(percentage)
    }
  }
}

// 停止拖拽
function stopDrag() {
  if (isDragging.value) {
    isDragging.value = false
  }

  // 移除事件监听
  document.removeEventListener('mousemove', handleDrag)
  // document.removeEventListener('touchmove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
  // document.removeEventListener('touchend', stopDrag)
}

// 处理键盘事件
function handleKeydown(event: KeyboardEvent) {
  if (props.disabled) {
    return
  }

  const findSliderFocusIndex = props.sliderButtons.findIndex((item: any) => item.id === currentHighSliderId)
  if (findSliderFocusIndex !== -1) {
    const findSliderFocus = props.sliderButtons[findSliderFocusIndex]

    switch (event.key) {
      case 'Delete':
      case 'Backspace':
        if (findSliderFocus.type === 'middle') {
          const sliderIndex = props.sliderButtons.findIndex((item: any) => item.id === currentHighSliderId)
          if (sliderIndex !== -1) {
            // props.sliderButtons.splice(sliderIndex, 1)
            emit('updateSliderButtons', sliderIndex)
          }
          currentHighSliderId = ''
        }
        break
      default:
        return
    }

    event.stopPropagation()
    event.preventDefault()
    // 确保值在范围内
    findSliderFocus.position = Math.max(0, Math.min(100, findSliderFocus.position))
  }
}

// 初始化滑块
// function initSliders() {
//   if (sliderTrackRef.value) {
//     const startPercentage = calculateSliderPosition(0, 'start')
//     const endPercentage = calculateSliderPosition(100, 'end')

//    props.sliderButtons = [
//       {
//         position: Math.round(startPercentage),
//         id: uuid(),
//         isActive: false,
//         type: 'start',
//         color: '#316bff',
//       },
//       {
//         position: Math.round(endPercentage),
//         id: uuid(),
//         type: 'end',
//         isActive: false,
//         color: '#316bff00',
//       },
//     ]
//   }
// }
function updateSliderButtons(val: any[]) {
  if (val && val.length > 0) {
    const newArr = val.map((item) => {
      return {
        position: Math.round(item.ratio * 100),
        id: item.id,
        type: item.type,
        isActive: item.isActive,
        color: item.color,
      }
    })
    const findSlider = val.find(item => item.isActive)
    if (findSlider) {
      emit('sliderPoint', findSlider)
    }
    emit('updateSliderButtons', newArr)
  }
}
// 解析渐变色字符串
// function parseGradientString(gradientStr: string) {
//   // 移除linear-gradient前缀和角度
//   const colorsPart = gradientStr
//     .replace(/^linear-gradient\(\d+deg,\s*/, '')
//     .replace(/\)$/, '')
//     .trim()

//   // 分割颜色停止点
//   // eslint-disable-next-line regexp/no-super-linear-backtracking
//   const colorStops = colorsPart.split(/\s*,\s*(?![^()]*\))/g)

//   // 解析每个颜色停止点
//   return colorStops.map((colorStop, index) => {
//     // 提取颜色和百分比
//     // eslint-disable-next-line regexp/no-super-linear-backtracking
//     const match = colorStop.match(/(.+?)\s+(\d+(?:\.\d+)?)%$/)

//     if (!match) {
//       return null
//     }

//     const [, color, percentage] = match
//     const position = Number.parseFloat(percentage)

//     // 确定类型
//     let type: 'start' | 'end' | 'middle' = 'middle'
//     if (index === 0) {
//       type = 'start'
//     } else if (index === colorStops.length - 1) {
//       type = 'end'
//     }

//     return {
//       position: Math.round(position),
//       id: uuid(),
//       isActive: index === 0,
//       type,
//       color: color.trim(),
//     }
//   }).filter(item => item !== null) as any[]
// }

// 生命周期
onMounted(() => {
  currentHighSliderId = props.sliderButtons.find(item => item.isActive)?.id
  eventBus.on('updateSliderButtons', updateSliderButtons)
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  eventBus.off('updateSliderButtons', updateSliderButtons)
  window.removeEventListener('keydown', handleKeydown)
  stopDrag()
})

// // 监听颜色变化
// watch(() => props.sliderButtons, (newValue) => {
//   console.log(newValue, currentHighSliderId)

//   // if (newValue.includes('linear-gradient')) {
//   //   const parsedSliders = parseGradientString(newValue)
//   //   if (parsedSliders.length > 0) {
//   //     // props.sliderButtons = parsedSliders
//   //     emit('updateSliderButtons', parsedSliders)
//   //   }
//   // }
//   // if (newValue && currentHighSliderId) {
//   //   const findSliderFocus = props.sliderButtons.find((item: any) => item.id === currentHighSliderId)
//   //   if (findSliderFocus) {
//   //     findSliderFocus.color = newValue
//   //   }
//   // }
// }, { immediate: true })
// 监听渐变色生成变化
watch(
  () => finalGradientColorValue.value,
  (newValue) => {
    emit('gradientUpdate', newValue)
  },
)
// 监听是否点击反转颜色
watch(
  () => props.isReverseColor,
  () => {
    const colors = sortedSliderButtons.value.map(item => item.color)
    colors.reverse()
    sortedSliderButtons.value.forEach((item, index) => {
      item.color = colors[index]
    })
  },
)
watch(
  () => props.colorType,
  (val) => {
    if (val === 1) {
      emit('gradientUpdate', finalGradientColorValue.value)
    }
  },
)
</script>

<template>
  <div
    :class="style['slider-container']"
    :style="containerStyle"
  >
    <div
      :class="style['slider-wrapper']"
      :style="wrapperStyle"
    >
      <div
        ref="sliderTrackRef"
        :class="style['slider-track']"
        :style="trackStyle"
        @click="handleTrackClick"
      >
        <!-- 轨道背景 -->
        <div
          :class="style['track-background']"
          :style="trackBackgroundStyle"
        />

        <!-- 轨道填充部分 -->
        <div
          :class="style['track-fill']"
          :style="fillStyle"
        />
        <!-- 滑块手柄 -->
        <el-tooltip
          v-for="(item, index) in sliderButtons"
          :key="item.id"
          :content="`${item.position}%`"
          placement="top"
        >
          <div
            :class="[style['slider-handle'], item.isActive ? style['slider-select-handle'] : '']"
            :style="handleStyle[index]"
            @click.stop
            @mousedown.stop="(event) => startDrag(event, item)"
          />
        </el-tooltip>
      </div>
    </div>
  </div>
</template>
