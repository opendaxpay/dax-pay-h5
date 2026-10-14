<script lang="ts" setup>
/**
 * 公众号扫码绑定发起页(PC 薄壳)
 *
 * 实际逻辑由共享 BindScan 组件承载, 与移动端同 path 各指各 view;
 * PC 微信内置浏览器扫码打开时同样可完成公众号网页授权
 */
import BindScan from '@/shared/components/auth/BindScan.vue'

defineOptions({ name: 'PcSocialBindScan' })
</script>

<template>
  <BindScan />
</template>
