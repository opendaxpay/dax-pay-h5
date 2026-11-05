<script lang="ts" setup>
/**
 * 码牌小程序引导页（/m/:code）
 * 落到本页说明「普通链接二维码」认领规则未拦截（未配置/未发布/非钱包环境），
 * 直接重定向 H5 码牌支付页（RoutePath.CODE_PAY，自带 UA 探测分端）继续完成支付，不再驻留提示；
 * 认领规则生效时本页不会被打开（钱包直接拉起小程序）。
 * 视觉结构保留作重定向期间的兜底壳（与 aggregate-mini/index.vue 对齐：品牌条 + 上浮卡）。
 */
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { closeWebview } from '@/shared/pay/close-webview'
import { useMiniGuideEnv } from '@/shared/pay/use-mini-guide-env'

defineOptions({ name: 'CodePayMiniGuidePage' })

// 码牌支付入口路由 name（RoutePath.CODE_PAY = /h/:code 的入口分发页，注册见 mobile/router/modules.ts）
const CODE_PAY_ENTRY_ROUTE_NAME = 'CodePayEntry'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
// 码牌编码来自路由参数
const code = (route.params.code as string) || ''

// UA 感知:钱包内显示"小程序暂不可用"+当前钱包图标;否则"请扫码支付"+四钱包
const { icons, titleKey, descKey } = useMiniGuideEnv()

// 兜底跳转 H5 码牌支付页（认领未生效/非钱包环境均适用）
// 只在本页(/m/:code)跳向码牌支付路由，码牌支付页不再回跳，不会形成重定向循环；code 为空时保留提示壳
onMounted(() => {
  if (code) {
    router.replace({ name: CODE_PAY_ENTRY_ROUTE_NAME, params: { code } })
  }
})
</script>

<template>
  <div class="code-mini">
    <!-- 品牌顶栏，与码牌环境页一致 -->
    <div class="code-mini__brand" />

    <div class="code-mini__panel">
      <!-- 四钱包图标：仅图标横排 -->
      <div class="code-mini__wallets">
        <img
          v-for="item in icons"
          :key="item.altKey"
          class="code-mini__wallet-img"
          :src="item.src"
          :alt="t(item.altKey)"
          width="40"
          height="40"
        >
      </div>

      <!-- 标题(UA 感知:钱包内为"小程序暂不可用") -->
      <h1 class="code-mini__title">
        {{ t(titleKey) }}
      </h1>
      <!-- 描述(UA 感知) -->
      <p class="code-mini__desc">
        {{ t(descKey) }}
      </p>

      <!-- 码牌编号弱展示 -->
      <p v-if="code" class="code-mini__code">
        {{ t('codePay.codeLabel') }} {{ code }}
      </p>
      <!-- 关闭页面 -->
      <van-button
        class="code-mini__close"
        round
        block
        type="primary"
        @click="closeWebview"
      >
        {{ t('aggregate.closePage') }}
      </van-button>
    </div>
  </div>
</template>

<style scoped>
.code-mini {
  min-height: 100%;
  padding-bottom: 40px;
  background: var(--h5-bg-page);
  box-sizing: border-box;
}

.code-mini__brand {
  height: 120px;
  background: linear-gradient(135deg, var(--h5-brand-cashier), var(--h5-brand-cashier-deep));
}

.code-mini__panel {
  margin: -48px 16px 0;
  padding: 28px 20px 24px;
  background: var(--h5-bg-card);
  border-radius: 12px;
  box-shadow: var(--h5-shadow-card);
  text-align: center;
  box-sizing: border-box;
}

.code-mini__wallets {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-bottom: 18px;
}

.code-mini__wallet-img {
  display: block;
  width: 40px;
  height: 40px;
  object-fit: contain;
  border-radius: 10px;
}

.code-mini__title {
  margin: 0 0 8px;
  font-size: 17px;
  font-weight: 600;
  color: var(--h5-text-primary);
  line-height: 1.4;
}

.code-mini__desc {
  margin: 0;
  font-size: 13px;
  color: var(--h5-text-secondary);
  line-height: 1.65;
  padding: 0 4px;
}

.code-mini__code {
  margin: 16px 0 0;
  font-size: 12px;
  color: var(--h5-text-placeholder);
  word-break: break-all;
  line-height: 1.5;
}

.code-mini__close {
  margin-top: 20px;
  --van-button-primary-background: var(--h5-brand-cashier);
  --van-button-primary-border-color: var(--h5-brand-cashier);
  color: #fff;
  font-weight: 600;
}
</style>
