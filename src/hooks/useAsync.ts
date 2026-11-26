import { useCallback, useEffect, useRef, useState } from 'react'

/** Small data-loading hook with reload, stale-response protection and error capture. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const callId = useRef(0)

  const run = useCallback(async () => {
    const id = ++callId.current
    setLoading(true)
    setError(null)
    try {
      const result = await fn()
      if (id === callId.current) setData(result)
    } catch (e) {
      if (id === callId.current) setError(e)
    } finally {
      if (id === callId.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    run()
  }, [run])

  return { data, error, loading, reload: run, setData }
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Mythree` : 'Mythree – संस्कृतगृहम्'
  }, [title])
}
