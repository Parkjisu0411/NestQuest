import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, basename } from 'node:path'
import { createHash } from 'node:crypto'
import { parseBootstrap, bootstrapSummary } from '../src/data/bootstrap.ts'
const local = resolve('local-data/bootstrap.json')
const supplied = process.argv[2]
try {
  const input = supplied ? resolve(supplied) : local
  if (/^\.env($|\.)/i.test(basename(input)) || /\.(apk|aab|jks|keystore)$/i.test(input) || /[\\/](dist|assets)[\\/]/i.test(input)) throw new Error()
  if (!existsSync(input)) {
    if (supplied) throw new Error()
    await writeFile('public/bootstrap.json',JSON.stringify({status:'empty'}))
    console.log('초기 자료 없음: PC 데이터 관리에서 APK 초기 자료를 내보내고 npm run seed:prepare -- <파일경로> 를 실행하세요.')
  } else {
    const seed = parseBootstrap(JSON.parse(await readFile(input,'utf8')))
    if (!seed.catalog.records.length) throw new Error()
    seed.version = createHash('sha256').update(JSON.stringify(seed.catalog)).digest('hex')
    const text = JSON.stringify(seed)
    await mkdir('local-data',{recursive:true})
    await writeFile(local,text)
    await writeFile('public/bootstrap.json',text)
    console.log('APK 초기 자료 준비:',bootstrapSummary(seed))
  }
} catch {
  console.error('초기 자료 준비 실패: 데이터 관리에서 내보낸 자료 파일과 경로를 확인하세요. 빌드를 중단합니다.')
  process.exitCode=1
}
