<script lang="ts" setup>
/**
 * 公众号扫码登录结果页(PC 薄壳)
 *
 * 实际逻辑由共享 BindScanResult 组件承载(login 场景), 与移动端同 path 各指各 view
 */
import BindScanResult from '@/shared/components/auth/BindScanResult.vue'

defineOptions({ name: 'PcSocialLoginScanResult' })
</script>

<template>
  <BindScanResult mode="login" />
</template>
