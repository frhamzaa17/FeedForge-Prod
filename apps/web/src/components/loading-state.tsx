export function LoadingState({ label = 'Loading workspace...' }: { label?: string }) {
  return <div className="page-state"><span className="loader" />{label}</div>
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="page-state error-state">
      <strong>0.5 Show could not load this page.</strong>
      <span>{message}</span>
      {retry ? <button onClick={retry}>Try again</button> : null}
    </div>
  )
}
