<script lang="ts" setup>
/**
 * 公众号扫码结果页(共享组件, mobile/PC 两端薄壳复用, 绑定/登录两场景)
 *
 * 公众号网页授权回调落地页: 凭 code+state 调后端兑换(state 为一次性映射),
 * bind 场景换取票据定位待绑定用户完成绑定, login 场景按绑定关系完成电脑端登录;
 * 结果展示后引导用户回到电脑端(PC 端轮询到成功后自动刷新/进入系统)。
 * 授权码与 state 均单次有效, 失败需回 PC 重新发起。
 */
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { exchangeBindScan, exchangeLoginScan } from '@/shared/api/social-bind-scan'
import InitLoadingMask from '@/shared/components/pay/InitLoadingMask.vue'

const props = withDefaults(defineProps<{
  /** 场景: bind=扫码绑定 / login=扫码登录 */
  mode?: 'bind' | 'login'
}>(), {
  mode: 'bind',
})

const { t } = useI18n()
const route = useRoute()

const loading = ref(true)
const success = ref(false)
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
 * 关闭当前页面
 *
 * 扫码流程仅运行在微信内置浏览器(公众号授权限制): 优先走微信网页通用桥
 * WeixinJSBridge.closeWindow 关窗(扫码打开的页面 window.close 通常无效),
 * 关闭失败时停留在本页, 由按钮下方的手动关闭提示兜底
 */
function handleClosePage() {
  try {
    const wxBridge = (window as unknown as {
      WeixinJSBridge?: { call: (name: string) => void }
    }).WeixinJSBridge
    wxBridge?.call('closeWindow')
    window.close()
  }
  catch {
    // 忽略: 关闭失败停留在本页, 手动关闭提示兜底
  }
}

onMounted(async () => {
  const code = route.query.code as string | undefined
  const state = route.query.state as string | undefined
  if (!code || !state) {
    // 用户取消授权或回调参数缺失
    markFailed(t(props.mode === 'login' ? 'auth.loginScan.codeMissing' : 'auth.bindScan.codeMissing'))
    return
  }
  try {
    const data = props.mode === 'login'
      ? await exchangeLoginScan(code, state)
      : await exchangeBindScan(code, state)
    const done = props.mode === 'login' ? data?.result === 'login_ready' : data?.result === 'bind_success'
    if (done) {
      loading.value = false
      success.value = true
    }
    else if (props.mode === 'login' && data?.error === 'unbind') {
      // 未绑定(方案A): 不自动注册, 引导用账号密码登录后在个人中心绑定
      markFailed(t('auth.loginScan.notBoundTip'))
    }
    else {
      markFailed(t(props.mode === 'login' ? 'auth.loginScan.loginFail' : 'auth.bindScan.bindFail'))
    }
  }
  catch (err) {
    markFailed((err as Error)?.message || t(props.mode === 'login' ? 'auth.loginScan.loginFail' : 'auth.bindScan.bindFail'))
  }
})
</script>

<template>
  <div class="bind-scan-result-container">
    <!-- 兑换中: 统一全屏遮罩 -->
    <InitLoadingMask v-if="loading" tip-key="common.processing" />
    <!-- 绑定/登录成功: 引导回到电脑端 -->
    <div v-else-if="success" class="result-box">
      <div class="status-icon">
        <svg viewBox="0 0 1024 1024" width="64" height="64" aria-hidden="true">
          <circle cx="512" cy="512" r="448" fill="#07c160" />
          <path fill="#fff" d="M432 688l-176-176 56-56 120 120 264-264 56 56z" />
        </svg>
      </div>
      <h3 class="result-title">
        {{ t(props.mode === 'login' ? 'auth.loginScan.successTitle' : 'auth.bindScan.successTitle') }}
      </h3>
      <p class="result-tip">
        {{ t(props.mode === 'login' ? 'auth.loginScan.successTip' : 'auth.bindScan.successTip') }}
      </p>
      <div class="action-buttons">
        <van-button type="primary" round block color="#07c160" @click="handleClosePage">
          {{ t('auth.common.closePage') }}
        </van-button>
        <p class="close-hint">
          {{ t('common.closeManually') }}
        </p>
      </div>
    </div>
    <!-- 失败兜底 -->
    <div v-else-if="failed" class="result-box">
      <div class="status-icon">
        <svg viewBox="0 0 1024 1024" width="64" height="64" aria-hidden="true">
          <circle cx="512" cy="512" r="448" fill="#ee0a24" />
          <path fill="#fff" d="M705.5 625.7l-41.8 41.8L512 515.8 360.3 667.5l-41.8-41.8L470.2 474 318.5 322.3l41.8-41.8L512 432.2l151.7-151.7 41.8 41.8L553.8 474l151.7 151.7z" />
        </svg>
      </div>
      <h3 class="result-title">
        {{ t(props.mode === 'login' ? 'auth.common.failTitle' : 'auth.bindScan.failTitle') }}
      </h3>
      <p class="result-tip">
        {{ failMsg }}
      </p>
      <div class="action-buttons">
        <p class="close-hint">
          {{ t('auth.bindScan.retryHint') }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.bind-scan-result-container {
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

    .result-tip {
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
