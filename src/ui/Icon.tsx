import type { CSSProperties } from 'react'
const paths = {
  back: 'M15 5l-7 7 7 7',
  filter: 'M4 7h16M4 17h16M8 4v6M16 14v6',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4',
  map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6zm6-3v15m6-12v15',
  compare: 'M4 5h6v15H4V5zm10-2h6v17h-6V3z',
  chevron: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  reset: 'M3 10a9 9 0 1 1 2 8M3 4v6h6',
  close: 'M6 6l12 12M18 6 6 18',
  heart: 'M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
} as const
export function Icon({ name, size = 22, style }: { name: keyof typeof paths; size?: number; style?: CSSProperties }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style}><path d={paths[name]} /></svg>
}
