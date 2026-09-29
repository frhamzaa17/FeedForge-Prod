import type { ReachPoint } from '@zpf/shared'

export function ReachChart({ reachSeries }: { reachSeries: ReachPoint[] }) {
  const max = Math.max(1, ...reachSeries.map((point) => point.total))

  return (
    <div className="reach-chart" aria-label="Daily reach chart">
      <div className="chart-grid">
        {[200, 150, 100, 50, 0].map((value) => (
          <div className="grid-row" key={value}>
            <span>{value}K</span>
            <i />
          </div>
        ))}
      </div>
      <div className="chart-bars">
        {reachSeries.map((point) => (
          <div className="bar-column" key={point.label}>
            <div className="stack" style={{ height: `${Math.max(2, (point.total / max) * 88)}%` }}>
              <span className="bar instagram" style={{ flex: point.instagram }} />
              <span className="bar youtube" style={{ flex: point.youtube }} />
              <span className="bar tiktok" style={{ flex: point.tiktok }} />
            </div>
            <small>{point.label}</small>
          </div>
        ))}
      </div>
    </div>
  )
}
