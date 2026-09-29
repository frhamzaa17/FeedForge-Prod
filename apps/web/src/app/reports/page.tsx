'use client'

import { useEffect, useState } from 'react'
import type { ReportTemplate } from '@zpf/shared'
import { api } from '@/lib/api'

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportTemplate[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState('')

  useEffect(() => {
    setLoading(true)
    void api.reports()
      .then(setReports)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Could not load reports'))
      .finally(() => setLoading(false))
  }, [])

  async function createReport() {
    setWorkingId('new')
    setError('')
    try {
      const accounts = await api.accounts()
      const report = await api.saveReport({
        name: reportName(),
        format: 'csv',
        metricSet: ['reach', 'views', 'engagementRate'],
        accountIds: accounts.map((account) => account.id),
        whiteLabel: false,
      })
      setReports((current) => [...current, report])
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create report')
    } finally {
      setWorkingId('')
    }
  }

  async function deleteReport(report: ReportTemplate) {
    const confirmed = window.confirm(`Delete "${report.name}"? This cannot be undone.`)
    if (!confirmed) return
    setWorkingId(report.id)
    setError('')
    try {
      await api.deleteReport(report.id)
      setReports((current) => current.filter((item) => item.id !== report.id))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete report')
    } finally {
      setWorkingId('')
    }
  }

  return (
    <div className="content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Reports pipeline</p>
          <h1>Build, save, export.</h1>
          <p>CSV exports are generated from your connected channels and saved content.</p>
        </div>
        <button className="primary-button" disabled={workingId === 'new'} onClick={() => void createReport()}>
          {workingId === 'new' ? 'Creating...' : '+ New report'}
        </button>
      </div>

      {loading ? <div className="success-message">Loading reports...</div> : null}
      {error ? <div className="error-message">{error}</div> : null}

      <section className="report-grid">
        {!loading && reports.length === 0 ? <div className="empty-state">No reports yet. Create a new report to export analytics.</div> : null}
        {reports.map((report) => (
          <article className="panel report-card" key={report.id}>
            <p className="eyebrow">{report.schedule ?? 'On demand'}</p>
            <h2>{report.name}</h2>
            <p>{report.metricSet.join(', ')}</p>
            <small>{report.accountIds.length} accounts | {report.format.toUpperCase()}</small>
            <div className="report-actions">
              <a className="primary-button" href={api.reportExportUrl(report.id)}>Export CSV</a>
              <button className="danger-button" disabled={workingId === report.id} onClick={() => void deleteReport(report)}>
                {workingId === report.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}

function reportName() {
  const timestamp = new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())
  return `Analytics Report - ${timestamp}`
}
