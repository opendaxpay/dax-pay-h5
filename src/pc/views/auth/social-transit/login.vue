<script lang="ts" setup>
/**
 * 三方登录透传页(登录场景 PC 薄壳)
 *
 * 实际逻辑由共享 SocialTransit 组件承载, 与移动端同 path 各指各 view
 */
import SocialTransit from '@/shared/components/auth/SocialTransit.vue'

defineOptions({ name: 'PcSocialLoginTransit' })
</script>

<template>
  <SocialTransit mode="login" />
</template>
