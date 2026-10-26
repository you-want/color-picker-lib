// @vitest-environment node
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))

describe('构建后的 npm 包契约（先 pnpm build）', () => {
  it.each(['main', 'module', 'types'])('%s 声明的入口真实存在', field => {
    expect(existsSync(resolve(root, pkg[field]))).toBe(true)
  })
  it('实际产物包含组件样式和 MIT LICENSE', () => {
    expect(existsSync(resolve(root, 'dist/assets/index.css'))).toBe(true)
    expect(readFileSync(resolve(root, 'LICENSE'), 'utf8')).toContain('MIT License')
  })
  it('生产产物不泄漏测试代码', () => {
    const js = readFileSync(resolve(root, pkg.main), 'utf8')
    expect(js).not.toMatch(/from ["'](?:vitest|@vue\/test-utils)["']/)
  })
  it('[PKG-01] style 字段应指向存在的 CSS 文件', () => {
    expect(existsSync(resolve(root, pkg.style))).toBe(true)
  })
  it('[PKG-02] 产物不应保留宿主工程的 useThemeVar Sass 函数', () => {
    expect(readFileSync(resolve(root, 'dist/assets/index.css'), 'utf8')).not.toContain('useThemeVar(')
  })
  it('[PKG-03] CI frozen-lockfile 可校验通过', () => {
    const fixture = mkdtempSync(resolve(tmpdir(), 'color-picker-lock-audit-'))
    try {
      for (const file of ['package.json', 'pnpm-lock.yaml']) copyFileSync(resolve(root, file), resolve(fixture, file))
      const result = spawnSync('pnpm', [
        'install', '--frozen-lockfile', '--offline', '--ignore-scripts', '--lockfile-only',
        '--store-dir', resolve(fixture, 'store'),
      ], { cwd: fixture, encoding: 'utf8', timeout: 20_000 })
      expect(result.status, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`).toBe(0)
    } finally {
      rmSync(fixture, { recursive: true, force: true })
    }
  }, 25_000)
})
