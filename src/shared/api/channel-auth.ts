import { RequestEnum } from '@/shared/enums/httpEnum'
import { http } from '@/shared/utils/http/axios'

/**
 * 通过 AuthCode 获取认证结果(H5 落地页回写)
 */
export function authAndGet(param: AuthCodeParam): Promise<AuthResult> {
  return http.request<AuthResult>({
    url: '/unipay/gateway/auth/callback',
    method: RequestEnum.POST,
    data: param,
    // 服务端要用授权码调微信/支付宝接口换取标识, 第三方偶发慢时 10s 全局超时不够用
    timeout: 30 * 1000,
  }, {
    // 由页面自行处理错误展示
    isShowMessage: false,
  })
}

/** 通道认证参数 */
export interface AuthCodeParam {
  /** 认证类型 alipay/wechat/... */
  authType?: string
  /** 授权码 */
  authCode?: string
  /** 查询码(管理端轮询用) */
  queryCode?: string
  /** 应用号 */
  appId?: string
  /** 认证会话码 */
  authToken?: string
  /** 支付产品 */
  product?: string
}

/** 认证结果 */
export interface AuthResult {
  openId?: string
  userId?: string
  accessToken?: string
  status?: string
  returnPath?: string
}
