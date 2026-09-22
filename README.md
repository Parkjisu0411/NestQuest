# NestQuest

서울 아파트를 조건에 맞게 추리고 임장·평가·최종 후보를 기록하는 개인용 앱입니다. 공공 단지·실거래와 카카오 지도·주소·참고 통근을 연동합니다. 일반 모바일은 지도 중심, 넓은 화면은 지도와 목록을 함께 표시합니다.

## 실행

`npm ci` 후 로컬 키를 설정하고 `npm run dev`로 개발 화면을 실행합니다. 키 값은 Git이나 백업에 넣지 않습니다. [키 설정](docs/LOCAL_KEYS.md) · [API 준비](docs/API_SETUP.md)

`npm run local`은 빌드 후 로컬 서버를 실행합니다. 기존 빌드 실행은 `npm start`입니다. 기본 주소는 http://127.0.0.1:4173 입니다. [로컬 사용](docs/LOCAL_USE.md)

## 검증과 모바일

- `npm run lint`: 정적 검사
- `npm test`: 자동 회귀 테스트
- `npm run build`: 웹 및 오프라인 셸 빌드

모바일 목표는 직접 설치하는 개인 Android APK입니다. 개인 빌드에는 추출 가능한 API 키가 포함되므로 다른 사용자는 소스와 빈 템플릿으로 자신의 키를 설정해 빌드합니다. APK·실기기 검증은 아직 별도 단계입니다. [Android 안내](docs/ANDROID.md)

## 문서

- [현재 개발 상태](docs/ROADMAP.md), [검증 범위](docs/LIVE_VALIDATION.md)
- [제품 정책](docs/PRODUCT_SPEC.md), [UI/UX](docs/UX_SPEC.md)
- [점수 계산](docs/SCORING.md), [데이터 모델](docs/DATA_MODEL.md)
- [데이터 출처](docs/DATA_SOURCES.md), [지도 자료](docs/MAP_DATA_PLAN.md)
- [캐시 정책](docs/DATA_CACHE.md), [일반 아파트 분류](docs/HOUSING_TYPE.md)
- [사진 백업](docs/PHOTO_BACKUP.md)

실데이터 범위는 현재 서울이며, 수도권 전체 지원과 모든 단지 정보 확인을 뜻하지 않습니다. 최신 확정 제품 정책이 문서의 초기 예시보다 우선합니다.

첫 실행용 단지 데이터를 APK에 포함하려면 [초기 자료 준비 절차](docs/DATA_CACHE.md)를 따릅니다. 초기 자료 파일은 Git에 포함되지 않으며, PC 데이터 관리에서 내보낸 파일로 준비합니다.
