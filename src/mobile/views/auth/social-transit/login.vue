<script lang="ts" setup>
/**
 * 三方登录透传页(登录场景薄壳)
 *
 * 实际逻辑由共享 SocialTransit 组件承载, 本文件仅声明组件 name 与场景,
 * 便于路由 name 对齐与 keep-alive
 */
import SocialTransit from '@/shared/components/auth/SocialTransit.vue'

defineOptions({ name: 'SocialLoginTransit' })
</script>

<template>
  <SocialTransit mode="login" />
</template>
