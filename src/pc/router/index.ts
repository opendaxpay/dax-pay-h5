import type { App } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import { createPcRouterGuards } from '@/pc/router/router-guards'
import { otherDeviceExclusives } from '@/shared/router/exclusive'
import { RoutePath } from '@/shared/router/paths'

// 移动独占路径：在 PC 端渲染"仅限手机端"提示存根（由注册表派生，勿手写）
const mobileOnlyStubs: RouteRecordRaw[] = otherDeviceExclusives('pc').map(r => ({
  path: r.path,
  name: `${r.name}__stub`,
  component: () => import('@/pc/views/DeviceOnly.vue'),
}))

// PC 端路由树（独立于移动端，按需在此扩展业务路由，例如收银台 PC 版）
// 顺序：真实路由 → 移动独占提示存根 → catch-all 404
const routes: RouteRecordRaw[] = [
  {
    path: RoutePath.HOME,
    name: 'PcHome',
    component: () => import('@/pc/views/Home.vue'),
  },
  // 收银台（跨端：与移动端同 path 各指各 view）
  {
    path: RoutePath.CASHIER,
    name: 'PcCashier',
    component: () => import('@/pc/views/cashier/index.vue'),
    meta: { title: 'route.cashier' }, // 收银台
  },
  // 收银台环境页路径（移动端 entry 探测 replace 的内部落点）:
  // PC 打开时复用 WEB 收银页（组件只消费 orderNo, 忽略 clientEnv 段）, 防分享链接 404
  {
    path: RoutePath.CASHIER_ENV,
    name: 'PcCashierEnv',
    component: () => import('@/pc/views/cashier/index.vue'),
    meta: { title: 'route.cashier' }, // 收银台
  },
  // 收银台小程序引导页（跨端：浏览器直接打开 /cm/:orderNo 时展示扫码提示，不发起支付）
  {
    path: RoutePath.CASHIER_MINI,
    name: 'PcCashierMini',
    component: () => import('@/pc/views/cashier-mini/index.vue'),
    meta: { title: 'route.cashier' }, // 收银台
  },
  // 聚合「非宿主」提示：须在 /aggregate/:orderNo 之前注册，避免 path 段 "unsupported" 被当成 orderNo 查单
  {
    path: RoutePath.AGGREGATE_UNSUPPORTED,
    name: 'PcAggregateUnsupported',
    component: () => import('@/pc/views/aggregate/Unsupported.vue'),
    meta: { title: 'route.cashier' }, // 收银台
  },
  // 聚合扫码支付（跨端）
  {
    path: RoutePath.AGGREGATE,
    name: 'PcAggregate',
    component: () => import('@/pc/views/aggregate/index.vue'),
    meta: { title: 'route.cashier' }, // 收银台
  },
  // 聚合各宿主环境页路径（移动端 entry 探测 replace 的内部落点）:
  // PC 打开时复用 PC 聚合页（组件只消费 orderNo, 忽略 env 段, 展示二维码）, 防分享链接 404
  {
    path: RoutePath.AGGREGATE_ENV_WECHAT,
    name: 'PcAggregateWechatEnv',
    component: () => import('@/pc/views/aggregate/index.vue'),
    meta: { title: 'route.cashier' }, // 收银台
  },
  {
    path: RoutePath.AGGREGATE_ENV_ALIPAY,
    name: 'PcAggregateAlipayEnv',
    component: () => import('@/pc/views/aggregate/index.vue'),
    meta: { title: 'route.cashier' }, // 收银台
  },
  {
    path: RoutePath.AGGREGATE_ENV_UNION,
    name: 'PcAggregateUnionEnv',
    component: () => import('@/pc/views/aggregate/index.vue'),
    meta: { title: 'route.cashier' }, // 收银台
  },
  {
    path: RoutePath.AGGREGATE_ENV_DOUYIN,
    name: 'PcAggregateDouyinEnv',
    component: () => import('@/pc/views/aggregate/index.vue'),
    meta: { title: 'route.cashier' }, // 收银台
  },
  // 聚合小程序引导页（跨端：浏览器直接打开 /am/:orderNo 时展示扫码提示，不发起支付）
  {
    path: RoutePath.AGGREGATE_MINI,
    name: 'PcAggregateMini',
    component: () => import('@/pc/views/aggregate-mini/index.vue'),
    meta: { title: 'route.cashier' }, // 收银台
  },
  // 码牌小程序引导页（跨端：浏览器直接打开 /m/:code 时展示扫码提示，不发起支付）
  {
    path: RoutePath.CODE_PAY_MINI,
    name: 'PcCodePayMini',
    component: () => import('@/pc/views/code-pay-mini/index.vue'),
    meta: { title: 'route.codePay' }, // 码牌支付
  },
  // 商户对账单（PC 独占：移动端由注册表派生 device-only 存根）
  {
    path: RoutePath.MERCHANT_STATEMENT,
    name: 'MerchantStatement',
    component: () => import('@/pc/views/statement/index.vue'),
    meta: { title: 'route.merchantStatement' }, // 商户对账单
  },
  // 协议展示页（跨端：与移动端同 path 各指各 view，链接可独立分享）
  {
    path: RoutePath.PROTOCOL,
    name: 'PcProtocol',
    component: () => import('@/pc/views/protocol/index.vue'),
    meta: { title: 'route.protocol' }, // 协议
  },
  // 微信认证落地页（跨端：与移动端同 path 各指各 view，PC 微信内置浏览器可访问）
  {
    path: RoutePath.AUTH_WECHAT,
    name: 'PcWechatAuth',
    component: () => import('@/pc/views/auth/wechat/index.vue'),
    meta: { title: 'route.wechatAuth' }, // 微信认证
  },
  // 三方登录透传页（跨端：与移动端同 path 各指各 view，跳转型平台登录 OAuth 回调）
  {
    path: RoutePath.SOCIAL_LOGIN_TRANSIT,
    name: 'PcSocialLoginTransit',
    component: () => import('@/pc/views/auth/social-transit/login.vue'),
    meta: { title: 'route.socialTransit' }, // 登录跳转
  },
  // 三方绑定透传页（跨端：与移动端同 path 各指各 view，机制同登录透传页）
  {
    path: RoutePath.SOCIAL_BIND_TRANSIT,
    name: 'PcSocialBindTransit',
    component: () => import('@/pc/views/auth/social-transit/bind.vue'),
    meta: { title: 'route.socialTransit' }, // 登录跳转
  },
  // 公众号扫码绑定发起页（跨端：与移动端同 path 各指各 view，PC 微信内置浏览器也可打开）
  {
    path: RoutePath.SOCIAL_BIND_SCAN,
    name: 'PcSocialBindScan',
    component: () => import('@/pc/views/auth/bind-scan/index.vue'),
    meta: { title: 'route.bindScan' }, // 账号绑定
  },
  // 公众号扫码绑定回调页（跨端：微信授权重定向落地，凭 code+state 完成绑定）
  {
    path: RoutePath.SOCIAL_BIND_SCAN_CALLBACK,
    name: 'PcSocialBindScanResult',
    component: () => import('@/pc/views/auth/bind-scan/result.vue'),
    meta: { title: 'route.bindScanResult' }, // 绑定结果
  },
  // 公众号扫码登录发起页（跨端：与移动端同 path 各指各 view，PC 微信内置浏览器也可打开）
  {
    path: RoutePath.SOCIAL_LOGIN_SCAN,
    name: 'PcSocialLoginScan',
    component: () => import('@/pc/views/auth/login-scan/index.vue'),
    meta: { title: 'route.loginScan' }, // 微信扫码登录
  },
  // 公众号扫码登录回调页（跨端：微信授权重定向落地，凭 code+state 完成登录）
  {
    path: RoutePath.SOCIAL_LOGIN_SCAN_CALLBACK,
    name: 'PcSocialLoginScanResult',
    component: () => import('@/pc/views/auth/login-scan/result.vue'),
    meta: { title: 'route.loginScanResult' }, // 登录结果
  },
  // 码牌支付：PC 仅展示扫码引导（静态段须在 /h/:code 之前）
  {
    path: RoutePath.CODE_PAY_WECHAT,
    name: 'PcCodePayWechat',
    component: () => import('@/pc/views/code-pay/index.vue'),
    meta: { title: 'route.codePay' }, // 码牌支付
  },
  {
    path: RoutePath.CODE_PAY_ALIPAY,
    name: 'PcCodePayAlipay',
    component: () => import('@/pc/views/code-pay/index.vue'),
    meta: { title: 'route.codePay' }, // 码牌支付
  },
  {
    path: RoutePath.CODE_PAY_UNION,
    name: 'PcCodePayUnion',
    component: () => import('@/pc/views/code-pay/index.vue'),
    meta: { title: 'route.codePay' }, // 码牌支付
  },
  {
    path: RoutePath.CODE_PAY_DOUYIN,
    name: 'PcCodePayDouyin',
    component: () => import('@/pc/views/code-pay/index.vue'),
    meta: { title: 'route.codePay' }, // 码牌支付
  },
  {
    path: RoutePath.CODE_PAY,
    name: 'PcCodePay',
    component: () => import('@/pc/views/code-pay/index.vue'),
    meta: { title: 'route.codePay' }, // 码牌支付
  },
  // 支付结果页（跨端：与移动端同 path 各指各 view，通道同步回跳落地页）
  {
    path: RoutePath.PAY_RESULT,
    name: 'PcPayResult',
    component: () => import('@/pc/views/pay-result/index.vue'),
    meta: { title: 'route.payResult' }, // 支付结果
  },
  // 微信转账确认收款页（跨端：PC 仅引导提示，收款需在微信内打开）
  {
    path: RoutePath.TRANSFER_CONFIRM,
    name: 'PcTransferConfirm',
    component: () => import('@/pc/views/transfer/wechat/TransferConfirm.vue'),
    meta: { title: 'route.transferConfirm' }, // 转账确认收款
  },
  ...mobileOnlyStubs,
  // 兜底：移动端专属路径（如 /home/index）或任何未匹配路径，渲染 PC 404 页
  // 用 component 而非 redirect——vue-router 5 下 catch-all + redirect 在初始导航不触发
  {
    path: '/:pathMatch(.*)*',
    name: 'PcNotFound',
    component: () => import('@/pc/views/NotFound.vue'),
  },
]

const pcRouter = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ left: 0, top: 0 }),
})

export function setupPCRouter(app: App) {
  app.use(pcRouter)
  // 挂载守卫：依据路由 meta.title 切换浏览器标题
  createPcRouterGuards(pcRouter)
}

export { pcRouter }
