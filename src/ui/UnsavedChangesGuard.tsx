import { useEffect, useRef, type RefObject } from 'react'
import { useBlocker } from 'react-router'

/** Mount only for an edited form, inside the application's data router. */
export function UnsavedChangesGuard({ saving, allowLeave }: { saving: boolean; allowLeave: RefObject<boolean> }) {
  const blocker = useBlocker(() => !allowLeave.current)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (blocker.state === 'blocked' && !dialog.current?.open) dialog.current?.showModal()
  }, [blocker.state])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (allowLeave.current) return
      event.preventDefault(); event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [allowLeave])
  if (blocker.state !== 'blocked') return null
  return <dialog className="leave-dialog" ref={dialog} aria-labelledby="leave-title" onCancel={(event) => { event.preventDefault(); blocker.reset() }}>
    <h2 id="leave-title">{saving ? '저장 중입니다' : '저장하지 않은 변경이 있습니다'}</h2>
    <p>{saving ? '저장이 끝날 때까지 이 화면에서 기다려 주세요.' : '화면을 나가면 수정한 내용은 버려집니다.'}</p>
    <button autoFocus onClick={() => blocker.reset()}>계속 작성</button>
    <button disabled={saving} onClick={() => blocker.proceed()}>변경 버리고 나가기</button>
  </dialog>
}
