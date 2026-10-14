import type { RouteRecordRaw } from 'vue-router'
import { RoutePath } from '@/shared/router/paths'

const Layout = () => import('@/mobile/layout/index.vue')

// 业务路由模块
const routeModuleList: Array<RouteRecordRaw> = [
  // 首页（根路径 /，与 PC 端首页地址统一）
  {
    path: RoutePath.HOME,
    name: 'Home',
    component: Layout,
    meta: {
      title: 'route.home', // 首页
    },
    children: [
      {
        path: '',
        name: 'HomePage',
        meta: {
          keepAlive: true,
        },
        component: () => import('@/mobile/views/home/index.vue'),
      },
    ],
  },
  // 收银台：入口 /cashier/:orderNo → 环境页 /cashier/:orderNo/:clientEnv
  {
    path: RoutePath.CASHIER,
    name: 'Cashier',
    component: Layout,
    meta: {
      title: 'route.cashier', // 收银台
    },
    children: [
      {
        // 入口：UA 探测后 replace 到环境页
        path: '',
        name: 'CashierEntry',
        component: () => import('@/mobile/views/cashier/Entry.vue'),
      },
      {
        // 环境页：clientEnv 白名单在页内校验（不缓存：收银台为一次性支付页，每次须重新探测与加载）
        path: ':clientEnv',
        name: 'CashierEnvPage',
        component: () => import('@/mobile/views/cashier/CashierEnvPage.vue'),
      },
    ],
  },
  // 收银台小程序引导页（跨端：浏览器直接打开 /cm/:orderNo 时展示扫码提示，不发起支付）
  {
    path: RoutePath.CASHIER_MINI,
    name: 'CashierMiniGuide',
    component: () => import('@/mobile/views/cashier-mini/index.vue'),
    meta: {
      title: 'route.cashier', // 收银台
    },
  },
  // 聚合扫码：入口 + 非宿主提示 + 各宿主环境页 统一在 Aggregate 父级下作为子路由
  // 让 App.vue 顶层 transition key（matched[0].name）在 entry → 环境页跳转时保持不变（都是 Aggregate），
  // 避免整页 remount 与 Entry.vue 的 onBeforeMount router.replace 竞争导致白屏
  // （曾发生在支付宝 webview：onBeforeMount 跨顶层 replace 与 <transition mode="out-in" appear> 的 enter 死锁）
  // 注意：静态段（unsupported/alipay/wechat/union-pay/douyin）必须排在 :orderNo 之前，否则会被当订单号吞掉
  // URL 契约不变，仍是 /aggregate/:orderNo、/aggregate/unsupported、/aggregate/{env}/:orderNo
  {
    path: RoutePath.AGGREGATE_GROUP,
    name: 'Aggregate',
    component: Layout,
    // 父级声明 title，子路由（unsupported / 各环境页 / entry）由 vue-router 的 to.meta 合并自动继承
    meta: {
      title: 'route.cashier', // 收银台
    },
    children: [
      // 非宿主提示：静态 path 段
      {
        path: 'unsupported',
        name: 'AggregateUnsupportedPage',
        component: () => import('@/mobile/views/aggregate/Unsupported.vue'),
      },
      // 微信环境页
      {
        path: 'wechat/:orderNo',
        name: 'AggregateWechatPage',
        component: () => import('@/mobile/views/aggregate/wechat/index.vue'),
      },
      // 支付宝环境页
      {
        path: 'alipay/:orderNo',
        name: 'AggregateAlipayPage',
        component: () => import('@/mobile/views/aggregate/alipay/index.vue'),
      },
      // 云闪付环境页
      {
        path: 'union-pay/:orderNo',
        name: 'AggregateUnionPage',
        component: () => import('@/mobile/views/aggregate/union-pay/index.vue'),
      },
      // 抖音环境页
      {
        path: 'douyin/:orderNo',
        name: 'AggregateDouyinPage',
        component: () => import('@/mobile/views/aggregate/douyin/index.vue'),
      },
      // 入口：UA 探测后 replace 到环境页（静态段已注册完毕，:orderNo 兜底匹配订单号）
      {
        path: ':orderNo',
        name: 'AggregateEntry',
        component: () => import('@/mobile/views/aggregate/Entry.vue'),
      },
    ],
  },
  // 聚合小程序引导页（跨端：浏览器直接打开 /am/:orderNo 时展示扫码提示，不发起支付）
  {
    path: RoutePath.AGGREGATE_MINI,
    name: 'AggregateMiniGuide',
    component: () => import('@/mobile/views/aggregate-mini/index.vue'),
    meta: {
      title: 'route.cashier', // 收银台
    },
  },
  // 码牌小程序引导页（跨端：浏览器直接打开 /m/:code 时展示扫码提示，不发起支付）
  {
    path: RoutePath.CODE_PAY_MINI,
    name: 'CodePayMiniGuide',
    component: () => import('@/mobile/views/code-pay-mini/index.vue'),
    meta: {
      title: 'route.codePay', // 码牌支付
    },
  },
  // 码牌支付：入口 + 各宿主环境页 统一在 CodePay 父级下作为子路由
  // 让 App.vue 顶层 transition key（matched[0].name）在 entry → 环境页跳转时保持不变（都是 CodePay），
  // 避免整页 remount 与 Entry 的 onBeforeMount router.replace 竞争导致白屏
  // （曾发生在支付宝 webview：跨顶层 replace 与 <transition mode="out-in" appear> 的 enter 死锁，
  //   与聚合 Aggregate 同源 bug，修复范式见 commits da82489 / 8138d93）
  // 注意：静态段（wechat/alipay/union-pay/douyin）必须排在 :code 之前，否则会被当 code 吞掉
  // URL 契约不变，仍是 /h/:code、/h/{env}/:code
  {
    path: RoutePath.CODE_PAY_GROUP,
    name: 'CodePay',
    component: Layout,
    meta: {
      title: 'route.codePay', // 码牌支付
    },
    children: [
      // 微信环境页
      {
        path: 'wechat/:code',
        name: 'CodePayWechatPage',
        component: () => import('@/mobile/views/code-pay/wechat/index.vue'),
      },
      // 支付宝环境页
      {
        path: 'alipay/:code',
        name: 'CodePayAlipayPage',
        component: () => import('@/mobile/views/code-pay/alipay/index.vue'),
      },
      // 云闪付环境页
      {
        path: 'union-pay/:code',
        name: 'CodePayUnionPage',
        component: () => import('@/mobile/views/code-pay/union-pay/index.vue'),
      },
      // 抖音环境页
      {
        path: 'douyin/:code',
        name: 'CodePayDouyinPage',
        component: () => import('@/mobile/views/code-pay/douyin/index.vue'),
      },
      // 入口：UA 探测后 replace 到环境页（静态段已注册完毕，:code 兜底匹配编码）
      {
        path: ':code',
        name: 'CodePayEntry',
        component: () => import('@/mobile/views/code-pay/index.vue'),
      },
    ],
  },
  // 协议展示页（跨端：与 PC 端同 path 各指各 view，链接可独立分享）
  {
    path: RoutePath.PROTOCOL,
    name: 'Protocol',
    component: Layout,
    meta: {
      title: 'route.protocol', // 协议
    },
    children: [
      {
        path: '',
        name: 'ProtocolPage',
        component: () => import('@/mobile/views/protocol/index.vue'),
      },
    ],
  },
  // 支付宝认证落地页（移动独占：支付宝 OAuth 重定向回调）
  {
    path: RoutePath.AUTH_ALIPAY,
    name: 'AlipayAuth',
    component: () => import('@/mobile/views/auth/alipay/index.vue'),
    meta: {
      title: 'route.alipayAuth', // 支付宝认证
    },
  },
  // 支付宝代运营授权落地页（移动独占：授权回跳换 app_auth_token）
  {
    path: RoutePath.ISV_AUTH_ALIPAY,
    name: 'AlipayIsvAuth',
    component: () => import('@/mobile/views/isv-auth/alipay/index.vue'),
    meta: {
      title: 'route.alipayIsvAuth', // 支付宝代运营授权
    },
  },
  // 微信认证落地页（跨端：与 PC 端同 path 各指各 view，微信公众号 OAuth 重定向回调取 code）
  {
    path: RoutePath.AUTH_WECHAT,
    name: 'WechatAuth',
    component: () => import('@/mobile/views/auth/wechat/index.vue'),
    meta: {
      title: 'route.wechatAuth', // 微信认证
    },
  },
  // 抖音认证落地页（移动独占：抖音 silent_auth 重定向回调取 code）
  {
    path: RoutePath.AUTH_DOUYIN,
    name: 'DouyinAuth',
    component: () => import('@/mobile/views/auth/douyin/index.vue'),
    meta: {
      title: 'route.douyinAuth', // 抖音认证
    },
  },
  // 三方登录透传页（跨端：跳转型平台登录 OAuth 回调，查目标端回调地址后跳回对应 Web 端）
  {
    path: RoutePath.SOCIAL_LOGIN_TRANSIT,
    name: 'SocialLoginTransit',
    component: () => import('@/mobile/views/auth/social-transit/login.vue'),
    meta: {
      title: 'route.socialTransit', // 登录跳转
    },
  },
  // 三方绑定透传页（跨端：跳转型平台绑定 OAuth 回调，机制同登录透传页）
  {
    path: RoutePath.SOCIAL_BIND_TRANSIT,
    name: 'SocialBindTransit',
    component: () => import('@/mobile/views/auth/social-transit/bind.vue'),
    meta: {
      title: 'route.socialTransit', // 登录跳转
    },
  },
  // 公众号扫码绑定发起页（跨端：PC 二维码内容，手机微信扫码打开换授权地址跳微信）
  {
    path: RoutePath.SOCIAL_BIND_SCAN,
    name: 'SocialBindScan',
    component: () => import('@/mobile/views/auth/bind-scan/index.vue'),
    meta: {
      title: 'route.bindScan', // 账号绑定
    },
  },
  // 公众号扫码绑定回调页（跨端：微信授权重定向落地，凭 code+state 完成绑定）
  {
    path: RoutePath.SOCIAL_BIND_SCAN_CALLBACK,
    name: 'SocialBindScanResult',
    component: () => import('@/mobile/views/auth/bind-scan/result.vue'),
    meta: {
      title: 'route.bindScanResult', // 绑定结果
    },
  },
  // 公众号扫码登录发起页（跨端：PC 登录页二维码内容，手机微信扫码打开换授权地址跳微信）
  {
    path: RoutePath.SOCIAL_LOGIN_SCAN,
    name: 'SocialLoginScan',
    component: () => import('@/mobile/views/auth/login-scan/index.vue'),
    meta: {
      title: 'route.loginScan', // 微信扫码登录
    },
  },
  // 公众号扫码登录回调页（跨端：微信授权重定向落地，凭 code+state 完成登录）
  {
    path: RoutePath.SOCIAL_LOGIN_SCAN_CALLBACK,
    name: 'SocialLoginScanResult',
    component: () => import('@/mobile/views/auth/login-scan/result.vue'),
    meta: {
      title: 'route.loginScanResult', // 登录结果
    },
  },
  // 支付结果页（跨端：通道同步回跳落地页 + jsapi 终态统一入口）
  {
    path: RoutePath.PAY_RESULT,
    name: 'PayResult',
    component: () => import('@/mobile/views/pay-result/index.vue'),
    meta: {
      title: 'route.payResult', // 支付结果
    },
  },
  // 微信转账确认收款页（跨端：收款人在微信内打开拉起确认）
  {
    path: RoutePath.TRANSFER_CONFIRM,
    name: 'TransferConfirm',
    component: () => import('@/mobile/views/transfer/wechat/TransferConfirm.vue'),
    meta: {
      title: 'route.transferConfirm', // 转账确认收款
    },
  },
]

export default routeModuleList
