import { addressAliases } from '../metroAreas.ts'
/** Complete legal lot address, including city districts and eup/myeon/ri. */
export function metroLotAddress(value:string):string|null {
  const text=value.trim().replace(/^서울(?:시|특별시)?\s/,'서울특별시 ').replace(/^경기(?:도)?\s/,'경기도 ').replace(/^인천(?:시|광역시)?\s/,'인천광역시 ').replace(/\s+/g,' ')
  const match=text.match(/^((?:서울특별시|인천광역시|경기도) (?:[^ ]+(?:시|군|구) )+(?:(?:[^ ]+(?:읍|면)) )?[^ ]+(?:동\d*가?|가|리)) (산\s*)?(\d+)(?:-(\d+))?(?=\s|$)/u)
  if(!match) return null
  const location=addressAliases.get(match[1])??match[1]
  return location+' '+(match[2]?'산':'')+Number(match[3])+(match[4]&&Number(match[4])?'-'+Number(match[4]):'')
}
export const seoulLotAddress = metroLotAddress
export function comparableApartmentName(value:string) { return value.replace(/\s+/g,'').replace(/아파트$/,'') }
