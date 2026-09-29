'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Post, PostStatus } from '@zpf/shared'
import { ErrorState, LoadingState } from '@/components/loading-state'
import { api } from '@/lib/api'
import { dateTime, platformCode, statusLabel } from '@/lib/format'

const filters: Array<'all' | PostStatus> = ['all', 'draft', 'pending_approval', 'scheduled', 'published', 'failed']
const sortOptions = [
  { value: 'latest', label: 'Latest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'status', label: 'Status' },
  { value: 'title', label: 'Title A-Z' },
] as const
type SortOption = typeof sortOptions[number]['value']

export default function CalendarPage() {
  const [posts, setPosts] = useState<Post[]>()
  const [filter, setFilter] = useState<'all' | PostStatus>('all')
  const [sort, setSort] = useState<SortOption>('latest')
  const [error, setError] = useState('')
  const [workingId, setWorkingId] = useState('')

  const load = useCallback(async () => {
    setError('')
    try { setPosts(await api.posts()) } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unknown error')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const visiblePosts = useMemo(
    () => {
      const filtered = posts?.filter((post) => filter === 'all' || post.status === filter) ?? []
      return [...filtered].sort((left, right) => {
        if (sort === 'oldest') return postTime(left) - postTime(right)
        if (sort === 'status') return left.status.localeCompare(right.status) || postTime(right) - postTime(left)
        if (sort === 'title') return left.title.localeCompare(right.title)
        return postTime(right) - postTime(left)
      })
    },
    [filter, posts, sort],
  )

  async function act(post: Post, action: 'approve' | 'archive' | 'retry' | 'publish') {
    setWorkingId(post.id)
    setError('')
    try {
      if (action === 'retry') await api.retryPost(post.id)
      if (action === 'publish') await api.publishPost(post.id)
      if (action === 'approve') await api.updatePostStatus(post.id, post.scheduledAt ? 'scheduled' : 'draft')
      if (action === 'archive') await api.updatePostStatus(post.id, 'archived')
      await load()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Action failed')
    } finally {
      setWorkingId('')
    }
  }

  return (
    <div className="content">
      <div className="page-heading">
        <div><p className="eyebrow">Publishing calendar</p><h1>Plan, ship, recover.</h1><p>Every draft, approval, scheduled post, and failure in one operational view.</p></div>
        <Link className="primary-button" href="/content/new">+ Create content</Link>
      </div>

      <div className="filter-bar">
        {filters.map((item) => <button className={filter === item ? 'active' : ''} onClick={() => setFilter(item)} key={item}>{item === 'all' ? 'All posts' : statusLabel(item)}</button>)}
        <label className="calendar-sort">Sort
          <select value={sort} onChange={(event) => setSort(event.target.value as SortOption)}>
            {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      {error ? <ErrorState message={error} retry={load} /> : null}
      {!posts && !error ? <LoadingState label="Loading publishing calendar..." /> : null}
      {posts ? (
        <section className="calendar-list">
          {visiblePosts.length === 0 ? <div className="empty-state">No posts match this filter.</div> : null}
          {visiblePosts.map((post) => (
            <article className={`calendar-card ${post.status}`} key={post.id}>
              <div className="calendar-date"><strong>{displayDate(post).day}</strong><small>{displayDate(post).label}</small></div>
              <div className="calendar-copy">
                <div><b className={`state ${post.status}`}>{statusLabel(post.status)}</b><span>{post.scheduledAt ? dateTime(post.scheduledAt) : post.publishedAt ? `Published ${dateTime(post.publishedAt)}` : 'Not scheduled'}</span></div>
                <h2>{post.title}</h2>
                <p>{post.text}</p>
                <div className="target-codes">{post.targets.map((target) => <i key={target.id}>{platformCode(target.platform)}</i>)}</div>
                {post.targets.find((target) => target.error) ? <div className="failure-detail">{post.targets.find((target) => target.error)?.error}</div> : null}
              </div>
              <div className="calendar-actions">
                {post.status === 'pending_approval' ? <button disabled={workingId === post.id} onClick={() => void act(post, 'approve')}>Approve</button> : null}
                {post.status === 'failed' ? <button disabled={workingId === post.id} onClick={() => void act(post, 'retry')}>Retry</button> : null}
                {['draft', 'scheduled'].includes(post.status) ? <button disabled={workingId === post.id} onClick={() => void act(post, 'publish')}>Publish now</button> : null}
                {post.status !== 'archived' ? <button className="quiet" disabled={workingId === post.id} onClick={() => void act(post, 'archive')}>Archive</button> : null}
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  )
}

function postTime(post: Post) {
  return new Date(post.scheduledAt ?? post.publishedAt ?? post.createdAt).getTime()
}

function displayDate(post: Post) {
  const value = post.scheduledAt ?? post.publishedAt
  if (!value) return { day: '--', label: statusLabel(post.status) }
  const date = new Date(value)
  return {
    day: String(date.getDate()),
    label: date.toLocaleString('en', { month: 'short' }),
  }
}
