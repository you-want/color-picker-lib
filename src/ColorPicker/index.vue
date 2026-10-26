<script setup lang="ts">
import type { CaptureCanvasOptions } from '../EyeDropper/captureCanvas'
import { useRecentColors } from '../composables/useRecentColors'
import {
  cancelPicking,
  pickerState,
  setActivePickerId,
} from '../shared/ColorPickerState'
import { eventBus } from '../shared/EventBus'
import { DEFAULT_COLORS, EXCLUDE_SELECTOR } from '../shared/defaults'
import {
  extractColorHexStringsPureJS,
  gradientAngleToDegrees,
  parseColorToRGBA,
  parseGradient,
  rgba,
  rgbToHex,
  sketchPickerInputToColorString,
  toSketchPickerColorValue,
} from '../color-utils/ColorUtil'
import SliderColorSetting from '../SliderColorSetting/index.vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { SketchPicker } from 'vue-color'
import style from './index.module.scss'
import 'vue-color/style.css'

defineOptions({ name: 'ColorPicker' })

// ---------------------------------------------------------------------------
// 解耦后的公共 API（冻结稿）：
//   props:  modelValue(CSS 色值) / showEyeDropper / getUserId / storageKey /
//           presetColors / 支持类型开关(纯色/渐变)
//   emits:  update:modelValue / sessionCommit / pick-request
//   expose: applyPickedColor(color)
// 包只管 UI 和自己的状态，画布/面板怎么消费颜色是宿主的事。
// ---------------------------------------------------------------------------
const props = withDefaults(
  defineProps<{
    /** 唯一身份，宿主每次渲染需稳定传入同一值。 */
    id: string
    /** 实时色值（纯色 / linear-gradient CSS 字符串）。 */
    modelValue?: string
    /** 填充透明度 0–100，默认 100。 */
    fillOpacity?: number
    /** 预设色板，默认 DEFAULT_COLORS。 */
    presetColors?: string[]
    /** 是否支持线性渐变，默认 true。 */
    isNeedGradient?: boolean
    disabled?: boolean
    sliderButtons?: SliderButton[]
    settingDisabled?: boolean
    triggerMixed?: boolean
    useSingleColorBlock?: boolean
    gradientWithoutAnchors?: boolean
    defaultColor?: string
    /** 是否显示取色按钮，默认 true。 */
    showEyeDropper?: boolean
    /** 宿主提供登录态解析，替代原组件内写死的 JWT 取 userId 逻辑。 */
    getUserId?: () => string
    /** 最近颜色存储键，含旧 key 迁移，默认 recenterlyUseColor:v2。 */
    storageKey?: string
    /** 取色器截图排除项透传。 */
    capture?: CaptureCanvasOptions
  }>(),
  {
    modelValue: '',
    fillOpacity: 100,
    presetColors: () => DEFAULT_COLORS,
    isNeedGradient: true,
    disabled: false,
    sliderButtons: () => [],
    settingDisabled: false,
    triggerMixed: false,
    useSingleColorBlock: false,
    gradientWithoutAnchors: false,
    defaultColor: '#316BFF',
    showEyeDropper: true,
    storageKey: 'recenterlyUseColor:v2',
  },
)
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  /** 退出调色板且本轮有改动时，提交一次历史颜色。 */
  (e: 'sessionCommit', color: string): void
  /** 宿主决定如何启动取色（如启动 EyeDropper），拿到色后调 applyPickedColor 回填。 */
  (e: 'pick-request', payload: { pickerId: string, color: string }): void
  (e: 'degChange', val: string): void
  (e: 'changeColorSet', val: SliderButton[]): void
  (e: 'colorType', value: number): void
  (e: 'change', selectColor: string): void
}>()
interface SliderButton {
  position: number
  type?: string
  isActive: boolean
  id: string
  color: string
}
// 部分调用方在模板中传 uuid()，重渲染时仍需保持本次组件实例的取色身份。
const pickerId = props.id
const modelValue = defineModel<string>()

// 最近颜色改为无 pinia 的组合式函数，userId 由宿主 getUserId 注入。
const recent = useRecentColors({ getUserId: props.getUserId, storageKey: props.storageKey })

const selectColor = ref(props.defaultColor)
const pickerKey = ref(0)
const sketchPickerRootRef = ref<HTMLElement | null>(null)
const pickerContainerRef = ref<HTMLElement | null>(null)
const paletteContentRef = ref<HTMLElement | null>(null)
const popoverShow = ref(false)
const colorType = ref(0)
const degValue = ref(180)
const simpleGradientActiveStop = ref(0)
const sliderButtonsValue = ref<SliderButton[]>([])
const isReverseColor = ref(false)
const sessionUserId = ref('')
let sessionChanged = false
let sessionColor = ''

// 当前色固定占第一格，历史从第二格开始；允许当前色和刚提交的历史色相同。
const useColors = computed(() =>
  [
    modelValue.value || props.defaultColor,
    ...recent.findUserIdColors(sessionUserId.value || recent.userId.value),
  ].slice(0, 16),
)
const sketchPickerValue = computed(() =>
  toSketchPickerColorValue(selectColor.value, colorType.value === 1 ? 100 : props.fillOpacity),
)
function solidBase(raw?: string) {
  return raw?.includes('linear-gradient')
    ? parseGradient(raw)?.colorStops[0]?.color || props.defaultColor
    : raw || props.defaultColor
}
function halfHex() {
  const c = parseColorToRGBA(rgba(solidBase(modelValue.value), props.fillOpacity / 100))
  return extractColorHexStringsPureJS(rgbToHex(c.r, c.g, c.b, true, c.a))
}
const leftColor = computed(() => halfHex()?.opaqueHex)
const rightColor = computed(() => halfHex()?.alphaHex)

function syncFromModel() {
  const parsed = modelValue.value?.includes('linear-gradient') ? parseGradient(modelValue.value) : null
  colorType.value = parsed ? 1 : 0
  if (parsed) {
    degValue.value = gradientAngleToDegrees(parsed.angle)
    const stops = props.gradientWithoutAnchors
      ? [parsed.colorStops[0], parsed.colorStops[parsed.colorStops.length - 1]]
      : parsed.colorStops
    const activeIndex = 0
    sliderButtonsValue.value = stops.map((stop, i) => ({
      position: (stop.offset ?? i / (stops.length - 1)) * 100,
      color: stop.color,
      id: props.sliderButtons[i]?.id || `stop-${i}`,
      type: i === 0 ? 'start' : i === stops.length - 1 ? 'end' : 'middle',
      isActive: i === activeIndex,
    }))
    simpleGradientActiveStop.value = Math.min(activeIndex, 1)
    selectColor.value = sliderButtonsValue.value.find(item => item.isActive)?.color || props.defaultColor
  } else {
    selectColor.value = modelValue.value || props.defaultColor
  }
  emit('colorType', colorType.value)
}
watch(
  modelValue,
  () => {
    // 本地编辑时色标是唯一数据源，不能因为父组件回写而重置当前激活色标。
    if (!popoverShow.value) {
      syncFromModel()
    } else if (colorType.value === 0 && !modelValue.value?.includes('linear-gradient')) {
      selectColor.value = modelValue.value || props.defaultColor
    }
  },
  { immediate: true },
)
watch(
  () => props.sliderButtons,
  (val) => {
    if (!popoverShow.value) {
      sliderButtonsValue.value = (val || []).map(item => ({ ...item }))
    }
  },
  { deep: true },
)
watch(
  () => pickerState.activePickerId,
  (id) => {
    if (id !== pickerId) {
      popoverShow.value = false
    }
  },
)
watch(
  () => props.fillOpacity,
  () => {
    if (popoverShow.value) {
      sessionChanged = true
      if (colorType.value === 0) {
        pickerKey.value++
        nextTick(expressColor)
      }
    }
  },
)
watch(
  popoverShow,
  async (visible) => {
    if (visible) {
      const uid = props.getUserId ? props.getUserId() : ''
      recent.setUserId(uid || recent.userId.value)
      sessionUserId.value = uid || recent.userId.value
      sessionChanged = false
      sessionColor = modelValue.value || props.defaultColor
      syncFromModel()
      if (colorType.value === 1) {
        emit('changeColorSet', sliderButtonsValue.value)
      }
      await nextTick()
      expressColor()
      if (colorType.value === 1 && !props.gradientWithoutAnchors) {
        eventBus.emit('changeSliderButtons', sliderButtonsValue.value)
      }
    } else {
      finishSession()
    }
  },
  { flush: 'post' },
)
function finishSession() {
  if (sessionChanged && sessionUserId.value) {
    recent.changeUseColor(sessionColor, sessionUserId.value)
    emit('sessionCommit', sessionColor)
  }
  sessionChanged = false
  cancelPicking(pickerId)
}
function applyColor(value: string) {
  if (!value) {
    return
  }
  sessionChanged ||= value !== modelValue.value
  sessionColor = value
  modelValue.value = value
  emit('change', value)
}
function buildGradient() {
  const stops = [...sliderButtonsValue.value].sort((a, b) => a.position - b.position)
  return `linear-gradient(${degValue.value}deg, ${stops.map(item => `${item.color} ${item.position}%`).join(', ')})`
}
function gradientUpdate(value: string) {
  if (popoverShow.value && colorType.value === 1 && value) {
    applyColor(value)
  }
}
function updateValue(colors: Parameters<typeof sketchPickerInputToColorString>[0]) {
  const value = sketchPickerInputToColorString(colors)
  if (!value) {
    return
  }
  selectColor.value = value
  if (colorType.value === 1) {
    const stop = sliderButtonsValue.value.find(item => item.isActive) || sliderButtonsValue.value[0]
    if (stop) {
      stop.color = value
      emit('changeColorSet', sliderButtonsValue.value)
      applyColor(buildGradient())
      eventBus.emit('changeSliderButtons', sliderButtonsValue.value)
    }
  } else {
    applyColor(value)
  }
}
function chooseRecentColor(value: string) {
  if (value.includes('linear-gradient')) {
    if (!props.isNeedGradient) {
      return
    }
    applyColor(value)
    syncFromModel()
    emit('changeColorSet', sliderButtonsValue.value)
    nextTick(() => eventBus.emit('changeSliderButtons', sliderButtonsValue.value))
  } else {
    updateValue(value)
  }
}
function colorTypeChange(value: number | string | boolean | undefined) {
  emit('colorType', colorType.value)
  if (value === 1) {
    const base = rgba(selectColor.value || props.defaultColor, 1)
    sliderButtonsValue.value = [
      { position: 0, color: base, isActive: true, id: 'stop-0', type: 'start' },
      { position: 100, color: rgba(base, 0), isActive: false, id: 'stop-1', type: 'end' },
    ]
    simpleGradientActiveStop.value = 0
    emit('changeColorSet', sliderButtonsValue.value)
    applyColor(buildGradient())
    nextTick(() => eventBus.emit('changeSliderButtons', sliderButtonsValue.value))
  } else {
    applyColor(selectColor.value || props.defaultColor)
  }
  emit('colorType', colorType.value)
  nextTick(expressColor)
}
function getSliderPointColor(stop: SliderButton) {
  selectColor.value = stop.color
  pickerKey.value++
  nextTick(expressColor)
}
function setSimpleGradientStop(index: 0 | 1) {
  simpleGradientActiveStop.value = index
  sliderButtonsValue.value.forEach((stop, i) => {
    stop.isActive = i === index
  })
  getSliderPointColor(sliderButtonsValue.value[index])
}
function updateSliderButtons(value: SliderButton | SliderButton[] | number) {
  if (Array.isArray(value)) {
    sliderButtonsValue.value = value
  } else if (typeof value === 'number') {
    sliderButtonsValue.value.splice(value, 1)
  } else {
    sliderButtonsValue.value.push(value)
    selectColor.value = value.color
  }
  emit('changeColorSet', sliderButtonsValue.value)
  applyColor(buildGradient())
  eventBus.emit('changeSliderButtons', sliderButtonsValue.value)
}
function reverseColor() {
  const stops = [...sliderButtonsValue.value].sort((a, b) => a.position - b.position)
  const colors = stops.map(item => item.color).reverse()
  stops.forEach((stop, i) => {
    stop.color = colors[i]
  })
  selectColor.value = stops.find(item => item.isActive)?.color || selectColor.value
  applyColor(buildGradient())
  emit('changeColorSet', sliderButtonsValue.value)
  eventBus.emit('changeSliderButtons', sliderButtonsValue.value)
}
function setSliderAngleHandler(value: number) {
  if (!popoverShow.value || colorType.value !== 1 || props.gradientWithoutAnchors) {
    return
  }
  degValue.value = value
  applyColor(buildGradient())
  emit('degChange', `${value}`)
}
function degValueChangeHandler() {
  degValue.value = (degValue.value + 90) % 360
  applyColor(buildGradient())
  emit('degChange', `${degValue.value}`)
  if (!props.gradientWithoutAnchors) {
    eventBus.emit('deg-value-change', 90)
  }
}
function lineSliderReadyHandler() {
  if (popoverShow.value && colorType.value === 1 && !props.gradientWithoutAnchors) {
    eventBus.emit('changeSliderButtons', sliderButtonsValue.value)
  }
}
function startEyeDropper() {
  // 取色链路收敛：不再依赖 edit-area 内部 watch，改 emit pick-request，
  // 宿主（画布）自行启动 EyeDropper，拿到颜色后调 applyPickedColor 回填。
  setActivePickerId(pickerId)
  pickerState.pickingPickerId = pickerId
  emit('pick-request', { pickerId, color: modelValue.value || '' })
}
function getFinallColor(result: { pickerId: string, color: string }) {
  if (popoverShow.value && result.pickerId === pickerId) {
    updateValue(result.color)
  }
}
/** 宿主取色完成后回填当前 picker（替代原 eventBus finallColor 单向链路）。 */
function applyPickedColor(color: string) {
  if (!color) {
    return
  }
  updateValue(color)
  cancelPicking(pickerId)
}
function colorBlankClickHandler(visible: boolean) {
  if (!pickerState.pickingPickerId) {
    popoverShow.value = visible
  }
}
function handleOutsidePointer(event: PointerEvent) {
  const target = event.target
  if (!popoverShow.value || pickerState.pickingPickerId || !(target instanceof Element)) {
    return
  }
  if (pickerContainerRef.value?.contains(target) || paletteContentRef.value?.contains(target)) {
    return
  }
  // 渐变锚点由 LineSlider 处理，画布空白点击会发送 closeColorPopver。
  if (colorType.value === 1 && target.closest('.konvajs-content')) {
    return
  }
  popoverShow.value = false
}
watch(
  () => props.disabled || props.settingDisabled,
  (disabled) => {
    if (disabled) {
      popoverShow.value = false
    }
  },
)
function showPopverHandler() {
  nextTick(expressColor)
}
function hidePopverHandler() {
  if (pickerState.activePickerId === pickerId) {
    setActivePickerId(null)
  }
}
function togglePopover() {
  if (props.disabled || props.settingDisabled) {
    return
  }
  if (popoverShow.value) {
    popoverShow.value = false
    setActivePickerId(null)
  } else {
    setActivePickerId(pickerId)
    popoverShow.value = true
  }
}
function isValidSketchChannelValue(value: string, isAlpha: boolean): boolean {
  if (value === '') {
    return false
  }
  if (isAlpha) {
    const n = Number.parseFloat(value)
    return !Number.isNaN(n) && n >= 0 && n <= 1
  }
  return /^(?:0|[1-9]\d{0,2})$/.test(value)
}

function getSketchPickerRoot(): HTMLElement | null {
  const root = sketchPickerRootRef.value
  return root instanceof HTMLElement ? root : null
}

/**
 * vue-color@3.3.0 SketchPicker 内部 DOM 选择器。
 * vue-color 未暴露输入校验 API，升级依赖时需对照 package.json 版本并验证此处选择器。
 */
const SKETCH_PICKER_DOM = {
  version: '3.3.0',
  hexInput: '.field_double .vc-editable-input .vc-input-input',
  channelInputs: '.field_single .vc-editable-input .vc-input-input',
} as const

interface SketchPickerEditableInputs {
  hexInput: HTMLInputElement | null
  channelInputs: HTMLInputElement[]
}

function findSketchPickerEditableInputs(root: HTMLElement): SketchPickerEditableInputs {
  try {
    const hexInput = root.querySelector<HTMLInputElement>(SKETCH_PICKER_DOM.hexInput)
    const channelInputs = Array.from(root.querySelectorAll<HTMLInputElement>(SKETCH_PICKER_DOM.channelInputs))
    return { hexInput, channelInputs }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`[color-picker] vue-color@${SKETCH_PICKER_DOM.version} DOM 结构不匹配，已跳过输入校验绑定`, error)
    }
    return { hexInput: null, channelInputs: [] }
  }
}

const hexRegex = /^(?:[A-F0-9]{3,4}|[A-F0-9]{6}|[A-F0-9]{8})$/i

interface ExpressColorBinding {
  element: Element
  focusHandler?: (e: Event) => void
  blurHandler: (e: Event) => void
}

let expressColorBindings: ExpressColorBinding[] = []

function handleHexBlur(e: Event) {
  const target = e.target as HTMLInputElement
  if (!hexRegex.test(target.value)) {
    target.value = props.defaultColor.slice(1)
    updateValue(props.defaultColor)
  }
}

function detachExpressColorListeners() {
  for (const binding of expressColorBindings) {
    if (binding.focusHandler) {
      binding.element.removeEventListener('focus', binding.focusHandler)
    }
    binding.element.removeEventListener('blur', binding.blurHandler)
  }
  expressColorBindings = []
}

// 校验颜色：依赖 vue-color 内部 DOM，结构变更时 findSketchPickerEditableInputs 会安全降级
function expressColor() {
  detachExpressColorListeners()

  const pickerRoot = getSketchPickerRoot()
  if (!pickerRoot) {
    return
  }

  const { hexInput, channelInputs } = findSketchPickerEditableInputs(pickerRoot)
  if (!hexInput && channelInputs.length === 0) {
    if (import.meta.env.DEV) {
      console.warn(
        `[color-picker] 未找到 vue-color@${SKETCH_PICKER_DOM.version} 可编辑输入框，已跳过 blur/focus 校验绑定`,
      )
    }
    return
  }

  if (hexInput) {
    hexInput.addEventListener('blur', handleHexBlur)
    expressColorBindings.push({ element: hexInput, blurHandler: handleHexBlur })
  }
  for (let index = 0; index < channelInputs.length; index++) {
    const element = channelInputs[index]
    const isAlpha = index === channelInputs.length - 1
    const channelState = { currentValue: '' }
    const focusHandler = (e: Event) => {
      channelState.currentValue = (e.target as HTMLInputElement).value
    }
    const blurHandler = (e: Event) => {
      const target = e.target as HTMLInputElement
      if (!isValidSketchChannelValue(target.value, isAlpha)) {
        target.value = channelState.currentValue
      }
    }
    element.addEventListener('focus', focusHandler)
    element.addEventListener('blur', blurHandler)
    expressColorBindings.push({ element, focusHandler, blurHandler })
  }
}

onMounted(() => {
  recent.refreshUserId()
  document.addEventListener('pointerdown', handleOutsidePointer, true)
  eventBus.on('closeColorPopver', colorBlankClickHandler)
  eventBus.on('setSliderAngle', setSliderAngleHandler)
  eventBus.on('finallColor', getFinallColor)
  eventBus.on('line-slider-ready', lineSliderReadyHandler)
})
onBeforeUnmount(() => {
  finishSession()
  document.removeEventListener('pointerdown', handleOutsidePointer, true)
  detachExpressColorListeners()
  if (pickerState.activePickerId === pickerId) {
    setActivePickerId(null)
  }
  eventBus.off('closeColorPopver', colorBlankClickHandler)
  eventBus.off('setSliderAngle', setSliderAngleHandler)
  eventBus.off('finallColor', getFinallColor)
  eventBus.off('line-slider-ready', lineSliderReadyHandler)
})

defineExpose({ applyPickedColor })
</script>

<template>
  <div
    ref="pickerContainerRef"
    :class="style['color-picker-container']"
  >
    <el-popover
      placement="top"
      trigger="click"
      :width="241"
      :visible="popoverShow"
      :disabled="disabled || settingDisabled"
      :visible-arrow="false"
      popper-class="color-picker-popover"
      @show="showPopverHandler"
      @hide="hidePopverHandler"
    >
      <template #default>
        <div
          ref="paletteContentRef"
          :class="style.palette"
        >
          <el-radio-group
            v-model="colorType"
            :class="style['color-type-select']"
            @change="colorTypeChange"
          >
            <el-radio :value="0">
纯色
</el-radio>
            <el-radio
              v-if="isNeedGradient"
              :value="1"
            >
              线性渐变
            </el-radio>
          </el-radio-group>
          <div
            v-if="colorType === 1"
            :class="style['deg-select']"
          >
            <!-- 无锚点模式：仅角度 + 起止两色 -->
            <template v-if="gradientWithoutAnchors">
              <div :class="style['simple-gradient-stops']">
                <el-tooltip
                  content="起始色"
                  placement="top"
                >
                  <div
                    :class="[
                      style['simple-stop-block'],
                      simpleGradientActiveStop === 0 ? style['simple-stop-active'] : '',
                    ]"
                    :style="{
                      background: sliderButtonsValue[0]?.color || '#FFFFFF',
                    }"
                    @click="setSimpleGradientStop(0)"
                  />
                </el-tooltip>
                <el-tooltip
                  content="结束色"
                  placement="top"
                >
                  <div
                    :class="[
                      style['simple-stop-block'],
                      simpleGradientActiveStop === 1 ? style['simple-stop-active'] : '',
                    ]"
                    :style="{
                      background: sliderButtonsValue[1]?.color || '#000000',
                    }"
                    @click="setSimpleGradientStop(1)"
                  />
                </el-tooltip>
              </div>
            </template>
            <template v-else>
              <SliderColorSetting
                v-if="popoverShow"
                :slider-buttons="sliderButtonsValue"
                :deg-value="degValue"
                :step="1"
                :color-type="colorType"
                :color-normalization="modelValue || ''"
                :is-reverse-color="isReverseColor"
                @update-slider-buttons="updateSliderButtons"
                @gradient-update="gradientUpdate"
                @slider-point="getSliderPointColor"
              />
            </template>
            <el-tooltip
              content="翻转渐变"
              placement="top"
            >
              <button
                type="button"
                :class="style['gradient-tool']"
                aria-label="翻转渐变"
                @click="reverseColor"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.2"
                  aria-hidden="true"
                >
                  <path
                    d="M2 5h11l-3-3M14 11H3l3 3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </el-tooltip>
            <el-tooltip
              content="顺时针旋转90°"
              placement="top"
            >
              <button
                type="button"
                :class="style['gradient-tool']"
                aria-label="顺时针旋转90°"
                @click="degValueChangeHandler"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.2"
                  aria-hidden="true"
                >
                  <path
                    d="M13 6a5.5 5.5 0 1 0 .3 4M13 2v4H9"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </el-tooltip>
          </div>
          <div
            ref="sketchPickerRootRef"
            :class="style['picker-body']"
          >
            <SketchPicker
              :key="pickerKey"
              :value="sketchPickerValue"
              :preset-colors="presetColors"
              @input="updateValue"
              @keydown.stop
            />
            <el-tooltip
              v-if="showEyeDropper"
              content="取色器"
              placement="top"
            >
              <button
                type="button"
                :class="style['eyedropper-button']"
                aria-label="画布取色"
                @click.stop="startEyeDropper"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  aria-hidden="true"
                >
                  <path
                    d="m14 8 2-2 2-3a2 2 0 0 1 3 3l-3 2-2 2M12 6l6 6M14 8 4 18l-1 3 3-1L16 10"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </el-tooltip>
          </div>
          <div :class="style['palette-tools']">
最近使用
</div>
          <div
            :class="style['recent-colors']"
            aria-label="最近使用颜色"
          >
            <button
              v-for="(value, index) in useColors"
              :key="index"
              type="button"
              :class="[style['recent-color'], index === 0 && style['current-color']]"
              :aria-label="index === 0 ? `当前颜色 ${value}` : `历史颜色 ${value}`"
              :aria-current="index === 0 ? 'true' : undefined"
              :title="value"
              :disabled="!isNeedGradient && value.includes('linear-gradient')"
              @click="chooseRecentColor(value)"
            >
              <span :style="{ background: value }" />
            </button>
          </div>
        </div>
      </template>
      <template #reference>
        <slot name="trigger">
          <div
            v-if="triggerMixed"
            class="picker-trigger picker-trigger-mixed"
            :style="{
              cursor: disabled || settingDisabled ? 'not-allowed' : 'pointer',
            }"
            @click.stop="togglePopover"
          >
            <span class="trigger-color trigger-color-mixed" />
          </div>
          <div
            v-else-if="useSingleColorBlock && colorType !== 1"
            class="picker-trigger"
            :style="{
              cursor: disabled || settingDisabled ? 'not-allowed' : 'pointer',
            }"
            @click.stop="togglePopover"
          >
            <span
              class="trigger-color"
              :style="{
                background:
                  modelValue && !String(modelValue).includes('linear-gradient')
                    ? modelValue
                    : defaultColor || '#1A76F5',
                opacity: disabled ? 0 : fillOpacity / 100,
              }"
            />
          </div>
          <div
            v-else-if="colorType === 1"
            class="picker-trigger"
            :style="{
              cursor: disabled || settingDisabled ? 'not-allowed' : 'pointer',
            }"
            @click.stop="togglePopover"
          >
            <span
              class="trigger-color"
              :style="{
                background: modelValue,
                opacity: disabled ? 0 : fillOpacity / 100,
              }"
            />
          </div>
          <div
            v-else
            class="half-picker-trigger"
            :style="{
              cursor: disabled || settingDisabled ? 'not-allowed' : 'pointer',
            }"
            @click.stop="togglePopover"
          >
            <span
              class="half-trigger-color left"
              :style="{ backgroundColor: leftColor }"
            />
            <span
              class="half-trigger-color right"
              :style="{ backgroundColor: rightColor }"
            />
          </div>
        </slot>
      </template>
    </el-popover>
  </div>
</template>
