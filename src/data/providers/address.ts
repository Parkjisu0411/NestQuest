/** Extract a complete Seoul legal lot address, retaining mountain lots and sub-lots.
 * K-apt appends the building name; never compare that display suffix as part of a lot.
 * Incomplete lots (e.g. 439-) and road addresses deliberately remain unmatched.
 */
export function seoulLotAddress(value: string): string | null {
  const match = value.trim().match(/^(서울특별시|서울시|서울)\s+([^\s]+구)\s+([^\s]+(?:동\d*가?|가))\s+(산\s*)?(\d+)(?:-(\d+))?(?=\s|$)/u)
  if (!match) return null
  return `서울특별시 ${match[2]} ${match[3]} ${match[4] ? '산' : ''}${Number(match[5])}${match[6] && Number(match[6]) ? `-${Number(match[6])}` : ''}`
}
export function comparableApartmentName(value: string): string {
  return value.replace(/\s+/g, '').replace(/아파트$/, '')
}
