import { existsSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const mode = process.argv[2] ?? 'doctor'
if (!['doctor', 'debug', 'release'].includes(mode)) throw new Error('Expected doctor, debug or release')
const javaHome = process.env.JAVA_HOME
const java = javaHome ? join(javaHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java'
const version = spawnSync(java, ['-version'], { encoding: 'utf8' })
const major = Number(/version "(\d+)/.exec(version.stderr ?? '')?.[1])
let sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
const localProperties = resolve('android/local.properties')
if (!sdk && existsSync(localProperties)) {
  sdk = /^sdk\.dir=(.+)$/m.exec(readFileSync(localProperties, 'utf8'))?.[1]?.trim().replace(/\\:/g, ':').replace(/\\\\/g, '\\')
}
if (!sdk && process.env.LOCALAPPDATA) sdk = join(process.env.LOCALAPPDATA, 'Android', 'Sdk')
const problems = []
if (major !== 21) problems.push(`이 프로젝트의 CLI 빌드는 JDK 21을 사용합니다 (현재 ${major || '찾지 못함'}). JDK 21을 설치하고 JAVA_HOME을 해당 경로로 설정하세요. 최신 Studio의 내장 JDK는 25일 수 있습니다.`)
if (!sdk || !existsSync(join(sdk, 'platforms', 'android-36', 'android.jar'))) problems.push('Android SDK Platform 36 필요. ANDROID_HOME 또는 android/local.properties를 설정하세요.')
if (!sdk || !existsSync(join(sdk, 'build-tools'))) problems.push('Android SDK Build-Tools가 필요합니다.')
if (problems.length) {
  console.error(problems.join('\n'))
  console.error('설치 및 서명 안내: docs/ANDROID.md')
  process.exit(1)
}
console.log(`JDK ${major}, SDK ${sdk}`)
if (mode !== 'doctor') {
  if (mode === 'release' && !['NESTQUEST_KEYSTORE', 'NESTQUEST_STORE_PASSWORD', 'NESTQUEST_KEY_ALIAS', 'NESTQUEST_KEY_PASSWORD'].every((key) => process.env[key])) {
    console.error('서명 환경변수 4개가 필요합니다. docs/ANDROID.md를 확인하세요.')
    process.exit(1)
  }
  const wrapper = process.platform === 'win32' ? 'gradlew.bat' : './gradlew'
  const result = spawnSync(wrapper, [mode === 'release' ? 'assembleRelease' : 'assembleDebug'], {
    cwd: resolve('android'), stdio: 'inherit', shell: process.platform === 'win32',
    env: { ...process.env, ANDROID_HOME: sdk },
  })
  if (result.error) console.error(result.error.message)
  process.exit(result.status ?? 1)
}
