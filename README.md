# @you-want/color-picker-lib

Vue 3 调色板、线性渐变编辑器与画布取色浮层。依赖 Vue `^3.5.0`、Element Plus `>=2.6.0`，无需宿主 store、JWT 或 Pinia。

[![npm version](https://img.shields.io/npm/v/@you-want/color-picker-lib.svg)](https://www.npmjs.com/package/@you-want/color-picker-lib)
[![npm weekly downloads](https://img.shields.io/npm/dw/@you-want/color-picker-lib.svg)](https://www.npmjs.com/package/@you-want/color-picker-lib)
[![license](https://img.shields.io/npm/l/@you-want/color-picker-lib.svg)](https://github.com/you-want/color-picker-lib/blob/main/LICENSE)

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
| `modelValue` | 原始 CSS 纯色或 `linear-gradient(...)`；保留各色标自身 alpha |
| `fillOpacity` | 100；渐变整体透明度，范围 0–100；支持 `v-model:fill-opacity`，无显式 alpha 的纯色也使用此值 |
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

事件：`update:modelValue` 实时更新原始颜色；`change(color)` 通知原始颜色编辑；`effectiveChange({ sourceColor, fillOpacity, color })` 在初始化及颜色/透明度变化时通知有效渲染值；`sessionCommit(color)` 在关闭或卸载时提交本轮最终有效颜色，未登录也发出；`changeColorSet(stops)`、`colorType(type)`、`degChange(degrees)` 用于宿主同步渐变信息。

`pick-request({ pickerId, color })` 请求宿主启动取色。组件实例暴露 `applyPickedColor(color)` 和只读 `effectiveColor`，分别用于回填与读取渲染值。

最近颜色最多保存 15 条，加上实时颜色共 16 格。持久化只在有用户 ID 时执行；默认兼容旧 key `recenterlyUseColor`。`useRecentColors` 的当前用户按调用实例隔离，`resetRecentColors()` 清空内存历史，不删除持久化数据。

历史色块和 `sessionCommit` 使用有效颜色；持久化记录同时保留原始颜色与整体透明度。选择历史时会恢复两者，避免重复乘 alpha，并允许从全透明恢复原始色标。旧字符串历史按整体透明度 100% 读取。`useRecentColors().changeUseColor(color, userId?, snapshot?)` 可接收 `{ sourceColor, fillOpacity }` 快照，`findColorSnapshot(color, userId?)` 读取快照。

`getUserId` 读取响应式用户 ID 时，身份变化会先向旧用户历史结清已有编辑，然后关闭面板、取消取色并刷新历史；不会把旧编辑保存到新用户。使用非响应式登录态时应由宿主先关闭编辑会话，再切换身份，重新打开会重新读取用户。

## 渐变整体透明度与矩形边框

画布应消费 `effectiveChange` 的 `color`，不要再对它乘一次整体透明度。原始 `v-model` 保留色标数据，整体透明度从 100% 降到 0% 再升回 100% 时不会丢失原始 alpha。纯色延续“显式 alpha 优先，否则使用 fillOpacity”的规则。

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ColorPicker, horizontalGradientBorderStyle } from '@you-want/color-picker-lib'
const source = ref('linear-gradient(90deg, #f00 0%, #0f08 35%, #00f 100%)')
const opacity = ref(100)
const rendered = ref(source.value)
</script>

<template>
  <ColorPicker
    id="border-picker"
    v-model="source"
    v-model:fill-opacity="opacity"
    :show-eye-dropper="false"
    @effective-change="rendered = $event.color"
  />
  <div
    :style="horizontalGradientBorderStyle(rendered, 8)"
    style="width: 280px; height: 160px; padding: 8px; box-sizing: border-box"
  >矩形内容</div>
</template>
```

`horizontalGradientBorderStyle` 将多色标按水平方向展开，上下边使用同向且同尺寸的背景层，左右边使用相应端点颜色，四角不会重复叠加透明度。该函数用于矩形横向边框，尺寸应至少为边宽的两倍；不改写源渐变角度，不处理圆角、SVG 或 Canvas 宿主边框。实际工业组态宿主仍需接入该函数或等价渲染方案后验收。

## 画布取色

完整接入见 `example/src/App.vue`：

1. 用 `useColorPickerSession().onPickRequest` 接收请求。
2. `session.pending.value` 非空时挂载 `<EyeDropper :target="canvasEl" />`。
3. `confirm(hex)` 时调用 `session.onPickConfirm(hex)`，根据返回的 pickerId 调用对应组件的 `applyPickedColor(hex)`。
4. `close` 时调用 `session.onPickClose`；取消、确认和卸载都会清理取色标记。

会话工具还会跟随取色标记被取消而清理 `pending`，包括用户切换及切换到其他调色板的情况。

| EyeDropper Prop | 说明 |
| --- | --- |
| `target` | 可选 HTMLElement；默认截取整个网页 |
| `capture` | `{ fast?: boolean, exclude?: string[] }` |
| `native` | 默认检测原生 API 支持情况并提示；false 关闭该提示。实际取色始终使用截图放大镜 |

事件为 `confirm(hex)`、`close`、`nativeUnsupported`。Escape、右键和退出按钮可取消；截图失败时显示错误与退出入口。

放大镜覆盖笔尖周围半径 10 CSS px 的页面范围，每格对应一个截图像素；DPR=1 时为 21×21 格，DPR=2 时为 41×41 格。坐标与范围按截图和页面的实际比例计算，不重复叠加滚动量或设备像素比。

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
# 启动本地 example 并连接 Chrome tt-bridge 后，另行执行真实浏览器验收
node scripts/verify-requirements-browser.mjs http://127.0.0.1:5186/ /tmp/color-picker-requirements-browser.json
```

example 使用 `link:..` 消费本地构建产物，不再引用已发布旧版本。`test:package` 消费实际 npm tarball，复用本机已安装依赖；它不验证空缓存联网安装。`test:audit` 保留为 `test` 的兼容别名，历史审计用例已全部纳入默认测试。详细结果与环境限制见 [测试报告](docs/TEST_REPORT.md)。

### 通过 GitHub Actions 发布（推荐）

在 GitHub 仓库的 **Actions → Publish to NPM → Run workflow** 中输入新版本号（semver，如 `0.2.1`）即可。流程会自动：校验版本未占用 → 更新 `package.json` → 运行 `pnpm verify` → 发布到 npm → 提交版本号回 main 并打 tag。

本地执行 `git pull` 即可同步更新后的版本号。

认证方式采用 npm **Trusted Publishing（OIDC）**，无需配置 `NPM_TOKEN`。需在 npm 包设置页 → Publishing Access → Add a GitHub Actions publisher，填入仓库 `you-want/color-picker-lib`、workflow `publish.yml`、environment `npm`。首次发布后该配置即生效。

### 本地手动发布

```bash
npm pack       # prepack 自动构建；产出 tgz，不执行发布
npm publish --access public
```

main 分支的推送会触发 GitHub Actions，运行 `pnpm verify`，通过后部署 example 到 GitHub Pages。部署版本及源码 commit 可通过在线示例的 `version.json` 核对。发布前更新 package.json 版本和 CHANGELOG；已发布的 npm 版本不能覆盖。

MIT License。
