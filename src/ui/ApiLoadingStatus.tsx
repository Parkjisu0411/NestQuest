import './ApiLoadingStatus.css'

/** Inline progress keeps map, list and navigation interactive during API work. */
export function ApiLoadingStatus({ message, onCancel }: { message: string; onCancel: () => void }) {
  return <div className="api-loading-status">
    <p role="status" aria-live="polite" aria-atomic="true">
      <span className="api-loading-status__dot" aria-hidden="true" />
      <span className="api-loading-status__text" title={message}>{message || '자료 조회 중'}</span>
    </p>
    <button type="button" onClick={onCancel} aria-label="자료 조회 중단">중단</button>
  </div>
}
