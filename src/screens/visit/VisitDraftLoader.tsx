import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { loadVisitDraft } from '../../persistence/repository.ts'
import { DRAFT_READ_ERROR, type VisitDraft } from '../../persistence/visitDraft.ts'

export function VisitDraftLoader({ questId, apartmentId, children }: {
  questId: string; apartmentId: string; children: (draft: VisitDraft | null) => ReactNode
}) {
  const [result, setResult] = useState<{ draft: VisitDraft | null } | { error: true } | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    loadVisitDraft(questId, apartmentId).then(
      (draft) => { if (!cancelled) setResult({ draft }) },
      () => { if (!cancelled) setResult({ error: true }) },
    )
    return () => { cancelled = true }
  }, [questId, apartmentId, attempt])
  if (result && 'draft' in result) return children(result.draft)
  return (
    <main style={{ padding: 20 }}>
      <Link to={`/apartments/${apartmentId}`}>단지로</Link>
      {result ? <>
        <p role="alert">{DRAFT_READ_ERROR}</p>
        <button type="button" onClick={() => { setResult(null); setAttempt((value) => value + 1) }}>다시 불러오기</button>
      </> : <p role="status">작성 중인 임장을 확인하고 있습니다.</p>}
    </main>
  )
}
