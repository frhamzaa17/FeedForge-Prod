type SparklineProps = {
  values: number[]
  negative?: boolean
}

export function Sparkline({ values, negative = false }: SparklineProps) {
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100
      const y = 34 - ((value - min) / range) * 28
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg className="sparkline" viewBox="0 0 100 38" role="img" aria-label="Metric trend">
      <polyline points={points} fill="none" stroke={negative ? '#c75b50' : '#56755a'} strokeWidth="2.5" />
    </svg>
  )
}
