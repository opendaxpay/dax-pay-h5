/**
 * 国际化核心装配
 *
 * - locale 状态以 vue-i18n 实例为单一事实源（composition 模式）
 * - 语言切换副作用：dayjs locale / vant 语言包 / `<html lang>` / localStorage 持久化
 * - mobile 与 pc 是两个独立 Vue 实例（各自独立 pinia），i18n 实例由两端 app.ts 分别 app.use(i18n)
 */
import type { App } from 'vue'
import type { AppLocaleCode, AppLocaleOption } from './lang'
import dayjs from 'dayjs'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'
import enUS from './en-US'
import idID from './id-ID'
import jaJP from './ja-JP'
import koKR from './ko-KR'
import {
  APP_LOCALES,
  DEFAULT_LOCALE,
  getLocaleOption,
  LOCALE_STORAGE_KEY,
  resolveInitialLocale,
} from './lang'
import msMY from './ms-MY'
import thTH from './th-TH'
import viVN from './vi-VN'
import zhCN from './zh-CN'
import zhHK from './zh-HK'
import zhTW from './zh-TW'

export type { AppLocaleCode, AppLocaleOption }

const i18n = createI18n({
  legacy: false,
  locale: resolveInitialLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
    'zh-TW': zhTW,
    'zh-HK': zhHK,
    'ja-JP': jaJP,
    'ko-KR': koKR,
    'id-ID': idID,
    'vi-VN': viVN,
    'th-TH': thTH,
    'ms-MY': msMY,
  },
  // dev 提示缺 key / 回退（便于发现漏翻与层级错位），生产保持静默避免控制台噪音
  missingWarn: !!import.meta.env.DEV,
  fallbackWarn: !!import.meta.env.DEV,
})

/** vant 语言包响应式引用，供 `van-config-provider` 的 `:locale` 绑定 */
const vantLocalePkg = ref<Record<string, any> | null>(null)

/** 动态加载 vant 语言包 */
async function loadVantLocale(code: AppLocaleCode) {
  const opt = getLocaleOption(code)
  if (!opt) {
    return
  }
  try {
    const mod = await opt.vantLoader()
    vantLocalePkg.value = mod.default ?? mod
  }
  catch (error) {
    console.warn('[i18n] failed to load vant locale:', error)
  }
}

/**
 * 应用语言变更的运行时副作用：dayjs / vant / `<html lang>`
 *
 * 注意：此处**不**写 localStorage。自动探测/初始化若落盘，
 * 会让陈旧值锁定语言、使后续浏览器语言变化失效。
 * 仅显式切换（`setLocale`）才持久化。
 */
function applySideEffects(code: AppLocaleCode) {
  const opt: AppLocaleOption = getLocaleOption(code) ?? APP_LOCALES[0]!
  // dayjs 全局 locale（影响 fromNow / localizedFormat 等本地化输出）
  dayjs.locale(opt.dayjsLocale)
  // 同步 <html lang> 属性
  if (typeof document !== 'undefined') {
    document.documentElement.lang = opt.htmlLang
  }
  // 异步加载 vant 语言包
  void loadVantLocale(code)
}

/**
 * 切换当前语言（显式选择，持久化到 localStorage）
 */
export function setLocale(code: AppLocaleCode) {
  if (!getLocaleOption(code)) {
    return
  }
  i18n.global.locale.value = code
  applySideEffects(code)
  // 仅显式切换才落盘，覆盖浏览器自动探测
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(LOCALE_STORAGE_KEY, code)
  }
}

/** 当前语言代码（非响应式读取，供非组件模块使用） */
export function getCurrentLocale(): AppLocaleCode {
  return i18n.global.locale.value as AppLocaleCode
}

/**
 * 供非组件模块使用的翻译函数（如 axios 拦截器、http checkStatus）
 */
export function t(key: string, named?: Record<string, unknown>): string {
  return i18n.global.t(key, named ?? ({} as Record<string, unknown>))
}

/**
 * 组件内语言组合式 API
 * @returns locale 当前语言（响应式 ref）、setLocale 切换函数、t 翻译函数、vantLocale vant 语言包 ref
 */
export function useLocale() {
  return {
    locale: i18n.global.locale,
    setLocale,
    t: i18n.global.t,
    vantLocale: vantLocalePkg,
    locales: APP_LOCALES,
  }
}

/**
 * 安装 i18n 到应用，并执行初始语言的副作用
 */
export function setupI18n(app: App) {
  app.use(i18n)
  applySideEffects(i18n.global.locale.value as AppLocaleCode)
  return i18n
}

export default i18n
