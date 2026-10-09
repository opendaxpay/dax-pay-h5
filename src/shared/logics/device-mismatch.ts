import type { RouteRecordName } from 'vue-router'
import { showConfirmDialog } from 'vant'
import { t } from '@/shared/locales'
import { isExclusiveRouteName } from '@/shared/router/exclusive'

// 函数式 Dialog 不经模板编译，按需引入（VantResolver 只处理模板组件）下需手动补样式；
// 移动端入口虽已引入会自然去重，PC 端入口未引，故在此统一兜底
import 'vant/es/dialog/style'

/** sessionStorage 键：本会话内用户已选择「保持当前」，不再重复提醒 */
const DISMISS_KEY = 'device-mismatch-dismissed'

/** catch-all 404 路由名（两端的兜底路由；未知路径切换设备后大概率仍是 404，不弹） */
const CATCH_ALL_ROUTE_NAMES = new Set(['ErrorPage', 'ErrorPageSon', 'PcNotFound'])

/**
 * 检测页面形态与终端 UA 是否不匹配，不匹配时弹窗提醒切换
 *
 * 触发条件：URL 显式携带 device 参数且与 UA 原生探测结果（window.__UA_DEVICE__）不一致；
 * 入口脚本会把生效形态回写进 URL，常态（无覆盖参数）下二者天然一致不会触发。
 * 每会话最多打扰一次，用户取消后本会话内不再提醒。
 *
 * 弹窗按「切换后有真实页面可去」限定（routeName 为当前首屏路由名，由两端 App.vue 传入）：
 * - 独占页真实版（name 命中独占注册表）：错误终端+强制参数才会把独占页开在所属端，
 *   切到 UA 端只会得到 DeviceOnly 存根死胡同（OAuth 回调类页面的 code 还是一次性的），不弹；
 * - 未知路径（catch-all 404）：切过去大概率仍是 404，不弹；
 * - 存根页（名称带 __stub 后缀，不在注册表精确匹配内）与跨端真实页：切过去有真实页面，保留弹窗。
 */
export function checkDeviceMismatch(routeName?: RouteRecordName) {
  const device = new URLSearchParams(window.location.search).get('device')
  // 参数缺失或非法（非 pc/mobile）时无法区分用户意图与误传，不打扰
  if (device !== 'pc' && device !== 'mobile') {
    return
  }
  // 与 UA 原生探测结果一致，无需提醒
  if (device === window.__UA_DEVICE__) {
    return
  }
  // 本会话已选择「保持当前」，不再提醒
  if (sessionStorage.getItem(DISMISS_KEY) === '1') {
    return
  }
  // 独占页真实版：切到 UA 端只有提示存根，弹切换窗只会把用户带进死胡同
  if (isExclusiveRouteName(routeName)) {
    return
  }
  // 未知路径（catch-all 404）：切换无意义
  if (typeof routeName === 'string' && CATCH_ALL_ROUTE_NAMES.has(routeName)) {
    return
  }

  const isPCPage = device === 'pc'
  showConfirmDialog({
    // 切换页面版本
    title: t('common.device.switchTitle'),
    // PC 版页面提示切移动版 / 移动版页面提示切 PC 版
    message: isPCPage ? t('common.device.switchToMobile') : t('common.device.switchToPc'),
    // 切换
    confirmButtonText: t('common.device.switchAction'),
    // 保持当前
    cancelButtonText: t('common.device.keepCurrent'),
  })
    .then(() => {
      // 确认切换：把 device 改为 UA 原生结果后整页刷新，入口脚本按新参数重挂载另一端 App
      // 不记 sessionStorage：刷新后参数已与 UA 一致天然不再触发，且便于测试者反复验证
      const url = new URL(window.location.href)
      url.searchParams.set('device', window.__UA_DEVICE__)
      window.location.replace(url.href)
    })
    .catch(() => {
      // 取消：记住用户选择，本会话不再提醒（新开会话/新标签页会重新检测）
      sessionStorage.setItem(DISMISS_KEY, '1')
    })
}
