import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

// 只操作本地示例的新标签；DOM 事件驱动真实组件，不替换 snapdom、Canvas 或像素。
const url = new URL(process.argv[2] || 'http://127.0.0.1:5186/')
assert(['localhost', '127.0.0.1'].includes(url.hostname), 'Browser acceptance only targets a local example')
const reportPath = process.argv[3] || '/tmp/color-picker-requirements-browser.json'
const bridge = args => JSON.parse(execFileSync('tt-bridge', [...args, '--json'], { encoding: 'utf8', timeout: 60_000 }))
let tabId
let originalStorage
const storageKey = 'recenterlyUseColor:v2'
const evaluate = fn => bridge(['eval', `(${fn.toString()})()`, '--tab', String(tabId)])
const results = []
async function check(name, fn) {
  const tab = bridge(['tab', 'list']).find(t => t.tabId === tabId)
  if (tab) bridge(['tab', 'select', String(tab.index)])
  const evidence = evaluate(fn)
  results.push({ name, passed: true, evidence })
  writeFileSync(reportPath, JSON.stringify({ date: new Date().toISOString(), target: url.href, results }, null, 2) + '\n')
  console.log(`PASS ${name}`)
}

try {
  const deadline = Date.now() + 300_000
  if (!bridge(['status']).extensionConnected) console.log('Waiting for tt-bridge extension connection…')
  while (!bridge(['status']).extensionConnected) {
    assert(Date.now() < deadline, 'tt-bridge extension did not connect within five minutes')
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  tabId = bridge(['tab', 'new', url.href]).tabId
  for (let i = 0; i < 50; i++) {
    if (evaluate(() => !!document.querySelector('#demo-user'))) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  originalStorage = evaluate(() => ({ value: localStorage.getItem('recenterlyUseColor:v2') }))
  evaluate(() => { localStorage.removeItem('recenterlyUseColor:v2'); return true })
  bridge(['open', url.href, '--tab', String(tabId)])
  await check('真实浏览器环境与公开构建模块', async () => {
    for (let i = 0; i < 100 && !document.querySelector('#demo-user'); i++) await new Promise(r => setTimeout(r, 50))
    const resource = pattern => performance.getEntriesByType('resource').find(e => pattern.test(e.name))?.name
    const lib = await import(resource(/\/dist\/index\.js(?:\?|$)/))
    const vue = await import(resource(/\/deps\/vue\.js/))
    const errors = []
    for (const level of ['error', 'warn']) {
      const original = console[level]
      console[level] = (...args) => { errors.push({ level, message: args.map(String).join(' ') }); original(...args) }
    }
    addEventListener('error', e => errors.push({ level: 'error', message: e.message }))
    addEventListener('unhandledrejection', e => errors.push({ level: 'error', message: String(e.reason) }))
    const q = selector => [...document.querySelectorAll(selector)].find(e => e.getBoundingClientRect().width > 0 && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
    const expect = (condition, message) => { if (!condition) throw new Error(message) }
    const flush = async () => { await vue.nextTick(); await new Promise(resolve => setTimeout(resolve, 0)) }
    const input = async (selector, value, event = 'input') => {
      for (let i = 0; i < 30 && !q(selector); i++) await new Promise(r => setTimeout(r, 25))
      const el = q(selector); expect(!!el, `Missing ${selector}; ${document.body.innerText}`)
      el.value = String(value); el.dispatchEvent(new Event(event, { bubbles: true })); await flush()
    }
    const source = () => q('[data-testid="source-color"]').textContent
    const effective = () => q('[data-testid="effective-color"]').textContent
    const toggle = async () => { q('button[aria-label="选择颜色"]').click(); await flush() }
    const ensureOpen = async () => {
      if (q('button[aria-label="选择颜色"]').getAttribute('aria-expanded') !== 'true') await toggle()
      for (let i = 0; i < 30 && !q('input[aria-label^="Hex"]'); i++) await new Promise(r => setTimeout(r, 25))
    }
    const ensureClosed = async () => {
      if (q('button[aria-label="选择颜色"]').getAttribute('aria-expanded') === 'true') await toggle()
      for (let i = 0; i < 30 && q('input[aria-label^="Hex"]'); i++) await new Promise(r => setTimeout(r, 25))
    }
    const alphas = color => lib.parseGradient(color).colorStops.map(s => lib.parseColorToRGBA(s.color).a)
    const history = () => JSON.parse(localStorage.getItem('recenterlyUseColor:v2') || '[]')
    window.__requirements = { lib, q, expect, flush, input, source, effective, toggle, ensureOpen, ensureClosed, alphas, history, errors }
    return { ua: navigator.userAgent, dpr: devicePixelRatio, viewport: [innerWidth, innerHeight] }
  })
  await check('整体透明度通知、最终历史与历史回选恢复', async () => {
    const a = window.__requirements
    const { q, expect, flush, input, source, effective, ensureOpen, ensureClosed, alphas, history } = a
    Array.from(document.querySelectorAll('button')).find(e => e.textContent.includes('加载三色渐变')).click()
    await flush(); await ensureOpen()
    a.originalGradient = source()
    await input('input[aria-label="渐变整体透明度"]', 50)
    expect(JSON.stringify(alphas(effective())) === '[0.4,0.3,0.2]', 'Effective alpha must include global opacity')
    expect(source() === a.originalGradient, 'Global opacity mutated source')
    expect(history().length === 0, 'History written before closing')
    const half = effective()
    await ensureClosed()
    expect(history()[0].colors[0] === half, 'History must contain effective color')
    await ensureOpen(); await input('input[aria-label="渐变整体透明度"]', 0); await ensureClosed()
    const zero = effective()
    await input('#demo-opacity', 100); await ensureOpen()
    q('button[aria-label^="历史颜色"]').click(); await flush()
    expect(source() === a.originalGradient && q('#demo-opacity').value === '0', 'History did not restore source and opacity')
    expect(effective() === zero, 'History opacity applied twice')
    await input('input[aria-label="渐变整体透明度"]', 100)
    expect(JSON.stringify(alphas(effective())) === '[0.8,0.6,0.4]', 'Opaque recovery lost original alpha')
    const handles = [...document.querySelectorAll('[role="slider"]')].filter(e => e.getAttribute('aria-label')?.startsWith('渐变色标') && e.getBoundingClientRect().width > 0)
    handles[1].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); await flush()
    await input('input[aria-label="Transparency"]', '0.25')
    expect(JSON.stringify(alphas(source())) === '[0.8,0.25,0.4]', 'Editing middle stop affected other stops')
    return { half, zero, restoredSource: a.originalGradient, middleStop: source() }
  })
  await check('用户切换结清旧会话、清理取色并隔离新用户历史', async () => {
    const a = window.__requirements
    await a.input('input[aria-label="渐变整体透明度"]', 50)
    const oldFinal = a.effective()
    a.q('button[aria-label="画布取色"]').click(); await a.flush()
    a.expect(!!document.querySelector('[data-eyedropper-overlay]'), 'Picking overlay missing')
    await a.input('#demo-user', 'demo-other', 'change')
    a.expect(!document.querySelector('[data-eyedropper-overlay]'), 'User switch left picking active')
    a.expect(a.q('button[aria-label="选择颜色"]').getAttribute('aria-expanded') === 'false', 'User switch left palette open')
    a.expect(a.history().find(e => e.userId === 'demo-user').colors[0] === oldFinal, 'Old session attributed incorrectly')
    await a.ensureOpen()
    a.expect([...document.querySelectorAll('button[title]')].filter(e => e.getBoundingClientRect().width > 0).length === 1, 'New user sees old history')
    await a.input('input[aria-label="渐变整体透明度"]', 75); await a.ensureClosed()
    a.expect(a.history().find(e => e.userId === 'demo-other').colors.length === 1, 'New user history missing')
    await a.input('#demo-user', 'demo-user', 'change')
    return { oldFinal, users: a.history().map(e => ({ userId: e.userId, count: e.colors.length })) }
  })
  await check('历史上限与两行八列真实布局', async () => {
    const a = window.__requirements
    await a.ensureOpen()
    a.q('label.el-radio').click(); await a.flush()
    for (let i = 0; i < 16; i++) {
      await a.ensureOpen()
      const hex = (0x200001 + i * 0x10101).toString(16)
      const withAlpha = a.q('input[aria-label^="Hex"]').getAttribute('aria-label').includes('transparency')
      await a.input('input[aria-label^="Hex"]', hex + (withAlpha ? 'ff' : ''))
      await a.ensureClosed()
    }
    await a.ensureOpen()
    const boxes = [...document.querySelectorAll('button[title]')].filter(e => e.getBoundingClientRect().width > 0).map(e => { const r = e.getBoundingClientRect(); return [r.x, r.y] })
    a.expect(boxes.length === 16, 'Expected current color plus 15 history colors')
    a.expect(boxes.slice(0, 8).every((r, i) => Math.abs(r[0] - boxes[i + 8][0]) < 0.1), 'History columns misaligned')
    a.expect(new Set(boxes.map(r => r[1])).size === 2, 'History must occupy two rows')
    await a.ensureClosed()
    return { boxes }
  })
  await check('矩形上下边框真实像素、透明度往返与不重复叠加', async () => {
    const a = window.__requirements
    Array.from(document.querySelectorAll('button')).find(e => e.textContent.includes('加载三色渐变')).click(); await a.flush()
    const source = a.source()
    const target = a.q('[data-testid="pick-canvas"]')
    const border = a.q('[data-testid="gradient-border"]')
    const samples = []
    for (const opacity of [100, 50, 0, 100]) {
      await a.input('#demo-opacity', opacity)
      const screenshot = await a.lib.captureCanvas(target)
      const context = screenshot.getContext('2d')
      const rect = target.getBoundingClientRect(); const bounds = border.getBoundingClientRect()
      const at = (x, y) => { const p = a.lib.samplePoint(x, y, rect, screenshot.width, screenshot.height); return [...context.getImageData(p.x, p.y, 1, 1).data] }
      const pairs = [0.05, 0.35, 0.5, 0.85].map(t => ({ top: at(bounds.left + bounds.width * t, bounds.top + 4), bottom: at(bounds.left + bounds.width * t, bounds.bottom - 4) }))
      a.expect(pairs.every(p => JSON.stringify(p.top) === JSON.stringify(p.bottom)), `Border mismatch at ${opacity}%`)
      if (opacity === 0) a.expect(pairs.every(p => JSON.stringify(p.top) === '[11,16,32,255]'), 'Zero opacity must reveal canvas')
      a.expect(a.source() === source, 'Opacity changed source gradient')
      const corner = at(bounds.left + 0.25, bounds.top + 4)
      const first = a.lib.parseColorToRGBA(a.lib.parseGradient(a.effective()).colorStops[0].color)
      const expected = [first.r, first.g, first.b].map((channel, i) => Math.round(channel * first.a + [11, 16, 32][i] * (1 - first.a)))
      a.expect(expected.every((channel, i) => Math.abs(channel - corner[i]) <= 2), 'Corner multiplied alpha more than once')
      samples.push({ opacity, pairs, corner })
      a.captureScale = { x: screenshot.width / rect.width, y: screenshot.height / rect.height }
    }
    a.expect(JSON.stringify(samples[0].pairs) === JSON.stringify(samples[3].pairs), 'Opacity round trip changed border pixels')
    a.expect(JSON.stringify(samples[0].pairs) !== JSON.stringify(samples[1].pairs), 'Opacity did not change actual pixels')
    return { samples }
  })
  bridge(['screenshot', '/tmp/color-picker-requirements.png', '--tab', String(tabId)])
  await check('真实取色、10 CSS px Retina 网格、确认回填与多次取消', async () => {
    const a = window.__requirements
    const start = async () => {
      await a.ensureOpen(); a.q('button[aria-label="画布取色"]').click(); await a.flush()
      for (let i = 0; i < 100 && document.querySelector('[data-eyedropper-overlay]')?.textContent.includes('正在准备'); i++) await new Promise(r => setTimeout(r, 50))
      const overlay = document.querySelector('[data-eyedropper-overlay]')
      a.expect(!!overlay && !overlay.textContent.includes('失败'), 'Real capture failed')
      return overlay
    }
    const overlay = await start()
    const r = a.q('[data-testid="pick-canvas"]').getBoundingClientRect()
    const point = { x: r.left + 24, y: r.top + 24 }
    overlay.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: point.x, clientY: point.y })); await a.flush()
    for (let i = 0; i < 100 && !overlay.textContent.includes('R:11 G:16 B:32 #0B1020'); i++) await new Promise(r => setTimeout(r, 25))
    a.expect(overlay.textContent.includes('R:11 G:16 B:32 #0B1020'), 'Sample does not match real background')
    const canvas = overlay.querySelector('canvas')
    const radius = { x: Number(canvas.dataset.sampleRadiusX), y: Number(canvas.dataset.sampleRadiusY) }
    a.expect(Math.abs(radius.x / a.captureScale.x - 10) < 0.51 && Math.abs(radius.y / a.captureScale.y - 10) < 0.51, 'Magnifier does not cover 10 CSS px radius')
    const center = [...canvas.getContext('2d').getImageData(radius.x * 14 + 7, radius.y * 14 + 7, 1, 1).data]
    a.expect(JSON.stringify(center) === '[11,16,32,255]', 'Lens center differs from sampled pixel')
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: point.x, clientY: point.y })); await a.flush()
    a.expect(!document.querySelector('[data-eyedropper-overlay]') && a.source().includes('rgba(11, 16, 32, 1)'), 'Picked color not confirmed')
    const beforeCancel = a.source()
    for (const mode of ['Escape', 'contextmenu', 'button']) {
      const active = await start()
      if (mode === 'Escape') window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      else if (mode === 'contextmenu') active.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
      else active.querySelector('button').click()
      await a.flush()
      a.expect(!document.querySelector('[data-eyedropper-overlay]') && a.source() === beforeCancel, `Cancel failed: ${mode}`)
    }
    await a.ensureClosed()
    a.expect(a.errors.length === 0, `Browser errors: ${JSON.stringify(a.errors)}`)
    return { point, radius, center, grid: [canvas.width / 14, canvas.height / 14], errors: a.errors }
  })
  writeFileSync(reportPath, JSON.stringify({ date: new Date().toISOString(), target: url.href, results }, null, 2) + '\n')
  console.log(`Browser acceptance: ${results.length}/${results.length}; ${reportPath}`)
} catch (error) {
  if (tabId) {
    try {
      const diagnostic = evaluate(() => ({ text: document.body.innerText, trigger: document.querySelector('button[aria-label="选择颜色"]')?.outerHTML, inputs: [...document.querySelectorAll('input')].map(e => ({ label: e.getAttribute('aria-label'), value: e.value, width: e.getBoundingClientRect().width })) }))
      writeFileSync('/tmp/color-picker-browser-failure.json', JSON.stringify(diagnostic, null, 2))
    } catch { /* 保留原始失败 */ }
  }
  throw error
} finally {
  if (tabId) {
    if (originalStorage) {
      bridge(['eval', `(()=>{const value=${JSON.stringify(originalStorage.value)};if(value===null)localStorage.removeItem(${JSON.stringify(storageKey)});else localStorage.setItem(${JSON.stringify(storageKey)},value);return true})()`, '--tab', String(tabId)])
    }
    const tab = bridge(['tab', 'list']).find(t => t.tabId === tabId)
    if (tab) bridge(['tab', 'close', String(tab.index)])
  }
}
