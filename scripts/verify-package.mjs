import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fixture = realpathSync(mkdtempSync(join(tmpdir(), 'color-picker-package-')))
const run = (command, args, cwd = fixture) => execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 })

try {
  const [packed] = JSON.parse(run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', fixture], root))
  const entries = new Set(packed.files.map(file => file.path))
  for (const entry of ['LICENSE', 'dist/index.js', 'dist/index.d.ts', 'dist/assets/index.css']) assert(entries.has(entry), `Missing ${entry}`)
  assert(![...entries].some(entry => /(?:__tests__|\.test\.|node_modules)/.test(entry)), 'Package contains test/dependency files')

  const consumer = join(fixture, 'consumer')
  const modules = join(consumer, 'node_modules')
  const packagePath = join(modules, '@you-want/color-picker-lib')
  mkdirSync(packagePath, { recursive: true })
  run('tar', ['-xzf', join(fixture, packed.filename), '--strip-components=1', '-C', packagePath])
  const manifest = JSON.parse(readFileSync(join(packagePath, 'package.json'), 'utf8'))
  for (const field of ['main', 'module', 'types', 'style']) assert(existsSync(join(packagePath, manifest[field])), `Broken ${field} entry`)

  // 消费真实 tarball。离线验收复用已安装依赖，不使用库源码别名。
  for (const name of ['vue', 'element-plus', 'vue-color', '@zumer/snapdom', 'mitt', 'uuid', 'vite']) {
    const target = join(modules, name)
    mkdirSync(dirname(target), { recursive: true })
    symlinkSync(realpathSync(join(root, 'node_modules', name)), target, 'dir')
  }
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: 'package-consumer', private: true, type: 'module' }))
  mkdirSync(join(consumer, 'src'))
  cpSync(join(root, 'example/src'), join(consumer, 'src'), { recursive: true })
  writeFileSync(join(consumer, 'index.html'), '<div id="app"></div><script type="module" src="/src/main.ts"></script>')
  writeFileSync(join(consumer, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { target: 'ES2020', module: 'ESNext', moduleResolution: 'bundler', lib: ['ES2020', 'DOM'], strict: true, skipLibCheck: true, noEmit: true, types: ['vite/client'] },
    include: ['src/**/*.ts', 'src/**/*.vue'],
  }))
  run(join(root, 'node_modules/.bin/vue-tsc'), ['--noEmit', '-p', join(consumer, 'tsconfig.json')], consumer)

  const { build } = await import('vite')
  const { default: vue } = await import('@vitejs/plugin-vue')
  await build({ root: consumer, configFile: false, plugins: [vue()], resolve: { dedupe: ['vue', 'element-plus', 'vue-color'] }, logLevel: 'error' })
  const assets = join(consumer, 'dist/assets')
  const css = readdirSync(assets).filter(file => file.endsWith('.css')).map(file => readFileSync(join(assets, file), 'utf8')).join('\n')
  assert(css.includes('magnifier-overlay_') && css.includes('recent-colors_'), 'Consumer is missing library styles')
  assert(!css.includes('useThemeVar('), 'Consumer contains unresolved Sass functions')
  console.log(`Package verified: ${packed.entryCount} files, ${packed.size} packed bytes; tarball consumer types, build and styles passed (installed dependencies reused).`)
} catch (error) {
  if (error.stdout) console.error(String(error.stdout))
  if (error.stderr) console.error(String(error.stderr))
  throw error
} finally {
  rmSync(fixture, { recursive: true, force: true })
}
