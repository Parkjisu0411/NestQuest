import { useState } from 'react'
import { mapBundle, mapBundleMessage, searchStations, stationDestination } from '../data/map/bundle.ts'
import type { CommuteDestination } from '../domain/models.ts'

export function StationPicker({ value, onSelect }: { value?: CommuteDestination; onSelect: (value: CommuteDestination | undefined) => void }) {
  const [query, setQuery] = useState('')
  const results = mapBundle && query.trim() ? searchStations(mapBundle.stations, query) : []
  const current = mapBundle?.stations.find((station) => `station:${station.id}` === value?.id)
  return <section className="station-picker" aria-label="출근역 선택">
    <p>출근역 · {value?.name ?? '미지정'}</p>
    {value && !value.id.startsWith('station:') ? <p>이전에 설정한 출근지입니다. 아래에서 가까운 출근역을 선택해 주세요.</p> : null}
    {value?.id.startsWith('station:') && mapBundle && !current ? <p role="alert">현재 역 자료에 없는 출근역입니다. 다시 선택해 주세요.</p> : null}
    
    {mapBundle ? <>
      <label>출근역 검색 <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="여의도 또는 9호선" /></label>
      <p role="status">{query.trim() ? `${results.length}개 역${results.length > 30 ? ' · 처음 30개 표시, 검색어를 더 입력해 주세요.' : ''}` : ''}</p>
      <ul>{results.slice(0,30).map((station) => <li key={station.id}><button type="button" aria-pressed={value?.id === `station:${station.id}`} onClick={() => onSelect(stationDestination(station))}>{station.name} · {station.lines.join('·')}{station.address ? ` · ${station.address}` : ''}</button></li>)}</ul>
    </> : <p role="status">{mapBundleMessage}</p>}
    {value ? <button type="button" onClick={() => onSelect(undefined)}>해제</button> : null}
  </section>
}
