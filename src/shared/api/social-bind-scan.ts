import { RequestEnum } from '@/shared/enums/httpEnum'
import { http } from '@/shared/utils/http/axios'

/** 扫码绑定兑换结果(与后端 SocialExchangeResult 对齐) */
export interface BindScanExchangeResult {
  /** 业务结果标记 */
  result?: string
  /** 错误标记 */
  error?: string
}

/**
 * 查询扫码绑定的微信授权地址(公众号扫码绑定发起页专用)
 *
 * 凭票据定位待绑定用户(PC 端发起时生成, 5 分钟过期), 返回公众号网页授权地址;
 * 公众号授权仅微信客户端内可完成, 调用方须运行在微信内置浏览器中
 */
export function getBindScanAuthUrl(ticket: string): Promise<string> {
  return http.request<string>(
    {
      url: '/social/bind-scan/auth-url',
      method: RequestEnum.GET,
      params: { ticket },
    },
    {
      // 由扫码绑定页自行处理错误展示
      isShowMessage: false,
    },
  )
}

/** 扫码绑定确认信息(与后端 SocialBindScanConfirmResult 对齐) */
export interface BindScanConfirmInfo {
  /** 脱敏的目标账号名(手机号/邮箱/用户名按各自规则脱敏) */
  maskedAccount?: string
}

/**
 * 查询扫码绑定确认信息(公众号扫码绑定确认页专用)
 *
 * 返回脱敏的目标账号名, 供扫码者核对是否本人的电脑端账号;
 * 票据无效时后端报错, 由确认页按失败卡兜底
 */
export function getBindScanConfirmInfo(ticket: string): Promise<BindScanConfirmInfo> {
  return http.request<BindScanConfirmInfo>(
    {
      url: '/social/bind-scan/confirm-info',
      method: RequestEnum.GET,
      params: { ticket },
    },
    {
      // 由扫码绑定页自行处理错误展示
      isShowMessage: false,
    },
  )
}

/**
 * 取消扫码绑定(公众号扫码绑定确认页专用)
 *
 * 手机端用户点击「取消」拒绝本次绑定, PC 端轮询到 cancelled 后停止轮询;
 * 票据不存在或已不可取消时空操作
 */
export function cancelBindScan(ticket: string): Promise<void> {
  return http.request<void>(
    {
      url: '/social/bind-scan/cancel',
      method: RequestEnum.POST,
      // 同 exchangeBindScan: POST 须以 JSON body 提交(后端 @RequestBody)
      data: { ticket },
    },
    {
      // 由确认页自行处理错误展示
      isShowMessage: false,
    },
  )
}

/**
 * 扫码绑定授权码兑换(微信授权回调页专用)
 *
 * state 为后端一次性映射(换取票据定位待绑定用户), 手机端无登录态,
 * 授权码与 state 均单次有效, 失败后需回 PC 端刷新二维码重新发起
 */
export function exchangeBindScan(code: string, state: string): Promise<BindScanExchangeResult> {
  return http.request<BindScanExchangeResult>(
    {
      url: '/social/exchange-bind-scan',
      method: RequestEnum.POST,
      // H5 http 封装会把 POST 的 params 并入 JSON body 而非挂在 query 上,
      // 后端接口为 @RequestBody 接参, 此处必须用 data 提交
      data: { code, state },
    },
    {
      // 由结果页自行处理错误展示
      isShowMessage: false,
    },
  )
}

/**
 * 查询扫码登录的微信授权地址(公众号扫码登录发起页专用)
 *
 * 凭票据定位身份域与平台(PC 登录页匿名发起时生成, 5 分钟过期), 返回公众号
 * 网页授权地址; 公众号授权仅微信客户端内可完成, 调用方须运行在微信内置浏览器中
 */
export function getLoginScanAuthUrl(ticket: string): Promise<string> {
  return http.request<string>(
    {
      url: '/social/login-scan/auth-url',
      method: RequestEnum.GET,
      params: { ticket },
    },
    {
      // 由扫码登录页自行处理错误展示
      isShowMessage: false,
    },
  )
}

/**
 * 扫码登录授权码兑换(微信授权回调页专用)
 *
 * 授权微信未绑定账号时返回 error=unbind(不自动注册, 引导用账号密码登录后绑定);
 * 成功后 PC 登录页轮询换取登录令牌, 手机端展示登录成功引导
 */
export function exchangeLoginScan(code: string, state: string): Promise<BindScanExchangeResult> {
  return http.request<BindScanExchangeResult>(
    {
      url: '/social/exchange-login-scan',
      method: RequestEnum.POST,
      // 同 exchangeBindScan: POST 须以 JSON body 提交(后端 @RequestBody)
      data: { code, state },
    },
    {
      // 由结果页自行处理错误展示
      isShowMessage: false,
    },
  )
}

/**
 * 取消扫码登录(公众号扫码登录确认页专用)
 *
 * 手机端用户点击「取消」拒绝本次电脑端登录, PC 端轮询到 cancelled 后停止轮询;
 * 票据不存在或已不可取消时空操作
 */
export function cancelLoginScan(ticket: string): Promise<void> {
  return http.request<void>(
    {
      url: '/social/login-scan/cancel',
      method: RequestEnum.POST,
      // 同 exchangeLoginScan: POST 须以 JSON body 提交(后端 @RequestBody)
      data: { ticket },
    },
    {
      // 由确认页自行处理错误展示
      isShowMessage: false,
    },
  )
}
