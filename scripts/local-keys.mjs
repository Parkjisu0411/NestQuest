import { copyFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { API_KEY_FIELDS, keysFromEnvironment } from '../src/data/apiKeyConfig.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const action = process.argv[2] ?? 'check'
if (action === 'init') {
  try {
    await copyFile(new URL('../.env.example',import.meta.url),new URL('../.env.local',import.meta.url),constants.COPYFILE_EXCL)
    console.log('.env.local을 만들었습니다. 사용자 편집기에서 키를 입력하세요. 값은 출력하지 않습니다.')
  } catch (error) {
    if (error?.code === 'EEXIST') console.log('.env.local이 이미 있습니다. 내용을 읽거나 덮어쓰지 않았습니다.')
    else { console.error('로컬 키 파일을 만들지 못했습니다. 파일 권한을 확인하세요.'); process.exitCode=1 }
  }
} else if (action === 'check') {
  const mode = process.argv[3] ?? 'development'
  if (!['development','production'].includes(mode)) throw new Error('development 또는 production을 지정하세요.')
  try {
    const keys = keysFromEnvironment(loadEnv(mode,root,'NESTQUEST_'))
    console.log(`키 설정 상태 (${mode}, 실제 인증 성공 여부는 별도)`)
    for (const [field,,label] of API_KEY_FIELDS) console.log(`${label}: ${keys[field] ? '등록됨' : '미등록'}`)
  } catch { console.error('키 설정을 읽지 못했습니다. 로컬 파일 형식을 확인하세요.'); process.exitCode=1 }
} else throw new Error('init 또는 check 명령을 사용하세요.')
