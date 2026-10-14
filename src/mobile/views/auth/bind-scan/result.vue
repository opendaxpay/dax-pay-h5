<script lang="ts" setup>
/**
 * 公众号扫码绑定结果页(移动端薄壳)
 *
 * 实际逻辑由共享 BindScanResult 组件承载, 本文件仅声明组件 name,
 * 便于路由 name 对齐与 keep-alive
 */
import BindScanResult from '@/shared/components/auth/BindScanResult.vue'

defineOptions({ name: 'SocialBindScanResult' })
</script>

<template>
  <BindScanResult />
</template>
