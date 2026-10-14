<script lang="ts" setup>
/**
 * 公众号扫码登录结果页(移动端薄壳)
 *
 * 实际逻辑由共享 BindScanResult 组件承载(login 场景), 本文件仅声明组件 name,
 * 便于路由 name 对齐与 keep-alive
 */
import BindScanResult from '@/shared/components/auth/BindScanResult.vue'

defineOptions({ name: 'SocialLoginScanResult' })
</script>

<template>
  <BindScanResult mode="login" />
</template>
