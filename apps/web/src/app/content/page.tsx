'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { Post } from '@zpf/shared'
import { ErrorState, LoadingState } from '@/components/loading-state'
import { api } from '@/lib/api'
import { dateTime, platformCode, statusLabel } from '@/lib/format'

export default function ContentPage() {
  const [posts, setPosts] = useState<Post[]>()
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try { setPosts(await api.posts()) } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unknown error')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div className="content">
      <div className="page-heading">
        <div><p className="eyebrow">Content operations</p><h1>Content pipeline</h1><p>Draft, review, schedule, and recover every post from one queue.</p></div>
        <Link className="primary-button" href="/content/new">+ New post</Link>
      </div>
      {error ? <ErrorState message={error} retry={load} /> : null}
      {!posts && !error ? <LoadingState label="Loading content pipeline..." /> : null}
      {posts ? (
        <section className="panel table-panel">
          <div className="data-table">
            <div className="data-row data-head"><span>Content</span><span>Targets</span><span>Schedule</span><span>Status</span></div>
            {posts.map((post) => (
              <Link className="data-row" href={`/calendar?post=${post.id}`} key={post.id}>
                <span className="row-title"><strong>{post.title}</strong><small>{post.contentType} | {post.campaign ?? 'No campaign'}</small></span>
                <span className="target-codes">{post.targets.map((target) => <i key={target.id}>{platformCode(target.platform)}</i>)}</span>
                <span>{dateTime(post.scheduledAt)}</span>
                <span><b className={`state ${post.status}`}>{statusLabel(post.status)}</b></span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
