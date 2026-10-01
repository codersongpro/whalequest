# Whale Quest

최신 구현 기준은 [제작 계획 v0.6](docs/reference/whale-quest-plan-v0.6.md)입니다. 평가 → 협동 레이드 → 팀보드 성찰 → 개인 복습을 상황 인식 사이드바로 이어 주는 **하나의 최종 산출물**을 목표로 합니다.

**현재 제공: 브라우저 시연 모드와 Supabase 연결 준비.** 사용자가 Supabase 프로젝트가 없다고 답해 이 범위로 구현했습니다. 수업방은 동일 웹 주소·동일 브라우저 안에서만 연결됩니다. 휴대폰/다른 기기 입장, 운영 권한, 실제 서버 채점과 실시간 수업은 아직 제공하지 않습니다. 실제 학생 정보를 넣지 마세요.

## 실행과 검증

Node.js 22.12 이상, package-lock 기준:

~~~sh
npm ci
npm run dev
npm run check
~~~

http://127.0.0.1:5183 에서 교사 수업을 선택합니다. 수업방 만들기 → 학생 화면을 같은 브라우저 새 탭으로 열기 또는 시연 시작(체험 학생3명) → 이해도/평가 → 레이드 → 활동 종료 → 팀보드 모드 → 클래스 모드 순서입니다. 자세한 [빠른 시작](docs/QUICK_START.md)과 [시연 체크리스트](docs/DEMO_CHECKLIST.md)를 확인하세요.

## 현재 기능

- 3유형 문제 검증/채점, 직접 작성·JSON/기존 PRD1.0 가져오기·교사 문항 검수·4교과 예제
- 수업방/학생 탭/이해도·투표·빠른 확인·형성평가·교사 통계·질문함·집계 전자칠판
- 5분 협동 레이드·중복 기여 방지·오답 상위3/선택 분포·전달물 보관함
- 클래스 공지/복습 배포 문안·팀보드 텍스트/PNG·학생 완료 카드 PNG를 교사가 확인 후 수동 게시
- IndexedDB 집중/오답/오늘의 복습·기록·JSON 백업/검증 후 복원·명시적 삭제
- 30일 만료의 브라우저 시연용 읽기전용 공유 링크/QR. 가져온 사본은 로컬
- 랜덤 뽑기·모둠 편성/수정·타이머·QR 저장. 부스 종료 후 카드 표시/30초 새 방 반복
- MV3 URL 기반 상황 판정/수동 모드/UBT 잠금 코드. 실제 웨일 자동 실행/탭 전환은 미검증

시연의 채점/권한 제어는 로컬 모형이며 생산용 서버 보안을 보장하지 않습니다. 전송 대기 UX·실제 서버 복구·서버 공유는 연결 후 구현/검증해야 합니다. 앱 내부 AI/개인 순위/아케이드/룰렛은 없습니다.

## 확장앱 빌드/설치

~~~sh
npm run build
npm run test:whale
~~~

웨일에서 whale://extensions → 개발자 모드 → 압축해제된 확장앱 로드 → dist/extension 선택. 웹앱 기본 주소를 저장하세요. 자동 인식 실패 시 클래스·팀보드·원격·수업 수동 탭을 사용합니다.

사이드바의 웹앱 iframe과 웹 탭의 저장소를 함께 사용하려면 **빌드 전에 VITE_PUBLIC_APP_URL을 실제 웹앱 기본 주소로 설정**하세요. 예: .env에 VITE_PUBLIC_APP_URL=http://127.0.0.1:5183 을 저장하고 다시 빌드. 패키징은 해당 앱 호스트1개 권한만 추가합니다. URL 모드 판정은 웨일 서비스 호스트만 사용하며 페이지 내용/일반 탭 주소를 저장하지 않습니다. 전체 tabs 권한/콘텐츠 스크립트는 없습니다. 자체 앱 호스트 권한은 iframe 저장소 분리 예외를 위한 것입니다. 환경이 다르면 웨일 실제 저장소 공유를 재확인해야 합니다.

dist/web은 웹, dist/extension은 확장입니다. vercel.json은 설정만 있고 공개 배포하지 않았습니다. frame-ancestors는 self/extension 스킴을 허용합니다. 운영 배포 전 설치된 확장 ID로 제한하고 클릭재킹/단기 교사 연결 코드를 검증하세요.

## 서버와 인수인계

[Supabase 연결 준비](docs/SUPABASE_SETUP.md)의 SQL은 **실행하지 않은 초안**입니다. 프로젝트 연결·CLI 생성 마이그레이션·RLS/서버 채점·실시간·50명 시험이 필요합니다. 프런트엔드가 환경 변수만으로 자동 운영 모드로 바뀌지는 않습니다.

[HANDOFF](docs/HANDOFF.md) · [구현 기준](docs/IMPLEMENTATION_PLAN.md) · [로드맵](docs/ROADMAP.md) · [검증](docs/VERIFICATION.md) · [남은 작업](docs/REMAINING_WORK.md)

주요 구조: apps/web, apps/extension, packages/core(문제/기록), packages/context(주소 규칙), packages/handoff(집계 전달물), packages/classroom(로컬 시연), packages/server(연결 준비), packages/ui. 문서 v0.6과 앱/매니페스트 0.1.0은 별개입니다.
