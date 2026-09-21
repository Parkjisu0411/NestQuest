import { useEffect, useRef, useState } from 'react'

export function DraftPhotoPreview({ blob }: { blob: Blob }) {
  const ref = useRef<HTMLImageElement>(null)
  const [failedBlob, setFailedBlob] = useState<Blob | null>(null)
  useEffect(() => {
    const url = URL.createObjectURL(blob)
    if (ref.current) ref.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [blob])
  return <>{failedBlob === blob ? <p>이 기기에서 미리 볼 수 없는 사진입니다. 원본은 보관됩니다.</p> : null}<img hidden={failedBlob === blob} ref={ref} alt="첨부한 임장 사진" onError={() => setFailedBlob(blob)} /></>
}
