import type { App } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { createApp } from 'vue'
import PcApp from '@/pc/App.vue'
import { pcRouter, setupPCRouter } from '@/pc/router'
import { setupI18n } from '@/shared/locales'
import { useDesignSettingStore } from '@/shared/store/modules/designSetting'

// PC 端独立的 pinia 实例（与移动端状态隔离，同一时刻仅一套应用运行）
const pcStore = createPinia()
pcStore.use(piniaPluginPersistedstate)

function setupPCStore(app: App) {
  app.use(pcStore)
}

/**
 * 创建 PC 端应用实例
 *
 * 挂载点：#pc-app（独立于 #app，不受 postcss-mobile-forever 的 appSelector 限宽影响）
 *
 * 样式约束：PC 页面所有尺寸用 scoped <style>（原生 px + 媒体查询），
 * 禁止使用 UnoCSS 的 px 原子类（如 p-4 / w-100 / text-2xl），
 * 它们会进入全局 UnoCSS 样式被 mobile-forever 转 vw，在宽屏下错乱。
 * UnoCSS 在 PC 仅限用非长度类（flex / grid / hidden / 颜色 / 文字对齐等）。
 */
export async function createPCApp() {
  // PC 形态标记: 供全局样式锚定(html[data-device='pc'], 见 App.vue 样式块的 vant 字号归一),
  // 移动端挂载链不执行本函数, 永不命中该选择器
  document.documentElement.dataset.device = 'pc'
  const app = createApp(PcApp)
  setupPCStore(app)
  // 挂载国际化（PC 端独立实例，与移动端共用同一 i18n 模块）
  setupI18n(app)
  // 初始化全局主题：跟随系统 prefers-color-scheme（传入 PC 独立 pinia，勿用 mobile 的 store 单例）
  useDesignSettingStore(pcStore).initSystemListener()
  // 站点配置: 缓存先 apply 防闪, 再远程 hash 比对
  const { initWebsiteConfig } = await import('@/shared/logics/init-website-config')
  await initWebsiteConfig()
  setupPCRouter(app)
  await pcRouter.isReady()
  return app
}
