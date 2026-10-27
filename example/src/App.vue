<script setup lang="ts">
import { ref } from 'vue'
import { ColorPicker, EyeDropper, horizontalGradientBorderStyle, useColorPickerSession, type ColorStop, type EffectiveColor } from '@you-want/color-picker-lib'

const userId = ref('demo-user')
function getUserId(): string {
  return userId.value
}

const color = ref('#316BFF')
const fillOpacity = ref(100)
const effective = ref<EffectiveColor>({ sourceColor: color.value, fillOpacity: 100, color: color.value })
const stops = ref<ColorStop[]>([])
const canvasEl = ref<HTMLElement | null>(null)

// 宿主取色会话：pick-request → 挂 EyeDropper → confirm 回填
const session = useColorPickerSession()

function onPickRequest(req: { pickerId: string, color: string }) {
  session.onPickRequest(req)
}
function onPickConfirm(hex: string) {
  const pickerId = session.onPickConfirm(hex)
  if (pickerId) {
    // 库内只有一个示例 picker，直接回填
    pickerRef.value?.applyPickedColor(hex)
  }
}
const pickerRef = ref<InstanceType<typeof ColorPicker> | null>(null)

function onCommit(c: string) {
  console.log('[sessionCommit] 提交历史颜色:', c)
}
</script>

<template>
  <div style="max-width: 720px; margin: 40px auto; font-family: system-ui; padding: 0 16px">
    <h1>取色器 & 调色板示例</h1>
    <p>
      原始色值：<code data-testid="source-color">{{ color }}</code>
    </p>
    <p>
      渲染色值：<code data-testid="effective-color">{{ effective.color }}</code>
    </p>

    <!-- 宿主画布：给 EyeDropper 截图的区域 -->
    <div
      ref="canvasEl"
      data-testid="pick-canvas"
      style="position: relative; height: 320px; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; background: #0b1020; display: flex; align-items: center; justify-content: center; gap: 24px"
    >
      <div
        style="width: 180px; height: 140px; border-radius: 12px; background: linear-gradient(135deg, #ff6a00, #ee0979)"
      />
      <div
        data-testid="gradient-border"
        :data-render-color="effective.color"
        :style="horizontalGradientBorderStyle(effective.color, 8)"
        style="width: 280px; height: 160px; display: flex; align-items: center; justify-content: center; color: white; text-align: center; font-size: 13px"
      >
        矩形边框横向渐变<br>上下边框颜色一致
      </div>
    </div>

    <div style="margin-top: 24px; display: flex; align-items: center; gap: 16px">
      <ColorPicker
        ref="pickerRef"
        v-model="color"
        v-model:fill-opacity="fillOpacity"
        id="picker-1"
        :slider-buttons="stops"
        :get-user-id="getUserId"
        storage-key="recenterlyUseColor:v2"
        @change-color-set="stops = $event"
        @pick-request="onPickRequest"
        @session-commit="onCommit"
        @effective-change="effective = $event"
      />
      <span style="color: #666; font-size: 13px">点击调色板里的取色器按钮，画布区域会出现放大镜</span>
    </div>
    <div style="margin-top: 20px; display: flex; gap: 16px; align-items: center; flex-wrap: wrap">
      <label for="demo-opacity">整体透明度 {{ fillOpacity }}%</label>
      <input id="demo-opacity" v-model.number="fillOpacity" type="range" min="0" max="100">
      <button
        type="button"
        @click="color = 'linear-gradient(90deg, rgba(255, 0, 0, 0.8) 0%, rgba(0, 255, 0, 0.6) 35%, rgba(0, 0, 255, 0.4) 100%)'"
      >
        加载三色渐变
      </button>
      <label for="demo-user">当前用户</label>
      <select id="demo-user" v-model="userId">
        <option value="demo-user">用户 A</option>
        <option value="demo-other">用户 B</option>
        <option value="">未登录</option>
      </select>
    </div>

    <!-- 宿主控制的 EyeDropper：pick-request 时显示 -->
    <EyeDropper
      v-if="session.pending.value"
      :target="canvasEl!"
      @confirm="onPickConfirm"
      @close="session.onPickClose"
    />
  </div>
</template>
