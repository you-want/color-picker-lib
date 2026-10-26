# @you-want/color-picker-lib

取色器（EyeDropper）+ 调色板（ColorPicker）公共组件库，从设计器主工程抽取并完成解耦，不依赖宿主全局 store / eventBus，宿主只需装 `vue` + `element-plus` 即可用。

## 解耦清单（4 个耦合点）

| 耦合点 | 解法 |
|---|---|
| eventBus 7 事件协议 | 库内置 `src/shared/EventBus.ts`（mitt 薄封装），不外泄给宿主；取色链路收敛为 `pick-request` emit + `applyPickedColor` expose |
| ColorPickerStore (pinia) | 内部化为模块级 `src/shared/ColorPickerState.ts`（reactive），不要求宿主装 pinia |
| userId 来源（宿主 JWT） | 改为 `getUserId: () => string` prop，由宿主注入登录态 |
| 杂项参数化 | `DEFAULT_COLORS` → `presetColors` 默认 prop；localStorage key → `storageKey`，保留旧 key `recenterlyUseColor` 迁移 |

## 安装

```bash
# 库内运行
pnpm install
pnpm test          # 39 个单测
pnpm type-check    # vue-tsc
pnpm build         # 产出 dist/index.js + dist/index.d.ts + dist/assets/index.css
```

## 发布为 npm 包

包名 `@you-want/color-picker-lib`，scope 为个人组织 `@you-want`。

```bash
pnpm build
npm pack           # 生成 you-want-color-picker-lib-x.y.z.tgz
# 登录 npm 组织（公共源需 npm login 或 .npmrc 配 authToken）
npm publish        # @you-want scope 需该组织已存在且你为 owner
```

## 示例项目

`example/` 是一个独立 Vite 应用，演示宿主侧完整取色链路：

```
ColorPicker @pick-request → 宿主挂载 EyeDropper（截图区域为画布）
    → @confirm(hex) → useColorPickerSession 回填 pickerRef.applyPickedColor
```

```bash
cd example
pnpm install
pnpm dev    # http://localhost:5173
```

依赖通过 `file:../you-want-color-picker-lib-0.1.0.tgz` 安装（tarball 需先 `npm pack` 生成），模拟真实 npm 安装流程。

## 组件 API

### `ColorPicker`

```vue
<ColorPicker
  v-model="color"
  id="picker-1"
  :fill-opacity="100"
  :get-user-id="() => loginStore.userId"
  storage-key="recenterlyUseColor:v2"
  :slider-buttons="stops"
  @change-color-set="stops = $event"
  @session-commit="onCommit"
  @pick-request="onPickRequest"
/>
```

| prop | 说明 |
|---|---|
| `modelValue` | CSS 色值（纯色 / `linear-gradient(...)`） |
| `showEyeDropper` | 是否显示取色按钮，默认 `true` |
| `getUserId` | 宿主登录态解析，替代原来写死在组件内的 JWT 取 userId 逻辑 |
| `storageKey` | 最近颜色存储键，含旧 key `recenterlyUseColor` 迁移 |
| `presetColors` | 预设色板，默认 `DEFAULT_COLORS` |
| `isNeedGradient` | 支持类型开关（纯色/渐变） |

- `emits`：`update:modelValue`（实时色值）、`sessionCommit(color)`（退出且本轮有改动时提交一次历史）、`pick-request({ pickerId, color })`（宿主决定如何启动取色）。
- `expose`：`applyPickedColor(color)` 取色结果回填当前 picker。

### `EyeDropper`

```vue
<EyeDropper :target="canvasEl" @confirm="onConfirm" @close="onClose" @native-unsupported="onNative" />
```

| prop | 说明 |
|---|---|
| `target` | 截图区域 HTMLElement |
| `native` | 是否强制用原生 API（默认自动检测） |
| `capture` | 截图选项透传（fast / exclude） |

`emits`：`confirm(hex)` / `close` / `nativeUnsupported`。

### 宿主取色链路（收敛后）

```
ColorPicker @pick-request → 宿主挂载 <EyeDropper> → @confirm(color)
                              → pickerRef.applyPickedColor(color) 回填
```

## 目录结构

```
src/
├── ColorPicker/          # 调色板 popover（解耦版）
├── EyeDropper/           # 取色浮层 + snapdom 截图 + 样式修复（零业务耦合）
├── SliderColorSetting/   # 渐变角度/色标滑块（随包件，去 eventBus 化）
├── color-utils/          # ColorUtil 纯函数
├── composables/          # useRecentColors（去 pinia）/ useColorPickerSession
└── shared/               # ColorPickerState / EventBus / defaults（内部，不要求宿主装 pinia）
```

## 注意事项

- snapdom 相关经验已固化在 `EyeDropper/captureCanvas.ts`（排除节点占位、fast 透传、样式修复），对抗 snapdom 内部缺陷，**不要精简**。
- 取色器 exclude 列表不得包含取色器自身 `[data-eyedropper-overlay]`（否则画布截图为空、浮层无法显示）。
- 原生 EyeDropper API 与放大镜交互互斥，保持截图方案为主线、原生仅作兼容性提示。
- 最近颜色旧 key（`recenterlyUseColor`）迁移逻辑已随包走，老用户历史不丢。
