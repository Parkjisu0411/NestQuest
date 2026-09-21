import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { keysFromEnvironment } from './apiKeyConfig.ts'
import { getApiSettings } from './apiSettings.ts'
import { ApiKeyStatus } from '../ui/ApiKeyStatus.tsx'

describe('personal build credentials', () => {
  it('embeds only the three runtime credentials, not signing or data collection keys', () => {
    const settings = keysFromEnvironment({
      NESTQUEST_PUBLIC_DATA_KEY:' test-public ', NESTQUEST_KAKAO_REST_KEY:'test-kakao', NESTQUEST_ODSAY_KEY:'test-odsay', NESTQUEST_KAKAO_JAVASCRIPT_KEY:' test-map ',
      NESTQUEST_STORE_PASSWORD:'synthetic-signing-secret', NESTQUEST_KRIC_KEY:'synthetic-download-secret', OTHER:'synthetic-other',
    })
    expect(settings).toEqual({publicDataKey:'test-public',kakaoRestKey:'test-kakao',kakaoJavaScriptKey:'test-map'})
    expect(JSON.stringify(settings)).not.toContain('synthetic-')
  })
  it('supports unconfigured and partially configured builds without inventing keys', () => {
    expect(keysFromEnvironment({})).toEqual({publicDataKey:'',kakaoRestKey:'',kakaoJavaScriptKey:''})
    expect(keysFromEnvironment({NESTQUEST_PUBLIC_DATA_KEY:'   ',NESTQUEST_ODSAY_KEY:'test-only'})).toEqual({publicDataKey:'',kakaoRestKey:'',kakaoJavaScriptKey:''})
  })
  it('shows presence only, without putting key values into DOM or form controls', () => {
    const html=renderToStaticMarkup(createElement(ApiKeyStatus,{settings:{publicDataKey:'synthetic-public-secret',kakaoRestKey:'',kakaoJavaScriptKey:''}}))
    expect(html).toContain('등록됨');expect(html).toContain('미등록')
    expect(html).not.toContain('synthetic-');expect(html).not.toContain('<input');expect(html).not.toContain('type="password"')
  })
  it('isolates unit tests from local credentials and makes runtime configuration immutable', () => {
    const keys=getApiSettings()
    // Do not include values in assertion output if configuration regresses.
    expect(Object.values(keys).every((value)=>value==='')).toBe(true)
    expect(Object.isFrozen(keys)).toBe(true)
  })
})
