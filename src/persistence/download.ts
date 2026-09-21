import { isAndroidApp } from '../platform/native.ts'

export function downloadJsonFile(filename: string, contents: string): Promise<void> {
  const blob = new Blob([contents], { type: 'application/json' })
  return downloadBlobFile(filename, blob)
}

export async function downloadBlobFile(filename: string, blob: Blob): Promise<void> {
  if (isAndroidApp()) {
    const { exportAndroidFile } = await import('../platform/exportFile.ts')
    return exportAndroidFile(filename, blob)
  }
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
