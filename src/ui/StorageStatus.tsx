import { useEffect, useState } from 'react'
import { inspectUnusedPhotos, userMessageFromUnknown } from '../persistence/repository.ts'

async function readStorageStatus(): Promise<string> {
    try {
      if (!navigator.storage?.estimate) return '이 환경에서는 저장 공간 정보를 제공하지 않습니다.'
      const estimate = await navigator.storage.estimate()
      const persistent = await navigator.storage.persisted?.()
      const mb = (value: number) => `${(value / 1024 / 1024).toFixed(1)}MB`
      return `이 앱 주소의 사용량 약 ${mb(estimate.usage ?? 0)}${estimate.quota ? ` / 허용량 약 ${mb(estimate.quota)}` : ''} · ${persistent ? '지속 저장 허용됨' : '지속 저장 미허용'}`
    } catch { return '저장 공간을 확인하지 못했습니다. 다시 확인해 주세요.' }
}

export function StorageStatus() {
  const [text, setText] = useState('저장 공간 확인 중…')
  const [busy, setBusy] = useState(false)
  const [unused, setUnused] = useState<{ count: number; bytes: number } | null>(null)
  const [cleanupMessage, setCleanupMessage] = useState('')
  async function refresh() { setText(await readStorageStatus()) }
  useEffect(() => { let active = true; void readStorageStatus().then((value) => { if (active) setText(value) }); return () => { active = false } }, [])
  return <section aria-label="기기 저장 공간">
    <h3>기기 저장 공간</h3><p role="status">{text}</p>
    <p>기록은 현재 기기·앱 주소에 저장됩니다. 앱 데이터 삭제나 기기 변경에 대비해 사진 포함 백업을 별도로 보관해 주세요.</p>
    <button type="button" disabled={busy} onClick={() => { void refresh() }}>사용량 다시 확인</button>{' '}
    <button type="button" disabled={busy} onClick={async () => {
      setBusy(true)
      try {
        if (!navigator.storage?.persist) setText('이 환경에서는 지속 저장을 요청할 수 없습니다.')
        else { await navigator.storage.persist(); await refresh() }
      } catch { setText('지속 저장을 요청하지 못했습니다. 백업 파일을 보관해 주세요.') }
      finally { setBusy(false) }
    }}>지속 저장 요청</button>
    <p>기록에서 이미 제거된 사진 원본의 저장 공간을 정리할 수 있습니다. 현재 기록과 작성 중 초안의 사진은 보존합니다.</p>
    <button type="button" disabled={busy} onClick={async () => {
      setBusy(true); setCleanupMessage(''); setUnused(null)
      try { setUnused(await inspectUnusedPhotos()) }
      catch (error) { setCleanupMessage(userMessageFromUnknown(error, '사진을 확인하지 못했습니다.')) }
      finally { setBusy(false) }
    }}>정리 가능한 사진 확인</button>
    {unused ? <div>
      <p role="status">기록에서 사용하지 않는 원본 {unused.count}개 · {(unused.bytes / 1024 / 1024).toFixed(1)}MB</p>
      {unused.count > 0 ? <><p>이 원본 파일을 삭제하면 복구할 수 없습니다. 현재 기록의 사진은 삭제하지 않습니다.</p>
        <button type="button" disabled={busy} onClick={async () => {
          setBusy(true)
          try { const result = await inspectUnusedPhotos(true); setUnused(null); setCleanupMessage(`${result.count}개 원본을 정리했습니다.`); await refresh() }
          catch (error) { setCleanupMessage(userMessageFromUnknown(error, '사진을 정리하지 못했습니다.')) }
          finally { setBusy(false) }
        }}>사용하지 않는 원본 삭제</button>{' '}<button type="button" disabled={busy} onClick={() => setUnused(null)}>취소</button>
      </> : null}
    </div> : null}
    {cleanupMessage ? <p role="status">{cleanupMessage}</p> : null}
  </section>
}
