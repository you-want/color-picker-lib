/**
 * 浏览器原生 EyeDropper API 支持检测。
 * Chrome / Edge 已支持，Safari / Firefox 暂不支持。
 * 不支持时回退到 snapdom 截图方案，并提示用户。
 */
export function isNativeEyeDropperSupported(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  // EyeDropper 是 Chrome 96+ / Edge 96+ 的浏览器 API，部分旧 TS 库未声明类型。
  return typeof (window as unknown as { EyeDropper?: unknown }).EyeDropper === 'function'
}

/**
 * 获取原生 EyeDropper 提示文案，用于在浏览器不支持时给用户反馈。
 * 主项目最终在 Chrome 上运行，提示主要面向 Safari / Firefox 用户。
 */
export function getNativeEyeDropperHint(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
    return '当前 Safari 不支持原生取色器，已回退到截图取色方案'
  }
  if (/Firefox/.test(ua)) {
    return '当前 Firefox 不支持原生取色器，已回退到截图取色方案'
  }
  return '当前浏览器不支持原生取色器，已回退到截图取色方案'
}
