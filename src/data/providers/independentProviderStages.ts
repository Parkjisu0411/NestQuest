import { ApiError, pauseProviderRequests } from './http.ts'

/** Isolate provider errors; cancellation and persistence errors must still stop the run. */
export function independentProviderStages(signal: AbortSignal, report: (service: string, message: string) => void) {
  const stopped = new Set<string>()
  const networkFailures=new Map<string,number>()
  return async (service: string, work: () => Promise<void>) => {
    signal.throwIfAborted()
    if (stopped.has(service)) return
    try { await work(); signal.throwIfAborted(); networkFailures.delete(service) }
    catch (error) {
      if (signal.aborted || !(error instanceof ApiError)) throw error
      report(service, error.userMessage)
      if (['auth', 'limit'].includes(error.kind)) stopped.add(service)
      else if (error.kind === 'network') {
        const count=(networkFailures.get(service)??0)+1
        networkFailures.set(service,count)
        if(count>=5) {
          stopped.add(service)
          report(service,error.userMessage+' 연속 연결 실패로 보류했습니다. 조회 계속으로 재개할 수 있습니다.')
        } else await pauseProviderRequests(signal,1000*count)
      }
    }
  }
}
