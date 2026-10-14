<script lang="ts" setup>
/**
 * 三方登录网关透传页(共享组件, mobile/PC 两端薄壳复用)
 *
 * 跳转型平台(支付宝/微信公众号)的登录/绑定 OAuth 回调统一落在支付网关域名的透传路径
 * (/auth/oauth-callback/:client/:source 与 /auth/social-bind-callback/:client/:source),
 * 本页不解析授权码, 仅凭路径参数 + mode 查询目标端回调地址, 原样透传 query 跳回,
 * 由对应端(运营/商户 Web)原有回调页完成 code 换取, 各端页面零改动。
 *
 * 失败兜底: 参数缺失或目标地址查询失败时显示错误卡; 全程不把授权码写入日志。
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { getTransitTarget } from '@/shared/api/social-transit'
import InitLoadingMask from '@/shared/components/pay/InitLoadingMask.vue'

const props = defineProps<{ mode: 'bind' | 'login' }>()

const { t } = useI18n()
const route = useRoute()

const loading = ref(true)
const failed = ref(false)
const failMsg = ref('')

/**
 * 标记失败状态
 */
function markFailed(msg: string) {
  failed.value = true
  failMsg.value = msg
  loading.value = false
}

/**
 * 页面初始化: 查询目标端回调地址后原样透传跳转
 *
 * 提前到 setup 顶层执行(不等 onMounted), 让 InitLoadingMask 第一时间接管视觉
 */
function init() {
  const client = route.params.client as string | undefined
  const source = route.params.source as string | undefined
  if (!client || !source) {
    markFailed(t('auth.common.transitFail'))
    return
  }
  getTransitTarget({ client, source, mode: props.mode })
    .then((target) => {
      if (!target) {
        markFailed(t('auth.common.transitFail'))
        return
      }
      // query 原样透传(支付宝 auth_code / 微信 code 字段差异由目标端回调页自行解析)
      window.location.replace(target + window.location.search)
    })
    .catch((err: Error) => {
      markFailed(err?.message || t('auth.common.transitFail'))
    })
}

// 立即触发(不等 onMounted, 减少白屏时间)
init()
</script>

<template>
  <div class="transit-container">
    <!-- 跳转中: 统一全屏遮罩(与授权落地页视觉一致) -->
    <InitLoadingMask v-if="loading" tip-key="common.processing" />
    <!-- 失败兜底 -->
    <div v-else-if="failed" class="result-box">
      <div class="status-icon">
        <svg viewBox="0 0 1024 1024" width="64" height="64" aria-hidden="true">
          <circle cx="512" cy="512" r="448" fill="#ee0a24" />
          <path fill="#fff" d="M705.5 625.7l-41.8 41.8L512 515.8 360.3 667.5l-41.8-41.8L470.2 474 318.5 322.3l41.8-41.8L512 432.2l151.7-151.7 41.8 41.8L553.8 474l151.7 151.7z" />
        </svg>
      </div>
      <h3 class="result-title">
        {{ t('auth.common.failTitle') }}
      </h3>
      <p class="fail-msg">
        {{ failMsg }}
      </p>
      <div class="action-buttons">
        <p class="close-hint">
          {{ t('common.closeManually') }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.transit-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;
  background-color: var(--h5-bg-page);

  .result-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 340px;
    padding: 40px 24px;
    background: var(--h5-bg-card);
    border-radius: 16px;
    box-shadow: 0 4px 12px rgb(0 0 0 / 5%);

    .status-icon {
      margin-bottom: 16px;
      line-height: 0;
    }

    .result-title {
      margin: 0 0 24px;
      font-size: 20px;
      font-weight: 600;
      color: var(--h5-text-primary);
    }

    .fail-msg {
      margin: 0 0 24px;
      font-size: 14px;
      color: var(--h5-text-secondary);
      text-align: center;
      word-break: break-all;
    }

    .action-buttons {
      width: 100%;

      .close-hint {
        margin: 12px 0 0;
        font-size: 13px;
        color: var(--h5-text-secondary);
        text-align: center;
      }
    }
  }
}
</style>
