<script lang="ts" setup>
/**
 * PC 码牌小程序引导页（/m/:code）
 * 落到本页说明「普通链接二维码」认领规则未拦截（未配置/未发布/非钱包环境），
 * 直接重定向 PC 码牌支付页（RoutePath.CODE_PAY，展示扫码引导）继续下一步，不再驻留提示；
 * 认领规则生效时本页不会被打开（钱包直接拉起小程序）。
 * 视觉结构保留作重定向期间的兜底壳（Web 白卡风格，scoped 原生 px）。
 */
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { closeWebview } from '@/shared/pay/close-webview'
import { useMiniGuideEnv } from '@/shared/pay/use-mini-guide-env'

defineOptions({ name: 'PcCodePayMiniGuide' })

// 码牌支付路由 name（RoutePath.CODE_PAY = /h/:code，注册见 pc/router/index.ts）
const CODE_PAY_ROUTE_NAME = 'PcCodePay'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
// 码牌编码来自路由参数
const code = (route.params.code as string) || ''

// UA 感知:钱包内显示"小程序暂不可用"+当前钱包图标;否则"请扫码支付"+四钱包
const { icons, titleKey, descKey } = useMiniGuideEnv()

// 兜底跳转码牌支付页（认领未生效/非钱包环境均适用）
// 只在本页(/m/:code)跳向码牌支付路由，码牌支付页不再回跳，不会形成重定向循环；code 为空时保留提示壳
onMounted(() => {
  if (code) {
    router.replace({ name: CODE_PAY_ROUTE_NAME, params: { code } })
  }
})
</script>

<template>
  <div class="pc-code-mini">
    <div class="pc-code-mini__card">
      <div class="pc-code-mini__icons">
        <img
          v-for="icon in icons"
          :key="icon.altKey"
          :src="icon.src"
          :alt="t(icon.altKey)"
          class="pc-code-mini__icon"
          width="40"
          height="40"
        >
      </div>
      <!-- 标题(UA 感知:钱包内为"小程序暂不可用") -->
      <h1 class="pc-code-mini__title">
        {{ t(titleKey) }}
      </h1>
      <!-- 描述(UA 感知) -->
      <p class="pc-code-mini__desc">
        {{ t(descKey) }}
      </p>
      <p v-if="code" class="pc-code-mini__code">
        {{ t('codePay.codeLabel') }} {{ code }}
      </p>
      <!-- 关闭页面 -->
      <button type="button" class="pc-code-mini__close" @click="closeWebview">
        {{ t('aggregate.closePage') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* PC：scoped 原生 px，禁止 UnoCSS 长度类 */
.pc-code-mini {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  box-sizing: border-box;
  background: var(--h5-bg-page);
}

.pc-code-mini__card {
  width: 100%;
  max-width: 480px;
  padding: 40px 36px 32px;
  background: var(--h5-bg-card);
  border-radius: 12px;
  box-shadow: 0 4px 24px rgb(0 0 0 / 8%);
  text-align: center;
  box-sizing: border-box;
}

.pc-code-mini__icons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  margin-bottom: 20px;
}

.pc-code-mini__icon {
  display: block;
  width: 40px;
  height: 40px;
  object-fit: contain;
}

.pc-code-mini__title {
  margin: 0 0 10px;
  font-size: 20px;
  font-weight: 600;
  color: var(--h5-text-primary);
  line-height: 1.4;
}

.pc-code-mini__desc {
  margin: 0;
  font-size: 14px;
  color: var(--h5-text-secondary);
  line-height: 1.7;
}

.pc-code-mini__code {
  margin: 20px 0 0;
  padding-top: 16px;
  border-top: 1px solid var(--h5-border);
  font-size: 12px;
  color: var(--h5-text-placeholder);
  word-break: break-all;
  line-height: 1.5;
}

.pc-code-mini__close {
  margin-top: 24px;
  width: 100%;
  max-width: 280px;
  height: 44px;
  border-radius: 22px;
  border: none;
  background: linear-gradient(135deg, var(--h5-brand-cashier) 0%, var(--h5-brand-cashier-deep) 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(93, 157, 254, 0.3);
}

.pc-code-mini__close:hover {
  opacity: 0.92;
}
</style>
