<script lang="ts" setup>
/**
 * 三方登录透传页(绑定场景 PC 薄壳)
 *
 * 实际逻辑由共享 SocialTransit 组件承载, 与移动端同 path 各指各 view
 */
import SocialTransit from '@/shared/components/auth/SocialTransit.vue'

defineOptions({ name: 'PcSocialBindTransit' })
</script>

<template>
  <SocialTransit mode="bind" />
</template>
