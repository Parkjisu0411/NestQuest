import { createElement } from 'react'
import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AreaSelector } from './AreaSelector.tsx'
import metroMap from '../../data/map/metro-regions.json'

it('renders every capital-region boundary together, regardless of the selected province',()=>{
 const html=renderToStaticMarkup(createElement(AreaSelector,{selectedCodes:new Set(['41111']),onToggle:()=>{}}))
 expect((html.match(/<svg/g)??[])).length(1)
 expect((html.match(/<path/g)??[])).length(metroMap.regions.length)
 expect(html).toContain('서울 경기 인천 통합 지역 선택 지도')
 expect(html).toContain('서울 종로구')
 expect(html).toContain('경기 수원시')
 expect(html).toContain('인천 연수구')
})
it('preserves selected states across provinces in the unified map',()=>{
 const regions=['11','41','28'].map(sido=>metroMap.regions.find(r=>r.sido===sido)!)
 const html=renderToStaticMarkup(createElement(AreaSelector,{selectedCodes:new Set(regions.flatMap(r=>r.codes)),onToggle:()=>{}}))
 expect((html.match(/aria-pressed="true"/g)??[])).length(3)
})