<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'MerchantStatement' })

const { t } = useI18n()

// 支付通道与状态用 code 表示，文案由 i18n 渲染
type ChannelCode = 'wechat' | 'alipay' | 'union'
type StatusCode = 'success' | 'fail' | 'pending'

interface Trade {
  time: string
  orderNo: string
  title: string
  amount: number
  channel: ChannelCode
  status: StatusCode
}

// 演示交易流水（mock）：仅用于演示，订单标题用中性英文占位，不参与 i18n 词条体系
const trades: Trade[] = [
  { time: '2026-06-24 10:23:11', orderNo: 'DEMO20260624102311001', title: 'Membership Subscription', amount: 99.00, channel: 'wechat', status: 'success' },
  { time: '2026-06-24 09:48:32', orderNo: 'DEMO20260624094832002', title: 'Product Order', amount: 158.50, channel: 'alipay', status: 'success' },
  { time: '2026-06-24 09:12:05', orderNo: 'DEMO20260624091205003', title: 'Virtual Goods', amount: 12.00, channel: 'wechat', status: 'pending' },
  { time: '2026-06-23 22:01:47', orderNo: 'DEMO20260623220147004', title: 'Service Fee', amount: 300.00, channel: 'union', status: 'success' },
  { time: '2026-06-23 18:34:20', orderNo: 'DEMO20260623183420005', title: 'Product Order', amount: 46.80, channel: 'alipay', status: 'fail' },
  { time: '2026-06-23 15:09:56', orderNo: 'DEMO20260623150956006', title: 'Membership Subscription', amount: 99.00, channel: 'wechat', status: 'success' },
  { time: '2026-06-23 11:42:13', orderNo: 'DEMO20260623114213007', title: 'Virtual Goods', amount: 6.00, channel: 'wechat', status: 'success' },
  { time: '2026-06-23 08:55:30', orderNo: 'DEMO20260623085530008', title: 'Product Order', amount: 218.00, channel: 'alipay', status: 'success' },
]

// 汇总
const summary = computed(() => {
  const success = trades.filter(trade => trade.status === 'success')
  const totalAmount = success.reduce((sum, trade) => sum + trade.amount, 0)
  const successRate = trades.length ? (success.length / trades.length) * 100 : 0
  return {
    totalAmount: totalAmount.toFixed(2),
    count: trades.length,
    successRate: successRate.toFixed(1),
    // 成功率 >=95% 用成功绿，否则用警告橙
    rateHealthy: successRate >= 95,
  }
})

// 状态文案
function statusText(status: StatusCode) {
  return t(`statement.status.${status}`)
}

// 通道文案
function channelText(channel: ChannelCode) {
  return t(`statement.channel.${channel}`)
}

// 状态对应样式类
function statusClass(status: StatusCode) {
  return { success: 'is-success', fail: 'is-fail', pending: 'is-pending' }[status]
}
</script>

<template>
  <div class="statement">
    <h1 class="statement__heading">
      <span class="statement__heading-bar" />
      {{ t('statement.heading') }}
    </h1>

    <!-- 汇总卡片：分色 + 图标 + 左侧色条 -->
    <div class="statement__summary">
      <!-- 交易总额：主色调 -->
      <div class="statement__summary-card statement__summary-card--primary">
        <span class="statement__summary-bar statement__summary-bar--primary" />
        <div class="statement__summary-head">
          <span class="statement__summary-icon statement__summary-icon--primary">
            <!-- 钱包图标 -->
            <svg viewBox="0 0 1024 1024" width="22" height="22" aria-hidden="true">
              <path fill="currentColor" d="M832 64 192 64C121.3 64 64 121.3 64 192l0 640c0 70.7 57.3 128 128 128l640 0c70.7 0 128-57.3 128-128L960 192C960 121.3 902.7 64 832 64zM192 128l640 0c35.4 0 64 28.6 64 64L192 192C156.6 192 128 163.4 128 128 128 92.6 156.6 128 192 128zM896 832c0 35.4-28.6 64-64 64L192 896c-35.4 0-64-28.6-64-64L128 244.2C148.4 252.6 170.6 256 192 256l704 0c35.4 0 64 28.6 64 64L960 832zM704 544c-35.4 0-64-28.6-64-64s28.6-64 64-64 64 28.6 64 64S739.4 544 704 544z" />
            </svg>
          </span>
          <span class="statement__summary-label">{{ t('statement.totalAmountSuccess') }}</span>
        </div>
        <span class="statement__summary-value statement__summary-value--primary">￥{{ summary.totalAmount }}</span>
      </div>

      <!-- 交易笔数：中性色 -->
      <div class="statement__summary-card statement__summary-card--neutral">
        <span class="statement__summary-bar statement__summary-bar--neutral" />
        <div class="statement__summary-head">
          <span class="statement__summary-icon statement__summary-icon--neutral">
            <!-- 订单列表图标 -->
            <svg viewBox="0 0 1024 1024" width="22" height="22" aria-hidden="true">
              <path fill="currentColor" d="M832 128 192 128c-35.2 0-64 28.8-64 64l0 640c0 35.2 28.8 64 64 64l640 0c35.2 0 64-28.8 64-64L896 192C896 156.8 867.2 128 832 128zM832 832 192 832 192 192l640 0L832 832zM320 416l384 0c17.6 0 32-14.4 32-32s-14.4-32-32-32L320 352c-17.6 0-32 14.4-32 32S302.4 416 320 416zM320 544l384 0c17.6 0 32-14.4 32-32s-14.4-32-32-32L320 480c-17.6 0-32 14.4-32 32S302.4 544 320 544zM320 672l256 0c17.6 0 32-14.4 32-32s-14.4-32-32-32L320 608c-17.6 0-32 14.4-32 32S302.4 672 320 672z" />
            </svg>
          </span>
          <span class="statement__summary-label">{{ t('statement.tradeCount') }}</span>
        </div>
        <span class="statement__summary-value">{{ summary.count }}</span>
      </div>

      <!-- 成功率：达标用绿，未达标用橙 -->
      <div class="statement__summary-card" :class="summary.rateHealthy ? 'statement__summary-card--success' : 'statement__summary-card--warning'">
        <span class="statement__summary-bar" :class="summary.rateHealthy ? 'statement__summary-bar--success' : 'statement__summary-bar--warning'" />
        <div class="statement__summary-head">
          <span class="statement__summary-icon" :class="summary.rateHealthy ? 'statement__summary-icon--success' : 'statement__summary-icon--warning'">
            <!-- 趋势上升图标 -->
            <svg viewBox="0 0 1024 1024" width="22" height="22" aria-hidden="true">
              <path fill="currentColor" d="M832 192 640 192c-17.6 0-32 14.4-32 32s14.4 32 32 32l115.2 0L512 499.2 379.2 366.4c-12.8-12.8-32-12.8-44.8 0L160 540.8c-12.8 12.8-12.8 32 0 44.8 6.4 6.4 14.4 9.6 22.4 9.6s16-3.2 22.4-9.6l152-152 132.8 132.8c12.8 12.8 32 12.8 44.8 0L832 268.8 832 384c0 17.6 14.4 32 32 32s32-14.4 32-32L896 224C896 206.4 881.6 192 864 192L832 192zM864 768 160 768c-17.6 0-32 14.4-32 32s14.4 32 32 32l704 0c17.6 0 32-14.4 32-32S881.6 768 864 768z" />
            </svg>
          </span>
          <span class="statement__summary-label">{{ t('statement.successRate') }}</span>
        </div>
        <span class="statement__summary-value" :class="summary.rateHealthy ? 'statement__summary-value--success' : 'statement__summary-value--warning'">{{ summary.successRate }}%</span>
      </div>
    </div>

    <!-- 流水表格 -->
    <div v-if="trades.length" class="statement__table-wrap">
      <table class="statement__table">
        <thead>
          <tr>
            <th>{{ t('statement.column.time') }}</th>
            <th>{{ t('statement.column.orderNo') }}</th>
            <th>{{ t('statement.column.title') }}</th>
            <th class="statement__th-amount">
              {{ t('statement.column.amount') }}
            </th>
            <th>{{ t('statement.column.channel') }}</th>
            <th>{{ t('statement.column.status') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="trade in trades" :key="trade.orderNo">
            <td>{{ trade.time }}</td>
            <td class="statement__mono">
              {{ trade.orderNo }}
            </td>
            <td>{{ trade.title }}</td>
            <td class="statement__amount">
              ￥{{ trade.amount.toFixed(2) }}
            </td>
            <td>{{ channelText(trade.channel) }}</td>
            <td>
              <span class="statement__status" :class="statusClass(trade.status)">
                <i class="statement__status-dot" />
                {{ statusText(trade.status) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 空状态 -->
    <div v-else class="statement__empty">
      <span class="statement__empty-text">{{ t('statement.empty') }}</span>
    </div>
  </div>
</template>

<style scoped>
/* PC 端对账单：scoped 原生 px + 媒体查询，不使用 UnoCSS 的 px 原子类 */
.statement {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px;
  box-sizing: border-box;
  /* 页面加浅色背景，让白色卡片浮起来 */
  min-height: 100vh;
  background: var(--h5-bg-page);
}

.statement__heading {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 24px;
  font-weight: 700;
  color: var(--h5-text-primary);
  margin: 0 0 24px;
}

/* 标题左侧主色调装饰竖条，增强视觉锚点 */
.statement__heading-bar {
  display: inline-block;
  width: 4px;
  height: 22px;
  background: #5d9dfe;
  border-radius: 2px;
}

.statement__summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.statement__summary-card {
  position: relative;
  background: var(--h5-bg-card);
  border-radius: 8px;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid #ebedf0;
  overflow: hidden;
}

/* 汇总卡左侧色条（绝对定位贴左） */
.statement__summary-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
}

.statement__summary-bar--primary {
  background: #5d9dfe;
}

.statement__summary-bar--neutral {
  background: #86909c;
}

.statement__summary-bar--success {
  background: #00b42a;
}

.statement__summary-bar--warning {
  background: #ff7d00;
}

.statement__summary-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.statement__summary-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  flex-shrink: 0;
}

.statement__summary-icon--primary {
  color: #5d9dfe;
  background: var(--h5-bg-brand-soft);
}

.statement__summary-icon--neutral {
  color: var(--h5-text-secondary);
  background: var(--h5-bg-muted);
}

.statement__summary-icon--success {
  color: #00b42a;
  background: #e8ffea;
}

.statement__summary-icon--warning {
  color: #ff7d00;
  background: var(--h5-bg-warning);
}

.statement__summary-label {
  font-size: 13px;
  color: var(--h5-text-secondary);
}

.statement__summary-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--h5-text-primary);
}

.statement__summary-value--primary {
  color: #5d9dfe;
}

.statement__summary-value--success {
  color: #00b42a;
}

.statement__summary-value--warning {
  color: #ff7d00;
}

.statement__table-wrap {
  background: var(--h5-bg-card);
  border-radius: 8px;
  overflow-x: auto;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid #ebedf0;
}

.statement__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.statement__table thead th {
  text-align: left;
  padding: 14px 16px;
  color: var(--h5-text-secondary);
  font-weight: 500;
  /* 表头底色加深为主色调浅色，与主色呼应 */
  background: var(--h5-bg-page);
  border-bottom: 1px solid var(--h5-border);
  white-space: nowrap;
}

/* 金额列表头右对齐 */
.statement__th-amount {
  text-align: right;
}

.statement__table tbody td {
  padding: 14px 16px;
  color: var(--h5-text-primary);
  border-bottom: 1px solid #f2f3f5;
}

.statement__table tbody tr:last-child td {
  border-bottom: none;
}

/* 行 hover 改为主色调浅色 */
.statement__table tbody tr:hover {
  background: var(--h5-bg-brand-soft);
}

.statement__mono {
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 13px;
}

.statement__amount {
  /* 金额列右对齐，符合财务表格规范 */
  text-align: right;
  font-weight: 600;
}

.statement__status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.6;
}

/* 状态前的圆点指示器 */
.statement__status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.statement__status.is-success {
  color: #00b42a;
  background: #e8ffea;
}

.statement__status.is-success .statement__status-dot {
  background: #00b42a;
}

.statement__status.is-fail {
  color: #f53f3f;
  background: #ffece8;
}

.statement__status.is-fail .statement__status-dot {
  background: #f53f3f;
}

.statement__status.is-pending {
  color: #ff7d00;
  background: var(--h5-bg-warning);
}

.statement__status.is-pending .statement__status-dot {
  background: #ff7d00;
}

/* 空状态 */
.statement__empty {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 64px 0;
}

.statement__empty-text {
  font-size: 14px;
  color: var(--h5-text-secondary);
}

@media (max-width: 768px) {
  .statement {
    padding: 16px;
  }

  .statement__summary {
    grid-template-columns: 1fr;
  }
}
</style>
