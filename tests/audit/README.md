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
