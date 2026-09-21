> 최신 확정 정책과 구현/검증 상태는 [PRODUCT_SPEC.md](PRODUCT_SPEC.md), [ROADMAP.md](ROADMAP.md), [LIVE_VALIDATION.md](LIVE_VALIDATION.md)를 우선한다. 아래는 초기 명세와 이력을 포함한다.

# NestQuest V0.1 UX Specification

## 현재 UI 기준 · 2026-09-21

밝은 중립 배경·흰 카드·청록 강조색과 SVG 아이콘을 사용한다. 탐색/비교/설정은 하단 메뉴, 상세/입력은 별도 화면이다. 좁은 화면은 지도와 접이식 목록, 720px 이상은 지도·목록 병렬 배치다. 설정은 행 전체로 조작하며 설명은 최소화한다. 상세의 임장 기록 버튼은 하단에 고정한다.

탐색 마커는 일반(회색 건물), 관심(분홍 하트), 다녀온 집(청록 체크), 최종 후보(황금 별)이다. 선택은 별도 테두리, 묶음은 중립색과 개수로 표시한다. 묶음 목록에도 단계 아이콘이 있고 외부 클릭·닫기·Escape로 닫는다. 아래 초기 화면 예시보다 이 기준이 우선한다.


## APK 확정 · 2026-09-18

최종 모바일 형태는 스토어 없이 직접 설치하는 Android APK로 확정했다. 아래의 APK 미정 표기는 이전 이력이다. Capacitor Android 프로젝트, 네이티브 백업 저장 위치 선택, 앱 뒤로가기, 사진 원본 뷰어 및 빌드/서명 설정을 추가했다. 현재 PC에 JDK 21 및 Android SDK가 없어 네이티브 컴파일과 APK 생성은 아직 완료하지 못했다. 최신 실행 방법과 남은 작업은 [ANDROID.md](ANDROID.md)를 따른다.

## 현재 구현 보완 · 2026-09-18

일반 모바일은 지도 중심, 가용 너비 720px 이상은 지도와 목록 병렬 구성이다. 비교는 방문 전 단지도 최대 4개까지 선택하며 좁은 화면에서는 표 내부를 가로 스크롤한다. 정보 미확인 표시와 포함 설정, 선택 입력인 집 내부 관찰, 완료 임장/평가 수정 이탈 확인을 제공한다. 새 임장은 자동 초안을 사용한다. 초기 저장소 읽기 실패 시 초기 설정으로 진행하지 않고 재시도 또는 백업 복구를 제공한다. 개인 로컬 실행 및 아직 미확정인 APK 방향은 [LOCAL_USE.md](LOCAL_USE.md)를 따른다.


## 1. Purpose

This document defines the primary UX and navigation model for NestQuest V0.1.

NestQuest is mobile-first.

When desktop and mobile UX conflict, prioritize mobile usability.

PRODUCT_SPEC.md takes precedence if a product behavior conflict exists.

---

# 2. Information Architecture

The application should remain intentionally small.

Primary structure:

Setup
  ↓
Quest
  ├── Apartment Detail
  │     ├── AI Research
  │     └── Visit
  │
  └── Shortlist / Compare

Settings

Quest is Home.

Do not create separate top-level navigation destinations for:

- Discover
- Candidates
- Visits
- Shortlist

V0.1 supports one active Quest.

Do not create Quest creation/selection/management UI.

---

# 3. First Run / Setup

Setup is a step-based mobile onboarding flow.

Show one focused decision at a time.

Do not present Setup as one long scrolling configuration form.

The user should generally complete the current step, then move forward.

Lightweight progress such as `2 / 5` is enough.

The user must be able to go back without losing entered data.

Multi-input and multi-select steps use an explicit Next action.

Simple single-choice subquestions may auto-advance.

The final CTA `집 찾아보기` appears only on the last step.

Principle:

입력한 조건만 필터로 사용한다.

Setup is a quick starting point. The user should not need to know every housing criterion before starting.

Optional Hard Filters may be left empty. Empty means no filter for that criterion, not a hidden default.

Suggested top-level steps:

1. 지역
2. 예산
3. 집 조건
4. 출퇴근
5. 내가 중요하게 보는 것
6. 완료

There is no dedicated loan-assumption Setup step.

## 지역

지역을 선택해주세요

Search Area remains required. Do not add 지역 건너뛰기 in Phase 1.

Fast bulk actions come first:

[ 서울 전체 ] [ 경기 전체 ]
[ 전체 해제 ]

If the dataset includes Incheon, also show 인천 전체.

Then grouped individual sigungu selection, for example:

서울
강서구  마포구  영등포구 ...

경기
고양시  과천시  성남시 ...

Bulk actions write into the same selected `QuestArea[]`. The user may then deselect individual districts.

The existing stylized SVG map remains as visual support. Do not redesign or replace it in this phase.

Quest Home map redesign, real/custom maps, licensed boundaries, and commute place search are deferred.

The user taps Next after finishing selection.

## 예산

어느 정도까지 생각하고 있나요?

Budget is optional. Empty fields are valid.

내 자금
[3.0억]

예상 대출한도
[5.0억]

구매예산
8.0억  or  조건 없음

[대출한도 알아보기]

If both inputs are empty, purchase budget is undefined and price is not a Hard Filter.

If only one input is present, the missing component is treated as 0 for the stated budget.

Do not collect interest rate or loan term on this step.

Phase 1 may present 대출한도 알아보기 as a prototype/stub that shows a static research prompt.

Do not integrate an external AI API in Phase 1.

The full loan-limit helper belongs to Phase 4.

## 집 조건

최소 전용면적, 최대 연식, and 최소 세대수 are independently optional.

Empty means no filter for that field. Do not require skipping the whole step as a unit.

Keep this visually lightweight.

The user taps Next even when some or all fields are empty.

## 출퇴근

This top-level step may contain two subquestions. They remain `4 / 5`.

어디로 출퇴근하나요?

The destination itself is optional. The user may continue with `아직 정하지 않았어요` without choosing one of the mock destinations.

Phase 1 uses a small curated mock destination selector rather than external geocoding.

Place search, subway-station search, and map selection are deferred.

Do not invent a default destination.

Selecting a destination may automatically move to the commute-time question.

출퇴근은 최대 통근시간
[60분]

Maximum commute time is optional. If omitted, commute information may still be shown when a destination exists, and commute time is not a Hard Filter.

If no destination exists, commute information is omitted and commute time is not a Hard Filter.

The user taps Next with an empty time field.

Do not call a routing API during Setup.

## 내가 중요하게 보는 것

Ask one evaluation-priority metric at a time.

Example:

5 / 5

1 / 6

역 접근성은 얼마나 중요한가요?

[평가 안 함]
[낮음]
[보통]
[높음]
[매우 높음]

Selecting a value saves it immediately and advances to the next metric.

After all six are selected, show a compact review. The user may tap a row to edit that answer.

The unselected state remains different from 평가하지 않음.

Display copy such as `평가 안 함` may be used if the domain meaning remains 평가하지 않음.

Korean labels must stay on one line. Do not force five narrow equal-width buttons.

The review should distinguish omitted Hard Filters as `조건 없음` rather than 0원 or 0㎡.

Evaluation Priorities remain required. There are no hidden priority defaults.

The only Setup completion CTA is:

[집 찾아보기]

The exact visual controls may evolve during prototype testing.

The underlying fields must remain consistent with PRODUCT_SPEC.md.

---

# 4. Evaluation Priorities

Evaluation Priorities are part of initial Setup.

The user defines importance for the six User Evaluation metrics during Setup.

The same priorities apply to all apartments in the active Quest.

They may later be edited in Settings.

Do not invent hidden default priority values.

The UI must make every choice explicit.

During Setup, ask one metric at a time.

Selecting a priority auto-advances to the next metric.

After all six are answered, show a compact review that can be edited.

Do not ask the user to set priorities during every Visit.

Suggested UI:

내가 중요하게 보는 것

역 접근성
[높음]

통근 체감
[매우 높음]

상권
[보통]

학군
[평가하지 않음]

자연 / 산책
[높음]

동네 분위기
[매우 높음]

Available values:

- 평가하지 않음
- 낮음
- 보통
- 높음
- 매우 높음

Priorities are defined once during Setup and reused across apartments.

Do not ask the user to set priorities during every Visit.

The sample values shown above (높음, 매우 높음, 보통, 평가하지 않음) are UI illustrations of possible choices. They are not product defaults.

---

# 5. Quest Home

Confirmed layout direction (2026-09-17): map-centered on ordinary mobile and folded screens; map and list visible together on unfolded Fold screens with sufficient space. The vertically stacked example below is a historical prototype reference, not the final responsive layout requirement. Detailed proposed interactions are tracked in PRODUCT_SPEC.md and are not yet all approved.

Suggested mobile structure:

NestQuest                         ⚙

내 집 찾기
서울 8개 지역 · 59㎡ 이상

[전체] [관심] [다녀온 집] [최종 후보]

┌──────────────────────────┐
│                          │
│        QUEST MAP         │
│                          │
└──────────────────────────┘

compact result row
compact result row
compact result row

Hierarchy:

1. compact Quest context
2. stage navigation
3. map
4. apartment results

The Quest context is a compact summary of entered criteria only. Do not list every selected district when many are chosen. Do not show omitted filters as 0원, 0분, or 999년.

The Quest Map and Apartment List share the same active Stage Filter.

The apartment list is a browsing/navigation tool. Each result should answer quickly: 무슨 단지인가, 어느 정도 크기인가, 가격은 어느 정도인가, 출퇴근은 어떤가 (configured only), 내가 어떤 상태로 보고 있는가, 다녀왔다면 My Score는 얼마인가.

Clicking a result opens the existing Apartment Detail page. Marker hover/preview modal behavior is deferred with the map redesign.

Phase 1 Quest Map is a lightweight prototype.

It should validate:

- approximate spatial understanding
- apartment marker placement
- selected Quest Area context
- synchronization with Stage Filter and the apartment list

Do not build production map infrastructure in Phase 1.

Do not use Kakao, Naver, or Google Maps for the Quest Map in Phase 1.

Do not fetch real administrative boundary GeoJSON in Phase 1.

Custom/detailed map redesign remains deferred.

---

# 6. Stage Visualization

Conceptual hierarchy:

DISCOVERED
= subtle

CANDIDATE
= emphasized

VISITED
= clearly visited

SHORTLIST
= strongest emphasis

PASSED
= hidden by default

Exact colors and marker shapes are implementation/design decisions.

Do not make the map resemble an RPG game board.

---

# 7. Stage Filters

Filters:

전체
관심
다녀온 집
최종 후보

Semantics:

전체:
DISCOVERED + CANDIDATE + VISITED + SHORTLIST

관심:
CANDIDATE + VISITED + SHORTLIST

다녀온 집:
VISITED + SHORTLIST

최종 후보:
SHORTLIST

PASSED apartments are hidden by default.

A secondary action may provide:

"제외한 집 보기"

Conceptual progression, not a mandatory workflow:

조건에 맞는 집
→ 관심 있는 집
→ 직접 다녀온 집
→ 최종적으로 고민 중인 집

The user still explicitly controls stage changes. Do not automatically promote apartments.

---

# 8. Apartment List Card — Before Visit

The default list uses compact result rows, not tall fact dumps.

Example:

영등포자이 디그니티
영등포구 · 59㎡
7.9억 · 여의도 18분
관심

If commute is not configured, omit commute rather than reserving empty space:

영등포자이 디그니티
영등포구 · 59㎡
7.9억
관심

DISCOVERED apartments need no prominent status label.

Do not display My Score before a Visit.

Avoid using a generic star for Candidate because star symbolism is reserved conceptually for Shortlist.

Prefer explicit wording:

"관심에 담기"

---

# 9. Apartment List Card — After Visit

Example:

상도효성해링턴플레이스
동작구 · 84㎡
8.1억 · 여의도 27분
다녀온 집 · 내 점수 4.2

For SHORTLIST:

★ 최종 후보

Show My Score only when eligible under existing rules, with a restrained label such as `내 점수 4.2`.

When the `최종 후보` filter is selected, preserve manual shortlist order. Do not sort by My Score.

---

# 10. Apartment Detail

Use one vertically scrolling page on mobile.

Avoid unnecessary nested tabs.

Recommended order:

1. Overview
2. Unit / Price
3. Commute
4. Complex Facts
5. Research
6. My Quest

---

# 11. Apartment Detail — Overview

Suggested information:

Apartment name

Address

Target Unit Type selector/chips

Estimated Price

Commute Time

Nearest Station

Approval Year

Household Count

Current Quest Stage

Relevant Stage Action

Example:

마곡엠밸리7단지

서울 강서구 ...

[59㎡] [84㎡]

예상가격
8.6억

통근
43분

가까운 역
약 480m

2014년 · 1,004세대

[관심에 담기]

---

# 12. Unit / Price

Example:

59㎡

예상가격
8.6억

최근 거래범위
8.3 ~ 8.9억

최근 거래
8.7억

거래건수
9건

신뢰도
높음

최근 실거래

08.21
8.7억
12층

07.14
8.5억
8층

06.03
8.9억
17층

Multiple target Unit Types may be shown using compact selectors/chips.

Do not show room/bathroom counts unless a future specification explicitly introduces them.

---

# 13. Commute

If no commute destination is configured, omit commute information. Do not show 0분, 미정 0분, or other fake values.

If a destination exists and commute data is available, show compact information such as `여의도 18분` in the list, and the full route in Apartment Detail.

Example:

통근 43분

집
│ 도보 7분
▼
마곡나루역
│ 9호선 · 24분
▼
여의도역
│ 도보 6분
▼
회사

Transfers and walking information are explanatory.

Do not convert them into hidden penalties.

Only total commute time participates in the V0.1 Hard Filter, and only when both destination and maxCommuteMinutes exist.

---

# 14. Complex Facts

Possible factual information:

- 준공
- 세대수
- 동수
- 주차
- 난방
- 관리비

Only show fields supported by actual available data.

Do not assign subjective scores to these facts.

Do not turn these into additional Hard Filters in V0.1.

---

# 15. Research

Research is supporting information and should be visually secondary.

Before research:

리서치

상권

아직 조사하지 않았어요

[AI 리서치 가이드]

학군

아직 조사하지 않았어요

[AI 리서치 가이드]

After research:

상권

[research summary]

근거 / 출처

조사일
2026.09.15

[자세히 보기]

Do not show:

상권 87점

or similar pseudo-precise AI scoring.

Phase 1:

AI Research may be represented by mock imported research data.

The AI Research guide may be a prototype/stub.

Do not integrate an external AI API in Phase 1.

Do not expand the Phase 4 AI Research workflow into Phase 1.

Fixture research summaries are mock data. Do not imply they are current real-world research.

---

# 16. My Quest — Before Visit

Example:

MY QUEST

아직 방문 기록이 없어요.

[임장 기록 시작]

Do not show My Score.

---

# 17. Start Visit

Suggested prototype:

마곡엠밸리7단지

임장 기록

2026.09.20 14:30

방문 시간
[주말 낮]

사진
[+ 사진 추가]

좋았던 점
[+ 추가]

아쉬웠던 점
[+ 추가]

자유 메모
[                    ]

[임장 완료]

---

# 18. Visit Type — PROVISIONAL

The following Visit Type options are a prototype proposal, not a frozen product requirement:

- 평일 낮
- 평일 저녁
- 주말 낮
- 주말 저녁
- 기타

Codex may use these during the Phase 1 prototype.

However, they must remain easy to change after mobile usability testing.

Do not build significant logic around these exact categories.

---

# 19. Visit Capture Principle

Draft recovery (implemented 2026-09-17): opening Visit checks the current Quest/apartment draft before rendering the editor. Existing drafts resume automatically with a notice, including attached originals and evaluation progress. Show saving/saved/error status and explicit draft-save retry. A draft does not count as a Visit. Completion removes it only after the combined visit/photo transaction succeeds. Saved drafts survive reopening the same browser origin; a force-stop before save completion can lose the latest pending changes.

Updated direction confirmed on 2026-09-17: prioritize structured on-site entry. The user should be able to navigate observation topics and record findings during the visit. The earlier quick-capture-first flow below is historical context and must not determine the new form structure. Topic names, photo-to-topic association, and rating controls are proposals tracked in PRODUCT_SPEC.md; they are not yet fixed requirements.

Do not force the user to stop during the physical Visit and complete six ratings.

Primary on-site capture:

photos
+
quick positives
+
quick negatives
+
free memo

Evaluation can occur when completing the Visit or afterward.

The Visit workflow should optimize for speed on a phone.

---

# 20. Evaluation After Visit

Independent editing (implemented 2026-09-17): Apartment Detail offers “평가하기” after a saved visit without evaluation, or “평가 수정” when an evaluation exists. The dedicated evaluation route shows all six ratings and their existing importance values, supports “평가 안 함”, and loads existing qualitative notes for text editing or deletion. New notes can be added. “평가 저장” does not create a Visit; “취소” returns without applying the local edits. Save failure retains the open form for retry. The evaluation fields use two columns where width permits. Editing importance remains in Settings.

Suggested UI:

이번 집은 어땠나요?

역 접근성
★★★★★

통근 체감
★★★★★

상권
★★★★★

학군
[평가 안 함]

자연 / 산책
★★★★★

동네 분위기
★★★★★

Each metric should include a concise guidance description.

---

# 21. 역 접근성 Guidance

Question:

"집에서 주요 지하철역까지 실제로 이동하기 얼마나 편한가?"

Consider:

- perceived distance
- hills
- stairs
- crossings
- route convenience
- station entrance access

Objective station distance remains separately visible.

---

# 22. 통근 체감 Guidance

Question:

"이 경로를 평일마다 반복한다고 생각했을 때 얼마나 괜찮은가?"

Consider:

- transfer fatigue
- congestion
- bus dependency
- walking
- transfer flow
- overall fatigue

Objective commute minutes remain separately visible.

---

# 23. 상권 Guidance

Question:

"실제 거주했을 때 일상생활에 필요한 상업시설을 이용하기 얼마나 좋은가?"

Consider:

- supermarkets
- convenience stores
- restaurants
- cafes
- hospitals
- pharmacies
- everyday services
- variety

Larger or busier does not automatically mean better.

---

# 24. 학군 Guidance

Question:

"내가 중요하게 생각하는 교육환경을 얼마나 충족하는가?"

Consider:

- school accessibility
- assigned-school information
- academy access
- educational environment
- personally researched information

This metric may be evaluated from research rather than physical observation.

The user may choose:

"평가 안 함"

---

# 25. 자연 / 산책 Guidance

Question:

"집 주변에서 걷거나 쉬거나 야외활동을 하기 얼마나 좋은가?"

Consider:

- parks
- walking paths
- rivers
- green space
- apartment landscaping
- accessibility

---

# 26. 동네 분위기 Guidance

Question:

"이 동네에서 실제로 살고 싶은 느낌이 드는가?"

Consider:

- street atmosphere
- comfort
- activity / quietness
- building/street impression
- overall residential preference

Do not split this into multiple numeric sub-metrics.

---

# 27. Extra Factors

Implemented revision (2026-09-17): these are qualitative strengths and concerns, separate from the score.

After User Evaluation:

추가 장단점을 남겨 주세요. 점수에는 반영하지 않습니다.

[좋았던 점]

[아쉬웠던 점]

Example:

좋았던 점

내용

[거실에서 한강뷰가 상당히 좋음]

No impact selector is shown. Both positive and negative notes use text entry.

A severe negative factor may also provide:

[후보 제외]

This must never automatically PASS the apartment.

---

# 28. Visit Completion

After evaluation:

MY SCORE 4.4 / 5

[★ 최종 후보에 추가]

[완료]

Adding to Shortlist is optional.

Completing a Visit normally results in VISITED unless the user explicitly chooses another permitted stage action.

---

# 29. Multiple Visits

Implemented visit reading (2026-09-17): each visit in Apartment Detail has a “기록 전체 보기” link with its photo count. `/apartments/:apartmentId/visits/:visitId` displays that visit's date/time, all positive and negative observations, multiline memo, and saved photos. Photos open at full size in a new tab. Missing originals are distinguished from read/decode failures; failures offer retry. Wide layouts display notes and photos side by side. The view is read-only; editing remains a separate follow-up.

Example history:

09.20 · 주말 낮

10.03 · 평일 저녁

10.12 · 기타

Each Visit preserves its own:

- photos
- pros
- cons
- memo

After a later Visit, the application may ask:

기존 평가도 수정할까요?

[평가 수정]

[그대로 유지]

A new Visit must not automatically modify User Evaluation.

---

# 30. My Quest — After Visit

Example:

MY SCORE 4.4 / 5

역 접근성
★★★★☆

통근 체감
★★★★★

상권
★★★★☆

학군
-

자연 / 산책
★★★☆☆

동네 분위기
★★★★★

+ 거실 개방감이 좋음

- 저녁 시간 도로 소음

최근 임장

2026.09.20 · 주말 낮

"전체적으로 예상보다 좋았음"

사진 6장

[임장 기록 보기]

[평가 수정]

---

# 31. Shortlist

When the user explicitly chooses SHORTLIST:

★ SHORTLIST

Shortlist Memo

[출퇴근 최우선이면 1순위.
59㎡ 실거래 9억 초반 나오면 적극 검토.]

[메모 수정]

[최종 후보에서 제외]

[PASS]

Shortlist Memo is the current decision memo.

It is separate from Visit notes.

---

# 32. Shortlist Overview

Suggested:

MY PICKS

1
영등포자이 디그니티

MY 4.6

59㎡ · 예상 9.3억

통근 31분

"출퇴근 최우선이면 1순위"


2
상도효성해링턴플레이스

MY 4.3

59㎡ · 예상 8.8억

통근 38분


3
마곡엠밸리7단지

MY 4.1

59㎡ · 예상 8.5억

통근 43분

Users must be able to manually reorder the Shortlist.

Manual order does not need to match My Score.

---

# 33. Compare

Compare should avoid becoming a dense desktop spreadsheet on mobile.

The prototype may use:

- selected apartment cards
- horizontally scrollable comparison
- grouped comparison sections

The final interaction should be selected based on mobile usability.

Required conceptual sections:

## VERIFIED DATA

- 예상가격
- 통근
- 가까운 역
- 연식
- 세대수
- 주차
- 관리비

## MY EVALUATION

- 역 접근성
- 통근 체감
- 상권
- 학군
- 자연 / 산책
- 동네 분위기
- MY SCORE

## DECISION CONTEXT

- Extra positive factors
- Extra negative factors
- Shortlist Memo
- manual shortlist order

Never display an automatically selected winner.

---

# 34. Settings

Keep Settings intentionally small.

Route: `/settings`

Settings edits the current active Quest. V0.1 has exactly one Quest.

Do not implement Quest names, lists, switching, accounts, sync, notifications, or theme settings.

Information architecture:

1. 탐색 조건
2. 평가 기준
3. 대출 상환 참고
4. 데이터
5. NestQuest 정보

The default screen shows current values in a compact, scannable list. Editing uses progressive disclosure on the same route. Do not reproduce Setup onboarding.

Optional SearchCriteria display as `조건 없음` or `설정 안 함`. Never show 0원, 0분, or 999년 for omitted filters.

Commute destination is optional. Clearing it also clears max commute filtering.

Evaluation Priorities edit the same Quest-level values used by My Score. Ratings, Visits, Extra Factors, stage, and shortlist rank stay unchanged.

Loan assumptions are secondary reference settings, not discovery criteria. Repayment method remains 원리금균등.

Backup / Restore lives in the 데이터 section and stays visually secondary.

    백업 파일 만들기
    NestQuest 기록을 JSON 파일로 저장합니다.

    백업에서 복원
    저장해 둔 NestQuest 백업 파일을 불러옵니다.

JSON backup does not include visit photo binaries. The UI must state that limitation. Restore requires confirmation that the current record will be replaced.

Do not turn Settings into a file-management dashboard, financial profile, or account-management area.

---

# 35. Navigation

Avoid unnecessary bottom navigation.

Preferred initial architecture:

Quest
= Home
= `/`

Settings
= accessed from Quest header
= `/settings`

Compare
= entered from Shortlist
= `/compare`

Apartment Detail
= entered from Quest Map/List
= `/apartments/:apartmentId`

Visit
= entered from Apartment Detail
= `/apartments/:apartmentId/visit`
= a full-screen mobile route
= not a modal
= not a bottom sheet

Setup
= `/setup`
= first run
= later SearchCriteria edits happen in Settings, not by replaying Setup

Do not create navigation for Multi-Quest management.

Do not add a bottom navigation bar for Discover, Candidates, Visits, or Shortlist.

---

# 36. UX Design Language

The UI should feel:

- warm
- calm
- personal
- exploratory
- clean
- data-aware

Avoid:

- dense financial dashboards
- heavy enterprise styling
- RPG visual language
- excessive badges
- fake precision
- unnecessary charts
- excessive gamification

Use hierarchy and whitespace to distinguish:

Verified Data

User Evaluation

AI Research

Do not blend them into a single "smart recommendation" dashboard.

User-facing score label is `내 점수`, not a prominent `MY SCORE`.

Nested screens return with `내 집 찾기` to Quest Home, except Visit which returns to Apartment Detail.

A Visit may be saved without Evaluation. On the Visit capture screen, evaluation is the primary action and saving the record without evaluation is a quieter tertiary action.

## 2026-09-18 구조적 임장 관찰

현장 입력은 이동·접근/단지 환경/주변 생활의 구역 선택과 총 9개 관찰 항목으로 구성한다. 각 항목의 확인 상태(미확인/확인함/해당 없음)와 메모를 분리하고 선택 입력으로 제공한다. 숫자 평가는 별도로 진행한다. 구역 선택과 입력은 초안으로 저장한다. 가용 너비 720px 이상에서 구역 목록과 본문을 병렬 배치한다. 사진은 아직 방문 전체 공통 첨부이며 항목별 연결은 후속 작업이다.

## 2026-09-18 관찰 사진 연결

관찰 항목의 사진 추가는 방문 공통 사진 목록에 원본을 한 번 추가하고 해당 항목과 연결한다. 기존 사진은 항목 내 사진 연결을 펼쳐 체크박스로 선택한다. 한 사진에 여러 항목을 연결할 수 있고 연결 해제와 사진 삭제는 구분한다. 전체 사진에서 삭제하면 모든 항목의 연결을 제거한다. 저장된 상세에서는 항목의 사진 보기 링크로 갤러리의 해당 사진에 이동하고 연결 항목명을 확인한다.
