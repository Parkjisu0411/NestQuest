> 아래 최신 확정 정책이 초기 명세보다 우선한다. 구현 상태는 [ROADMAP.md](ROADMAP.md), 검증 범위는 [LIVE_VALIDATION.md](LIVE_VALIDATION.md)를 따른다.

# NestQuest V0.1 Product Specification

## 최신 확정 정책 · 2026-09-21

- 현재 실데이터 탐색 범위는 서울 일반 아파트다. 수도권 확장은 별도다.
- 탐색은 카카오 지도와 단지 오버레이, 초기 지역 선택만 자체 지도다. 일반 모바일은 지도 중심, 720px 이상은 지도와 목록을 함께 표시한다.
- 출근지는 가까운 역으로 지정하고 카카오 참고 통근을 저장·재사용한다. 마지막 도보와 실제 출근 시각은 사용자가 확인한다.
- 가격·면적·연식·세대수·통근 조건을 지원하며 정보 미확인 포함 여부를 선택한다.
- 일반 → 관심 → 다녀온 집 → 최종 후보로 관리하며 방문 전 비교·최종 후보 지정도 허용한다.
- 현장 임장은 구조화 관찰·메모·사진으로 입력하며 집 내부는 선택이다. 평가는 1~5점과 중요도, 장단점은 점수 가감 없이 기록한다.
- 자료 갱신 시 사용자 기록을 보존하며 미확인을 0으로 바꾸지 않는다. API 조회는 화면을 차단하지 않는다.
- 개인 APK에 로컬 키를 포함하고 소스 공유자는 자신의 키로 빌드한다. APK 및 폴드 실기기 검증은 별도다.


## APK 확정 · 2026-09-18

최종 모바일 형태는 스토어 없이 직접 설치하는 Android APK로 확정했다. 아래의 APK 미정 표기는 이전 이력이다. Capacitor Android 프로젝트, 네이티브 백업 저장 위치 선택, 앱 뒤로가기, 사진 원본 뷰어 및 빌드/서명 설정을 추가했다. 현재 PC에 JDK 21 및 Android SDK가 없어 네이티브 컴파일과 APK 생성은 아직 완료하지 못했다. 최신 실행 방법과 남은 작업은 [ANDROID.md](ANDROID.md)를 따른다.

## 확정 정책 · 2026-09-18

이 절은 아래 초기 명세와 충돌할 경우 우선한다. 정보가 없는 단지는 미확인 항목을 표시하고 검색 조건의 포함 여부로 제어한다(기본 포함). 확인된 값이 조건을 위반하면 제외한다. 관심·방문·최종 후보 보존 규칙은 유지한다. 방문 전에도 비교와 최종 후보 지정이 가능하며 방문 없이 후보를 해제하면 관심으로 돌아간다. 집 내부 관찰 4개 항목은 선택 입력이다. 평가는 항목별 점수와 중요도로 계산하고 장단점은 점수에 가감하지 않는다. 공개 호스팅 대신 개인 로컬 설치를 목표로 한다. 모바일 형태는 개인 Android APK로 확정했다.


## 1. Document Purpose

This document defines the authoritative product requirements for NestQuest V0.1.

Implementation must follow this specification.

If specification documents conflict, use the following priority:

1. PRODUCT_SPEC.md
2. UX_SPEC.md
3. SCORING.md
4. DATA_MODEL.md
5. DATA_SOURCES.md
6. ROADMAP.md

External API specifications, quotas, licenses, pricing, and provider policies may change. For those external facts, the latest official provider documentation takes precedence.

Do not invent, expand, or reinterpret product requirements simply because a feature is common in other real-estate applications.

If an implementation decision is not defined, prefer the simplest implementation that preserves the product principles. If the decision materially changes product behavior, surface it before implementation.

---

# 2. Product

Product name:

**NestQuest**

NestQuest is a personal home-buying decision tool focused initially on apartments in Seoul and the surrounding metropolitan area.

Its core question is:

> 현재 내 조건에서, 실제로 내가 살기 가장 적합한 집은 어디인가?

NestQuest is not intended to be:

- a general real-estate marketplace
- a listing service
- an automated appraisal service
- a mortgage underwriting system
- an AI home recommendation service

V0.1 supports one active Quest.

The data model may retain `questId` relationships for clarity, but no Multi-Quest UI or Multi-Quest management functionality should be implemented in V0.1.

---

# 3. Product Philosophy

The core journey is:

조건으로 찾는다
→ 관심 있는 집을 고른다
→ 직접 가본다
→ 내 기준으로 평가한다
→ 비교한다
→ 내가 최종적으로 선택한다

NestQuest helps structure the user's decision.

NestQuest must not pretend to make the final decision for the user.

Objective data is primarily used to narrow the search space and provide factual comparison.

Subjective evaluation becomes meaningful primarily after the user has actually visited an apartment.

The final choice belongs to the user.

---

# 4. Evidence Hierarchy

NestQuest distinguishes four major categories of information.

## 4.1 VERIFIED DATA

Objective facts obtained from external/public data sources.

Examples:

- apartment address
- approval date
- household count
- parking count
- transaction prices
- nearest subway station
- commute route

Verified Data may be used for factual display and Hard Filters.

---

## 4.2 DERIVED DATA

Values deterministically calculated by NestQuest from Verified Data or user inputs.

Examples:

- purchase budget
- building age
- parking spaces per household
- estimated market price
- estimated monthly loan payment
- My Score

Derived Data must be reproducible from its inputs.

---

## 4.3 USER EVALUATION

The user's own current judgment.

Examples:

- station accessibility
- commute experience
- commercial environment
- school environment
- nature / walking environment
- neighborhood atmosphere

User Evaluation is the primary input for My Score.

The user may form an evaluation from a physical visit, personal research, or both.

---

## 4.4 AI RESEARCH

Optional supporting research generated externally using ChatGPT, Claude, or another AI system.

AI Research:

- must not be used for Hard Filtering
- must not directly affect My Score
- must not automatically change Quest Stage
- must not be presented as Verified Data

The user reviews AI Research and forms their own User Evaluation.

NestQuest must remain fully usable without AI Research.

---

# 5. Platform Principles

## MOB-01 Mobile First

NestQuest must be designed mobile-first.

All core workflows must work on a smartphone without requiring desktop usage.

This includes:

- setup
- apartment discovery
- candidate selection
- apartment detail
- visit recording
- photo recording
- evaluation
- shortlist management
- comparison
- AI research workflow
- backup/export

Desktop layouts may use additional space, but mobile UX takes priority whenever there is a conflict.

---

## MOB-02 Web Application

V0.1 begins as a web application using:

- React
- TypeScript
- Vite

PWA capabilities are not required during initial implementation.

PWA support may be added after the core application is stable.

---

## MOB-03 Local First

V0.1 must not require:

- user accounts
- a proprietary NestQuest backend
- a server database

User-specific data should primarily live locally in the browser.

IndexedDB is the local persistence mechanism. There is no account, backend, or cloud sync.

---

# 6. Core User Journey

## FLOW-01

First-time user:

Setup
(search conditions + Evaluation Priorities)
→ Discover
→ Candidate
→ Visit
→ User Evaluation
→ Shortlist
→ Compare

Quest is the central workspace throughout this process.

Evaluation Priorities are collected during Setup. They are not an optional later step.

---

# 7. Setup

## SETUP-01 Search Area

The user selects one or more administrative areas.

Search Area is required. The user must select at least one area before completing Setup.

There is no “지역 건너뛰기” in Phase 1, because Search Area currently defines the discovery scope.

Initial geographic target:

- Seoul
- surrounding metropolitan areas supported by selected data sources

Phase 1 area selection:

- bulk actions: 서울 전체, 경기 전체, and 인천 전체 when Incheon exists in the dataset
- 전체 해제
- individual sigungu selection
- the existing stylized SVG map remains as visual support and is not redesigned in this phase

Bulk selection must write into the same `QuestArea[]`. There is no hidden “Seoul selected” flag.

Example: 서울 전체, then deselect 강남구, leaves the remaining Seoul sigungu selected.

Quest Home / custom map redesign, licensed boundaries, and commute place search are deferred.

---

## SETUP-02 Budget

Budget is optional.

The user may enter:

- available cash
- expected loan limit

or skip either or both.

If both are absent:

- purchase budget is undefined
- Discover budget ceiling is undefined
- price is not used as a Hard Filter

Do not treat a missing budget as 0.

If one value is provided and the other is absent, treat the absent component as 0 when calculating the stated purchase budget.

Available Cash means the amount the user is actually willing to use for the purchase.

NestQuest does not separately calculate emergency cash reserves.

---

## SETUP-03 Loan Limit

NestQuest does not calculate actual mortgage eligibility.

If the user does not know their expected loan limit, they may skip it.

NestQuest may still provide:

"대출한도 알아보기"

This generates a structured research prompt for an external AI system.

Temporary information may be requested solely to generate that prompt.

Such information does not become part of the permanent V0.1 Profile unless separately required by the specification.

The user ultimately enters their own Expected Loan Limit, or omits it.

---

## SETUP-04 Home Hard Filters

V0.1 supports exactly these primary Discover Hard Filters:

1. Search Area (required)
2. Purchase Budget (optional)
3. Minimum Exclusive Area (optional)
4. Maximum Building Age (optional)
5. Minimum Household Count (optional)
6. Maximum Commute Time (optional)

Principle:

only entered criteria act as filters.

A skipped criterion must not receive a hidden sentinel such as 0, Infinity, or 999.

Do not add parking, management fee, heating type, station distance, room count, bathroom count, or other Hard Filters in V0.1.

---

## SETUP-05 Commute Destination

The commute destination is optional. The user may complete Setup without selecting one.

Phase 1 keeps a small curated mock destination list for users who want to choose one.

Place search, subway-station search, and map selection are deferred until the map/location architecture is revisited.

Do not invent a default destination or silently select one of the mock destinations.

Three commute states:

1. No destination
   - commute information is not required
   - commute time is not a Hard Filter
   - Quest Home remains usable
   - do not show fake commute values
2. Destination exists, maxCommuteMinutes omitted
   - commute information may be displayed when available
   - commute time is not a Hard Filter
3. Destination and maxCommuteMinutes both exist
   - commute information may be displayed
   - max commute time acts as a Hard Filter

If maxCommuteMinutes exists without a destination, it must not filter apartments.

Only total commute time participates in the Hard Filter.

Transfers, bus usage, walking duration, and route complexity must not introduce hidden penalties.

---

## SETUP-06 Evaluation Priorities

Evaluation Priorities are part of initial Setup.

The user must explicitly select the importance of all six User Evaluation metrics before completing Setup:

1. 역 접근성
2. 통근 체감
3. 상권
4. 학군
5. 자연 / 산책
6. 동네 분위기

Allowed choices:

- 평가하지 않음
- 낮음
- 보통
- 높음
- 매우 높음

There are no hidden default priority values.

Setup is incomplete until every metric has an explicit user choice.

The same priorities apply to all apartments in the active Quest.

The user may later edit these priorities in Settings.

Do not ask the user to set priorities during every Visit.

Setup does not ask for loan interest rate or loan term.

Phase 1 uses application reference LoanAssumption values internally:

- annualInterestRate = 0.04 (4.0%)
- termYears = 30
- equal principal-and-interest

These are reference assumptions only. They are not a bank quote, eligibility estimate, recommendation, or current market-rate claim.

The user may later edit them in Settings.

---

# 7a. Settings

## SET-01 Active Quest editor

`/settings` edits the single active Quest.

Phase 1 Settings covers:

- SearchCriteria, including optional commute destination
- EvaluationPriorities
- LoanAssumption reference rate and term
- a small NestQuest about section

Phase 2 adds a secondary 데이터 section for JSON Backup / Restore. It does not create, name, list, duplicate, or switch Quests.

Changing SearchCriteria updates discovery filtering immediately. CANDIDATE, VISITED, and SHORTLIST apartments, Visits, Evaluations, and shortlist rank remain.

LoanAssumption is not a Setup step. It is a secondary Settings reference for monthly-payment display only.

Map redesign and apartment representative images remain deferred.

---

# 8. Discover

## DISC-01 Discovery Unit

Apartment identity and Quest Stage are primarily complex-level.

Price and area eligibility are evaluated at:

Apartment + Target Unit Type

level.

A complex may therefore contain multiple Unit Types with separate Price Estimates.

---

## DISC-02 Hard Filter Pipeline

Recommended processing order:

1. Search Area
2. Load apartment complexes
3. Load Unit Types / transaction data
4. Minimum Exclusive Area
5. Maximum Building Age
6. Minimum Household Count
7. Calculate Price Estimate
8. Purchase Budget
9. Calculate Commute
10. Maximum Commute Time

Expensive commute API calls should occur after cheaper filters where practical.

---

## DISC-03 Budget Buffer

Discover uses a +5% budget buffer only when a purchase budget exists.

Example:

Purchase Budget = 800,000,000 KRW

Discover Budget Ceiling = 840,000,000 KRW

Purpose:

avoid prematurely hiding borderline candidates.

The UI may label homes above the stated Purchase Budget but within the buffer as:

"예산 근처"

If purchase budget is undefined, there is no Discover budget ceiling and price is not a Hard Filter.

The technical 5% value does not need to be exposed as a V0.1 setting.

---

## DISC-04 No Pre-Visit Recommendation Score

NestQuest must not calculate or display a recommendation score before a Visit.

Do not create:

- Data Score
- Match Score
- AI Score
- Ranking Score
- Recommendation Score

Discover results may be sorted using objective facts such as:

- estimated price
- commute time
- station distance
- building age
- household count

Sorting is not a recommendation.

---

# 9. Quest Stages

## QUEST-01 Stages

Each apartment has one Quest Stage:

- DISCOVERED
- CANDIDATE
- VISITED
- SHORTLIST
- PASSED

---

## QUEST-02 DISCOVERED

The apartment was found through Discover.

It has not yet been explicitly selected by the user.

---

## QUEST-03 CANDIDATE

The user explicitly selected the apartment as worth considering.

Automatic data must never automatically promote an apartment to CANDIDATE.

---

## QUEST-04 VISITED

At least one Visit exists for the apartment.

---

## QUEST-05 SHORTLIST

The user explicitly considers the apartment a serious purchase candidate.

My Score must never automatically promote an apartment to SHORTLIST.

---

## QUEST-06 PASSED

The user no longer wishes to actively consider the apartment.

PASSED means hidden, not deleted.

Possible reasons:

- PRICE
- COMMUTE
- COMPLEX
- NEIGHBORHOOD
- AFTER_VISIT
- OTHER

Historical data should be retained.

---

# 10. Quest Home

## QUEST-07 Single Quest Workspace

Do not create separate top-level pages for:

- Discover
- Candidates
- Visits
- Shortlist

NestQuest uses one central Quest workspace consisting primarily of:

- compact Quest context
- Stage Filter
- Quest Map
- compact apartment results

Quest is Home.

Confirmed exploration layout (2026-09-17): ordinary mobile and a folded phone use a map-centered workspace. An unfolded Fold with sufficient available width shows the map and apartment list together. Adapt to available viewport space, including split-screen use; do not enforce the wide layout solely by device name. Specific panel interactions remain under product review.

Filtering uses predefined fields with user-entered conditions. A user-defined field/filter builder is not part of the current scope. The exact field set remains subject to the ongoing product review.

The apartment list is a browsing/navigation tool. It should not dump every fact about every apartment. Secondary facts belong in Apartment Detail.

The current Quest Map remains a lightweight prototype. Custom/production map redesign is deferred.

---

## QUEST-08 Stage Filters

Recommended filters:

- 전체
- 관심
- 다녀온 집
- 최종 후보

Internal stages stay:

DISCOVERED, CANDIDATE, VISITED, SHORTLIST, PASSED

User-facing labels:

DISCOVERED: no prominent status label in normal browsing
CANDIDATE: 관심
VISITED: 다녀온 집
SHORTLIST: 최종 후보
PASSED: 제외한 집

Semantics:

전체:
DISCOVERED + CANDIDATE + VISITED + SHORTLIST

관심:
CANDIDATE + VISITED + SHORTLIST

다녀온 집:
VISITED + SHORTLIST

최종 후보:
SHORTLIST

PASSED is hidden by default.

A secondary action may allow the user to view passed apartments.

---

## QUEST-09 Map/List Synchronization

Quest Map and Apartment List must use the same active Stage Filter.

Changing the filter updates both.

---

# 11. Apartment Detail

## APT-01 Mobile Detail Structure

Apartment Detail should be a mobile-friendly single scrolling page.

Avoid unnecessary nested tabs.

Recommended order:

1. Overview
2. Unit / Price
3. Commute
4. Complex Facts
5. Research
6. My Quest

---

## APT-02 Objective / Subjective Separation

Verified Data and User Evaluation must remain visually distinguishable.

Do not blend them into one synthetic dashboard score.

---

# 12. Visit

## VIS-01 Multiple Visits

An apartment may have multiple Visit records.

Visits are historical records.

A new Visit must not overwrite a previous Visit.

---

## VIS-02 Structured On-Site Capture

Confirmed direction (2026-09-17): the Visit workflow prioritizes structured entry on site. Users record observations by topic during the visit, rather than relying primarily on unstructured capture followed by later organization. Mobile entry should remain efficient.

During a visit, the user should be able to record:

- photos
- positive observations
- negative observations
- free-form notes

without being forced to complete all six evaluation ratings immediately.

Structured capture does not itself confirm mandatory ratings, new numeric metrics, or a fixed checklist. The observation topics, visit scope, and rating workflow are under review in PRODUCT_SPEC.md. Observation records and the current apartment-level User Evaluation remain distinct.

---

## VIS-03 Visit Completion

After or near the end of the Visit, NestQuest may ask the user to update User Evaluation.

A new Visit must not automatically overwrite existing User Evaluation.

---

# 13. User Evaluation

## EVAL-01 Standard Metrics

V0.1 has exactly six standard subjective evaluation metrics:

1. 역 접근성
2. 통근 체감
3. 상권
4. 학군
5. 자연 / 산책
6. 동네 분위기

Do not add additional standard numeric metrics without changing the specification.

---

## EVAL-02 Rating Values

Each metric may be:

- 1
- 2
- 3
- 4
- 5
- Not Rated

Not Rated is excluded from My Score.

---

## EVAL-02A Evaluation Priorities

How important each metric is to the user is defined by Evaluation Priorities.

Priorities are collected during Setup (SETUP-06) and may be edited in Settings.

They are not Visit-time inputs.

There are no hidden default priority values.

---

## EVAL-03 My Score Timing

Independent evaluation editing is implemented at `/apartments/:apartmentId/evaluation`. A saved Visit belonging to the active Quest is required; a seeded VISITED/SHORTLIST stage alone is insufficient. Users can enter a first evaluation after saving a visit without one, or edit their current evaluation. Saving updates UserEvaluation only, preserves visits/photos/stage/shortlist order, and publishes the change after persistence succeeds.

My Score must not exist before at least one Visit exists.

NO VISIT
→ NO MY SCORE

---

# 14. Extra Factors

## EVAL-04 Free-Form Factors

Users may add free-form positive or negative factors not adequately represented by the six standard metrics.

Examples:

+ 거실에서 한강뷰가 상당히 좋음

- 바로 앞 대로변 소음이 예상보다 심함

Confirmed on 2026-09-17: these factors are qualitative positive/negative notes and do not adjust My Score. Retain per-metric ratings and importance weights; My Score is their eligible weighted average. Numeric extra adjustments are removed from the target behavior. Existing note text must be preserved during implementation migration.

Do not introduce predefined Extra Factor categories in V0.1.

---

## EVAL-05 Critical Negative Factor

A severe negative factor may lead the user to choose:

"후보 제외"

This is a decision action.

It must not be converted into an arbitrary numeric penalty.

NestQuest must never automatically PASS the apartment.

---

# 15. Shortlist

## SHORT-01 Explicit User Action

SHORTLIST is always created by explicit user action.

---

## SHORT-02 Shortlist Memo

Each shortlisted apartment may have a simple current decision memo.

Example:

"출퇴근 최우선이면 1순위.
59㎡ 실거래 9억 초반 나오면 적극 검토."

Shortlist Memo is separate from Visit notes.

---

## SHORT-03 Manual Ranking

Users may manually order shortlisted apartments.

Manual shortlist order represents the user's current decision.

It does not need to match My Score order.

NestQuest must not automatically overwrite manual shortlist ranking.

---

# 16. Compare

## CMP-01 Compare Eligibility

Compare is intended primarily for VISITED and SHORTLIST apartments.

---

## CMP-02 Comparison Structure

Comparison should show objective facts and subjective evaluations without combining them into a synthetic recommendation score.

Objective examples:

- estimated price
- commute time
- nearest station distance
- building age
- household count
- parking
- management fee

Subjective examples:

- six User Evaluation metrics
- My Score
- Extra Factors
- Shortlist Memo

---

## CMP-03 No Automatic Winner

NestQuest must not automatically declare a winning apartment.

The user decides.

---

# 17. AI Research

## AI-01 Optional

AI Research is optional.

NestQuest must remain usable without it.

---

## AI-02 Initial Categories

Initial V0.1 categories:

- Commercial Environment
- School District / Educational Environment

---

## AI-03 Research Quality

AI Research prompts should emphasize:

- explicit criteria
- evidence
- sources
- research date
- uncertainty
- no guessing

Do not request or display arbitrary AI scores such as:

"상권 87점"

AI Research is supporting information only.

---

# 18. Loan Reference

## LOAN-01 Reference Monthly Payment

NestQuest may calculate a reference monthly payment using:

- Expected Loan Limit when the user entered one
- Quest LoanAssumption
- equal principal-and-interest repayment

Setup does not collect interest rate or loan term.

Phase 1 starts from application reference assumptions:

- 4.0% (`annualInterestRate = 0.04`)
- 30 years

These are not a bank quote, eligibility estimate, recommendation, or current market-rate claim.

The user may later edit the reference annual interest rate and term in Settings.

This is a standardized reference estimate.

It is not:

- mortgage eligibility
- a bank quote
- a loan offer
- a policy calculation

---

# 19. Export / Backup

## EXPORT-01 JSON Backup

Phase 2 supports versioned JSON Backup and Restore of user-owned NestQuest state.

Envelope:

    format: nestquest-backup
    version: 1
    exportedAt
    data

`data` is canonical user state. Derived values such as My Score, purchase budget, Discover ceiling, and monthly payment are not stored.

JSON backup includes VisitPhoto metadata (`blobKey`) but does not embed binary photo files. Restore must not pretend missing photo binaries exist.

Restoring a valid backup replaces the current local record after explicit confirmation. Invalid files are rejected and leave the current Quest untouched.

---

## EXPORT-02 Viewer

NestQuest should eventually support a shareable read-only snapshot/viewer.

Preferred initial candidate:

Standalone HTML

The viewer should work on mobile and desktop.

Actual opening behavior through KakaoTalk and common mobile environments must be tested before finalizing this format.

---

# 20. Out of Scope — V0.1

The following are explicitly outside V0.1 unless this specification changes:

- property listing marketplace
- asking-price scraping
- automated mortgage eligibility
- LTV engine
- DSR engine
- acquisition tax calculator
- brokerage fee calculator
- legal fee calculator
- moving cost calculator
- first-time-buyer policy engine
- housing ownership policy engine
- PolicySnapshot
- FinanceEstimate engine
- Data Score
- Match Score
- AI Score
- Recommendation Score
- pre-visit recommendation score
- automatic room count
- automatic bathroom count
- automated winner selection
- automatic Candidate promotion
- automatic Shortlist promotion
- automatic PASS
- proprietary backend
- user accounts
- cross-device real-time synchronization
- Multi-Quest management UI

---

# 21. Design Direction

NestQuest should feel:

- Warm
- Calm
- Exploratory
- Personal
- Data-driven

It should not feel like:

- a bank application
- a trading terminal
- a dense enterprise dashboard
- a spreadsheet application
- an RPG
- a childish gamified application

Quest terminology should be restrained.

Appropriate examples:

- Quest
- Visited
- Shortlist
- My Picks
- Quest Progress

Avoid:

- XP
- levels
- achievements
- excessive badges
- game-like visual effects

---

# 22. Success Criteria

NestQuest V0.1 succeeds if a user can:

1. define what kind of apartment they are looking for
2. discover apartments meeting those conditions
3. explicitly select Candidates
4. visit them
5. quickly record observations on mobile
6. form their own User Evaluation
7. create a Shortlist
8. manually prioritize shortlisted homes
9. compare final candidates
10. make their own final decision

without NestQuest pretending to know the objectively correct answer.
