export interface ApiSettings { publicDataKey: string; kakaoRestKey: string; kakaoJavaScriptKey: string }
export const API_KEY_FIELDS = [
  ['publicDataKey', 'NESTQUEST_PUBLIC_DATA_KEY', '공공데이터'],
  ['kakaoRestKey', 'NESTQUEST_KAKAO_REST_KEY', '카카오 주소·통근'],
  ['kakaoJavaScriptKey', 'NESTQUEST_KAKAO_JAVASCRIPT_KEY', '카카오 지도'],
] as const
export function keysFromEnvironment(environment: Record<string, string | undefined>): ApiSettings {
  return {
    publicDataKey: environment.NESTQUEST_PUBLIC_DATA_KEY?.trim() ?? '',
    kakaoRestKey: environment.NESTQUEST_KAKAO_REST_KEY?.trim() ?? '',
    kakaoJavaScriptKey: environment.NESTQUEST_KAKAO_JAVASCRIPT_KEY?.trim() ?? '',
  }
}
