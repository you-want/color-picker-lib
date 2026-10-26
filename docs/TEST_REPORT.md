# 开源组件库修复与验收报告

日期：2026-10-26。对象：当前工作区源码、示例和本次构建的 `@you-want/color-picker-lib@0.1.1` tarball。

**结果：已修复初次审计的 21 类问题，并修复真实浏览器发现的零度红色色相不同步；自动化验收和 Chrome 浏览器验收通过。** 初次审计为 120 个用例、23 个失败断言（对应 19 类问题），另有两项示例集成问题。本轮保留这些断言并扩充回归，最终 **13 个测试文件、174 个用例全部通过，无跳过、无预期失败**。`pnpm verify` 完整执行成功。

这证明了下表范围内的功能与产物可用性。已通过 tt-bridge 连接用户 Chrome 补完浏览器验收；空缓存联网安装仍受环境限制，未计为通过。

## 验收结果

| 项目 | 结果 / 证据 |
| --- | --- |
| 全部回归 `pnpm test` | 174/174，通过；包含原有 39 个用例和全部初次审计用例 |
| 颜色与坐标审计 | 68/68；CSS 色名、HEX、现代 RGB/HSL、HSV、透明度、角度单位、非法格式、256 组 RGBA/HEX8 字节往返 |
| 状态与历史审计 | 20/20；存储命名空间、用户上下文、历史共享/去重、损坏/禁止/额度耗尽存储、事件解绑 |
| 真实组件集成 | 27/27；真实 Element Plus、SketchPicker、SliderColorSetting，运行于 jsdom |
| 完整取色链路 | 3/3；确认回填、Escape 取消、截图失败退出后重试，验证会话与浮层清理 |
| 滑块键盘交互 | 6/6；方向键、step、Home/End、删除边界、禁用、宿主输入框隔离 |
| SSR | 3/3；无 window/localStorage 渲染、EyeDropper 传送占位、服务端请求历史隔离 |
| 发布契约审计 | 8/8；JS/声明/CSS 入口、LICENSE、无测试代码泄漏、无残留 Sass 函数、frozen-lockfile |
| 库源码类型检查 | `pnpm type-check` 通过 |
| 示例类型检查 | `pnpm type-check:example` 通过；使用公开 ColorStop 类型，无 any 回填 |
| 库构建 | 通过；JS 66.07 kB（gzip 19.18 kB），CSS 10.95 kB（gzip 2.85 kB） |
| 示例构建 | 通过；消费 `link:..` 本地构建产物；CSS 包含调色板/放大镜选择器，无残留 `useThemeVar` |
| root 与 example 锁文件 | 两处 `pnpm install --frozen-lockfile --offline --ignore-scripts --lockfile-only` 均通过，仅验证锁文件一致性 |
| npm tarball | 22 个文件，31,815 bytes 压缩；包括运行代码、声明、样式、README、LICENSE |
| tarball 独立宿主消费 | 解包真实 tarball，无库源码别名；示例在临时宿主中类型检查、生产构建和 CSS 检查均通过；依赖复用本机安装 |
| 统一验收 | `pnpm verify` 退出码 0，完整顺序执行测试、库类型、示例类型/构建、tarball 消费 |
| Chrome 真实浏览器 | tt-bridge 连接 Chrome 155，15/15 组检查通过；真实 snapdom 截图采样、确认回填、取消重试、渐变拖动和键盘事件、Retina 滚动坐标；记录期间无 console error/warn |
| 变更格式 | `git diff --check` 通过 |

环境：macOS，Node.js 22.22.1、pnpm 10.32.1、Vite 6.4.5、Vitest 3.2.7、TypeScript 5.7.3。组件集成实际使用 Vue 3.5.44、Element Plus 2.14.7、vue-color 3.3.3、snapdom 1.9.9。

## 初次问题关闭记录

以下原问题全部修复。测试名称保留原编号，便于搜索和回归；没有改成 skip/fails，也没有删除原正确行为断言。

| 编号 | 修复后的行为 |
| --- | --- |
| COLOR-01 | 共用 CSS 标准色名表；green 在 RGBA、HEX 等入口均为 #008000 |
| COLOR-02 | HSL 色相规范化，360°/0° 等价，支持负角度 |
| COLOR-03 | HSL 小数饱和度/亮度不再截断 |
| COLOR-04 | HEX 校验完整长度和所有字符，非法值不产生 NaN |
| COLOR-05 | RGB/HSL/HSV 函数校验完整输入，拒绝尾随垃圾字符和非有限通道 |
| COLOR-06 | 正确解析现代 RGB/HSL 的斜杠百分比 alpha |
| COLOR-07 | 透明度提取/分析共用颜色解析器，HSLA 零透明度可正确识别 |
| COLOR-08 | deg/grad/rad/turn 均转换为度，渐变角度不再混入色标 |
| STATE-01 | 历史按 storageKey 分组、独立读取和持久化；相同 key 仍实时共享历史 |
| STATE-02 | 每个 useRecentColors 调用实例拥有独立 userId；会话记录打开时的用户 |
| STATE-03 | 监听包装按事件和 handler 管理；多事件可正确解绑，未知解绑不误删其他监听 |
| UI-01 | 未登录仍发出 sessionCommit，仅持久化要求用户 ID |
| UI-02 | 默认触发器为原生 button，含展开/禁用语义；Escape 关闭并恢复焦点 |
| UI-03 | 自定义 trigger 插槽通过统一点击处理展开，禁用状态仍有效 |
| UI-04 | 区分本地回写与外部更新；外部渐变/撤销同步编辑器，保留本地编辑激活色标 |
| UI-05 | 历史渐变直接按选中值同步，切换到正确编辑模式 |
| PKG-01 | style 字段指向真实的 dist/assets/index.css |
| PKG-02 | 宿主 Sass 函数替换成带默认值的 CSS 变量，产物不含 useThemeVar |
| PKG-03 | manifest/lockfile 同步，移除重复及未使用的开发依赖，冻结锁文件校验通过 |
| EXAMPLE-01 | 导出 ColorStop，示例使用完整色标类型并检查类型后构建 |
| EXAMPLE-02 | 示例显式导入库 CSS；改为本地 link，避免误测已发布旧版 |

额外修复：取消取色后遗留 picking 标记；子滑块格式化预览回写导致的外部值变更；HEX8/现代 RGB 透明度预览；无效 SketchPicker payload；无效采样坐标；SSR 直接访问 window；滑块全局键盘监听干扰宿主输入。

原有导出函数保持，颜色解析改用同一套规则以消除不同入口行为分歧。Element Plus 最低 peer 范围调整为 `>=2.6.0`，对应组件所用 radio value API；本次实际版本验证为 2.14.7，未实测最低版本。

## 可重复验收

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm --dir example install --frozen-lockfile
pnpm verify

# 仅跑测试并保存 JSON
pnpm test --reporter=json --outputFile=/tmp/color-picker-test-results.json

# 仅验证 tarball
pnpm test:package
```

默认 `pnpm test` 现在自动构建并包含原审计目录；`test:audit` 为兼容别名。`scripts/verify-package.mjs` 会创建临时宿主、解包真实 tarball、检查入口/包内容、执行类型检查/构建、验证最终 CSS，并清理临时目录。

README 已同步依赖、CSS 导入、组件 API、独立用户上下文、主题变量、完整取色协议和本地开发流程。SSR 宿主还需按 Element Plus 的规则为每次请求提供稳定 ID 和 z-index 上下文。

## 验收边界

- **Chrome 浏览器验收已完成，范围见下节。** tt-bridge 通过页面 DOM 点击及合成 MouseEvent/KeyboardEvent 操作真实 Chrome；不等同于操作系统可信键鼠输入或屏幕阅读器验收。Firefox/Safari、触屏及缩放矩阵尚未验证。jsdom 回归仍使用 canvas/截图边界替身；Chrome 取色使用真实 snapdom 与 Canvas 像素。
- **空缓存联网安装未通过环境验证。** 本轮以当前 tarball、Vue 3.5.44、Element Plus 2.14.7 创建独立空缓存安装；npm 调试日志显示 registry.npmjs.org 请求 `ENOTFOUND`，随后表层报 ERESOLVE/element-plus@undefined。未用 force/legacy-peer-deps 绕过；不能将其断言为真实版本冲突。已通过的包消费测试明确复用本机依赖。
- 示例完整注册 Element Plus，最终 JS 约 1.13 MB，Vite 有 500 kB 分块提示；这是示例总包体积，未当作库自身体积。库体积见上表。
- 本次未验证移动触摸拖拽、超大页面截图性能、浏览器 hydration、Element Plus 最低版本矩阵。颜色支持范围以 README 为准，不包含 var()/calc()/其他色彩空间等所有 CSS 语法。
- 初次审计对安装的 30 个生产依赖包名/版本查询 npm bulk advisories，响应为空；本轮未更换这些运行依赖版本。该结果不代表完整安全审计。
- 发布状态以 npm registry、GitHub 仓库和示例站点 `version.json` 为准；本报告记录验证范围，不把本地验收当成上线凭证。

## tt-bridge 浏览器补充验收

环境：用户 Chrome 155.0.0.0、tt-bridge 扩展 1.0.6，示例 `http://127.0.0.1:5178/`，消费当前 `dist` 构建产物。视口 1730 × 952 CSS 像素、devicePixelRatio = 2。浏览器中没有替换组件、snapdom、Canvas 或 localStorage；操作由桥接工具在页面执行 DOM 点击和合成事件。

共 15 组检查，明细见 [browser-acceptance.json](./browser-acceptance.json)：

- HEX 输入、透明度与预览；Escape 关闭、真实焦点返回及单次会话提交。
- 渐变模式、添加中间色标、方向键/Home/End/删除、基于真实布局的鼠标拖动、旋转和翻转。
- 历史持久化和选择。
- 实际 snapdom 截图、放大镜显示背景像素 `R:11 G:16 B:32 #0B1020`，确认回填为 `rgba(11, 16, 32, 1)`；浮层正确移除。
- Escape、右键、退出按钮、画布外点击四种退出方式；每次取消后重新进入成功，取消不改色且保留调色板。
- 页面滚动 80 CSS 像素后、Retina dpr=2 下再次正确采样；点击调色板外部关闭。
- 全程记录 console error/warn、window error 和 unhandledrejection，结果均为空。已查看调色板及真实取色截图。

浏览器额外发现并修复：vue-color 3.3.x 将 0° 红色色相当成灰色而保留旧色相。例如输入绿色后输入 `ff0000`，模型已是红色，但 Hue 仍为 120°、面板仍绿。当前在实际红色与面板色相不一致时重建 SketchPicker，并恢复编辑输入的焦点及选区；灰色继续保留原色相，正确色相的拖动不触发重建。新增两条集成测试先复现失败，再验证修复；Chrome 中确认 Hue 为 0°，焦点与选区保留。

本轮统一验收日志：`/private/tmp/color-picker-browser/verification.log`（退出码 0，174/174）；截图位于 `/private/tmp/color-picker-browser/`，含 `palette.png`、`picking.png`、`final.png`。临时浏览器验收脚本仅用于本轮运行，不包含于 npm 产物。

版本整理：0.1.1 增加 CHANGELOG 与发布元数据，示例支持 GitHub Pages 子路径，CI 固定 pnpm 10.32.1 / Node.js 22。`VITE_BASE=/color-picker-lib/ pnpm verify` 再次完整通过；22 文件的实际打包产物通过宿主消费。该子路径的线上验证需另行检查部署结果。
