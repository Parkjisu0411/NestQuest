import { readFile, writeFile, rename } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseMapBundle } from '../src/data/map/schema.ts'

// Input is a normalized WGS84 bundle, not a raw provider response or SHP file.
const input = process.argv[2]
if (!input) throw new Error('사용법: npm run map:prepare -- <정규화한 지도 JSON> [--check]')
const raw = await readFile(path.resolve(input), 'utf8')
if (Buffer.byteLength(raw)>20*1024*1024) throw new Error('지도 파일이 20MiB를 초과합니다.')
const bundle = parseMapBundle(JSON.parse(raw))
const codes = ['11110','11140','11170','11200','11215','11230','11260','11290','11305','11320','11350','11380','11410','11440','11470','11500','11530','11545','11560','11590','11620','11650','11680','11710','11740']
if (codes.some((code) => !bundle.regions.some((region) => region.code===code))) throw new Error('서울 25개 구 코드가 일치하지 않습니다.')
const hash = createHash('sha256').update(raw).digest('hex')
console.log(`지도 검증: ${bundle.regions.length}개 구 / ${bundle.stations.length}개 역 / ${bundle.routes.length}개 경로 · 입력 SHA256 ${hash}`)
if (!process.argv.includes('--check')) {
  const target = fileURLToPath(new URL('../src/data/map/map-bundle.json', import.meta.url))
  const output = JSON.stringify({ ...bundle, build: { inputSha256: hash, generatedAt: new Date().toISOString() } })+'\n'
  await writeFile(target+'.tmp',output)
  await rename(target+'.tmp',target)
  console.log('지도 자료를 교체했습니다. 앱 빌드 후 반영됩니다.')
}
