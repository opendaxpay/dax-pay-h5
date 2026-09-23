import { RequestEnum } from '@/shared/enums/httpEnum'
import { http } from '@/shared/utils/http/axios'

/**
 * 码牌金额类型
 */
export type AmountType = 'random' | 'fixed'

/**
 * 码牌支付信息(公开接口返回)
 */
export interface CodePayInfo {
  /** 码牌编码 */
  code?: string
  /** 码牌名称 */
  name?: string
  /** 商户简称(展示用; 后端简称空时已回退全称) */
  mchShortName?: string
  /** 金额类型 random-自定义 / fixed-固定 */
  amountType?: AmountType
  /** 固定金额(分, amountType=fixed 时返回) */
  fixedAmount?: number
  /** 落地程序类型 h5 / mini_app */
  programType?: string
  /** 是否需要 openId(传入 clientEnv 时由后端解析 method 判定) */
  needOpenId?: boolean
}

/**
 * 码牌支付结果
 */
export interface CodePayResult {
  bizOrderNo?: string
  orderNo?: string
  tradeNo?: string
  status?: string
  payBody?: string
  payBodyType?: string
}

/**
 * 授权链接结果
 */
export interface CodePayAuthUrlResult {
  authUrl?: string
  queryCode?: string
}

/**
 * 码牌订单状态(脱敏)
 */
export interface CodePayOrderStatus {
  orderNo?: string
  status?: string
  amount?: number
  title?: string
}

/**
 * 根据码牌编码查询支付信息(公开接口, 无需登录)
 */
export function getCodePayInfo(code: string, clientEnv?: string): Promise<CodePayInfo> {
  return http.request<CodePayInfo>({
    url: '/client/device/qrcode/get-by-code',
    method: RequestEnum.GET,
    params: { code, clientEnv },
  }, {
    // 由页面自行处理错误展示
    isShowMessage: false,
  })
}

/**
 * 生成码牌 OAuth 授权链接(公开, 按码牌解析商户上下文)
 */
export function generateCodeAuthUrl(data: {
  code: string
  clientEnv: string
}): Promise<CodePayAuthUrlResult> {
  return http.request<CodePayAuthUrlResult>({
    url: '/client/device/qrcode/generate-auth-url',
    method: RequestEnum.POST,
    data,
  }, {
    isShowMessage: false,
  })
}

/**
 * 码牌发起支付
 */
export function codePay(data: {
  code: string
  amount?: number
  description?: string
  clientEnv: string
  runtime?: string
  openId?: string
  device?: string
  clientIp?: string
}): Promise<CodePayResult> {
  return http.request<CodePayResult>({
    url: '/client/device/qrcode/pay',
    method: RequestEnum.POST,
    data,
  }, {
    isShowMessage: false,
  })
}

/**
 * 查询码牌订单状态(公开脱敏, source 须为 cashier_code)
 */
export function getCodeOrderStatus(orderNo: string): Promise<CodePayOrderStatus> {
  return http.request<CodePayOrderStatus>({
    url: '/client/device/qrcode/order-status',
    method: RequestEnum.GET,
    params: { orderNo },
  }, {
    isShowMessage: false,
  })
}
