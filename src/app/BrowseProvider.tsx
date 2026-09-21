import { useMemo, useRef, useState, type ReactNode } from 'react'
import { BrowseContext, initialBrowseState } from './browseContext.ts'

/** Transient browsing context survives route changes, separate from user data. */
export function BrowseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialBrowseState)
  const scrollTop = useRef(0)
  const value = useMemo(() => ({ state, setState, scrollTop }), [state])
  return <BrowseContext.Provider value={value}>{children}</BrowseContext.Provider>
}
