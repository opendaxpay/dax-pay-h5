import type { AggregatePayMeta, AggregatePayResult, GatewayOrderInfo } from '@/shared/api/gateway'
/**
 * 聚合扫码环境页共用编排
 * loadOrder → meta → OAuth → doPay → handlePayResult
 *
 * ready 状态机（与 loading 分离，消除「订单卡闪现后进入支付」的视觉跳跃）：
 *  - ready=false：业务内容不渲染，由 InitLoadingMask 接管视觉
 *  - ready=true：可渲染订单卡 + 支付按钮
 *  - 跳 OAuth / autoLaunch 自动支付场景始终保持 ready=false，让遮罩连续到下一阶段
 */
import type { AggregateClientEnv } from '@/shared/utils/client-env'
import { computed, onUnmounted, ref } from 'vue'
import {
  aggregatePay,
  generateGatewayAuthUrl,
  getAggregateMeta,
  getGatewayOrder,
} from '@/shared/api/gateway'
import { getPayResult } from '@/shared/api/pay-result'
import { useGatewayOrderPoll } from '@/shared/hooks/use-gateway-order-poll'
import { closeWebview } from '@/shared/pay/close-webview'
import { prefetchDouyinJsapi } from '@/shared/pay/douyin'
import { invokeJsapiByEnv } from '@/shared/pay/jsapi'
import { useGatewayAuth } from '@/shared/pay/use-gateway-auth'
import { buildAggregateEnvPath } from '@/shared/utils/client-env'
import { cacheOrder, clearCachedOrder, getCachedOrder } from '@/shared/utils/order-cache'
import { fenToYuan } from '@/shared/utils/pay-amount'
import { getPayOpenId } from '@/shared/utils/pay-openid'
import {
  isRedirectableQrInWallet,
  redirectToPayUrl,
  resolvePayResult,
  submitPayForm,
} from '@/shared/utils/pay-result'

export interface UseAggregatePayOptions {
  orderNo: string
  clientEnv: AggregateClientEnv
  /** mobile | pc */
  device?: string
  onPaid?: () => void
  /** 用户主动取消支付（JSAPI 桥返回 cancel）：仅提示，不轮询不报错 */
  onCancel?: () => void
  onError?: (message: string) => void
  /** i18n 文案回调 */
  t: (key: string) => string
  /**
   * 支付成功且无商户 returnUrl 时，自动关闭 webview 回到宿主钱包
   * 聚合扫码场景建议开启（用户没有业务回跳地址，付完应回到支付宝/微信钱包）
   * 与 returnUrl 跳转互斥：有 returnUrl 走跳转，无 returnUrl 且开关开启才关闭
   */
  closeOnPaidWithoutReturn?: boolean
}

/**
 * 网关订单是否终态不可再付
 */
export function isGatewayOrderTerminal(status?: string): boolean {
  return status === 'paid'
    || status === 'failed'
    || status === 'closed'
    || status === 'expired'
}

/**
 * 聚合环境页编排
 */
export function useAggregatePay(options: UseAggregatePayOptions) {
  const {
    orderNo,
    clientEnv,
    device = 'mobile',
    onPaid,
    onCancel,
    onError,
    t,
    closeOnPaidWithoutReturn = false,
  } = options

  const loading = ref(true)
  // 业务内容是否可渲染（与 loading 分离）：ready=false 期间由 InitLoadingMask 接管视觉
  const ready = ref(false)
  const paying = ref(false)
  // 跳转类支付结果标志: location.href 触发后页面卸载前 finally 不重置 paying, 避免闪现订单卡
  let redirecting = false
  const loadError = ref('')
  const order = ref<GatewayOrderInfo>({})
  const meta = ref<AggregatePayMeta>({})
  const payResult = ref<AggregatePayResult | null>(null)
  const showQrcode = ref(false)
  const qrContent = ref('')
  const openId = ref('')

  const remainSeconds = ref(0)
  let countdownTimer: ReturnType<typeof setInterval> | null = null

  const amountYuan = computed(() => fenToYuan(order.value.amount))
  const paid = computed(() => order.value.status === 'paid')
  const terminal = computed(() => isGatewayOrderTerminal(order.value.status))
  const expired = computed(() =>
    remainSeconds.value <= 0 && !!order.value.expiredTime && !paid.value,
  )
  const countdown = computed(() => {
    const s = remainSeconds.value
    const m = String(Math.floor(s / 60)).padStart(2, '0')
    const sec = String(s % 60).padStart(2, '0')
    return `${m}:${sec}`
  })

  const { startPoll, stopPoll } = useGatewayOrderPoll({
    onUpdate(latest) {
      order.value = latest
    },
    onPaid(latest) {
      order.value = latest
      onPaid?.()
      // 不预取签名URL: 倒计时归零/手动点击时由 redirectIfNeeded 内部查单(3s 缓冲让通道回调推进状态)
    },
  })

  // 是否为「重入已支付订单」: 初始加载即为 paid(非本会话支付成功), 不自动倒计时跳转, 仅展示结果卡 + 手动按钮
  const isReentry = ref(false)
  // 跳转查单中标志(防重复触发, 查单期间保持 true)
  const redirectLoading = ref(false)

  /**
   * 跳转到商户 returnUrl 或关闭 webview
   *
   * 跳转时刻才查单(getPayResult), 给后端倒计时 3s 缓冲让通道回调把状态推进到 paid,
   * 从而拿到带签名的 redirectUrl; 查询失败或状态未就绪时不跳转(让问题暴露, 不兜底裸跳)。
   * 由成功卡片倒计时归零或用户点击按钮触发(异步)。
   */
  async function redirectIfNeeded() {
    if (redirectLoading.value) {
      return
    }
    redirectLoading.value = true
    try {
      if (order.value.returnUrl) {
        // 跳转时刻查单: 优先带签名 redirectUrl, 未就绪回退裸跳 returnUrl
        const url = await resolveRedirectUrl()
        if (url) {
          window.location.href = url
        }
        return
      }
      // 无 returnUrl 且开启自动关闭: 关闭 webview 回到宿主钱包
      if (closeOnPaidWithoutReturn) {
        closeWebview()
      }
    }
    finally {
      redirectLoading.value = false
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

  // OAuth 跳转编排(收敛建议由 [useGatewayAuth] 统一处理)
  const gatewayAuth = useGatewayAuth({
    generateAuthUrl: async () => {
      const returnPath = buildAggregateEnvPath(orderNo, clientEnv)
      // clientEnv='union-pay' 已在 ensureOpenId 中提前 return, 不会进入此分支
      const authType = clientEnv === 'douyin' ? 'douyin' : clientEnv
      return generateGatewayAuthUrl({
        orderNo,
        authType,
        returnPath,
        clientEnv,
        runtime: 'h5',
      })
    },
    onError: msg => onError?.(msg),
    failKey: 'aggregate.authFail',
  })

  // 模板依赖 authorizing 控制遮罩, 复用 composable 内部 ref 避免双重维护
  const authorizing = gatewayAuth.authorizing

  /**
   * 需要 OAuth 时跳转授权
   */
  async function ensureOpenId(): Promise<boolean> {
    // 云闪付一期无平台 OAuth, 跳过强制授权
    if (clientEnv === 'union_pay') {
      return true
    }
    return gatewayAuth.ensureOpenId(meta.value.needOpenId, openId.value)
  }

  /**
   * 处理支付结果
   */
  async function applyPayResult(result: AggregatePayResult | null) {
    payResult.value = result
    // 同步资金交易号: 支付发起时后端已创建 PayTrade, 响应含 tradeNo; 前端 order 来自预下单(bootstrap), 彼时无 tradeNo
    if (result?.tradeNo) {
      order.value.tradeNo = result.tradeNo
    }
    const action = resolvePayResult(result)
    switch (action.type) {
      case 'success':
        order.value.status = 'paid'
        // 支付成功后订单状态已变，清除缓存避免回显未付态
        clearCachedOrder(orderNo)
        onPaid?.()
        // 不立即 redirectIfNeeded()：模板切到成功卡片，由卡片倒计时或按钮触发跳转
        break
      case 'redirect':
        // 跳转类结果: 保持 paying, 避免 finally 重置导致跳转前闪现订单卡
        redirecting = true
        redirectToPayUrl(action.url)
        break
      case 'qrcode':
        // 微信/支付宝客户端内: 通道返回的聚合码链接可按 UA 分流拉起钱包支付, 直接跳转而非显示二维码
        if (isRedirectableQrInWallet(clientEnv, action.content)) {
          redirecting = true
          redirectToPayUrl(action.content)
          startPoll(orderNo)
          break
        }
        qrContent.value = action.content
        showQrcode.value = true
        startPoll(orderNo)
        break
      case 'form':
        // 表单提交会导航离开本页, 同属跳转类
        redirecting = true
        submitPayForm(action.html)
        startPoll(orderNo)
        break
      case 'jsapi':
        try {
          await invokeJsapiByEnv(clientEnv, action.payload, { orderNo })
          // JSAPI 桥成功 → 立即标记已支付，模板切到整页成功卡片（与收银台/码牌语义一致）
          order.value.status = 'paid'
          clearCachedOrder(orderNo)
          onPaid?.()
          // 不启动轮询，不立即跳转：让用户看到成功页面，由卡片倒计时或按钮触发跳转
        }
        catch (e: any) {
          if (e?.message === 'cancel') {
            // 用户取消支付：仅提示，不轮询不报错
            onCancel?.()
          }
          else if (/not implemented for/i.test(e?.message || '')) {
            // 当前环境（云闪付/抖音一期）无 JSAPI 桥：兜底轮询，让后端真实状态裁决
            startPoll(orderNo)
          }
          else {
            // 其它失败：报错 + 兜底轮询，避免桥误报让用户误以为已支付
            onError?.(e?.message || t('aggregate.payFail'))
            startPoll(orderNo)
          }
        }
        break
      case 'unsupported':
        showQrcode.value = false
        startPoll(orderNo)
        break
      default:
        startPoll(orderNo)
        break
    }
  }

  /**
   * 发起支付
   */
  async function doPay() {
    if (paying.value || paid.value || expired.value || terminal.value) {
      return
    }
    if (!(await ensureOpenId())) {
      return
    }
    paying.value = true
    redirecting = false
    showQrcode.value = false
    qrContent.value = ''
    try {
      const result = await aggregatePay({
        orderNo,
        clientEnv,
        openId: openId.value || undefined,
        device,
        runtime: 'h5',
      })
      await applyPayResult(result)
    }
    catch (e: any) {
      onError?.(e?.message || t('aggregate.payFail'))
    }
    finally {
      // 跳转类结果保持 paying=true, 让 loading 稳定显示到页面卸载
      if (!redirecting) {
        paying.value = false
      }
    }
  }

  /**
   * 加载订单 + meta，按 autoLaunch 决定是否自动支付
   *
   * ready 状态控制：
   *  - 终态订单（已支付/失败/关闭/过期）→ ready=true（展示结果卡）
   *  - 需要 OAuth 跳转 → ready=false（保持遮罩连续到回调页 + 回跳）
   *  - autoLaunch=true → ready=false（遮罩直接进入 paying 阶段）
   *  - 其余可交互场景 → ready=true（渲染订单卡 + 立即支付按钮）
   */
  async function bootstrap() {
    loading.value = true
    ready.value = false
    loadError.value = ''
    openId.value = getPayOpenId(orderNo, clientEnv)
    // OAuth 回跳后先从 sessionStorage 缓存恢复订单，减少白屏时间
    const cached = getCachedOrder<GatewayOrderInfo>(orderNo)
    if (cached) {
      order.value = cached
    }
    try {
      order.value = await getGatewayOrder(orderNo)
      // 写入缓存，OAuth 跳转回跳时可快速恢复
      cacheOrder(orderNo, order.value)
      startCountdown(order.value.expiredTime)
      // 终态订单：显示结果卡
      if (paid.value || terminal.value) {
        // 初始加载即为 paid = 重入(非本会话支付成功), 标记重入态: 不自动倒计时跳转, 仅手动按钮可跳
        // 不预取签名URL: 手动按钮点击时由 redirectIfNeeded 内部查单
        if (paid.value) {
          isReentry.value = true
        }
        ready.value = true
        return
      }
      meta.value = await getAggregateMeta({
        orderNo,
        clientEnv,
        runtime: 'h5',
      })
      if (meta.value.needOpenId && !openId.value) {
        // 需要 OAuth：保持 ready=false，InitLoadingMask 持续显示直到跳转
        // 禁止在跳转授权前预取(回跳 URL 带 query, 签名会失效)
        await ensureOpenId()
        return
      }
      // 抖音: OAuth 完成或无需授权后预取 SDK + jsapi-config(点支付复用)
      if (clientEnv === 'douyin') {
        prefetchDouyinJsapi({ orderNo })
      }
      // 仅配置显式 autoLaunch=true 时自动拉起
      if (meta.value.autoLaunch === true) {
        // autoLaunch：保持 ready=false，由 paying 接管遮罩，避免订单卡闪现
        await doPay()
        return
      }
      // 可交互：渲染订单卡 + 立即支付按钮
      ready.value = true
    }
    catch (e: any) {
      loadError.value = e?.message || t('aggregate.loadFail')
      // 加载失败也要 ready，让结果卡（loadError）显示
      ready.value = true
    }
    finally {
      loading.value = false
    }
  }

  onUnmounted(() => {
    if (countdownTimer) {
      clearInterval(countdownTimer)
    }
    stopPoll()
  })

  return {
    loading,
    ready,
    paying,
    authorizing,
    loadError,
    order,
    meta,
    payResult,
    showQrcode,
    qrContent,
    openId,
    remainSeconds,
    amountYuan,
    paid,
    terminal,
    expired,
    countdown,
    isReentry,
    bootstrap,
    doPay,
    startPoll,
    stopPoll,
    redirectIfNeeded,
  }
}
