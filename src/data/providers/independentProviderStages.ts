import { ApiError } from './http.ts'

/** Isolate provider errors; cancellation and persistence errors must still stop the run. */
export function independentProviderStages(signal: AbortSignal, report: (service: string, message: string) => void) {
  const stopped = new Set<string>()
  return async (service: string, work: () => Promise<void>) => {
    signal.throwIfAborted()
    if (stopped.has(service)) return
    try { await work(); signal.throwIfAborted() }
    catch (error) {
      if (signal.aborted || !(error instanceof ApiError)) throw error
      report(service, error.userMessage)
      if (['auth', 'limit', 'network'].includes(error.kind)) stopped.add(service)
    }
  }
}
