<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useVantThemeVars } from '@/shared/hooks/setting/useVantThemeVars'
import { useLocale } from '@/shared/locales'
import { checkDeviceMismatch } from '@/shared/logics/device-mismatch'

defineOptions({ name: 'PcApp' })

const router = useRouter()

// PC 端 vant 组件（如收银台、协议页的 Dialog/NavBar）语言包，跟随当前语言
const { vantLocale } = useLocale()
// 跟随系统深浅色，驱动 vant ConfigProvider theme
const { getDarkMode, getThemeVars } = useVantThemeVars()

// 挂载完成后检测页面形态与终端 UA 是否不匹配并弹窗提醒（异步触发，不阻塞首屏渲染）
// 等初始导航完成再取首屏路由名：弹窗按「切换后有真实页面可去」判定需要（独占真实版/404 不弹）
onMounted(async () => {
  await router.isReady()
  checkDeviceMismatch(router.currentRoute.value?.name)
})
</script>

<template>
  <vanConfigProvider :theme="getDarkMode" :theme-vars="getThemeVars()" :locale="vantLocale">
    <RouterView />
  </vanConfigProvider>
</template>

<style lang="less">
  /* PC 与移动端共用语义色 Token + 全局暗色覆盖 */
@import '../shared/styles/index.less';

/* PC 形态归一 vant 字号: vant 样式来自 node_modules, 未被 postcss-mobile-forever 的
   exclude(仅 src/pc/) 排除, 其 --van-font-size-* 的 px 被转为 min(vw, px), 宽视口下
   饱和偏大(input 继承 22.4px 等)。此处按 vant 官方默认 px 值覆写回固定字号;
   锚点 html[data-device='pc'] 由 createPCApp 打标(移动端不命中, 弹层 teleport 到
   body 也能经 html 祖先继承); 本文件在 src/pc/ 下, 覆写值不会被转 vw */
html[data-device='pc'] {
  --van-font-size-xs: 10px;
  --van-font-size-sm: 12px;
  --van-font-size-md: 14px;
  --van-font-size-lg: 16px;
}
</style>
