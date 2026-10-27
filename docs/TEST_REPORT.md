# 开源组件库修复与验收报告

## 当前验收：2026-10-27，需求 3.10（0.2.0）

依据：[V2.3 工业组态产品体验优化，3.10 取色器&调色板](https://ones.cisdigital.cn/wiki/#/team/SKG3mSQb/share/6DnmNRj8/page/CwzHmSXD)。0.2.0 已提交远端、发布 npm 并部署示例；各环节凭证见下方，0.1.1 不包含本轮修改。

- **`pnpm verify` 完整通过：15 个文件、188 个用例，无跳过或预期失败。** 包括新增 10 项透明度/历史/用户切换回归及 4 项放大镜比例回归，全部原 174 项断言继续通过。库与示例类型检查、生产构建、真实 tarball 宿主消费通过；tarball 验证复用本机依赖，本次未重新进行空 store 安装。
- **tt-bridge 真实 Chrome：6/6 组通过**，证据见 [requirements-browser-acceptance.json](./requirements-browser-acceptance.json)。消费当前 dist，无库源码别名，不替换组件、snapdom、Canvas 或像素；通过 DOM 点击与合成鼠标/键盘事件操作，不等同于操作系统可信输入或屏幕阅读器验收。
- 库构建 JS 70.66 kB（gzip 20.42 kB），CSS 11.25 kB（gzip 2.93 kB）。示例仍有 Element Plus 整体注册导致的较大分块提示。

| 需求 | 本次结果 |
| --- | --- |
| 渐变整体透明度 | 新增面板滑块与 `v-model:fill-opacity`；`effectiveChange` 输出原始值、整体透明度与最终 CSS。色标 alpha 0.8/0.6/0.4 在 50% 时变为 0.4/0.3/0.2，源数据不变 |
| 历史提交与恢复 | 编辑期间不写历史；关闭只提交最终有效色。保存源色/透明度快照；选择全透明历史后提高到 100% 恢复原色标，旧字符串历史不重复乘透明度 |
| 用户切换 | 面板打开时响应式切换用户，旧编辑只写旧用户历史，关闭面板并取消取色，宿主 pending 同步清理；新用户不显示旧历史 |
| 最近颜色布局 | 真实布局实测 16 格、两行八列，对应列横坐标一致；第一格为当前有效色 |
| 矩形上下边框 | 新增 `horizontalGradientBorderStyle` 与示例；对真实截图中 4 个横向位置的上下边框逐像素比较，在 100%、50%、0% 时均一致，回到 100% 恢复原像素；四角验证为单次 alpha 合成 |
| 放大镜范围 | 按页面半径 10 CSS px 计算；真实 DPR=2 显示 41×41 格，中心 RGB(11,16,32) 与确认值 #0B1020 一致；取消后再次进入成功 |

可重复运行（先构建库、启动 example，并让 Chrome tt-bridge 扩展连接）：

```bash
pnpm verify
pnpm --dir example dev --host 127.0.0.1 --port 5186
# 另一终端执行；第三个参数可指定 JSON 报告路径
node scripts/verify-requirements-browser.mjs http://127.0.0.1:5186/ /tmp/color-picker-requirements-browser.json
```

脚本只接受本地示例 URL，新建测试标签，结束后恢复该 origin 原有历史数据并关闭测试标签；扩展未连接时最多等待五分钟。浏览器证据环境为 macOS、Chrome 155、1730×952、DPR=2。DPR=1/1.5 与非等比截图比例仅有自动化边界回归，Safari/Firefox、触屏、屏幕阅读器及最低依赖版本矩阵本轮未验证。

**宿主边界：** 矩形辅助函数和示例已经验收，原工业组态主工程未在本仓库修改或上线；主工程需要消费有效颜色，并接入该横向边框函数或等价方案后再做实际页面验收。辅助函数不处理圆角、SVG 或 Canvas 宿主边框。非响应式登录态由宿主在切换前关闭会话，重新打开时会读取新用户。

### 0.2.0 发布与部署凭证

- [npm 0.2.0](https://www.npmjs.com/package/@you-want/color-picker-lib/v/0.2.0) 已发布，registry `latest` 为 0.2.0。发布的是经过验收的构建 tarball：23 文件、35,155 bytes，SHA-1 `f397b1ba733081c162d863c0f2eb58085fdb912e`，registry 与本地一致。
- [源码标签 v0.2.0](https://github.com/you-want/color-picker-lib/tree/v0.2.0) 指向 `6455afad518030fdff843ebce36b8348142c9bde`，已推送 main 与标签。[GitHub Actions](https://github.com/you-want/color-picker-lib/actions/runs/40468639324) 的 verify、deploy 均成功。
- [线上示例](https://you-want.github.io/color-picker-lib/) 的 `version.json` 验证为 0.2.0 与上述 commit；线上 JS/CSS 与本地验收构建逐字节相同。后续 main 文档提交仍会触发部署，commit 可随之更新；release tag 保持不变。
- registry 独立消费方使用空 pnpm store 安装发布包、Vue 3.5.44、Element Plus 2.14.7 及完整构建工具链，下载 88 个依赖、reused 0。安装使用 `--ignore-scripts`，随后类型检查、生产构建和最终 CSS 检查均通过，没有源码别名或本地依赖链接。
- 发布后独立无头 Chrome 156（1440×1000、DPR=2）访问线上产物，确认整体透明度 100%→50%→0%→100% 保留源色标并恢复；实际 snapdom/Canvas 取色为 #0B1020，正确写回激活色标，其余色标保留，pageerror 为空。此冒烟检查不替代上方本地 6 组需求验收，也不扩展 Safari/Firefox 等覆盖声明。

结构化发布证据见 [release-0.2.0-acceptance.json](./release-0.2.0-acceptance.json)。发布前以 `VITE_BASE=/color-picker-lib/ pnpm verify` 对 0.2.0 再次完整验收通过，日志保存于 `/private/tmp/color-picker-release-0.2.0-verify.log`；独立安装、构建及线上截图在 `/private/tmp/color-picker-release-0.2.0/`。

## 2026-10-26 初次修复及已发布 0.1.1 的历史记录

以下内容记录上一轮验收，不代表当前未发布修改已完成线上验证。

日期：2026-10-26。对象：当时工作区源码、示例和当时构建的 `@you-want/color-picker-lib@0.1.1` tarball。

**结果：已修复初次审计的 21 类问题，并修复真实浏览器发现的零度红色色相不同步；自动化验收和 Chrome 浏览器验收通过。** 初次审计为 120 个用例、23 个失败断言（对应 19 类问题），另有两项示例集成问题。本轮保留这些断言并扩充回归，最终 **13 个测试文件、174 个用例全部通过，无跳过、无预期失败**。`pnpm verify` 完整执行成功。

这证明了下表范围内的功能与产物可用性。已通过 tt-bridge 连接用户 Chrome 补完浏览器验收；发布后完成独立空 store 联网安装、类型检查和生产构建。

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
| 发布包全新安装 | npm 0.1.1，独立空 pnpm store 下载 51 个依赖（reused 0）；另行安装消费方工具链后，示例类型检查和生产构建均通过，无库源码别名 |
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
- **空 store 安装已补验通过。** 发布后在独立目录用 pnpm 安装 registry 中的 0.1.1、Vue 3.5.44、Element Plus 2.14.7，51 个依赖全新下载，未复用本机依赖；随后安装独立 Vite / Vue 插件 / TypeScript / vue-tsc / Sass 工具链，类型检查和生产构建通过。早期 npm CLI 的 ENOTFOUND 是执行环境网络限制，不能据此认定 peer 冲突。
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

版本整理：0.1.1 增加 CHANGELOG 与发布元数据，示例支持 GitHub Pages 子路径，CI 固定 pnpm 10.32.1 / Node.js 22。`VITE_BASE=/color-picker-lib/ pnpm verify` 再次完整通过；22 文件的实际打包产物通过宿主消费。该子路径已通过线上检查，见下节。

## 0.1.1 发布与部署凭证

- [npm 0.1.1](https://www.npmjs.com/package/@you-want/color-picker-lib/v/0.1.1) 已发布，registry 的 latest 已为 0.1.1；包内 22 文件。发布包 SHA-1 `9ed403dbad61bf73938810389ede33b55f15036a`，与本地验收包一致。
- [源码 tag v0.1.1](https://github.com/you-want/color-picker-lib/tree/v0.1.1) 指向 `a2f234465f9cc5d1d97967aade2776ee3680124c`。
- [GitHub Actions 验收及部署](https://github.com/you-want/color-picker-lib/actions/runs/40329291970) 成功，首次部署源码与 release tag 一致。
- [线上示例](https://you-want.github.io/color-picker-lib/) 页面及 JS/CSS 正常加载；[version.json](https://you-want.github.io/color-picker-lib/version.json) 返回 0.1.1 与部署 commit。后续 main 的文档提交也会触发工作流，部署 commit 可随之更新。
- 线上使用真实 snapdom 采样画布背景，确认后回填 `rgba(11, 16, 32, 1)`，浮层移除且未记录到页面错误。
- npm 发布后的独立消费方使用全新下载的依赖和工具链，示例类型检查、生产构建通过。没有添加 force / legacy-peer-deps，也没有以库源码替代 registry 产物。

发布时仍有非阻塞警告：snapdom 1.9.9 已被上游标记弃用，提示旧版本在文本重排、宽度冻结及 KaTeX 裁剪上存在保真问题；当前截图路径保留宿主样式修复并通过本轮场景，升级到 2.x 需要独立兼容回归，未把复杂页面保真声明为全面通过。Actions 的部分依赖有 Node.js 20 action runtime 弃用提示（GitHub 已改以 Node.js 24 运行），作业仍成功；项目本身使用 Node.js 22。示例全量 Element Plus 的分块提示仍保留。
