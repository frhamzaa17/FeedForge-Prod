'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AiInsightsSnapshot } from '@zpf/shared'
import { api } from '@/lib/api'

export default function AiInsightsPage() {
  const router = useRouter()
  const [insights, setInsights] = useState<AiInsightsSnapshot>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    setError('')
    void api.aiInsights()
      .then(setInsights)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Could not load AI insights'))
      .finally(() => setLoading(false))
  }, [])

  function useInComposer(input: { title: string; text: string; scheduleHint?: string }) {
    const params = new URLSearchParams({
      title: input.title,
      text: input.text,
    })
    if (input.scheduleHint) params.set('scheduleHint', input.scheduleHint)
    router.push(`/content/new?${params.toString()}`)
  }

  return (
    <div className="content">
      <div className="page-heading"><div><p className="eyebrow">Human-confirmed intelligence</p><h1>AI insights</h1><p>Suggestions use your connected channels and saved content history. Empty cards mean 0.5 Show needs more real history, not filler.</p></div></div>
      {loading ? <div className="success-message">Preparing suggestions. First response can take a few seconds.</div> : null}
      {error ? <div className="error-message">{error}</div> : null}
      <section className="insight-grid">
        <article className="panel"><p className="eyebrow">Best posting time</p>{insights?.bestTimes.length === 0 ? <div className="empty-state compact">Connect a channel or sync published post history.</div> : null}{insights?.bestTimes.slice(0, 5).map((item) => <div className="suggestion-card" key={item.accountId}><strong>{item.label}</strong>{item.confidence > 0 ? <span>{Math.round(item.confidence * 100)}% confidence</span> : null}<p>{item.reason}</p><button onClick={() => useInComposer({ title: 'New post for suggested time', text: `Suggested posting window: ${item.label}. ${item.reason}`, scheduleHint: item.label })}>Use in composer</button></div>)}</article>
        <article className="panel"><p className="eyebrow">Viral score</p>{insights?.viralScores.length === 0 ? <div className="empty-state compact">Needs historical post performance before draft scoring is honest.</div> : null}{insights?.viralScores.map((item) => <div className="suggestion-card" key={item.postId}><strong>{item.title}</strong><span>{Math.round(item.probability * 100)}% probability</span><p>{item.reason}</p></div>)}</article>
        <article className="panel"><p className="eyebrow">Recommendations</p>{insights?.recommendations.length === 0 ? <div className="empty-state compact">Sync or publish content to generate recommendations.</div> : null}{insights?.recommendations.map((item) => <div className="suggestion-card" key={item.title}><strong>{item.title}</strong>{item.confidence > 0 ? <span>{Math.round(item.confidence * 100)}% confidence</span> : null}<p>{item.action}</p><button onClick={() => useInComposer({ title: item.title, text: item.action })}>Use this</button></div>)}</article>
        <article className="panel"><p className="eyebrow">Clip nominations</p>{insights?.clipSuggestions.length === 0 ? <div className="empty-state compact">Needs transcripts or source episode links before clips can be nominated.</div> : null}{insights?.clipSuggestions.map((item) => <div className="suggestion-card" key={item.start}><strong>{item.start} - {item.end}</strong><p>{item.reason}</p></div>)}</article>
      </section>
    </div>
  )
}
