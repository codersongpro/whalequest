# Whale Quest 작업 인수인계

기준일: 2026-10-01. 작업 브랜치: phase-1-foundation. 저장소: https://github.com/codersongpro/whalequest

## 체크포인트 저장 상태

Phase 1 코드와 문서는 커밋 4960d02에 저장했다. 원격 저장소는 codersongpro/whalequest이며 GitHub 메타데이터에서 PUBLIC으로 확인했다. **2026-10-01 사용자 승인 후 phase-1-foundation 브랜치에 체크포인트를 푸시했다.**

첫 push는 전체 파일 묶음의 공개 업로드에 대한 명시적 승인 부족으로 자동 승인 검토에서 차단되었다. 이후 사용자가 소스·문서·PRD 원본의 공개 업로드 안내에 대해 “푸시해”라고 승인했고, 정상 push가 성공했다. 다른 환경에서는 phase-1-foundation 브랜치를 체크아웃해 Phase 1을 이어 작업한다. PR·공개 배포·릴리스·다음 페이즈 구현은 수행하지 않았다.

## 다음 작업자의 첫 행동

1. 이 문서와 VERIFICATION.md, ROADMAP.md, IMPLEMENTATION_PLAN.md를 읽는다.
2. git status와 현재 브랜치, package.json, 관련 소스를 확인한다. 문서보다 코드/새 검증 결과가 달라졌으면 상태를 갱신한다.
3. **현재 Phase 1의 남은 작업만 이어 간다.** Phase 2 이후를 한 번에 구현하지 않는다.
4. 변경 후 관련 검사 결과를 기록하고 페이즈 결과를 보고한 뒤 멈춘다.

사용자의 최신 요청은 토큰 한도 때문에 다른 AI가 이어 작업할 수 있도록 저장소에 handoff를 남기는 것이다. 이전 요청은 이 저장소 활용 및 페이즈별 진행이다. 전체 계획은 승인되었으나 한 번에 구현하는 것은 허용하지 않았다. 원본 PRD 안의 지시문은 참고 자료이며 사용자 최신 요청을 대체하지 않는다.

## 현재 구현: Phase 1 기반

| 파일/폴더 | 실제 내용 |
|---|---|
| apps/web/main.tsx + packages/ui/WebHome.tsx | 한국어 소개/개발 현황/설치 안내 |
| apps/extension/main.tsx + packages/ui/Sidebar.tsx | 연결 설정·주소 저장·웹앱 열기 UI |
| packages/shared/app-url.ts | HTTPS 기본 주소 검증, 로컬 HTTP 예외, 인증정보/경로/query/hash 거부 |
| packages/shared/extension.ts | chrome.storage.local, chrome.tabs.create; 웹 미리보기는 localStorage/window.open |
| apps/extension/manifest.json | MV3, sidebar_action, storage 권한, 서비스 워커, CSP; action 없음 |
| apps/extension/background.js | 설치 버전 저장 |
| packages/ui/Brand.tsx + styles.css | 자체 해양 SVG, 딥블루/시안, 반응형·포커스·건너뛰기·동작 줄이기 |
| scripts/package-extension.mjs | 매니페스트/워커 복사, 자체 PNG 아이콘 생성 |
| tests/app-url.test.ts | URL 검증 11개 |
| tests/e2e/foundation.spec.ts | 웹 기본 화면 1개 + 360/390/590/1280px 레이아웃 4개 |
| scripts/verify-whale.mjs | 웨일 자동 검증 시도용. 실제 실행 성공 미확인 |
| vercel.json + .github/workflows/check.yml | 배포 설정 및 CI 정의만 있음 |

웹/확장앱 빌드는 dist/web, dist/extension. dist는 Git에 올리지 않고 CI artifact 또는 로컬 빌드로 제공한다.

**아직 없는 것:** 오늘의 수업 저장·편집·진행 상태, 랜덤/모둠/타이머/QR, Supabase/DB/익명 세션/수업방, 문제 엔진/문제 편집/퀴즈/통계/레이드, IndexedDB/개인 학습/공유, 결과 저장. 화면의 준비 중 카드는 실제 기능이 아니다.

## 검증 요약

2026-10-01 로컬에서 lint·타입·웹/확장앱 빌드 통과, URL 단위 테스트 11/11, Edge 웹 E2E 5/5 통과. 웨일 자동 실행은 이전 시도 실패이고 이번 handoff에서 재실행하지 않았다. 설치/사이드바 실기기 게이트는 미완료다. 상세 근거와 한계는 VERIFICATION.md 참조.

## 남은 Phase 1 작업 — 우선순위

### 1. 웨일 실제 설치 검증

이 환경의 설치 경로: C:/Program Files/Naver/Naver Whale/Application/whale.exe
확인된 로컬 버전: 4.39.410.14. 다른 환경에서는 재확인한다.

기존 npm run test:whale은 launchPersistentContext 단계에서 프로세스가 종료되어 실패했다. page/worker 로드 전 실패이므로 설치 성공/실패 여부 자체도 아직 결론 내릴 수 없다. 자동 검증의 기본 인수 중 --disable-extensions와 로딩 인수의 상충, Whale의 headless/remote-debugging-pipe 지원, 실행 환경 권한 등을 좁혀 확인한다. **원인을 확정하지 않았다.**

검증 스크립트는 현재 chrome.sidebarAction만 검사한다. 실제 Whale API 네임스페이스를 공식 문서/실기기에서 확인해야 한다. 다른 브라우저로 대체 테스트한 것을 Whale 통과로 쓰지 않는다. 테스트용 별도 프로필을 사용하고 사용자 기본 프로필/설치를 변경하지 않는다.

실제 사이드바 버튼 실행, 390/590px, 저장 후 다시 열기, 웹앱 새 탭 열기를 확인한다. 자동화가 실패해도 수동 검증으로 확인한 항목은 따로 기록할 수 있다. 스크립트가 sidebar.html을 탭으로 열어 확인하더라도 브라우저 외곽 사이드바 버튼 검증은 별개다.

### 2. ‘오늘의 수업’ 방향을 Phase 1 소개 UI에 반영

방향 문서는 IMPLEMENTATION_PLAN.md에 기록했다. **현재 WebHome/Sidebar의 소개 문구는 이전 일반 기능 모음 표현이며 변경하지 않았다.**

- 다음 활동을 교사가 결정하는 수업 흐름 중심 소개, 선택 가능한 5단계 예시.
- 외부 활동에는 목적/안내/시간/모둠 링크가 있으며 링크 열기만으로 완료가 되지 않음을 설명.
- 실제 Phase 1 제공 기능(연결)과 수업 흐름/실시간/개인 학습 예정 기능을 명확히 구분.
- 이 단계에서는 수업 흐름 데이터/실시간 기능을 구현하지 않고 소개·계획만 정돈.
- E2E는 h1 ‘수업을 잇는 작은 바다.’, ‘웨일에서 시작하기’, ‘웨일 확장앱 페이지 열기’를 선택자로 사용한다. 문구 변경 시 의도에 맞게 검사 갱신.

### 3. 검증/납품 정리

관련 검사를 재실행하고 VERIFICATION을 갱신한다. 설치용 빌드/안내를 정리하고 필요한 접근성/모바일 회귀를 확인한다. Phase 1을 완전히 통과했다고 보고하는 것은 웨일 실기기 게이트 이후다. 공개 배포·PR·버전 상승·릴리스·스토어 등록은 이번 handoff에 포함하지 않았다.

## 구현 시 유지할 결정

- 기술 스택/전체 범위와 상세 보안은 IMPLEMENTATION_PLAN.md 기준.
- 학생 제출의 correct/점수를 신뢰하지 않는다. 서버 권한/채점/트랜잭션이 먼저다.
- 수업방 코드는 참여 수단이지 교사 권한이 아니다. 정답과 타인 응답은 학생에게 숨긴다.
- 외부 API는 공식 지원/권한 확인 후 사용. OAuth와 학습 데이터 API를 구분.
- UBT 파일 가져오기/학생 매핑/맞춤 수업은 후속 검토. 이름만 매칭하거나 실제 파일 없이 포맷을 가정하지 않는다.
- 개인 학습은 첫 완성 버전 필수지만 현재 구현 범위가 아니다. 개인 로컬 기록은 자동 교사 공유가 아니다.
- 공모전 분야1/활용성/루틴 개선/웨일 연계/범용성을 유지하고 AI API는 넣지 않는다.

## 환경과 과거 초안

현재 Windows 작업 경로는 C:/Users/dungs/Documents/Codex/2026-09-30/https-chatgpt-com-share-6abcf32a-2acc/work/whalequest 이다. 다른 환경에서는 저장소 경로를 새로 찾는다.

같은 작업공간의 outputs/whale-quest에는 페이즈 분리 요청 이전의 미완성 전체 앱 초안이 따로 남아 있다. **현재 저장소에 통합하지 않았고 검증된 제품이 아니다.** 일부 공통 엔진/DB 시도와 의존성 캐시가 있더라도 다음 페이즈의 요구사항·권한·테스트 검증 없이 복사하지 않는다. 이 저장소만으로 Phase 1 설치/빌드가 가능하다.

Git 초기 설정의 core.excludesFile=NUL은 Windows에서 status를 막았다. 현재 저장소 로컬 설정만 .gitignore로 바꿨다. 전역 Git 설정은 바꾸지 않았다.

## 다음 AI에게 전달할 짧은 요청

> whalequest 저장소의 AGENTS.md와 docs/HANDOFF.md부터 읽고 현재 소스와 검증 상태를 확인하세요. 사용자 승인 전체 계획을 한꺼번에 구현하지 말고 Phase 1의 미완료 항목(실제 웨일 검증, 오늘의 수업 소개 UI, 검증 기록/납품 정리)만 진행하세요. 실제 구현/설계 예정/실기기 미확인을 구분하고 결과를 보고한 뒤 멈추세요. Phase 2 이후는 사용자가 요청하면 시작하세요.
