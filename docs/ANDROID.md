# Android 개인 설치

2026-09-18: 스토어 등록 없이 APK를 직접 설치하는 방식으로 확정했다. PC 서버 없이 앱 안에 포함된 화면과 기기 내 기록을 사용한다. 실제 API 연동은 웹에서 검증했으며 APK 생성·설치와 폴드 실기기 검증은 별도로 진행한다.

## 구현 상태

- Capacitor Android 프로젝트: 앱 ID `app.nestquest.personal`, 번들 `dist`, 저장소 origin `https://localhost`. 외부 개발 서버 URL을 넣지 않는다. 앱 ID/origin을 바꾸면 기존 기록에 접근할 수 없으므로 유지한다.
- 사진 첨부/복원: Capacitor WebView의 시스템 파일 선택기로 기존 파일 입력을 연결한다. Android에서는 알 수 없는 `.nestquest` MIME 때문에 복원 파일이 숨겨지지 않도록 모든 파일을 선택 가능하게 하고, 내용 검증은 기존 백업 파서에서 수행한다.
- 사진 원본: APK에서는 앱 내 대화상자로 확대 열람한다. 원본 크기로 스크롤 가능하며 닫기/뒤로가기로 돌아온다.
- 백업: 256KiB씩 캐시 파일에 기록한 다음 Android 문서 생성 화면으로 목적지를 선택한다. 복사가 끝나야 완료를 알리고 임시 파일을 정리한다. 취소는 성공으로 표시하지 않는다. 중간 쓰기 실패 시 목적지에 불완전한 파일이 남을 수 있으므로 다시 백업한다. 강제 종료 시 캐시에 남은 파일은 앱/OS 캐시 정리 대상이며 사용자 백업으로 취급하지 않는다.
- 뒤로가기: 열린 대화상자 닫기 → 앱 내 이동(편집 이탈 보호 포함) → 시작 화면에서 앱 최소화. 앱 프로세스 강제 종료를 사용하지 않는다.
- APK는 서비스 워커를 등록하지 않는다. 새 화면 코드는 APK 업데이트로 전달한다. 웹 개발/로컬 실행은 계속 가능하다.
- 회전/가용 화면 크기 변경 허용, 키보드에 따른 화면 크기 조정. 일반 사진 선택/문서 저장에 광범위한 저장소 권한을 추가하지 않는다. 자동 클라우드 백업은 끄고 명시적인 `.nestquest` 백업을 사용한다.

## 빌드 준비

2026-09-18 마지막 환경 진단: Java 17, Android SDK 및 기본 경로의 Android Studio 없음. **아직 APK 파일을 생성하지 않았으며 Java 플러그인 컴파일도 검증하지 못했다.**

1. [Capacitor 환경 안내](https://capacitorjs.com/docs/getting-started/environment-setup)에 따라 Android Studio 2025.2.1 이상 및 JDK 21 이상을 준비한다. Studio의 포함 JDK를 사용할 수 있다.
2. SDK Manager에서 Android SDK Platform 36, Android SDK Build-Tools, Platform-Tools를 설치한다. SDK 약관은 설치 화면에서 직접 확인한다.
3. `JAVA_HOME`을 JDK에, `ANDROID_HOME`을 SDK에 설정한다. 또는 Android Studio가 만든 `android/local.properties`의 `sdk.dir`을 사용한다. 시스템의 다른 Java 프로젝트 설정은 필요하면 그대로 두고 터미널 세션에만 환경변수를 적용한다.

```sh
npm ci
npm run android:doctor
npm run android:apk
```

`android:apk`는 웹 빌드 → 네이티브 동기화 → Gradle debug APK 빌드를 실행한다. 결과 경로는 `android/app/build/outputs/apk/debug/app-debug.apk`다. 이 경로는 성공 후에만 생긴다. Android Studio에서 확인하려면 `npm run android:open`을 사용한다.

## 개인용 최종 서명과 업데이트

Debug APK는 개발 확인용이다. 실제 기록을 쌓기 전 개인 서명 키를 만들고 release APK로 사용한다. 다른 PC의 debug 키 또는 다른 release 키로 바꾸면 기존 앱에 덮어 설치할 수 없다.

JDK의 `keytool`로 저장소 밖 안전한 경로에 키를 만든다. 아래 경로는 본인의 키 보관 경로로 바꾼다. 비밀번호는 대화형 입력으로 지정한다.

```sh
keytool -genkeypair -v -keystore <개인키경로>/nestquest.jks -alias nestquest -keyalg RSA -keysize 3072 -validity 10000
```

빌드 터미널에 다음 환경변수를 설정한다. 값은 저장소에 기록하지 않는다.

- `NESTQUEST_KEYSTORE`: 키 파일 절대 경로
- `NESTQUEST_STORE_PASSWORD`: 키 저장소 비밀번호
- `NESTQUEST_KEY_ALIAS`: `nestquest`
- `NESTQUEST_KEY_PASSWORD`: 키 비밀번호

`npm run android:release` 실행 후 `android/app/build/outputs/apk/release/app-release.apk`를 사용한다. 키와 비밀번호는 개인적으로 별도 보관한다. 루트 `.gitignore`에서 `*.jks`, `*.keystore`를 제외하지만 안전한 외부 보관이 우선이다. 업데이트할 때 `android/app/build.gradle`의 versionCode를 증가시키고 같은 앱 ID·서명 키로 빌드한다.

APK를 휴대폰으로 옮겨 열고, 해당 파일을 연 앱의 설치 허용을 설정한다. 업데이트 시 기존 앱을 삭제하지 않고 설치한다. 삭제·앱 데이터 초기화는 기록을 지울 수 있으므로 먼저 사진 포함 백업을 만든다. PC 브라우저의 기존 데이터는 자동 이동하지 않으며 APK 첫 화면에서 백업 복원으로 가져온다.

## 남은 작업 순서

1. **Android 빌드 환경 준비와 첫 APK 생성**: JDK/SDK 설정 후 실제 Gradle 컴파일, 오류 수정, 기본 실행 확인. 현재 환경 진단에서 차단됨.
2. **개인 서명 키 생성 및 release APK 검증**: 키 보관, 동일 서명 업데이트 시 기록 유지, PC 백업 → APK 복원 확인.
3. **네이티브 API 검증**: 웹에서 확인한 실제 API를 APK의 CapacitorHttp 경로에서 다시 확인.
4. **폴드 실기기 검증**: 접힘/펼침/회전·분할 화면·키보드·뒤로가기, 사진 선택/원본 표시, 백업 저장 위치 선택·취소·복원, 비행기 모드·재실행·대용량 사진·공간 부족. 기존 제외 범위이며 아직 실행하지 않음.
5. 위 검증에서 발견된 문제 수정 후 실제 개인 사용 시작. 촬영 입력(capture=environment)과 시스템 파일 선택을 연결했으며 실제 카메라 동작은 기기에서 확인한다.

공개 호스팅, 스토어 등록, 서버 계정/다중 사용자 동기화는 현재 계획에 없다. 다른 사용자는 저장소를 받아 자신의 키로 빌드한다. 현재 작업 폴더에는 Git 메타데이터가 없어 원격 저장소 게시도 수행하지 않았다.

## 2026-09-18 검증 이력

자동 테스트 242개, 웹 빌드, Android 동기화, lint 통과. 추가 내보내기 테스트는 네이티브 플러그인 대역을 사용한다. CLI는 취약 의존성을 피한 8.4.3으로 고정했고 설치 시 npm audit 취약점 0건을 확인했다. 네이티브 Java 컴파일 및 설치 파일 생성은 위 도구 환경 준비 후 검증해야 한다.

## 후속 기능 변경 · 2026-09-18

실제 API 연결 개발을 시작했고 실행 안내는 [API_SETUP.md](API_SETUP.md)를 따른다. 사진 입력에는 capture=environment 촬영 입력을 추가했으므로 위의 직접 촬영 미구현 표기는 이전 상태다. 실제 카메라 실행은 미검증이다. APK 빌드·설치는 사용자의 결정에 따라 기능 개발 이후로 미룬다.

## 로컬 API 키 포함 빌드

현재 정책은 `.env.local`의 세 API 키를 웹 번들 및 개인 APK에 자동 포함하는 방식이다. 모바일에서 키를 입력하지 않는다. 키 파일과 빌드 산출물은 Git에서 제외한다. [설정과 보안 경계](LOCAL_KEYS.md)를 먼저 확인한다. 실제 APK 빌드/설치 일정은 기존대로 기능 개발 후다.

## 최신 웹 검증 · 2026-09-21

295개 테스트·lint·웹 빌드 통과. 실제 API/사진 복원 검증은 [LIVE_VALIDATION.md](LIVE_VALIDATION.md) 참고. 이번에는 android:sync나 APK 빌드를 실행하지 않았다.
