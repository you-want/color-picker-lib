<script setup lang="ts">
import { ref } from 'vue'
import { ColorPicker, EyeDropper, useColorPickerSession } from '@you-want/color-picker-lib'

// 宿主侧登录态：演示用固定 userId
function getUserId(): string {
  return 'demo-user'
}

const color = ref('#316BFF')
const stops = ref<{ position: number, color: string, isActive: boolean }[]>([])
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
    ;(pickerRef.value as any)?.applyPickedColor(hex)
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
      当前色值：<code>{{ color }}</code>
    </p>

    <!-- 宿主画布：给 EyeDropper 截图的区域 -->
    <div
      ref="canvasEl"
      style="position: relative; height: 320px; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; background: #0b1020; display: flex; align-items: center; justify-content: center"
    >
      <div
        style="width: 240px; height: 140px; border-radius: 12px; background: linear-gradient(135deg, #ff6a00, #ee0979)"
      />
    </div>

    <div style="margin-top: 24px; display: flex; align-items: center; gap: 16px">
      <ColorPicker
        ref="pickerRef"
        v-model="color"
        id="picker-1"
        :fill-opacity="100"
        :slider-buttons="stops"
        :get-user-id="getUserId"
        storage-key="recenterlyUseColor:v2"
        @change-color-set="stops = $event"
        @pick-request="onPickRequest"
        @session-commit="onCommit"
      />
      <span style="color: #666; font-size: 13px">点击调色板里的取色器按钮，画布区域会出现放大镜</span>
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
