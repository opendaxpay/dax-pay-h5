import { RequestEnum } from '@/shared/enums/httpEnum'
import { http } from '@/shared/utils/http/axios'

/** 三方登录透传目标查询参数 */
export interface TransitTargetParam {
  /** 身份域终端 admin/merchant */
  client: string
  /** 平台来源 alipay/weChat */
  source: string
  /** 场景 login/bind */
  mode: 'bind' | 'login'
}

/**
 * 查询跳转型平台 OAuth 回调的透传目标地址(网关透传页专用)
 *
 * 跳转型平台(支付宝/微信公众号)登录/绑定回调统一落在网关域名透传路径,
 * 本接口按端+场景返回对应 Web 端的原有回调页地址, 域名来自后端端点配置
 */
export function getTransitTarget(param: TransitTargetParam): Promise<string> {
  return http.request<string>(
    {
      url: '/social/transit-target',
      method: RequestEnum.GET,
      params: param,
    },
    {
      // 由透传页自行处理错误展示
      isShowMessage: false,
    },
  )
}
