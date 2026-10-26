# 项目约定

Vue 3 开源调色板、渐变编辑器和 snapdom 画布取色组件库。

- 使用 pnpm 10.32.1；CI 使用 Node.js 22。
- 安装根目录和 example 的依赖后，先 `pnpm build`，再 `pnpm --dir example dev`。
- 发布前运行 `pnpm verify`：包含全部测试、类型、示例构建及真实 npm tarball 消费。
- `src/` 为公共库；`example/` 必须消费本地构建和显式导入库 CSS，不能别名到源码。
- `tests/audit/` 保存回归断言；不要跳过已复现缺陷，真实浏览器验收不能用 jsdom 代替。
- `docs/TEST_REPORT.md` 记录验收范围；发布变化记入 `CHANGELOG.md`。
- main 推送触发验收及 GitHub Pages 部署；`version.json` 是部署版本和 commit 凭证。
- npm 发布前确认版本未占用；只发布构建包，凭证不得进入仓库或日志。
- 不把本地验证、代码推送、npm 发布和线上验证混为同一状态。
- 尚未覆盖的平台和安装条件以测试报告为准，不宣称所有浏览器均已通过。
