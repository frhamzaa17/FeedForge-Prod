'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { DashboardSnapshot } from '@zpf/shared'
import { ErrorState, LoadingState } from '@/components/loading-state'
import { ReachChart } from '@/components/reach-chart'
import { Sparkline } from '@/components/sparkline'
import { api } from '@/lib/api'
import { compactNumber, freshnessLabel, platformCode, relativeTime, statusLabel } from '@/lib/format'

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardSnapshot>()
  const [error, setError] = useState('')
  const [range, setRange] = useState<'28' | '90' | 'custom'>('28')
  const [customOpen, setCustomOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState(() => dateInputValue(new Date(Date.now() - 27 * 86_400_000)))
  const [customTo, setCustomTo] = useState(() => dateInputValue(new Date()))
  const [filtering, setFiltering] = useState(false)

  const load = useCallback(async (query = 'days=28') => {
    setError('')
    setFiltering(true)
    try {
      setDashboard(await api.dashboard(query))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unknown error')
    } finally {
      setFiltering(false)
    }
  }, [])

  useEffect(() => { void load('days=28') }, [load])

  function selectPreset(days: '28' | '90') {
    setRange(days)
    setCustomOpen(false)
    void load(`days=${days}`)
  }

  function applyCustomRange() {
    if (!customFrom || !customTo || customFrom > customTo) {
      setError('Choose a valid custom date range.')
      return
    }
    setRange('custom')
    setCustomOpen(false)
    void load(new URLSearchParams({ from: customFrom, to: customTo }).toString())
  }

  if (error) return <div className="content"><ErrorState message={error} retry={load} /></div>
  if (!dashboard) return <div className="content"><LoadingState label="Loading command center and syncing connected channels..." /></div>

  const latest = dashboard.latestContent

  return (
    <div className="content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{new Intl.DateTimeFormat('en-IN', { dateStyle: 'full' }).format(new Date())}</p>
          <h1>Your brand, at a glance.</h1>
          <p>Performance across every channel for {dashboard.range.days === 1 ? dashboard.range.from : `${dashboard.range.from} to ${dashboard.range.to}`}.</p>
        </div>
        <div className="date-filter-wrap">
          <div className="date-filter" aria-label="Dashboard date range">
            <button className={range === '28' ? 'active' : ''} disabled={filtering} onClick={() => selectPreset('28')}>28 days</button>
            <button className={range === '90' ? 'active' : ''} disabled={filtering} onClick={() => selectPreset('90')}>90 days</button>
            <button className={range === 'custom' ? 'active' : ''} onClick={() => setCustomOpen((open) => !open)}>Custom</button>
          </div>
          {customOpen ? (
            <div className="custom-date-popover">
              <label>From<input type="date" value={customFrom} max={customTo} onChange={(event) => setCustomFrom(event.target.value)} /></label>
              <label>To<input type="date" value={customTo} min={customFrom} max={dateInputValue(new Date())} onChange={(event) => setCustomTo(event.target.value)} /></label>
              <button className="primary-button" disabled={filtering} onClick={applyCustomRange}>Apply</button>
            </div>
          ) : null}
        </div>
      </div>

      <section className="metric-grid" aria-label="Executive metrics">
        {dashboard.metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <div className="metric-label">
              {metric.label}
              <button
                aria-label={`About ${metric.label}`}
                title={metric.detail}
                onClick={() => window.alert(`${metric.label}: ${metric.detail}`)}
              >
                i
              </button>
            </div>
            <div className="metric-value-row">
              <strong>{compactNumber(metric.value)}{metric.unit === 'hours' ? ' hrs' : ''}</strong>
              <Sparkline values={metric.series} negative={metric.delta < 0} />
            </div>
            <div className="metric-footer">
              <span className={metric.delta < 0 ? 'down' : 'up'}>{metric.delta > 0 ? '+' : '-'} {Math.abs(metric.delta)}%</span>
              <small>{metric.detail}</small>
            </div>
          </article>
        ))}
      </section>

      <section className="platform-grid" aria-label="Platform performance">
        {dashboard.accounts.map((account) => (
          <article className="platform-card" key={account.id}>
            <div className="platform-head">
              <span className="platform-icon" style={{ background: account.color }}>{platformCode(account.platform)}</span>
              <span><strong>{account.displayName}</strong><small>{account.username}</small></span>
              <Link href="/settings" aria-label={`Open ${account.displayName}`}>+</Link>
            </div>
            <div className="platform-numbers">
              <span><small>{account.platform === 'youtube' ? 'Total views' : 'Reach'}</small><strong>{compactNumber(account.reach)}</strong></span>
              <span><small>{account.platform === 'youtube' ? 'Subscribers' : 'Audience'}</small><strong>{compactNumber(account.audience)}</strong></span>
            </div>
            <div className="freshness"><i /> {freshnessLabel(account.lastSyncAt)}</div>
          </article>
        ))}
      </section>

      <section className="main-grid">
        <article className="panel reach-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Momentum</p><h2>Daily reach</h2></div>
            <div className="legend"><span className="ig">Instagram</span><span className="yt">YouTube</span><span className="tt">TikTok</span></div>
          </div>
          <ReachChart reachSeries={dashboard.reachSeries} />
        </article>

        <article className="panel podcast-panel">
          <div className="panel-heading"><div><p className="eyebrow">Latest published content</p><h2>{latest.title}</h2></div></div>
          <div className="episode-art"><span>{latest.platform === 'none' ? '-' : platformCode(latest.platform)}</span><strong>{latest.label.toUpperCase()}<br />CONTENT<br />STATUS</strong></div>
          <div className="episode-stats">
            <span><strong>{compactNumber(latest.views)}</strong><small>Views</small></span>
            <span><strong>{(latest.engagementRate * 100).toFixed(2)}%</strong><small>Engagement</small></span>
            <span><strong>{compactNumber(latest.clicks)}</strong><small>Clicks</small></span>
          </div>
          <div className="completion"><span style={{ width: `${Math.min(100, Math.max(0, latest.engagementRate * 100))}%` }} /></div>
          <p>{latest.publishedAt ? `Published ${relativeTime(latest.publishedAt)}.` : 'Publish content from the composer to populate this panel.'}</p>
        </article>
      </section>

      <section className="bottom-grid">
        <article className="panel">
          <div className="panel-heading"><div><p className="eyebrow">What worked</p><h2>Top content</h2></div><Link href="/analytics">View analytics -&gt;</Link></div>
          <div className="content-list">
            {dashboard.topContent.length === 0 ? <div className="empty-state">No real published content metrics yet. Published posts will appear here after they have platform metrics.</div> : null}
            {dashboard.topContent.map((item, index) => (
              <div className="content-row" key={item.id}>
                <span className="rank">{String(index + 1).padStart(2, '0')}</span>
                <span className="content-title"><strong>{item.title}</strong><small>{item.meta}</small></span>
                <span className="content-metric"><strong>{item.metric}</strong><small>{item.lift}</small></span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading"><div><p className="eyebrow">Publishing</p><h2>Coming up</h2></div><Link href="/calendar">Open calendar -&gt;</Link></div>
          <div className="upcoming-list">
            {dashboard.upcoming.length === 0 ? <div className="empty-state">No scheduled, draft, failed, or pending posts yet.</div> : null}
            {dashboard.upcoming.slice(0, 4).map((post) => (
              <div className="upcoming-row" key={post.id}>
                <span className={`state-dot ${post.status}`} />
                <span>
                  <small>{post.scheduledAt ? new Date(post.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Unscheduled'}</small>
                  <strong>{post.title}</strong>
                  <em>{post.targets.map((target) => platformCode(target.platform)).join(' | ')}</em>
                </span>
                <b className={`state ${post.status}`}>{statusLabel(post.status)}</b>
              </div>
            ))}
          </div>
        </article>
      </section>

      <footer><span><i /> Workspace connected</span><span>Updated {relativeTime(dashboard.generatedAt)}</span></footer>
    </div>
  )
}

function dateInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}
