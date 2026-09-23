/**
 * 网关聚合扫码 / 收银台 API
 */
import { RequestEnum } from '@/shared/enums/httpEnum'
import { http } from '@/shared/utils/http/axios'

/** 网关订单摘要 */
export interface GatewayOrderInfo {
  orderNo?: string
  bizOrderNo?: string
  gatewayType?: string
  title?: string
  description?: string
  amount?: number
  currency?: string
  status?: string
  expiredTime?: string
  payTime?: string
  channel?: string
  method?: string
  product?: string
  tradeNo?: string
  outOrderNo?: string
  fundStatus?: string
  attach?: string
  returnUrl?: string
}

/** 聚合/收银台支付结果 */
export interface AggregatePayResult {
  bizOrderNo?: string
  orderNo?: string
  status?: string
  payBody?: string
  /**
   * 支付参数体类型（与后端 PayBodyTypeEnum 对齐）
   * link | jsapi | from | identifier | qr_code | json
   * 历史可能出现 url，前端按 link 兼容
   */
  payBodyType?: string
  tradeNo?: string
}

/** 收银台支付项(公开字段) */
export interface CashierItemPublic {
  /** 支付项ID(后端 Long, 前端用 string 避免精度问题) */
  id: string
  name?: string
  icon?: string
  recommend?: boolean
  sortNo?: number
  /** 该项是否需要先走 OAuth 获取 openId（后端按 method + clientEnv 综合判定） */
  needOpenId?: boolean
  // 是否为订单已锁定的支付项（订单支付中且与已锁定的支付方式匹配）
  locked?: boolean
}

/** 查询网关订单 */
export function getGatewayOrder(orderNo: string): Promise<GatewayOrderInfo> {
  return http.request<GatewayOrderInfo>({
    url: '/unipay/gateway/order',
    method: RequestEnum.GET,
    params: { orderNo },
  }, {
    isShowMessage: false,
  })
}

/** 聚合扫码元数据（autoLaunch / needOpenId） */
export interface AggregatePayMeta {
  autoLaunch?: boolean
  needOpenId?: boolean
}

/** 查询聚合扫码元数据 */
export function getAggregateMeta(params: {
  orderNo: string
  clientEnv: string
  runtime?: string
}): Promise<AggregatePayMeta> {
  return http.request<AggregatePayMeta>({
    url: '/unipay/gateway/aggregate/meta',
    method: RequestEnum.GET,
    params,
  }, {
    isShowMessage: false,
  })
}

/** 聚合扫码发起支付 */
export function aggregatePay(data: {
  orderNo: string
  clientEnv: string
  openId?: string
  device?: string
  runtime?: string
  clientIp?: string
}): Promise<AggregatePayResult> {
  return http.request<AggregatePayResult>({
    url: '/unipay/gateway/aggregate/pay',
    method: RequestEnum.POST,
    data,
  }, {
    isShowMessage: false,
  })
}

/** 网关 H5 生成 OAuth 授权链接 */
export interface GatewayAuthUrlResult {
  authUrl?: string
  queryCode?: string
}

export function generateGatewayAuthUrl(data: {
  orderNo: string
  authType: string
  returnPath: string
  /** 客户端环境(微信/抖音通道解析用) */
  clientEnv?: string
  /** 运行形态 h5/mini */
  runtime?: string
  /** 收银台支付项 ID */
  itemId?: string
  /** 收银台类型 h5/web/mini */
  cashierType?: string
}): Promise<GatewayAuthUrlResult> {
  return http.request<GatewayAuthUrlResult>({
    url: '/unipay/gateway/auth/generate-url',
    method: RequestEnum.POST,
    data,
  }, {
    isShowMessage: false,
  })
}

/** 收银台支付项列表 */
export function listCashierItems(params: {
  orderNo: string
  cashierType: string
  clientEnv?: string
}): Promise<CashierItemPublic[]> {
  return http.request<CashierItemPublic[]>({
    url: '/unipay/gateway/cashier/items',
    method: RequestEnum.GET,
    params,
  }, {
    isShowMessage: false,
  }).then((list) => {
    // id 统一为 string
    return (list || []).map(item => ({
      ...item,
      id: String(item.id),
    }))
  })
}

/** 收银台发起支付 */
export function cashierPay(data: {
  orderNo: string
  itemId: string | number
  cashierType: string
  clientEnv?: string
  openId?: string
  device?: string
  clientIp?: string
}): Promise<AggregatePayResult> {
  return http.request<AggregatePayResult>({
    url: '/unipay/gateway/cashier/pay',
    method: RequestEnum.POST,
    data: {
      ...data,
      // 后端 Long; 字符串数字可被 Jackson 反序列化
      itemId: data.itemId,
    },
  }, {
    isShowMessage: false,
  })
}
