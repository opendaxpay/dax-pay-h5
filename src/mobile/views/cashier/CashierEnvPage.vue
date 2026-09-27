<script lang="ts" setup>
/**
 * H5 收银台环境页：路径中的 clientEnv 即配置分桶
 * 负责订单展示、支付项选择、发起支付与 payBody 分发
 */
import type { CashierItemPublic, GatewayOrderInfo } from '@/shared/api/gateway'
import { showNotify } from 'vant'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import {
  cashierPay,
  generateGatewayAuthUrl,
  getGatewayOrder,
  listCashierItems,
} from '@/shared/api/gateway'
import { getPayResult } from '@/shared/api/pay-result'
import BeianFooter from '@/shared/components/BeianFooter.vue'
import InitLoadingMask from '@/shared/components/pay/InitLoadingMask.vue'
import PayMethodIcon from '@/shared/components/pay/PayMethodIcon.vue'
import QrCodeDisplay from '@/shared/components/pay/QrCodeDisplay.vue'
import StripeIntentPay from '@/shared/components/pay/StripeIntentPay.vue'
import { useGatewayOrderPoll } from '@/shared/hooks/use-gateway-order-poll'
import { closeWebview } from '@/shared/pay/close-webview'
import { prefetchDouyinJsapi } from '@/shared/pay/douyin'
import { useGatewayAuth } from '@/shared/pay/use-gateway-auth'
import { detectClientEnv, isValidH5ClientEnv } from '@/shared/utils/client-env'
import { formatDateTime } from '@/shared/utils/datetime'
import { cacheOrder, clearCachedOrder, getCachedOrder } from '@/shared/utils/order-cache'
import { fenToYuan } from '@/shared/utils/pay-amount'
import { invokeJsapiByEnv } from '@/shared/utils/pay-jsapi'
import {
  clientEnvNeedsOpenId,
  clientEnvToAuthType,
  getPayOpenId,
} from '@/shared/utils/pay-openid'
import {
  isRedirectableQrInWallet,
  redirectToPayUrl,
  resolvePayResult,
  submitPayForm,
} from '@/shared/utils/pay-result'

defineOptions({ name: 'CashierEnvPage' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const orderNo = route.params.orderNo as string
const clientEnvParam = route.params.clientEnv as string

const loading = ref(true)
// 业务内容是否可渲染（与 loading 分离）：ready=false 期间由 InitLoadingMask 接管视觉
const ready = ref(false)
const paying = ref(false)
const loadError = ref('')
const order = ref<GatewayOrderInfo>({})
const payMethods = ref<CashierItemPublic[]>([])
const selectId = ref<string>('')
const showQrcode = ref(false)
const qrContent = ref('')
// Stripe PaymentIntent: 卡支付面板可见性与 payload(原始 payBody)
const showStripeIntent = ref(false)
const stripePayload = ref('')

// 订单已锁定的支付项ID（订单支付中后端会标记唯一匹配项）; 非空时禁用切换其他项
const lockedItemId = computed(() => payMethods.value.find(i => i.locked)?.id || '')

const remainSeconds = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null

const amountYuan = computed(() => fenToYuan(order.value.amount))
const paid = computed(() => order.value.status === 'paid')
const expired = computed(() => remainSeconds.value <= 0 && !!order.value.expiredTime && !paid.value)

// 终态判定: 订单不可继续支付（用于跳过支付项请求并展示结果卡片）
const closed = computed(() => order.value.status === 'closed')
const failed = computed(() => order.value.status === 'failed')
const isTerminal = computed(() =>
  paid.value || closed.value || failed.value || order.value.status === 'expired' || expired.value,
)

// 结果态类型（成功/关单/失败/过期/加载失败），非空时渲染结果卡片
type ResultState = 'paid' | 'closed' | 'failed' | 'expired' | 'loadError'
const resultState = computed<ResultState | ''>(() => {
  // 订单加载失败优先（订单不存在/网络异常）
  if (loadError.value) {
    return 'loadError'
  }
  // 支付成功(优先于其他终态,展示完整成功卡片)
  if (paid.value) {
    return 'paid'
  }
  if (closed.value) {
    return 'closed'
  }
  if (failed.value) {
    return 'failed'
  }
  if (order.value.status === 'expired' || expired.value) {
    return 'expired'
  }
  return ''
})

// 结果态展示元数据（图标/标题/副文案/主题色）
const resultMeta = computed(() => {
  switch (resultState.value) {
    case 'paid':
      // 支付成功: 微信绿(与码牌/聚合一致)
      return { icon: 'success', titleKey: 'cashier.paid', tipKey: 'cashier.paidTip', color: '#07c160' }
    case 'closed':
      return { icon: 'lock', titleKey: 'cashier.closed', tipKey: 'cashier.closedTip', color: '#fa8c16' }
    case 'failed':
      return { icon: 'cross', titleKey: 'cashier.failed', tipKey: 'cashier.failedTip', color: '#ff4d4f' }
    case 'expired':
      return { icon: 'clock-o', titleKey: 'cashier.expired', tipKey: 'cashier.expiredTip', color: '#8c8c8c' }
    default:
      return { icon: 'warning-o', titleKey: 'cashier.loadFail', tipKey: 'cashier.loadFailTip', color: '#fa8c16' }
  }
})

const countdown = computed(() => {
  const s = remainSeconds.value
  const h = String(Math.floor(s / 3600)).padStart(2, '0')
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const sec = String(s % 60).padStart(2, '0')
  return { h, m, s: sec }
})

const { startPoll, stopPoll } = useGatewayOrderPoll({
  onUpdate(latest) {
    order.value = latest
  },
  onPaid(latest) {
    // 轮询检测到已支付: 仅更新订单,成功卡片由 resultState 渲染、倒计时跳转由 watch 触发
    order.value = latest
  },
})

/**
 * 支付项展示名
 */
function methodName(item: CashierItemPublic) {
  if (item.name) {
    return item.name
  }
  const icon = item.icon || 'wechat'
  const key = `cashier.method.${icon}`
  const label = t(key)
  return label === key ? icon : label
}

/**
 * 选择支付项（订单已锁定支付方式时, 禁止切换到非锁定项）
 */
function selectPayMethod(itemId: string) {
  if (lockedItemId.value && itemId !== lockedItemId.value) {
    return
  }
  selectId.value = itemId
}

/**
 * 支付成功后跳转商户 returnUrl - 倒计时方案
 *
 * 进入 paid 终态后,若有 returnUrl,展示 3 秒倒计时,归零自动 location.href;
 * 用户也可点「返回商户」按钮立即跳转。替代原 1.2s setTimeout 闪跳,
 * 让用户能看清成功卡片再跳。
 */
const REDIRECT_COUNTDOWN_SECONDS = 3
const redirectCountdown = ref(0)
let redirectTimer: ReturnType<typeof setInterval> | null = null

// 是否为「重入已支付订单」: 初始加载即为 paid(非本会话支付成功), 不自动倒计时跳转, 仅展示结果卡 + 手动按钮
const isReentry = ref(false)
// 跳转中标志(防重复触发, 查单期间保持 true)
const redirecting = ref(false)

function clearRedirectTimer() {
  if (redirectTimer) {
    clearInterval(redirectTimer)
    redirectTimer = null
  }
}

/**
 * 启动可视化倒计时,由 watch(resultState) 在进入 paid 终态时触发
 *
 * 倒计时归零时才查单(getPayResult), 给后端 3s 缓冲让通道回调把状态推进到 paid,
   * 从而拿到带签名的 redirectUrl; 查询失败或状态未就绪时不跳转(让问题暴露, 不兜底裸跳)。
 *
 * @param autoCountdown true=首次支付成功, 启动倒计时归零自动跳转;
 *                      false=重入已支付订单, 不启动倒计时(仅手动按钮 redirectNow 跳转)
 */
function startRedirectCountdown(autoCountdown = true) {
  if (!order.value.returnUrl || (autoCountdown && redirectTimer)) {
    return
  }
  // 重入态: 不启动倒计时, 仅手动按钮(redirectNow 内部查单)可跳
  if (!autoCountdown) {
    return
  }
  // 首次支付成功: 启动倒计时, 归零时才查单(3s 缓冲让通道回调推进状态)
  redirectCountdown.value = REDIRECT_COUNTDOWN_SECONDS
  redirectTimer = setInterval(() => {
    redirectCountdown.value--
    if (redirectCountdown.value <= 0) {
      clearRedirectTimer()
      doRedirect()
    }
  }, 1000)
}

/** 查单 + 跳转(倒计时归零或手动按钮触发), redirectUrl 为空则不跳(让问题暴露, 不兜底裸跳) */
async function doRedirect() {
  if (redirecting.value) {
    return
  }
  redirecting.value = true
  try {
    const url = await resolveRedirectUrl()
    if (url) {
      window.location.href = url
    }
  }
  finally {
    redirecting.value = false
  }
}

/** 查询带签名的跳转地址, 状态未就绪或查询失败时返回 null(不兜底裸跳, 让问题暴露) */
async function resolveRedirectUrl(): Promise<string | null> {
  if (!order.value.tradeNo) {
    return null
  }
  try {
    const info = await getPayResult(order.value.tradeNo)
    // 不兜底裸跳: redirectUrl 为空说明状态未就绪/条件不满足, 返回 null 让调用方感知
    return info?.redirectUrl || null
  }
  catch {
    return null
  }
}

/**
 * 用户点击「返回商户」立即跳转(不等倒计时)
 *
 * 内部调 doRedirect 查单 + 跳转(redirectUrl 为空则不跳, 让问题暴露)。
 */
async function redirectNow() {
  clearRedirectTimer()
  await doRedirect()
}

// 进入 paid 终态时启动倒计时跳转(由 status 变化驱动,所有触发 paid 的路径统一在此处理)
// 重入已支付订单(isReentry=true)仅预取签名URL, 不自动倒计时跳转
watch(resultState, (state) => {
  if (state === 'paid') {
    startRedirectCountdown(!isReentry.value)
  }
})

/**
 * 启动过期倒计时
 */
function startCountdown(expiredTime?: string) {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  if (!expiredTime) {
    remainSeconds.value = 0
    return
  }
  const exp = new Date(expiredTime).getTime()
  remainSeconds.value = Math.max(0, Math.floor((exp - Date.now()) / 1000))
  countdownTimer = setInterval(() => {
    if (remainSeconds.value > 0) {
      remainSeconds.value--
    }
    else if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }, 1000)
}

/**
 * UA 与路径 clientEnv 不一致时踢回入口重分流
 */
function guardClientEnv(): boolean {
  if (!isValidH5ClientEnv(clientEnvParam)) {
    router.replace({ name: 'CashierEntry', params: { orderNo } })
    return false
  }
  const actual = detectClientEnv()
  if (actual !== clientEnvParam) {
    router.replace({ name: 'CashierEntry', params: { orderNo } })
    return false
  }
  return true
}

/**
 * 加载订单 + 支付项；支持授权回跳 autoPay
 *
 * ready 控制：autoPay 触发时保持 ready=false 让遮罩持续到 pay() 结束，
 * 避免订单卡闪现后立刻进入支付态
 */
async function loadPage() {
  if (!guardClientEnv()) {
    return
  }
  loading.value = true
  ready.value = false
  loadError.value = ''
  // OAuth 回跳后先从 sessionStorage 缓存恢复订单，减少白屏时间
  const cached = getCachedOrder<GatewayOrderInfo>(orderNo)
  if (cached) {
    order.value = cached
  }
  try {
    order.value = await getGatewayOrder(orderNo)
    // 初始加载即为 paid = 重入已支付订单(非本会话支付成功), 标记后 watch(resultState) 仅预取签名URL不自动跳转
    if (order.value.status === 'paid') {
      isReentry.value = true
    }
    // 写入缓存，OAuth 跳转回跳时可快速恢复
    cacheOrder(orderNo, order.value)
    startCountdown(order.value.expiredTime)
    // 仅可支付订单（非终态）请求支付项，避免对已关闭/失败/过期订单触发后端拦截异常
    if (!isTerminal.value) {
      // clientEnv 来自路径，与运营端 H5 分桶对齐
      payMethods.value = await listCashierItems({
        orderNo,
        cashierType: 'h5',
        clientEnv: clientEnvParam,
      })
      // 订单已锁定支付方式: 强制选中锁定项, 不接受授权回跳的 itemId 覆盖
      if (lockedItemId.value) {
        selectId.value = lockedItemId.value
      }
      else {
        // 授权回跳可带 itemId；否则推荐项/首项
        const qItemId = route.query.itemId as string | undefined
        if (qItemId && payMethods.value.some(i => i.id === qItemId)) {
          selectId.value = qItemId
        }
        else {
          const recommend = payMethods.value.find(i => i.recommend)
          selectId.value = (recommend || payMethods.value[0])?.id || ''
        }
      }
    }
  }
  catch (e: any) {
    loadError.value = e?.message || t('cashier.loadFail')
  }
  finally {
    loading.value = false
  }
  // 授权成功回跳后自动继续支付：保持 ready=false 让遮罩持续到支付发起
  if (!isTerminal.value && !loadError.value && route.query.autoPay === '1' && selectId.value) {
    // 抖音: OAuth 回跳后 URL(含 autoPay query) 已稳定, 预取后再自动支付
    if (clientEnvParam === 'douyin') {
      prefetchDouyinJsapi({ orderNo })
    }
    await pay()
  }
  else if (!isTerminal.value && !loadError.value && clientEnvParam === 'douyin') {
    // 可交互页: 预取 SDK + jsapi-config(点支付复用; 若随后 OAuth 回跳会按新 URL 再预取)
    prefetchDouyinJsapi({ orderNo })
  }
  // 支付未触发或已结束（未跳走）：渲染业务内容
  ready.value = true
}

/**
 * 当前选中支付项是否需要 openId
 *
 * 优先读后端返回的 item.needOpenId（基于 method + clientEnv + openId 黑名单综合判定）;
 * 旧后端无此字段时降级到 clientEnv 硬编码（wechat/alipay/douyin → true）。
 */
function selectedItemNeedsOpenId(): boolean {
  const selected = payMethods.value.find(i => i.id === selectId.value)
  if (selected?.needOpenId !== undefined) {
    return !!selected.needOpenId
  }
  return clientEnvNeedsOpenId(clientEnvParam)
}

// OAuth 跳转编排(由 [useGatewayAuth] 统一处理, 收银台无需 authorizing ref)
const gatewayAuth = useGatewayAuth({
  generateAuthUrl: async () => {
    const authType = clientEnvToAuthType(clientEnvParam)
    if (!authType) {
      return null
    }
    // returnPath 含 itemId + autoPay, 授权完成后自动继续支付
    const returnPath
      = `/cashier/${encodeURIComponent(orderNo)}/${clientEnvParam}`
        + `?itemId=${encodeURIComponent(selectId.value)}&autoPay=1`
    return generateGatewayAuthUrl({
      orderNo,
      authType,
      returnPath,
      clientEnv: clientEnvParam,
      itemId: selectId.value,
      cashierType: 'h5',
    })
  },
  // 抛错由 pay() 的 try/catch 接管, 与原实现行为一致
  onError: (msg) => {
    throw new Error(msg)
  },
  failKey: 'cashier.authUrlFail',
})

/**
 * 需要 openId 时跳转 OAuth；returnPath 带回环境页并 autoPay
 *
 * 外部签名保留 Promise<string | null>: null 表示已跳转 OAuth 或不支持(由 pay() 中止后续)
 */
async function ensureOpenIdOrRedirect(): Promise<string | null> {
  if (!selectedItemNeedsOpenId()) {
    return getPayOpenId(orderNo, clientEnvParam) || null
  }
  const existing = getPayOpenId(orderNo, clientEnvParam)
  if (existing) {
    return existing
  }
  const authType = clientEnvToAuthType(clientEnvParam)
  if (!authType) {
    // 不支持的通道(如 union_pay/browser), 不跳转也不抛错
    return null
  }
  await gatewayAuth.ensureOpenId(true, undefined)
  // 跳转已触发或失败(失败时 onError 已抛错, 不会走到这里)
  return null
}

/**
 * 处理 JSAPI 调起结果
 */
async function handleJsapi(payload: string) {
  const status = await invokeJsapiByEnv(clientEnvParam, payload, { orderNo })
  if (status === 'ok') {
    // JSAPI 调起支付成功: 仅更新状态,成功卡片由 resultState 渲染、倒计时跳转由 watch 触发
    order.value.status = 'paid'
    return
  }
  if (status === 'cancel') {
    showNotify({ type: 'warning', message: t('cashier.payCancel') })
    return
  }
  if (status === 'unsupported') {
    showNotify({ type: 'warning', message: t('cashier.jsapiPending') })
    startPoll(orderNo)
    return
  }
  showNotify({ type: 'danger', message: t('cashier.payFail') })
  startPoll(orderNo)
}

/**
 * Stripe 卡支付成功：Stripe 已确认扣款, 成功卡片由 resultState 渲染、倒计时跳转由 watch 触发
 */
function handleStripeSuccess() {
  showStripeIntent.value = false
  order.value.status = 'paid'
}

/**
 * Stripe 卡支付已受理未终态(3DS 处理中/processing): 关闭面板, 轮询订单兜底
 */
function handleStripePending() {
  showStripeIntent.value = false
  startPoll(orderNo)
}

/**
 * Stripe 卡支付面板关闭(用户取消): 提示并保留在页面(支付方式已锁定, 可重新发起)
 */
function handleStripeCancel() {
  showStripeIntent.value = false
  showNotify({ type: 'warning', message: t('cashier.payCancel') })
}

/**
 * 支付发起成功后同步锁定态
 *
 * 后端已将订单置为 paying 并写入 method, 需刷新 locked 以禁用切换其他项;
 * 刷新失败时兜底把当前选中项标为 locked, 避免同页仍可点选
 */
async function syncLockedPayMethods() {
  const currentId = selectId.value
  try {
    payMethods.value = await listCashierItems({
      orderNo,
      cashierType: 'h5',
      clientEnv: clientEnvParam,
    })
    if (lockedItemId.value) {
      selectId.value = lockedItemId.value
    }
  }
  catch {
    // 刷新失败: 本地兜底锁定当前选中项
    if (currentId) {
      payMethods.value = payMethods.value.map(item => ({
        ...item,
        locked: item.id === currentId,
      }))
      selectId.value = currentId
    }
  }
}

/**
 * 发起收银台支付
 */
async function pay() {
  if (paying.value || paid.value || !selectId.value || expired.value) {
    return
  }
  // 本地已锁定时禁止用非锁定项发起支付
  if (lockedItemId.value && selectId.value !== lockedItemId.value) {
    return
  }
  paying.value = true
  showQrcode.value = false
  qrContent.value = ''
  try {
    // 选中项需要 openId 时(微信/支付宝/抖音环境或后端标记 needOpenId)跳转授权
    let openId: string | undefined
    if (selectedItemNeedsOpenId()) {
      const id = await ensureOpenIdOrRedirect()
      if (id == null) {
        // 已跳转 OAuth 或无需继续
        return
      }
      openId = id
    }
    const result = await cashierPay({
      orderNo,
      itemId: selectId.value,
      cashierType: 'h5',
      clientEnv: clientEnvParam,
      device: 'mobile',
      openId,
    })
    const action = resolvePayResult(result)
    // 同步资金交易号: 支付发起时后端已创建 PayTrade, 响应含 tradeNo; 前端 order 来自预下单(bootstrap), 彼时无 tradeNo
    if (result?.tradeNo) {
      order.value.tradeNo = result.tradeNo
    }
    // 未直接成功时同步锁定态(JSAPI 取消/二维码等仍停留本页的场景)
    if (action.type !== 'success') {
      await syncLockedPayMethods()
    }
    switch (action.type) {
      case 'success':
        order.value.status = 'paid'
        // 支付成功后订单状态已变,清除缓存避免回显未付态
        clearCachedOrder(orderNo)
        // 成功卡片由 resultState 渲染、倒计时跳转由 watch 触发
        break
      case 'redirect':
        redirectToPayUrl(action.url)
        break
      case 'qrcode':
        // 微信/支付宝客户端内: 通道返回的聚合码链接可按 UA 分流拉起钱包支付, 直接跳转而非显示二维码
        if (isRedirectableQrInWallet(clientEnvParam, action.content)) {
          redirectToPayUrl(action.content)
          startPoll(orderNo)
          break
        }
        qrContent.value = action.content
        showQrcode.value = true
        startPoll(orderNo)
        break
      case 'form':
        submitPayForm(action.html)
        startPoll(orderNo)
        break
      case 'jsapi':
        await handleJsapi(action.payload)
        break
      case 'stripe_intent':
        // Stripe PaymentIntent: 弹层内动态加载 Stripe.js + Elements 卡输入
        stripePayload.value = action.payload
        showStripeIntent.value = true
        break
      case 'unsupported':
        showNotify({ type: 'warning', message: t('cashier.payLaunched') })
        startPoll(orderNo)
        break
      case 'poll':
      default:
        startPoll(orderNo)
        break
    }
  }
  catch (e: any) {
    showNotify({ type: 'danger', message: e?.message || t('cashier.payFail') })
  }
  finally {
    paying.value = false
  }
}

onMounted(() => {
  loadPage()
})

onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }
  clearRedirectTimer()
  stopPoll()
})
</script>

<template>
  <div class="cashier">
    <!-- 初始化/支付中：统一全屏遮罩，避免业务内容闪现（含 OAuth 回跳 autoPay 自动支付） -->
    <InitLoadingMask
      v-if="!ready || paying"
      :tip-key="paying ? 'cashier.paying' : ''"
    />

    <!-- 结果态: 支付成功/订单已关闭/支付失败/已过期/加载失败 -->
    <div v-else-if="resultState" class="cashier__result">
      <!-- 成功态: 实心彩色圆底 + 白色对勾(对齐 AggregateResultCard);其他态: 半透明底 + 彩色 SVG -->
      <div
        class="cashier__result-icon"
        :style="{
          color: resultMeta.color,
          background: resultState === 'paid' ? resultMeta.color : `${resultMeta.color}1a`,
        }"
      >
        <svg
          viewBox="0 0 48 48"
          width="40"
          height="40"
          fill="none"
          :stroke="resultState === 'paid' ? '#fff' : resultMeta.color"
          :stroke-width="resultState === 'paid' ? 4 : 3.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <!-- 成功: 对勾 -->
          <template v-if="resultState === 'paid'">
            <path d="M14 24 L21 31 L34 16" />
          </template>
          <!-- 订单已关闭: 锁 -->
          <template v-else-if="resultState === 'closed'">
            <rect x="10" y="22" width="28" height="18" rx="3" />
            <path d="M15 22 V15 a9 9 0 0 1 18 0 V22" />
          </template>
          <!-- 支付失败: 叉号 -->
          <template v-else-if="resultState === 'failed'">
            <path d="M14 14 L34 34 M34 14 L14 34" stroke-width="4" />
          </template>
          <!-- 已过期: 时钟 -->
          <template v-else-if="resultState === 'expired'">
            <circle cx="24" cy="24" r="17" />
            <path d="M24 13 V24 L32 28" />
          </template>
          <!-- 加载失败: 警告三角 -->
          <template v-else>
            <path d="M24 6 L43 39 H5 Z" />
            <path d="M24 19 V29" />
            <circle cx="24" cy="35" r="1.5" :fill="resultMeta.color" stroke="none" />
          </template>
        </svg>
      </div>
      <div class="cashier__result-title">
        {{ t(resultMeta.titleKey) }}
      </div>
      <div class="cashier__result-subtitle">
        {{ resultState === 'loadError' ? (loadError || t(resultMeta.tipKey)) : t(resultMeta.tipKey) }}
      </div>
      <!-- 订单信息卡片 -->
      <div v-if="order.orderNo" class="cashier__result-order">
        <div class="cashier__result-order-row">
          <span>{{ t('cashier.orderTitle') }}</span>
          <span :title="order.title || t('cashier.demoOrderTitle')">{{ order.title || t('cashier.demoOrderTitle') }}</span>
        </div>
        <div class="cashier__result-order-row">
          <span>{{ t('cashier.orderNo') }}</span>
          <span :title="order.orderNo">{{ order.orderNo }}</span>
        </div>
        <div v-if="order.amount" class="cashier__result-order-row">
          <span>{{ t('cashier.payableAmount') }}</span>
          <span class="cashier__result-amount">￥{{ amountYuan }}</span>
        </div>
        <!-- 成功态额外展示支付时间 -->
        <div v-if="resultState === 'paid' && order.payTime" class="cashier__result-order-row">
          <span>{{ t('cashier.payTime') }}</span>
          <span :title="order.payTime">{{ formatDateTime(order.payTime) }}</span>
        </div>
      </div>
      <!-- 成功态且有 returnUrl: 倒计时提示 + 返回商户按钮(重入态仅显示按钮, 不自动跳) -->
      <template v-if="resultState === 'paid' && order.returnUrl">
        <p v-if="!isReentry && redirectCountdown > 0" class="cashier__result-countdown">
          {{ t('cashier.autoRedirectTip', { n: redirectCountdown }) }}
        </p>
        <button class="cashier__result-btn" @click="redirectNow">
          {{ t('cashier.backToMerchant') }}
        </button>
      </template>
      <!-- 抖音：无可靠关 WebView API，改为手动关闭提示 -->
      <p v-else-if="clientEnvParam === 'douyin'" class="cashier__result-close-hint">
        {{ t('common.closeManually') }}
      </p>
      <!-- 其他情况: 关闭页面按钮 -->
      <button v-else class="cashier__result-btn" @click="closeWebview">
        {{ t('cashier.closePage') }}
      </button>
      <!-- 平台备案信息(版权 + ICP + 公网安, 配置为空不渲染) -->
      <BeianFooter class="cashier__beian" />
    </div>

    <template v-else>
      <!-- 顶部订单信息 -->
      <div class="cashier__header enter-y">
        <div class="cashier__price">
          <span class="cashier__currency">￥</span>
          <span class="cashier__amount">{{ amountYuan }}</span>
        </div>
        <div v-if="remainSeconds > 0 && !paid" class="cashier__countdown">
          <span class="cashier__countdown-label">{{ t('cashier.remainTime') }}</span>
          <span class="cashier__countdown-time">
            {{ countdown.h }}:{{ countdown.m }}:{{ countdown.s }}
          </span>
        </div>
        <div v-else-if="expired" class="cashier__countdown cashier__countdown--expired">
          <span class="cashier__countdown-label">{{ t('cashier.expired') }}</span>
        </div>
        <div class="cashier__detail">
          <div class="cashier__detail-row">
            <span>{{ t('cashier.orderTitle') }}</span>
            <!-- title 便于长文案悬停/长按看全量 -->
            <span :title="order.title || t('cashier.demoOrderTitle')">{{ order.title || t('cashier.demoOrderTitle') }}</span>
          </div>
          <div class="cashier__detail-row">
            <span>{{ t('cashier.orderNo') }}</span>
            <span :title="order.orderNo">{{ order.orderNo }}</span>
          </div>
        </div>
      </div>

      <!-- 二维码支付 -->
      <div v-if="showQrcode" class="cashier__body enter-y">
        <div class="cashier__section-title">
          {{ t('cashier.qrcodePay') }}
        </div>
        <div class="cashier__qrcode">
          <QrCodeDisplay :content="qrContent" :size="200" />
          <p class="cashier__qrcode-tip">
            {{ t('cashier.qrcodeTip', { name: methodName(payMethods.find(i => i.id === selectId) || { id: '' }) }) }}
          </p>
        </div>
        <!-- 平台备案信息 -->
        <BeianFooter class="cashier__beian" />
      </div>

      <!-- 支付方式选择 -->
      <div v-else class="cashier__body enter-y">
        <div class="cashier__section-title">
          {{ t('cashier.selectMethod') }}
        </div>
        <div v-if="!payMethods.length" class="cashier__empty">
          {{ t('cashier.emptyItems') }}
        </div>
        <div v-else class="cashier__list">
          <div
            v-for="item in payMethods"
            :key="item.id"
            class="cashier__item"
            :class="{
              'cashier__item--active': item.id === selectId,
              'cashier__item--disabled': lockedItemId && item.id !== lockedItemId,
            }"
            @click="selectPayMethod(item.id)"
          >
            <div class="cashier__item-info">
              <!-- 品牌 SVG 图标，略大于默认以提升可识别度 -->
              <PayMethodIcon :icon="item.icon" :size="28" />
              <div class="cashier__pay-name">
                {{ methodName(item) }}
                <span v-if="item.recommend" class="cashier__recommend">{{ t('cashier.recommend') }}</span>
              </div>
            </div>
            <div class="cashier__radio" :class="{ 'cashier__radio--checked': item.id === selectId }" />
          </div>
        </div>
        <!-- 平台备案信息 -->
        <BeianFooter class="cashier__beian" />
      </div>

      <!-- 底部支付按钮(paid 已由 resultState 卡片接管,此处不会进入 paid 态) -->
      <div v-if="!showQrcode" class="cashier__footer enter-y">
        <button
          class="cashier__pay-btn"
          :disabled="paying || !selectId || expired"
          @click="pay"
        >
          {{ paying ? t('cashier.paying') : `${t('cashier.payNow')} ￥${amountYuan}` }}
        </button>
      </div>
    </template>

    <!-- Stripe PaymentIntent 卡支付面板(弹层, 动态加载 Stripe.js + Elements) -->
    <StripeIntentPay
      :visible="showStripeIntent"
      :payload="stripePayload"
      :title="order.title"
      :amount-yuan="amountYuan"
      @success="handleStripeSuccess"
      @pending="handleStripePending"
      @cancel="handleStripeCancel"
    />
  </div>
</template>

<style scoped lang="less">
@primary: var(--h5-brand-cashier);
@primary-dark: var(--h5-brand-cashier-deep);
@danger: #ff4d4f;

.cashier {
  // 三区布局: header 固定 / 中间滚动 / footer 贴底，矮屏不压按钮
  // 父级 RouterView flex-1 已分配全高，用 100% 严格锁定（避免 100vh/dvh 嵌套溢出）
  height: 100%;
  background: var(--h5-bg-page);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

  &__error {
    color: @danger;
    font-size: 14px;
    padding: 24px;
    text-align: center;
  }

  &__empty {
    color: var(--h5-text-secondary);
    font-size: 14px;
    text-align: center;
    padding: 24px 0;
  }

  &__result {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 24px calc(24px + env(safe-area-inset-bottom, 0px));
    text-align: center;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    animation: cashier-result-up 0.5s ease-out;
  }

  &__result-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    margin-bottom: 24px;
    animation: cashier-result-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  &__result-title {
    font-size: 22px;
    font-weight: 600;
    color: var(--h5-text-primary);
    margin-bottom: 8px;
  }

  &__result-subtitle {
    font-size: 14px;
    color: var(--h5-text-secondary);
    line-height: 1.6;
    max-width: 280px;
  }

  &__result-order {
    width: 100%;
    max-width: 320px;
    margin-top: 24px;
    padding: 16px 20px;
    background: var(--h5-bg-card);
    border-radius: 12px;
    box-shadow: var(--h5-shadow-card);
  }

  &__result-order-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    font-size: 13px;
    margin-bottom: 10px;

    &:last-child {
      margin-bottom: 0;
    }

    span:first-child {
      flex-shrink: 0;
      color: var(--h5-text-secondary);
    }

    span:last-child {
      flex: 1;
      min-width: 0;
      color: var(--h5-text-primary);
      text-align: right;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  // 金额红：与 PC 一致，比品牌蓝更醒目
  &__result-amount {
    color: @danger;
    font-weight: 600;
  }

  // 自动跳转倒计时提示(仅成功态 + 有 returnUrl)
  &__result-countdown {
    margin: 16px 0 0;
    font-size: 12px;
    color: var(--h5-text-secondary);
    line-height: 1.6;
    font-variant-numeric: tabular-nums;
  }

  // 无法关 WebView 时的手动关闭提示（如抖音）
  &__result-close-hint {
    margin: 24px 0 0;
    font-size: 13px;
    color: var(--h5-text-secondary);
    line-height: 1.6;
  }

  &__result-btn {
    // 流式底栏，不再 fixed，避免被内容遮挡
    margin-top: 32px;
    width: 100%;
    max-width: 320px;
    height: 48px;
    background: linear-gradient(135deg, @primary 0%, @primary-dark 100%);
    color: #fff;
    border: none;
    border-radius: 100px;
    font-size: 16px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(93, 157, 254, 0.3);
    flex-shrink: 0;

    &:active {
      opacity: 0.9;
      transform: scale(0.98);
    }
  }

  &__header {
    flex-shrink: 0;
    background: linear-gradient(180deg, var(--h5-bg-brand-soft) 0%, var(--h5-bg-card) 100%);
    padding: 24px 20px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: var(--h5-shadow-card);
  }

  // 应付金额用红色，主按钮保持品牌蓝，信息层级更清晰
  &__price {
    display: flex;
    align-items: baseline;
    color: @danger;
    margin-bottom: 8px;
  }

  &__currency {
    font-size: 20px;
    font-weight: 600;
  }

  &__amount {
    font-size: 44px;
    font-weight: 800;
    letter-spacing: -1px;
    text-shadow: 0 2px 8px rgba(255, 77, 79, 0.15);
  }

  // 倒计时用橙：与金额红区分（红=应付 / 橙=时限 / 蓝=操作）
  &__countdown {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
    background: var(--h5-bg-warning);
    padding: 6px 16px;
    border-radius: 100px;

    &--expired {
      background: var(--h5-bg-muted);
    }
  }

  &__countdown-label {
    font-size: 12px;
    color: var(--h5-text-warning);
  }

  &__countdown-time {
    color: var(--h5-text-warning);
    font-weight: 700;
    font-size: 14px;
  }

  &__detail {
    width: 100%;
    border-top: 1px solid var(--h5-border);
    padding-top: 12px;
  }

  &__detail-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 13px;
    margin-bottom: 6px;

    // 左侧标签不收缩
    span:first-child {
      flex-shrink: 0;
      color: var(--h5-text-secondary);
    }

    // 右侧值单行省略，避免长订单号折行撑高头部
    span:last-child {
      flex: 1;
      min-width: 0;
      color: var(--h5-text-primary);
      text-align: right;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  // 中间唯一滚动区：支付项再多也不压底栏
  &__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 20px 20px 16px;
  }

  &__section-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--h5-text-primary);
    margin-bottom: 16px;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__item {
    background: var(--h5-bg-card);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 2px solid transparent;
    transition: all 0.2s ease;

    &--active {
      border-color: @primary;
      background: var(--h5-bg-brand-soft);
    }

    // 订单已锁定支付方式: 非锁定项灰化不可选
    &--disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  }

  &__item-info {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  &__pay-name {
    font-size: 16px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--h5-text-primary);
  }

  &__recommend {
    font-size: 12px;
    color: var(--h5-text-warning);
    background: var(--h5-bg-warning);
    border: 1px solid #ffd591;
    padding: 0 4px;
    border-radius: 4px;
  }

  &__radio {
    width: 20px;
    height: 20px;
    border: 2px solid var(--h5-text-placeholder);
    border-radius: 50%;
    transition: all 0.2s;
    flex-shrink: 0;

    &--checked {
      border-color: @primary;
      background: @primary;
      box-shadow: inset 0 0 0 3px var(--h5-bg-card);
    }
  }

  &__qrcode {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: var(--h5-bg-card);
    border-radius: 12px;
  }

  &__qrcode-tip {
    margin: 0;
    font-size: 13px;
    color: var(--h5-text-secondary);
    text-align: center;
  }

  // 平台备案栏(结果态/滚动区末尾), 视觉弱化不抢交易主流程
  &__beian {
    margin-top: 16px;
    opacity: 0.75;
    flex-shrink: 0;
  }

  // 文档流底栏，不再 fixed，天然不被列表遮挡
  &__footer {
    flex-shrink: 0;
    z-index: 10;
    padding: 12px 20px calc(16px + env(safe-area-inset-bottom, 0px));
    background: var(--h5-bg-card);
    box-shadow: 0 -2px 10px rgb(0 0 0 / 5%);
  }

  &__pay-btn {
    width: 100%;
    height: 48px;
    background: @primary;
    color: #fff;
    border: none;
    border-radius: 100px;
    font-size: 18px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(93, 157, 254, 0.3);

    &:active {
      background: @primary-dark;
      opacity: 0.95;
    }

    &:disabled {
      opacity: 0.6;
    }
  }
}

@keyframes cashier-result-up {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes cashier-result-pop {
  from {
    opacity: 0;
    transform: scale(0.5);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
