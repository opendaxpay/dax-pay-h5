/**
 * 码牌端页共用逻辑: 加载信息 / OAuth / 支付 / 轮询
 * 复用 gateway 同族工具: pay-openid / pay-result / jsapi / pay-amount
 */
import type { CodePayInfo, CodePayResult } from '@/shared/api/code-pay'
import { showNotify } from 'vant'
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  codePay,
  generateCodeAuthUrl,
  getCodeOrderStatus,
  getCodePayInfo,
} from '@/shared/api/code-pay'
import { closeWebview } from '@/shared/pay/close-webview'
import { prefetchDouyinJsapi } from '@/shared/pay/douyin'
import { invokeJsapiByEnv } from '@/shared/pay/jsapi'
import { useGatewayAuth } from '@/shared/pay/use-gateway-auth'
import { isAmountOverMax, yuanToFen } from '@/shared/utils/pay-amount'
import { clearPayOpenId, getPayOpenId } from '@/shared/utils/pay-openid'
import {
  isRedirectableQrInWallet,
  redirectToPayUrl,
  resolvePayResult,
  submitPayForm,
} from '@/shared/utils/pay-result'

export interface UseCodePayPageOptions {
  /** 码牌编码 */
  code: string
  /** 写死的客户端环境 */
  clientEnv: 'wechat' | 'alipay' | 'union_pay' | 'douyin'
}

/**
 * 码牌端页 composable
 */
export function useCodePayPage(options: UseCodePayPageOptions) {
  const { t } = useI18n()
  const { code, clientEnv } = options

  const loading = ref(true)
  // 业务内容是否可渲染（与 loading 分离）：ready=false 期间由 InitLoadingMask 接管视觉
  const ready = ref(false)
  const paying = ref(false)
  const loadError = ref('')
  const info = ref<CodePayInfo>({})
  const payResult = ref<CodePayResult | null>(null)
  const openId = ref<string | undefined>()
  const amount = ref('0')
  const description = ref('')

  // OAuth 跳转编排(码牌用 location.replace 避免返回键回到中转页)
  const gatewayAuth = useGatewayAuth({
    generateAuthUrl: () => generateCodeAuthUrl({ code, clientEnv }),
    onError: (msg) => {
      loadError.value = msg
    },
    failKey: 'codePay.authUrlFail',
    redirect: 'replace',
  })
  // 模板依赖 authRedirecting 控制遮罩, 复用 composable 内部 ref 避免双重维护
  const authRedirecting = gatewayAuth.authorizing

  let pollTimer: ReturnType<typeof setInterval> | null = null

  const displayAmount = computed(() => {
    if (info.value.amountType === 'fixed' && info.value.fixedAmount) {
      return (info.value.fixedAmount / 100).toFixed(2)
    }
    return amount.value
  })

  const paid = computed(() => {
    const s = payResult.value?.status
    return s === 'success' || s === 'paid'
  })

  /** 支付结果订单号(结果态展示) */
  const orderNo = computed(() => payResult.value?.orderNo || '')

  onUnmounted(() => {
    stopPoll()
  })

  /**
   * 初始化: 取 openId → 拉码牌 → 必要时 OAuth
   *
   * needOpenId 仅 true 时跳转授权；授权落地页 /auth/* 立即 code→openId，
   * 回跳后本处读 sessionStorage。支付只带 openId，禁止支付时再换 code。
   *
   * ready 控制：跳转 OAuth / 错误态以外的完成场景才 ready=true，
   * 让 InitLoadingMask 持续覆盖到 OAuth 跳转 / 错误结果卡出现
   */
  async function init() {
    loading.value = true
    ready.value = false
    loadError.value = ''
    // 授权回跳后 openId 已由 auth-return 写入(key=code+clientEnv)
    const stored = getPayOpenId(code, clientEnv)
    if (stored) {
      openId.value = stored
      clearPayOpenId(code, clientEnv)
    }
    try {
      info.value = await getCodePayInfo(code, clientEnv)
      if (info.value.programType === 'mini_app') {
        // 小程序码不可在 H5 支付
        loadError.value = t('codePay.miniAppOnly')
        ready.value = true
        return
      }
      // 仅 needOpenId===true 且尚未拿到 openId → 整段 OAuth（回跳即换 openId）
      // false / null / 缺省: 不跳转，可直接收款
      if (info.value.needOpenId === true && !openId.value) {
        // 禁止在跳转授权前预取(回跳 URL 可能变化, 签名会失效)
        const ok = await gatewayAuth.ensureOpenId(true, openId.value)
        if (!ok) {
          // 已跳转 OAuth 或失败(loadError 已由 onError 写入); 失败时显示错误卡
          if (loadError.value) {
            ready.value = true
          }
          return
        }
      }
      // 抖音: OAuth 完成或无需授权后预取 SDK + jsapi-config(点支付复用)
      if (clientEnv === 'douyin') {
        prefetchDouyinJsapi({ code })
      }
      // 正常态：可渲染码牌收款 UI
      ready.value = true
    }
    catch (e: any) {
      loadError.value = e?.message || t('codePay.loadFail')
      ready.value = true
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 金额键盘输入
   * Vant NumberKeyboard 数字键 @input 传 number，须统一转 string，否则 amount 被污染后 indexOf 崩溃
   */
  function onInput(key: string | number) {
    if (paying.value || paid.value) {
      return
    }
    // 统一为字符串（Vant 数字键为 number）
    const k = String(key)
    // 保证 amount 始终是字符串
    let current = String(amount.value)
    if (k === '.' && current.includes('.')) {
      return
    }
    // 最多两位小数
    const dot = current.indexOf('.')
    if (dot >= 0 && current.length - dot > 2 && k !== '.') {
      return
    }
    if (current === '0' && k !== '.') {
      current = k
    }
    else {
      current += k
    }
    // 防止零值死锁: 结果金额为零且小数位满2位(如"0.00"), 拦截
    if (Number(current) === 0) {
      const zeroDot = current.indexOf('.')
      if (zeroDot >= 0 && current.length - zeroDot > 2) {
        return
      }
    }
    // 上限：对齐后端 amount @Max(9999999999 分)，超限则忽略本次按键
    if (isAmountOverMax(current)) {
      return
    }
    amount.value = current
  }

  function onDelete() {
    if (paying.value || paid.value) {
      return
    }
    // String 加固：防止历史脏值导致 slice 失败
    amount.value = String(amount.value).slice(0, -1) || '0'
  }

  /**
   * 标记支付成功(走结果页, 不再 toast 以免双反馈)
   */
  function markPaid(result?: CodePayResult | null) {
    payResult.value = {
      ...(result || payResult.value || {}),
      status: 'success',
    }
  }

  /**
   * 应用支付结果(与聚合页分发语义对齐)
   */
  async function applyPayResult(result: CodePayResult | null) {
    payResult.value = result
    const action = resolvePayResult(result)
    switch (action.type) {
      case 'success':
        markPaid(result)
        return
      case 'redirect':
        redirectToPayUrl(action.url, true)
        return
      case 'form':
        submitPayForm(action.html)
        return
      case 'jsapi':
        try {
          await invokeJsapiByEnv(clientEnv, action.payload, { code })
          markPaid(result)
        }
        catch (e: any) {
          if (e?.message === 'cancel') {
            showNotify({ type: 'warning', message: t('codePay.jsapiCancelOrFail') })
          }
          else {
            showNotify({ type: 'warning', message: e?.message || t('codePay.jsapiCancelOrFail') })
          }
          if (result?.orderNo) {
            startPoll(result.orderNo)
          }
        }
        return
      case 'qrcode':
        // 微信/支付宝客户端内: 通道返回的聚合码链接可按 UA 分流拉起钱包支付, 直接跳转并轮询后结束;
        // 钱包外落到下方轮询(码牌页无二维码展示区, 沿用改动前直落 default 的轮询/待支付提示)
        if (isRedirectableQrInWallet(clientEnv, action.content)) {
          redirectToPayUrl(action.content, true)
          if (result?.orderNo) {
            startPoll(result.orderNo)
          }
          return
        }
        // falls through
      case 'unsupported':
      case 'poll':
      default:
        if (result?.orderNo) {
          startPoll(result.orderNo)
        }
        else {
          showNotify({ type: 'warning', message: t('codePay.payPending') })
        }
    }
  }

  /**
   * 确认支付
   */
  async function pay() {
    if (paying.value || paid.value) {
      return
    }
    if (info.value.programType === 'mini_app') {
      showNotify({ type: 'warning', message: t('codePay.miniAppOnly') })
      return
    }
    let amountFen: number | undefined
    if (info.value.amountType === 'random') {
      amountFen = yuanToFen(String(amount.value))
      if (!amountFen) {
        showNotify({ type: 'warning', message: t('codePay.amountZero') })
        return
      }
      // 提交前再拦一层（与键盘上限一致）
      if (isAmountOverMax(String(amount.value))) {
        showNotify({ type: 'warning', message: t('codePay.amountOverMax') })
        return
      }
    }
    // 仅 JSAPI/MINI 类 method 要求 openId（与后端 PayMethodOpenIdSupport 一致）
    if (info.value.needOpenId === true && !openId.value) {
      showNotify({ type: 'warning', message: t('codePay.needAuth') })
      return
    }
    paying.value = true
    try {
      const result = await codePay({
        code,
        amount: amountFen,
        description: description.value || undefined,
        clientEnv,
        runtime: 'h5',
        openId: openId.value,
        device: 'mobile',
      })
      await applyPayResult(result)
    }
    catch (e: any) {
      showNotify({ type: 'danger', message: e?.message || t('codePay.payFail') })
    }
    finally {
      paying.value = false
    }
  }

  function startPoll(orderNoVal: string) {
    stopPoll()
    let tries = 0
    pollTimer = setInterval(async () => {
      tries++
      if (tries > 30) {
        stopPoll()
        showNotify({ type: 'warning', message: t('codePay.pollTimeout') })
        return
      }
      try {
        const st = await getCodeOrderStatus(orderNoVal)
        if (st?.status === 'paid') {
          stopPoll()
          markPaid({ ...(payResult.value || {}), orderNo: orderNoVal, status: 'success' })
        }
        else if (st?.status === 'failed' || st?.status === 'closed' || st?.status === 'expired') {
          stopPoll()
          showNotify({ type: 'danger', message: t('codePay.payFail') })
        }
      }
      catch {
        // 忽略单次轮询错误
      }
    }, 2000)
  }

  function stopPoll() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  /**
   * 更新备注
   */
  function setDescription(value: string) {
    description.value = value
  }

  /**
   * 关闭宿主 WebView / 窗口（统一 closeWebview）
   */
  function closePage() {
    closeWebview()
  }

  return {
    loading,
    ready,
    paying,
    loadError,
    info,
    payResult,
    amount,
    description,
    setDescription,
    displayAmount,
    paid,
    orderNo,
    authRedirecting,
    init,
    onInput,
    onDelete,
    pay,
    closePage,
  }
}
