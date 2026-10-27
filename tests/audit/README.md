# 公共组件库回归与验收

```bash
pnpm test                 # 先构建，再运行所有回归及原审计用例
pnpm test:audit           # 兼容别名，同 pnpm test
pnpm verify               # 测试、类型、示例构建与真实 tarball 消费
```

原审计发现的 COLOR/STATE/UI/PKG 编号保留在测试名称中，所有断言仍要求正确结果；没有使用 skip、预期失败或弱化原缺陷断言。默认测试包含 `src` 原回归和本目录全部用例。

组件集成使用真实 Element Plus、vue-color 和 SliderColorSetting，在 jsdom 中挂载。ResizeObserver 与 canvas 棋盘格绘制使用浏览器边界替身。完整取色链路使用实际组件与 session，只替换截图/像素读取边界；它不等于真实浏览器像素或视觉验收。SSR 单独在无 DOM 的 Node 环境运行。

发布契约读取构建后的 dist；锁文件校验在临时目录复制 manifest/lockfile 后执行，不改动工作区依赖。`scripts/verify-package.mjs` 解包真实 npm tarball 并验证宿主类型、构建、CSS，依赖复用本机安装，临时文件自动清理。

机器可读结果：

```bash
pnpm test --reporter=json --outputFile=/tmp/color-picker-test-results.json
```

修复记录和覆盖边界见 [测试报告](../../docs/TEST_REPORT.md)。

需求 3.10 新增 `requirements.test.ts`（整体透明度、历史快照、用户切换及 pending 清理）和 `magnifier.test.ts`（页面半径 10 CSS px、逐截图像素网格）。jsdom 结果不能替代像素验收。

真实浏览器脚本：先 `pnpm build` 和启动 example，再连接 tt-bridge 扩展，执行：

```bash
node scripts/verify-requirements-browser.mjs http://127.0.0.1:5186/ /tmp/color-picker-requirements-browser.json
```

脚本使用新标签中的真实组件、snapdom 和 Canvas，验证边框像素与透明度往返、历史选择/布局、用户切换、放大镜中心/半径和取色取消。测试后恢复原历史数据并关闭测试标签。仅支持本地示例，机器可读证据保存于第三个参数指定的位置。
