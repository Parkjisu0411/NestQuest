export type DraftSaveStatus = 'pending' | 'saving' | 'saved' | 'error'

/** Coalesce typing, serialize writes, and drain before committing a visit. */
export function createDraftAutosave<T>(write: (value: T) => Promise<void>, notify: (status: DraftSaveStatus) => void, delay = 350) {
  let pending: { value: T; revision: number } | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let revision = 0
  let paused = false
  let running = Promise.resolve()
  let status: DraftSaveStatus = 'saved'
  function report(next: DraftSaveStatus) { status = next; notify(next) }
  function clearTimer() { if (timer !== undefined) clearTimeout(timer); timer = undefined }

  function flush(): Promise<void> {
    clearTimer()
    if (paused || !pending) return running
    const job = pending
    pending = undefined
    running = running.then(async () => {
      if (job.revision === revision && !paused) report('saving')
      try {
        await write(job.value)
        if (job.revision === revision && !paused) report('saved')
      } catch {
        if (job.revision === revision && !paused) {
          pending = job
          report('error')
        }
      }
    })
    return running
  }

  return {
    update(value: T) {
      if (paused) return
      pending = { value, revision: ++revision }
      report('pending')
      clearTimer()
      timer = setTimeout(() => { void flush() }, delay)
    },
    flush,
    async pause() {
      paused = true
      clearTimer()
      pending = undefined
      await running
    },
    resume() { paused = false },
    getStatus: () => status,
  }
}
