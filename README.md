# @you-want/color-picker-lib

Vue 3 调色板、线性渐变编辑器与画布取色浮层。依赖 Vue `^3.5.0`、Element Plus `>=2.6.0`，无需宿主 store、JWT 或 Pinia。

[在线示例](https://you-want.github.io/color-picker-lib/) · [更新记录](CHANGELOG.md)

## 安装与样式

```bash
pnpm add @you-want/color-picker-lib vue element-plus
```

在应用入口注册 Element Plus，并导入两份样式：

```ts
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '@you-want/color-picker-lib/dist/assets/index.css'
import App from './App.vue'

createApp(App).use(ElementPlus).mount('#app')
```

库样式需要显式导入；只导入组件 JS 不会加载调色板及取色浮层的布局样式。package.json 的 `style` 字段指向 `dist/assets/index.css`。

## 基本用法

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ColorPicker, type ColorStop } from '@you-want/color-picker-lib'

const color = ref('#316BFF')
const stops = ref<ColorStop[]>([])
</script>

<template>
  <ColorPicker
    id="picker-1"
    v-model="color"
    :slider-buttons="stops"
    :show-eye-dropper="false"
    @change-color-set="stops = $event"
  />
</template>
```

`id` 必须在实例生命周期内稳定且唯一。同一页面同时只打开一个调色板；默认触发器使用原生按钮，支持键盘操作，Escape 关闭并还原焦点。`#trigger` 插槽可替换为自定义按钮，点击事件由组件统一处理。

## ColorPicker API

| Prop | 默认值 / 说明 |
| --- | --- |
| `id` | 必填，稳定且唯一的实例 ID |
| `modelValue` | CSS 纯色或 `linear-gradient(...)` |
| `fillOpacity` | 100；无显式 alpha 的纯色透明度，范围 0–100 |
| `showEyeDropper` | true；宿主负责接收取色请求并挂载 EyeDropper |
| `getUserId` | 可选 `() => string`；未登录返回空串 |
| `storageKey` | `recenterlyUseColor:v2`；不同 key 的历史独立，相同 key 按用户共享历史 |
| `presetColors` | 内置 `DEFAULT_COLORS` |
| `isNeedGradient` | true；是否允许选择渐变类型 |
| `disabled` / `settingDisabled` | false；阻止展开，已打开时关闭 |
| `sliderButtons` | `ColorStop[]`；`id`、`position`、`color`、`isActive`，可选 `type` |
| `gradientWithoutAnchors` | false；仅编辑首尾两个色标 |
| `useSingleColorBlock` / `triggerMixed` | false；触发器显示模式 |
| `defaultColor` | `#316BFF` |

事件：`update:modelValue` 实时更新；`change(color)` 通知编辑；`sessionCommit(color)` 在关闭或卸载时提交本轮最终编辑，未登录也发出；`changeColorSet(stops)`、`colorType(type)`、`degChange(degrees)` 用于宿主同步渐变信息。

`pick-request({ pickerId, color })` 请求宿主启动取色。组件实例暴露 `applyPickedColor(color)`，用于回填结果。

最近颜色最多保存 15 条，加上实时颜色共 16 格。持久化只在有用户 ID 时执行；默认兼容旧 key `recenterlyUseColor`。`useRecentColors` 的当前用户按调用实例隔离，`resetRecentColors()` 清空内存历史，不删除持久化数据。

## 画布取色

完整接入见 `example/src/App.vue`：

1. 用 `useColorPickerSession().onPickRequest` 接收请求。
2. `session.pending.value` 非空时挂载 `<EyeDropper :target="canvasEl" />`。
3. `confirm(hex)` 时调用 `session.onPickConfirm(hex)`，根据返回的 pickerId 调用对应组件的 `applyPickedColor(hex)`。
4. `close` 时调用 `session.onPickClose`；取消、确认和卸载都会清理取色标记。

| EyeDropper Prop | 说明 |
| --- | --- |
| `target` | 可选 HTMLElement；默认截取整个网页 |
| `capture` | `{ fast?: boolean, exclude?: string[] }` |
| `native` | 默认检测原生 API 支持情况并提示；false 关闭该提示。实际取色始终使用截图放大镜 |

事件为 `confirm(hex)`、`close`、`nativeUnsupported`。Escape、右键和退出按钮可取消；截图失败时显示错误与退出入口。

snapdom 的实时样式恢复、滚动容器、伪元素与排除占位修复位于 `EyeDropper/captureCanvas.ts`。默认排除 `[data-eyedropper-exclude]`；浮层在截图副本中移除，不要把浮层本身加入传给 snapdom 的 exclude 列表。

## 工具与主题

导出颜色转换、透明度分析、渐变解析/插值、`captureCanvas`、`samplePoint`、`useRecentColors` 和会话工具。颜色支持 HEX、RGB(A)、HSL(A)、HSV(A)、CSS 色名及透明色；RGB/HSL 支持逗号和斜杠百分比 alpha。渐变支持百分比色标和 deg/rad/grad/turn 角度；`var()`、`calc()`、像素色标、径向渐变及 CSS Color 4 的其他色彩空间需要宿主先转换。

可通过 CSS 变量覆盖 `--color-picker-text`、`--color-picker-border`、`--color-picker-divider`、`--color-picker-primary`、`--color-picker-shadow`；每项都有内置默认值。浮层传送到 body 时，应在可继承至 body 的作用域设置主题变量。

`eventBus` 和 picker 状态函数保留为兼容导出；新宿主建议使用组件事件与会话工具。事件总线同一事件/handler 的重复订阅为幂等操作。

## 本地开发与验收

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm --dir example install --frozen-lockfile
pnpm --dir example dev

pnpm test                 # 全部回归、真实组件集成、SSR 和发布契约测试
pnpm type-check           # 库源码类型检查
pnpm type-check:example   # 示例类型检查；需先构建库
pnpm test:package         # tarball 内容、独立宿主类型/构建/CSS 验证
pnpm verify               # 全部测试、类型、示例构建和 tarball 消费验收
```

example 使用 `link:..` 消费本地构建产物，不再引用已发布旧版本。`test:package` 消费实际 npm tarball，复用本机已安装依赖；它不验证空缓存联网安装。`test:audit` 保留为 `test` 的兼容别名，历史审计用例已全部纳入默认测试。详细结果与环境限制见 [测试报告](docs/TEST_REPORT.md)。

```bash
npm pack       # prepack 自动构建；产出 tgz，不执行发布
npm publish --access public
```

main 分支的推送会触发 GitHub Actions，运行 `pnpm verify`，通过后部署 example 到 GitHub Pages。部署版本及源码 commit 可通过在线示例的 `version.json` 核对。发布前更新 package.json 版本和 CHANGELOG；已发布的 npm 版本不能覆盖。

MIT License。
