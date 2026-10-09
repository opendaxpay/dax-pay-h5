/**
 * 设备独占路由注册表
 *
 * 仅"一端"实现的业务页登记在此。两端路由器据此自动派生"对端提示存根"：
 * 当用户在错误设备打开独占页时（如手机打开 PC-only 页），渲染 device-only
 * 提示页而非 404。
 *
 * 约束：每项需保证其所属端路由器里有对应的"真实路由"，否则该路径在本端
 * （所属端）反而会落 catch-all 变 404。
 *
 * 新增时参照示例（取消注释，并确保所属端已注册真实路由）：
 *   { path: RoutePath.MERCHANT_DASHBOARD, name: 'MerchantDashboard', device: 'pc' },
 *   { path: RoutePath.WECHAT_BIND, name: 'WechatBind', device: 'mobile' },
 */
import { RoutePath } from './paths'

export interface ExclusiveRoute {
  /** 路由 path（引用 RoutePath 常量） */
  path: string
  /** 路由 name（全端唯一；对端存根会用 `${name}__stub`） */
  name: string
  /** 仅哪端实现 */
  device: 'pc' | 'mobile'
}

// 设备独占业务页登记（新增时按上方示例添加）
// 码牌 /h/* 已跨端：PC 为扫码引导页，Mobile 为分发/收款页，故不登记 exclusive
export const EXCLUSIVE_ROUTES: ExclusiveRoute[] = [
  // 支付宝认证落地页：仅移动端实现（支付宝 OAuth 重定向回调）
  { path: RoutePath.AUTH_ALIPAY, name: 'AlipayAuth', device: 'mobile' },
  // 支付宝代运营授权落地页：仅移动端实现（支付宝授权回跳）
  { path: RoutePath.ISV_AUTH_ALIPAY, name: 'AlipayIsvAuth', device: 'mobile' },
  // 抖音认证落地页：仅移动端实现（抖音 App 内 WebView silent_auth 重定向回调）
  { path: RoutePath.AUTH_DOUYIN, name: 'DouyinAuth', device: 'mobile' },
  // 商户对账单：仅 PC 端实现
  { path: RoutePath.MERCHANT_STATEMENT, name: 'MerchantStatement', device: 'pc' },
]

/**
 * 返回"非指定端"的独占路由，供该端生成 device-only 提示存根。
 * 例：forDevice='mobile' → 返回所有 device='pc' 的独占项（供移动端生成存根）
 */
export function otherDeviceExclusives(forDevice: 'pc' | 'mobile'): ExclusiveRoute[] {
  return EXCLUSIVE_ROUTES.filter(r => r.device !== forDevice)
}

/**
 * 判断路由 name 是否为某独占页的"真实路由"（对端存根名为 `${name}__stub`，不在匹配内）。
 * 供终端不匹配弹窗判定：独占页真实版被错误终端打开时不弹切换窗（切过去只有存根）。
 */
export function isExclusiveRouteName(name: unknown): boolean {
  return typeof name === 'string' && EXCLUSIVE_ROUTES.some(r => r.name === name)
}
