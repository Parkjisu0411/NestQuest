// Download public CSV files only; this command never reads local credentials.
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output=path.resolve(process.argv[2] ?? 'tmp-map','rail')
await mkdir(output,{recursive:true})
for(const id of ['15041298','15041310','15041074','15081853','15081858','15041284','15041295','15041327','15041423','15041350','15041340','15041299']) {
  const page=`https://www.data.go.kr/data/${id}/fileData.do`
  const response=await fetch(page,{signal:AbortSignal.timeout(30000)})
  if(!response.ok)throw new Error(`Metadata unavailable: ${id}`)
  const html=await response.text()
  if(!html.includes('이용허락범위 제한 없음'))throw new Error(`Review current license before importing ${id}`)
  const url=html.match(/"contentUrl":\s*"([^"]+)"/)?.[1]
  if(!url || new URL(url).origin!=='https://www.data.go.kr')throw new Error(`Review download location: ${id}`)
  const file=await fetch(url,{signal:AbortSignal.timeout(30000),redirect:'error'})
  if(!file.ok)throw new Error(`Download unavailable: ${id}`)
  const bytes=Buffer.from(await file.arrayBuffer())
  if(bytes.length>2_000_000 || !new TextDecoder('euc-kr').decode(bytes).startsWith('철도운영기관명,'))throw new Error(`Unexpected CSV: ${id}`)
  await writeFile(path.join(output,`${id}.csv`),bytes)
  console.log(`공개 노선 CSV ${id} 저장`)
}
console.log('원본의 기준일·역명·분기는 map:convert 및 회귀 테스트로 다시 확인하세요.')
