/**
 * 业务路由 path 常量
 *
 * 两端路由（mobile/pc）注册路由时必须从此引用，杜绝 path 字面量漂移。
 * 跨端页（两端都实现）尤其关键：必须用同一常量保证 path 形态完全一致。
 *
 * 注意：本常量仅用于路由注册（route record 的 path 字段）。
 * 导航时请用 router.push({ name, params })，不要手工拼接 path 字符串。
 *
 * 新增业务页示例（按需取消注释并配合对应 view）：
 *   跨端页（如收银台）：  CASHIER: '/cashier/:id',
 *   PC 独占（如商户后台）：MERCHANT_DASHBOARD: '/merchant/dashboard',
 *   移动独占（如微信绑定）：WECHAT_BIND: '/wechat/bind',
 */
export const RoutePath = {
  /** 首页（跨端） */
  HOME: '/',
  /**
   * 收银台入口（跨端；预下单落地 URL 契约，不可改）
   * Mobile：UA 探测后 replace 到 CASHIER_ENV
   * PC：直接 WEB 收银页
   */
  CASHIER: '/cashier/:orderNo',
  /**
   * 收银台环境页（Mobile H5；clientEnv=browser|wechat|alipay|union_pay|douyin）
   * 与运营端 H5 配置分桶一一对应；OAuth returnPath 指向此路径
   * PC 端注册同 path 常量兜底复用 WEB 收银页（忽略 clientEnv 段），防分享链接 404
   */
  CASHIER_ENV: '/cashier/:orderNo/:clientEnv',
  /**
   * 收银台小程序入口（跨端；cashier 预下单返回的 miniUrl 契约）
   * 微信/支付宝扫码后由「普通链接二维码」规则拉起收银台小程序;
   * 浏览器直接打开时展示扫码引导提示（不发起支付）
   */
  CASHIER_MINI: '/cm/:orderNo',
  /**
   * 聚合扫码入口（跨端；预下单落地 URL 契约，不可改）
   * Mobile：UA 探测后 replace 到环境页；PC：单页处理
   */
  AGGREGATE: '/aggregate/:orderNo',
  /**
   * 聚合扫码父级分组（仅 Mobile 路由注册用）
   * Mobile 把入口 + 非宿主提示 + 各宿主环境页（wechat/alipay/union-pay/douyin）全部
   * 合并到此父级下作为子路由，让 App.vue 顶层 transition key（matched[0].name）在
   * entry → 环境页跳转时保持不变（都是 Aggregate），避免整页 remount 与 Entry.vue 的
   * onBeforeMount router.replace 竞争导致白屏（曾发生在支付宝 webview）。
   * URL 契约不变：/aggregate/:orderNo、/aggregate/unsupported、/aggregate/{env}/:orderNo。
   * PC 仍用 AGGREGATE（/aggregate/:orderNo）作为单层路由。
   */
  AGGREGATE_GROUP: '/aggregate',
  /** 聚合-不支持的宿主环境提示（Mobile + PC 注册用） */
  AGGREGATE_UNSUPPORTED: '/aggregate/unsupported',
  /**
   * 聚合各宿主环境页路径（移动端 entry 探测 replace 的内部落点, URL 契约 /aggregate/{env}/:orderNo）
   * 移动端以相对子路由挂在 AGGREGATE_GROUP 下实现; PC 端注册同 path 常量兜底复用 PC 聚合页,
   * 防止移动端 replace 后的地址被分享到 PC 打开时落 404
   */
  AGGREGATE_ENV_WECHAT: '/aggregate/wechat/:orderNo',
  /** 聚合-支付宝环境页路径（同 AGGREGATE_ENV_WECHAT） */
  AGGREGATE_ENV_ALIPAY: '/aggregate/alipay/:orderNo',
  /** 聚合-云闪付环境页路径（同 AGGREGATE_ENV_WECHAT） */
  AGGREGATE_ENV_UNION: '/aggregate/union-pay/:orderNo',
  /** 聚合-抖音环境页路径（同 AGGREGATE_ENV_WECHAT） */
  AGGREGATE_ENV_DOUYIN: '/aggregate/douyin/:orderNo',
  /**
   * 聚合小程序入口（跨端；预下单同时返回的 miniUrl 落地 URL 契约）
   * 微信/支付宝扫码后由「普通链接二维码」规则拉起各自小程序;
   * 浏览器直接打开时展示扫码引导提示（不发起支付）
   */
  AGGREGATE_MINI: '/am/:orderNo',
  /**
   * 码牌支付父级分组（仅 Mobile 路由注册用）
   * Mobile 把入口 + 各宿主环境页（wechat/alipay/union-pay/douyin）全部合并到此父级下作为
   * 子路由，让 App.vue 顶层 transition key（matched[0].name）在 entry → 环境页跳转时保持不变
   * （都是 CodePay），避免整页 remount 与 Entry 的 onBeforeMount router.replace 竞争导致白屏
   * （曾发生在支付宝 webview：跨顶层 replace 与 <transition mode="out-in" appear> 的 enter 死锁）。
   * URL 契约不变：/h/{code}、/h/{env}/{code}。
   * PC 仍用各 CODE_PAY_*（/h/:code、/h/wechat/:code 等）作为单层顶层路由。
   */
  CODE_PAY_GROUP: '/h',
  /** 码牌支付入口（跨端：Mobile 分发/收款，PC 扫码引导；path 与后端 getCodeLink /h/{code} 一致） */
  CODE_PAY: '/h/:code',
  /** 码牌支付-微信端（Mobile 收款；PC 同入口扫码引导） */
  CODE_PAY_WECHAT: '/h/wechat/:code',
  /** 码牌支付-支付宝端（Mobile 收款；PC 同入口扫码引导） */
  CODE_PAY_ALIPAY: '/h/alipay/:code',
  /** 码牌支付-云闪付端（Mobile 收款；PC 同入口扫码引导） */
  CODE_PAY_UNION: '/h/union-pay/:code',
  /** 码牌支付-抖音端（Mobile 收款；PC 同入口扫码引导） */
  CODE_PAY_DOUYIN: '/h/douyin/:code',
  /**
   * 码牌小程序入口（跨端；programType=mini_app 码牌落地 URL 契约）
   * 微信/支付宝扫码后由「普通链接二维码」规则拉起小程序（dax-pay-cashier）;
   * H5/PC 浏览器直接打开时展示扫码引导（不发起支付）。path 与后端 CODE_MINI_PATH /m/{code} 一致
   */
  CODE_PAY_MINI: '/m/:code',
  /** 商户对账单（PC 独占） */
  MERCHANT_STATEMENT: '/merchant/statement',
  /** 协议展示页（跨端：用户协议/隐私政策，链接可独立分享） */
  PROTOCOL: '/protocol/:protocolType',
  /** 支付宝认证落地页（移动独占：OAuth 重定向回调，authToken 通过 state 查询参数传递） */
  AUTH_ALIPAY: '/auth/alipay',
  /** 支付宝代运营授权落地页（移动独占：支付宝授权回跳换 app_auth_token） */
  ISV_AUTH_ALIPAY: '/isv-auth/alipay',
  /** 微信认证落地页（跨端：公众号 OAuth 重定向回调，PC 微信内置浏览器也可访问，authToken 通过 state 查询参数传递） */
  AUTH_WECHAT: '/auth/wechat',
  /** 抖音认证落地页（移动独占：抖音 silent_auth 重定向回调，authToken 通过 state 查询参数传递） */
  AUTH_DOUYIN: '/auth/douyin',
  /**
   * 三方登录透传页（跨端：跳转型平台登录 OAuth 回调）
   * 跳转型平台(支付宝/公众号)登录回调统一落网关域名此路径, 凭 client+source
   * 查询目标端回调地址后原样透传 query 跳回对应 Web 端, 路径与后端透传契约一致
   */
  SOCIAL_LOGIN_TRANSIT: '/auth/oauth-callback/:client/:source',
  /**
   * 三方绑定透传页（跨端：跳转型平台绑定 OAuth 回调, 机制同登录透传页）
   */
  SOCIAL_BIND_TRANSIT: '/auth/social-bind-callback/:client/:source',
  /**
   * 公众号扫码绑定发起页（跨端：PC 生成的二维码内容, 手机微信扫码打开）
   * 公众号网页授权仅微信客户端内可完成, PC 端发起绑定改走扫码跨设备流程,
   * 本页凭票据换授权地址后跳转微信, 与后端 SCAN_BIND_PAGE_PATH 契约一致
   */
  SOCIAL_BIND_SCAN: '/social/bind-scan',
  /**
   * 公众号扫码绑定回调页（跨端：微信授权重定向落地, 凭 code+state 完成绑定）
   * 与后端扫码绑定回调路径契约一致({paymentGatewayBaseUrl}/social/bind-scan-callback/{source})
   */
  SOCIAL_BIND_SCAN_CALLBACK: '/social/bind-scan-callback/:source',
  /**
   * 公众号扫码登录发起页（跨端：PC 登录页二维码内容, 手机微信扫码打开）
   * PC 登录页公众号无法直接跳转授权, 改走扫码跨设备流程,
   * 本页凭票据换授权地址后跳转微信, 与后端 SCAN_LOGIN_PAGE_PATH 契约一致
   */
  SOCIAL_LOGIN_SCAN: '/social/login-scan',
  /**
   * 公众号扫码登录回调页（跨端：微信授权重定向落地, 凭 code+state 完成登录）
   * 与后端扫码登录回调路径契约一致({paymentGatewayBaseUrl}/social/login-scan-callback/{source})
   */
  SOCIAL_LOGIN_SCAN_CALLBACK: '/social/login-scan-callback/:source',
  /**
   * 支付结果页（跨端；通道同步回跳落地页 + jsapi 终态统一入口）
   * 通道 returnUrl 设为此地址: {paymentGatewayBaseUrl}/pay-result/{tradeNo}
   * 支付完成后凭 tradeNo 查订单状态, 有商户 returnUrl 则带签名跳转, 无则展示结果结束页
   */
  PAY_RESULT: '/pay-result/:tradeNo',
  /**
   * 微信转账确认收款页（跨端；后端发起转账返回的 confirmUrl 落地契约）
   * 收款人在微信内打开: {paymentGatewayBaseUrl}/transfer-confirm/{transferNo}
   * 调 WeixinJSBridge.invoke('requestMerchantTransfer') 拉起微信官方收款确认页
   */
  TRANSFER_CONFIRM: '/transfer-confirm/:transferNo',
} as const
