<script lang="ts" setup>
import type { UserProtocolContentResult } from '@/shared/api/types'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { findDefaultProtocol, resolveProtocolCode } from '@/shared/api/protocol'
import BeianFooter from '@/shared/components/BeianFooter.vue'
import { useDesignSetting } from '@/shared/hooks/setting/useDesignSetting'
import { getLogoUrl, getSystemName, hasBeianFooterContent, websiteConfig } from '@/shared/logics/init-website-config'
import { formatDate } from '@/shared/utils/datetime'

defineOptions({ name: 'PcProtocolPage' })

const { t } = useI18n()
const route = useRoute()
const { getDarkMode } = useDesignSetting()

const loading = ref(true)
// 协议内容
const protocol = ref<UserProtocolContentResult | null>(null)
// 错误信息
const errorMsg = ref('')

const title = computed(() => protocol.value?.title || t('protocol.title'))
const html = computed(() => protocol.value?.contentHtml || '')

// 站点 logo(平台配置优先, 默认 public/logo.svg; 深色优先 logoDark)
const logoUrl = computed(() => {
  void websiteConfig.value
  // 依赖深色模式, 切换系统主题时刷新 logoDark
  void getDarkMode.value
  return getLogoUrl()
})

// 系统名(平台配置, 空回退 DaxPay)
const systemName = computed(() => {
  void websiteConfig.value
  return getSystemName() || 'DaxPay'
})

// 页脚显隐: 备案配置全空时整条页脚不渲染(避免只剩一条空发丝线)
const showFooter = computed(() => {
  void websiteConfig.value
  return hasBeianFooterContent()
})

// 协议标题加载完成后同步浏览器标签页标题(路由 meta 只有静态「协议」兜底)
watch(title, (value) => {
  document.title = value
})

/** 加载默认协议内容 */
async function load() {
  const raw = route.params.protocolType as string
  const code = resolveProtocolCode(raw)
  if (!code) {
    errorMsg.value = t('protocol.typeNotExist')
    loading.value = false
    return
  }
  try {
    protocol.value = await findDefaultProtocol(code)
  }
  catch (e) {
    errorMsg.value = e instanceof Error ? e.message : t('protocol.loadFailed')
  }
  finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="pc-protocol">
    <!-- 内容列: 短内容时页脚贴视口底(flex 撑满), 长内容时页脚随文末 -->
    <div class="pc-protocol__layout">
      <!-- 站点品牌栏: 左上角 logo + 系统名, 点击回首页 -->
      <header class="pc-protocol__header">
        <div class="pc-protocol__header-inner">
          <RouterLink class="pc-protocol__brand" to="/" :aria-label="t('common.backHome')">
            <img class="pc-protocol__brand-logo" :src="logoUrl" :alt="systemName">
            <span class="pc-protocol__brand-name">{{ systemName }}</span>
          </RouterLink>
        </div>
      </header>

      <main class="pc-protocol__main">
        <!-- 加载中 -->
        <div v-if="loading" class="pc-protocol__status">
          {{ t('common.loading') }}
        </div>

        <!-- 错误 -->
        <div v-else-if="errorMsg" class="pc-protocol__status">
          {{ errorMsg }}
        </div>

        <!-- 正文 -->
        <article v-else-if="html" class="pc-protocol__article">
          <h1 class="pc-protocol__title">
            {{ protocol?.title }}
          </h1>
          <div class="pc-protocol__meta">
            <span v-if="protocol?.versionLabel">{{ t('protocol.version', { version: protocol.versionLabel }) }}</span>
            <span v-if="protocol?.effectiveTime">{{ t('protocol.effectiveTime', { time: formatDate(protocol.effectiveTime) }) }}</span>
          </div>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="pc-protocol__content" v-html="html" />
        </article>

        <!-- 无内容 -->
        <div v-else class="pc-protocol__status">
          {{ t('protocol.noContent') }}
        </div>
      </main>

      <!-- 平台备案信息(版权 + ICP + 公网安, 配置为空不渲染): 页面级页脚 -->
      <footer v-if="showFooter" class="pc-protocol__footer">
        <BeianFooter class="pc-protocol__beian" />
      </footer>
    </div>
  </div>
</template>

<style scoped lang="less">
// PC 端: 严格使用 scoped 原生 px + 媒体查询, 禁用 UnoCSS 长度原子类
// 全局 body/html 锁滚(common.less), 长文由本容器内滚
.pc-protocol {
  height: 100vh;
  overflow-y: auto;
  background: var(--h5-bg-page);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.pc-protocol__layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* ---------- 品牌栏(站点 chrome): 内容从栏下滚过, 遮在栏后 ---------- */
.pc-protocol__header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--h5-bg-page);
  border-bottom: 1px solid var(--h5-border);
}

/* 与正文栏同宽同 padding, 品牌与卡片左缘对齐 */
.pc-protocol__header-inner {
  display: flex;
  align-items: center;
  max-width: 884px;
  height: 60px;
  margin: 0 auto;
  padding: 0 32px;
  box-sizing: border-box;
}

.pc-protocol__brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--h5-text-primary);
  text-decoration: none;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.8;
  }
}

.pc-protocol__brand-logo {
  width: 30px;
  height: 30px;
}

.pc-protocol__brand-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--h5-text-primary);
}

/* ---------- 正文文档栏(窄栏阅读容器) ---------- */
.pc-protocol__main {
  flex: 1;
  width: 100%;
  max-width: 884px;
  margin: 0 auto;
  padding: 32px;
  box-sizing: border-box;
}

.pc-protocol__article {
  background: var(--h5-bg-card);
  border-radius: 8px;
  padding: 48px 56px;
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.04);
}

.pc-protocol__status {
  background: var(--h5-bg-card);
  border-radius: 8px;
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.04);
  text-align: center;
  color: var(--h5-text-secondary);
  padding: 80px 0;
  font-size: 14px;
}

/* ---------- 页面级页脚: 全宽贴底, 与品牌栏对称的站点 chrome ---------- */
.pc-protocol__footer {
  padding: 20px 32px 24px;
  border-top: 1px solid var(--h5-border);
}

/* 备案栏 PC 规格覆写: 组件基础样式面向交易页(12px), 此处提一档可读性 */
.pc-protocol__footer :deep(.beian-footer) {
  font-size: 13px;
  gap: 6px;
}

.pc-protocol__footer :deep(.beian-footer__filing-icon) {
  width: 16px;
  height: 16px;
}

/* 文档头: 左对齐(协议标题 + 版本/生效时间) */
.pc-protocol__title {
  margin: 0 0 12px;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.35;
  color: var(--h5-text-primary);
}

.pc-protocol__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--h5-border);
  font-size: 13px;
  color: var(--h5-text-secondary);
}

// v-html 内容样式穿透
:deep(.pc-protocol__content) {
  font-size: 15px;
  line-height: 1.85;
  color: var(--h5-text-primary);
  word-break: break-word;

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin: 28px 0 14px;
    font-weight: 600;
    color: var(--h5-text-primary);
  }

  h1 {
    font-size: 22px;
  }
  h2 {
    font-size: 20px;
  }
  h3 {
    font-size: 18px;
  }
  h4 {
    font-size: 16px;
  }

  p {
    margin: 14px 0;
  }

  ul,
  ol {
    margin: 14px 0;
    padding-left: 24px;
  }

  li {
    margin: 6px 0;
  }

  blockquote {
    margin: 16px 0;
    padding: 12px 16px;
    border-left: 4px solid #5d9dfe;
    background: var(--h5-bg-muted);
    color: var(--h5-text-secondary);
  }

  table {
    width: 100%;
    margin: 16px 0;
    border-collapse: collapse;

    th,
    td {
      border: 1px solid var(--h5-border);
      padding: 10px 12px;
    }

    th {
      background: var(--h5-bg-muted);
    }
  }

  pre {
    margin: 16px 0;
    padding: 14px 16px;
    background: var(--h5-bg-muted);
    border-radius: 6px;
    overflow-x: auto;
    font-size: 13px;
    line-height: 1.6;
  }

  code {
    background: var(--h5-bg-muted);
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 13px;
  }

  img {
    max-width: 100%;
  }

  a {
    color: #5d9dfe;
  }
}

// 响应式: 窄屏收缩内边距(品牌栏/正文栏/页脚保持同 padding 对齐)
@media (max-width: 768px) {
  .pc-protocol__header-inner {
    height: 52px;
    padding: 0 12px;
  }

  .pc-protocol__main {
    padding: 16px 12px;
  }

  .pc-protocol__article {
    padding: 24px 20px;
  }

  .pc-protocol__footer {
    padding: 16px 12px 20px;
  }
}
</style>
