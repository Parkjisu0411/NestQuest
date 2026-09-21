import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  save: vi.fn(), writeFile: vi.fn(), appendFile: vi.fn(), deleteFile: vi.fn(), rmdir: vi.fn(),
}))
vi.mock('@capacitor/core', () => ({ registerPlugin: () => ({ save: mocks.save }) }))
vi.mock('@capacitor/filesystem', () => ({ Directory: { Cache: 'CACHE' }, Filesystem: mocks }))
import { exportAndroidFile } from './exportFile.ts'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.save.mockResolvedValue({ saved: true })
  mocks.writeFile.mockResolvedValue({ uri: 'file:///cache/test' })
  mocks.appendFile.mockResolvedValue(undefined)
  mocks.deleteFile.mockResolvedValue(undefined)
  mocks.rmdir.mockResolvedValue(undefined)
})

describe('Android document export', () => {
  it('preserves binary bytes across bounded chunks before opening the destination picker', async () => {
    const bytes = Uint8Array.from({ length: 600_123 }, (_, index) => index % 256)
    await exportAndroidFile('backup.nestquest', new Blob([bytes]))
    const chunks = mocks.appendFile.mock.calls.map(([options]) => Uint8Array.from(atob(options.data), (char) => char.charCodeAt(0)))
    expect(chunks).toHaveLength(3)
    expect(chunks.every((chunk) => chunk.length <= 256 * 1024)).toBe(true)
    expect(Buffer.concat(chunks)).toEqual(Buffer.from(bytes))
    expect(mocks.save.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.appendFile.mock.invocationCallOrder[2])
    expect(mocks.deleteFile.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.save.mock.invocationCallOrder[0])
  })
  it('reports cancellation and removes only its own temporary file', async () => {
    mocks.save.mockResolvedValue({ saved: false })
    await expect(exportAndroidFile('backup.json', new Blob(['{}']))).rejects.toThrow('취소')
    expect(mocks.deleteFile).toHaveBeenCalledWith({ path: mocks.writeFile.mock.calls[0][0].path, directory: 'CACHE' })
  })
  it('never offers a partially written archive and cleans up on bridge failure', async () => {
    mocks.appendFile.mockRejectedValue(new Error('storage full'))
    await expect(exportAndroidFile('backup.nestquest', new Blob(['data']))).rejects.toThrow('storage full')
    expect(mocks.save).not.toHaveBeenCalled()
    expect(mocks.deleteFile).toHaveBeenCalledOnce()
  })
  it('waits for native copying to complete before cleaning up', async () => {
    let finish!: (value: { saved: boolean }) => void
    mocks.save.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const exporting = exportAndroidFile('backup.json', new Blob(['{}']))
    await vi.waitFor(() => expect(mocks.save).toHaveBeenCalledOnce())
    expect(mocks.deleteFile).not.toHaveBeenCalled()
    finish({ saved: true })
    await exporting
    expect(mocks.deleteFile).toHaveBeenCalledOnce()
  })
})
