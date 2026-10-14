<script lang="ts" setup>
/**
 * 公众号扫码发起页(共享组件, mobile/PC 两端薄壳复用, 绑定/登录两场景)
 *
 * PC 端(个人中心绑定页/登录页)对公众号生成含票据的二维码, 手机微信扫码打开本页;
 * 凭票据向后端换取公众号网页授权地址后跳转微信, 授权回调落 BindScanResult 结果页。
 * 公众号网页授权仅微信客户端内可完成, 本页须在微信内打开才能通过微信侧校验。
 *
 * 两场景均先落确认页(微信授权页仅首次授权时弹出, 不构成按次确认):
 * - login: 确认页是跨设备扫码登录唯一的按次用户同意环节(防诱导扫码钓鱼)
 * - bind: 确认页展示脱敏的目标账号名, 供扫码者核对是否本人电脑端账号——
 *   这是「微信身份抢占」钓鱼(诱导扫码把微信绑到他人账号)的唯一拦截点
 * 失败兜底: 票据缺失/过期或授权地址获取失败时显示错误卡; 全程不记录票据日志。
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { cancelBindScan, cancelLoginScan, getBindScanAuthUrl, getBindScanConfirmInfo, getLoginScanAuthUrl } from '@/shared/api/social-bind-scan'
import InitLoadingMask from '@/shared/components/pay/InitLoadingMask.vue'

const props = withDefaults(defineProps<{
  /** 场景: bind=扫码绑定(PC 个人中心发起) / login=扫码登录(PC 登录页匿名发起) */
  mode?: 'bind' | 'login'
}>(), {
  mode: 'bind',
})

const { t } = useI18n()
const route = useRoute()

const loading = ref(true)
const failed = ref(false)
const failMsg = ref('')
// 确认页状态(等待用户确认/取消后终态)
const needConfirm = ref(false)
const cancelling = ref(false)
const cancelled = ref(false)
// bind 场景: 确认页展示的脱敏目标账号名
const maskedAccount = ref('')

// 确认页主提示: bind 带账号插值(核对目标账号), login 通用文案
const confirmTip = computed(() => {
  if (props.mode === 'login') {
    return t('auth.loginScan.confirmTip')
  }
  return maskedAccount.value
    ? t('auth.bindScan.confirmAccountTip', { account: maskedAccount.value })
    : t('auth.bindScan.confirmTip')
})

/**
 * 标记失败状态
 */
function markFailed(msg: string) {
  failed.value = true
  failMsg.value = msg
  loading.value = false
}

/**
 * 凭票据换取授权地址并跳转微信
 *
 * 由确认页「确认」按钮触发(两场景一致)
 */
function jumpToWechat(ticket: string) {
  const fetchAuthUrl = props.mode === 'login' ? getLoginScanAuthUrl : getBindScanAuthUrl
  fetchAuthUrl(ticket)
    .then((url) => {
      if (!url) {
        markFailed(t('auth.bindScan.jumpFail'))
        return
      }
      // 跳转公众号网页授权(仅微信客户端内可完成)
      window.location.href = url
    })
    .catch((err: Error) => {
      markFailed(err?.message || t('auth.bindScan.jumpFail'))
    })
}

/**
 * 页面初始化: 两场景均落确认页; bind 先拉取脱敏账号名
 *
 * 提前到 setup 顶层执行(不等 onMounted), 让 InitLoadingMask/确认页第一时间接管视觉
 */
function init() {
  const ticket = route.query.ticket as string | undefined
  if (!ticket) {
    markFailed(t('auth.bindScan.ticketMissing'))
    return
  }
  if (props.mode === 'login') {
    // 扫码登录: 直接落确认页(无账号可展示)
    loading.value = false
    needConfirm.value = true
    return
  }
  // 扫码绑定: 先换脱敏账号名再落确认页, 票据无效时按失败卡兜底
  getBindScanConfirmInfo(ticket)
    .then((info) => {
      maskedAccount.value = info?.maskedAccount || ''
      loading.value = false
      needConfirm.value = true
    })
    .catch((err: Error) => {
      markFailed(err?.message || t('auth.bindScan.jumpFail'))
    })
}

/**
 * 确认: 发起微信授权(跳转前由全屏遮罩接管视觉)
 */
function handleConfirm() {
  if (needConfirm.value === false) {
    return
  }
  needConfirm.value = false
  loading.value = true
  jumpToWechat(route.query.ticket as string)
}

/**
 * 取消: 标记票据 cancelled(PC 端停止轮询并提示刷新), 展示已取消终态
 *
 * 请求失败也按已取消展示(票据 5 分钟自然过期, PC 端按过期兜底)
 */
async function handleCancel() {
  if (cancelling.value) {
    return
  }
  cancelling.value = true
  const cancel = props.mode === 'login' ? cancelLoginScan : cancelBindScan
  try {
    await cancel(route.query.ticket as string)
  }
  catch {
    // 忽略: 票据自然过期兜底
  }
  needConfirm.value = false
  cancelled.value = true
  cancelling.value = false
}

// 立即触发(不等 onMounted, 减少白屏时间)
init()
</script>

<template>
  <div class="bind-scan-container">
    <!-- 跳转微信/拉取确认信息中: 统一全屏遮罩 -->
    <InitLoadingMask v-if="loading" tip-key="auth.bindScan.jumping" />
    <!-- 扫码确认页: 按次确认, 防诱导扫码钓鱼(bind 展示脱敏目标账号供核对) -->
    <div v-else-if="needConfirm" class="result-box">
      <div class="status-icon">
        <svg viewBox="0 0 1024 1024" width="64" height="64" aria-hidden="true">
          <circle cx="512" cy="512" r="448" fill="#1989fa" />
          <rect x="288" y="300" width="448" height="280" rx="24" fill="none" stroke="#fff" stroke-width="44" />
          <rect x="472" y="596" width="80" height="36" fill="#fff" />
          <rect x="392" y="652" width="240" height="36" rx="18" fill="#fff" />
        </svg>
      </div>
      <h3 class="result-title">
        {{ t(mode === 'login' ? 'auth.loginScan.confirmTitle' : 'auth.bindScan.confirmTitle') }}
      </h3>
      <p class="result-tip">
        {{ confirmTip }}
      </p>
      <p class="security-hint">
        {{ t(mode === 'login' ? 'auth.loginScan.confirmSecurityTip' : 'auth.bindScan.confirmSecurityTip') }}
      </p>
      <div class="action-buttons">
        <van-button type="primary" round block color="#07c160" @click="handleConfirm">
          {{ t(mode === 'login' ? 'auth.loginScan.confirmBtn' : 'auth.bindScan.confirmBtn') }}
        </van-button>
        <van-button round plain block :loading="cancelling" @click="handleCancel">
          {{ t(mode === 'login' ? 'auth.loginScan.cancelBtn' : 'auth.bindScan.cancelBtn') }}
        </van-button>
      </div>
    </div>
    <!-- 已取消(终态): 用户在确认页拒绝了本次绑定/登录 -->
    <div v-else-if="cancelled" class="result-box">
      <div class="status-icon">
        <svg viewBox="0 0 1024 1024" width="64" height="64" aria-hidden="true">
          <circle cx="512" cy="512" r="448" fill="#909399" />
          <path fill="#fff" d="M705.5 625.7l-41.8 41.8L512 515.8 360.3 667.5l-41.8-41.8L470.2 474 318.5 322.3l41.8-41.8L512 432.2l151.7-151.7 41.8 41.8L553.8 474l151.7 151.7z" />
        </svg>
      </div>
      <h3 class="result-title">
        {{ t(mode === 'login' ? 'auth.loginScan.cancelledTitle' : 'auth.bindScan.cancelledTitle') }}
      </h3>
      <p class="result-tip">
        {{ t(mode === 'login' ? 'auth.loginScan.cancelledTip' : 'auth.bindScan.cancelledTip') }}
      </p>
      <div class="action-buttons">
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
.bind-scan-container {
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

    // 确认页/取消卡主提示
    .result-tip {
      margin: 0 0 8px;
      font-size: 14px;
      color: var(--h5-text-secondary);
      text-align: center;
    }

    // 确认页安全提示(次级, 弱化展示)
    .security-hint {
      margin: 0 0 24px;
      font-size: 12px;
      color: var(--h5-text-secondary);
      opacity: 0.75;
      text-align: center;
    }

    .action-buttons {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;

      // 手动关闭提示
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
