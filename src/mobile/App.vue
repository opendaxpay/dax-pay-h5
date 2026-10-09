<script setup lang="ts">
import { computed, onMounted, unref } from 'vue'
import { useRouter } from 'vue-router'
import { useDesignSetting } from '@/shared/hooks/setting/useDesignSetting'
import { useVantThemeVars } from '@/shared/hooks/setting/useVantThemeVars'
import { useLocale } from '@/shared/locales'
import { checkDeviceMismatch } from '@/shared/logics/device-mismatch'
import { useRouteStore } from '@/shared/store/modules/route'

const router = useRouter()
const routeStore = useRouteStore()
const { getIsPageAnimate, getPageAnimateType } = useDesignSetting()
const { getDarkMode, getThemeVars } = useVantThemeVars()
// vant 语言包（跟随当前语言，驱动 vant 内置组件文案：Dialog 按钮、Picker 等）
const { vantLocale } = useLocale()

// 需要缓存的路由组件
const keepAliveComponents = computed(() => routeStore.keepAliveComponents)

const getTransitionName = computed(() => {
  return unref(getIsPageAnimate) ? unref(getPageAnimateType) : undefined
})

// 挂载完成后检测页面形态与终端 UA 是否不匹配并弹窗提醒（异步触发，不阻塞首屏渲染）
// 等初始导航完成再取首屏路由名：弹窗按「切换后有真实页面可去」判定需要（独占真实版/404 不弹）
onMounted(async () => {
  await router.isReady()
  checkDeviceMismatch(router.currentRoute.value?.name)
})
</script>

<template>
  <vanConfigProvider :theme="getDarkMode" :theme-vars="getThemeVars()" :locale="vantLocale">
    <RouterView v-slot="{ Component, route }">
      <div class="absolute bottom-0 top-0 w-full overflow-hidden">
        <transition :name="getTransitionName" mode="out-in" appear>
          <!-- 空数组 [] 在 JS 中仍为 truthy，须用 length；key 用顶层路由 name，避免子路由切换整页 remount 冲掉 KeepAlive -->
          <KeepAlive v-if="keepAliveComponents.length" :include="keepAliveComponents">
            <component :is="Component" :key="String(route.matched[0]?.name || route.fullPath)" />
          </KeepAlive>
          <component :is="Component" v-else :key="String(route.matched[0]?.name || route.fullPath)" />
        </transition>
      </div>
    </RouterView>
  </vanConfigProvider>
</template>

<style lang="less">
  @import '../shared/styles/index.less';
</style>
