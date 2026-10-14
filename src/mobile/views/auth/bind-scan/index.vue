<script lang="ts" setup>
/**
 * 公众号扫码绑定发起页(移动端薄壳)
 *
 * 实际逻辑由共享 BindScan 组件承载, 本文件仅声明组件 name,
 * 便于路由 name 对齐与 keep-alive
 */
import BindScan from '@/shared/components/auth/BindScan.vue'

defineOptions({ name: 'SocialBindScan' })
</script>

<template>
  <BindScan />
</template>
