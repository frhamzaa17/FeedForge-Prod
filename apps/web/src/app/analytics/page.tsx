'use client'

import { useEffect, useState } from 'react'
import type { AnalyticsSnapshot, MetricKey } from '@zpf/shared'
import { api } from '@/lib/api'
import { compactNumber, freshnessLabel, platformCode, platformLabel, statusLabel } from '@/lib/format'

const metrics: MetricKey[] = ['reach', 'impressions', 'views', 'likes', 'comments', 'shares', 'saves', 'clicks', 'engagementRate']
const metricLabels: Record<MetricKey, string> = {
  reach: 'Reach',
  impressions: 'Impressions',
  views: 'Views',
  likes: 'Likes',
  comments: 'Comments',
  shares: 'Shares',
  saves: 'Saves',
  clicks: 'Clicks',
  engagementRate: 'Engagement Rate',
}
const denominatorLabels = {
  reach: 'Reach',
  impressions: 'Impressions',
  followers: 'Followers',
} as const
const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const hourLabels = ['12a', '6a', '12p', '6p', '11p']

export default function AnalyticsPage() {
  const [metric, setMetric] = useState<MetricKey>('reach')
  const [denominator, setDenominator] = useState<'reach' | 'impressions' | 'followers'>('reach')
  const [analytics, setAnalytics] = useState<AnalyticsSnapshot>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setError('')
    void api.analytics(new URLSearchParams({ metric, denominator }).toString())
      .then(setAnalytics)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Could not load analytics'))
      .finally(() => setLoading(false))
  }, [metric, denominator])

  return (
    <div className="content">
      <div className="page-heading"><div><p className="eyebrow">Analytics intelligence</p><h1>Compare what matters.</h1><p>Every ranking labels the selected metric and denominator.</p></div></div>
      {loading ? <div className="success-message">Loading live workspace analytics...</div> : null}
      {error ? <div className="error-message">{error}</div> : null}
      <div className="analytics-controls">
        <label>Metric<select value={metric} onChange={(event) => setMetric(event.target.value as MetricKey)}>{metrics.map((item) => <option key={item} value={item}>{metricLabels[item]}</option>)}</select></label>
        <label>Denominator<select value={denominator} onChange={(event) => setDenominator(event.target.value as typeof denominator)}>{Object.entries(denominatorLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      <section className="analytics-layout">
        <article className="panel">
          <div className="panel-heading"><div><p className="eyebrow">Connected accounts</p><h2>Live channel summary</h2></div></div>
          <div className="data-table">
            {analytics && analytics.accountSummary.length === 0 ? <div className="empty-state">No connected accounts yet. Connect a channel from Settings to populate analytics.</div> : null}
            {analytics?.accountSummary.map((account) => (
              <div className="analytics-row account-summary-row" key={account.accountId}>
                <b>{platformLabel(account.platform).slice(0, 2).toUpperCase()}</b>
                <span><strong>{account.displayName}</strong><small>{account.username} | {account.healthMessage}</small></span>
                <em>{account.status}</em>
                <strong>{compactNumber(account.reach)} reach<br /><small>{compactNumber(account.audience)} audience | {freshnessLabel(account.lastSyncAt)}</small></strong>
              </div>
            ))}
          </div>
        </article>
        <article className="panel">
          <div className="panel-heading"><div><p className="eyebrow">Best performers</p><h2>{metricLabels[metric]} / {denominatorLabels[denominator]}</h2></div></div>
          <div className="data-table">
            {analytics && analytics.ranked.length === 0 ? <div className="empty-state">No real post-level analytics yet. Once content is published and synced, rankings will appear here.</div> : null}
            {analytics && analytics.ranked.length === 0 && analytics.accountSummary.length > 0 ? (
              <div className="channel-rank-list">
                {analytics.accountSummary
                  .map((account) => ({ ...account, value: accountMetricValue(account, metric) }))
                  .sort((a, b) => b.value - a.value)
                  .map((account, index) => (
                    <div className="analytics-row" key={account.accountId}>
                      <b>{index + 1}</b>
                      <span><strong>{account.displayName}</strong><small>{platformLabel(account.platform)} channel total | post-level {metricLabels[metric].toLowerCase()} not synced yet</small></span>
                      <em>{platformCode(account.platform)}</em>
                      <strong>{compactNumber(account.value)}</strong>
                    </div>
                  ))}
              </div>
            ) : null}
            {analytics?.ranked.map((item, index) => (
              <div className="analytics-row" key={item.postId}>
                <b>{index + 1}</b><span><strong>{item.title}</strong><small>{statusLabel(item.status)} | {item.benchmark}</small></span>
                <em>{item.viral ? 'Viral flag' : ''}</em><strong>{metric === 'engagementRate' ? `${(item.value * 100).toFixed(2)}%` : compactNumber(item.value)}</strong>
              </div>
            ))}
          </div>
        </article>
        <article className="panel">
          <div className="panel-heading"><div><p className="eyebrow">Engagement heatmap</p><h2>Best times by day and hour</h2></div></div>
          <div className="heatmap-guide"><span>Lower</span><i /><i className="mid" /><i className="high" /><span>Higher engagement</span></div>
          <div className="heatmap-shell" aria-label="Engagement by day and hour">
            <div className="heatmap-hours">{hourLabels.map((hour) => <span key={hour}>{hour}</span>)}</div>
            {dayLabels.map((day, dayIndex) => (
              <div className="heatmap-row" key={day}>
                <b>{day}</b>
                <div className="heatmap">
                  {analytics?.heatmap.filter((cell) => cell.day === dayIndex).map((cell) => (
                    <i key={`${cell.day}-${cell.hour}`} title={`${day}, ${String(cell.hour).padStart(2, '0')}:00, score ${cell.score}`} style={{ opacity: Math.max(.1, Math.min(1, cell.score / 100)) }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {analytics && analytics.heatmap.every((cell) => cell.score === 0) ? <div className="empty-state compact">No post-time engagement history yet. Once 0.5 Show has published posts with performance, darker blocks will show stronger time windows.</div> : null}
          <div className="trend-list">{analytics?.trends.map((trend) => <div key={trend.label}><strong>{trend.label}</strong><span>+{trend.lift}x</span><small>{trend.evidence}</small></div>)}</div>
          {analytics && analytics.trends.length === 0 ? <div className="empty-state">No tagged content trends yet.</div> : null}
        </article>
      </section>
      <section className="panel attribution-panel"><div className="panel-heading"><div><p className="eyebrow">Clip attribution</p><h2>Clip to episode plays</h2></div></div>{analytics && analytics.attribution.length === 0 ? <div className="empty-state">No clip-to-episode links yet. Add source episode links or campaign links to measure which clips drive plays.</div> : null}{analytics?.attribution.map((item) => <div key={item.clipId}><strong>{item.clipId}</strong><span>{item.attributedPlays} attributed plays</span><small>{item.utmUrl}</small></div>)}</section>
    </div>
  )
}

function accountMetricValue(account: AnalyticsSnapshot['accountSummary'][number], metric: MetricKey) {
  if (metric === 'reach' || metric === 'views' || metric === 'impressions') return account.reach
  return 0
}
