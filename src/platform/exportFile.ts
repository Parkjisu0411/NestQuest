import { registerPlugin } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { PersistError } from '../persistence/errors.ts'

const Documents = registerPlugin<{ save(options: { path: string; filename: string; mimeType: string }): Promise<{ saved: boolean }> }>('NestQuestDocuments')
const CHUNK_BYTES = 256 * 1024

/** Bound the bridge payload: never base64-encode the whole photo archive. */
export async function exportAndroidFile(filename: string, blob: Blob): Promise<void> {
  const path = `exports/${crypto.randomUUID()}/${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  try {
    await Filesystem.writeFile({ path, directory: Directory.Cache, data: '', recursive: true })
    for (let offset = 0; offset < blob.size; offset += CHUNK_BYTES) {
      const bytes = new Uint8Array(await blob.slice(offset, offset + CHUNK_BYTES).arrayBuffer())
      let binary = ''
      for (const byte of bytes) binary += String.fromCharCode(byte)
      await Filesystem.appendFile({ path, directory: Directory.Cache, data: btoa(binary) })
    }
    const result = await Documents.save({ path, filename, mimeType: blob.type || 'application/octet-stream' })
    if (!result.saved) throw new PersistError('파일 저장을 취소했습니다. 기존 기록은 그대로 유지됩니다.')
  } finally {
    // The picker callback resolves only after copying, so the source can now be removed.
    await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => {})
    await Filesystem.rmdir({ path: path.slice(0, path.lastIndexOf('/')), directory: Directory.Cache }).catch(() => {})
  }
}
