import { API_KEY_FIELDS, type ApiSettings } from '../data/apiKeyConfig.ts'

export function ApiKeyStatus({ settings }: { settings: Readonly<ApiSettings> }) {
  return <section aria-label="API 연결 설정 상태">
    <h2>API 연결 설정</h2>
    <p>이 앱에 포함된 설정을 자동으로 사용합니다. 휴대폰에서 키를 입력할 필요가 없습니다.</p>
    <ul>{API_KEY_FIELDS.map(([field,,label]) => <li key={field}>{label}: {settings[field] ? '등록됨' : '미등록'}</li>)}</ul>
    <p>미등록 기능은 개발 PC에서 키를 설정한 후 앱을 다시 빌드하면 사용할 수 있습니다. 등록 여부는 실제 연결 성공을 뜻하지 않습니다.</p>
  </section>
}
