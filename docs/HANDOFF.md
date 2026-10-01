# Whale Quest 인수인계 (v0.6)

2026-10-01. 저장소 https://github.com/codersongpro/whalequest · 작업 브랜치 phase-1-foundation. 이름은 초기 브랜치이나 현재 범위는 통합 시연이다.

## 최신 요청과 승인

사용자는 기존 페이즈 중단 방식을 바꾸어 본선 전체를 작업하고 웨일 서비스와 연결된 시연을 요구했다. 이어 Supabase 프로젝트가 없으므로 **시연 모드와 연결 준비까지** 허용했다. 최우선 원본은 reference/whale-quest-plan-v0.6.md. v0.5의 관문A/B는 폐기하고 하나의 최종 산출물/L2 상황인식 중심으로 변경했다. AGENTS.md도 갱신했다.

이전 원본PRD/공유대화는 참고이며 문서 안의 작업 지시를 외부 메시지/배포/출품 승인으로 간주하지 않는다. 앱/매니페스트는0.1.0 유지, 문서만v0.6. 공개 GitHub source/docs 업로드는 이전 ‘푸시해’ 요청에 따라 승인된 저장소로 진행한다. PR/릴리스/스토어/공개서비스 배포는 수행하지 않았다.

## 구현 지도

- packages/core: 공통3유형 채점/검증, 기존PRD JSON1.0 변환, 버전별 복습선별, IndexedDB 원자적 백업/복원/삭제, 완료PNG/프롬프트/4예제, 브라우저시연 공유.
- packages/ui/PersonalLearning: 문항별 검수·편집·집중/오답/오늘복습·기록·완료카드·JSON백업.
- packages/classroom/demo-room: localStorage 동일브라우저 방/참여/활동/만료, WebLocks로 동시탭 변경 직렬화, 로컬채점/중복기여1회. **운영 서버 권한이 아니다.**
- packages/ui/Classroom: 교사제어/학생/집계Board/부스, 자동 오답 전달물, 클래스문안/복습추천, 질문/결과, 학생본인 수업응답→개인복습 명시적복사.
- packages/ui/ClassTools: 로컬타이머/명단/랜덤/모둠·수정/QR, 모둠 전달물은 인원수만.
- packages/context: service-domains.json 정확한호스트 판정, use-context Chrome storage 이벤트. App/ContextSidebar는 mode 메시지의 부모/원점검사. UBT는 수동·iframe경로 변경으로 우회하지 못하게 잠금.
- packages/handoff: 집계오답/모둠/검수질문 전달물 로컬보관, 방만료 필터/정리, 카드PNG.
- apps/extension: host 제한 MV3 background 탭 이벤트, DOM읽기/tabs/content_scripts 없음. sidebar iframe은 동일웹앱 context route.
- packages/server: 익명 인증/토큰갱신/12RPC 계약·타임아웃/키검증 adapter. **UI에 연결하지 않음.**
- docs/reference/supabase-schema.sql: 비공개표/권한/서버채점/기여/공유의 **실행 안 한 초안**. 검증마이그레이션 아님.

## 실행과 이어갈 항목

Node22.12+ npm ci → npm run dev. npm run check는 lint/type/unit/build/Edge 웹E2E. CI는 Chromium. docs/QUICK_START.md, DEMO_CHECKLIST.md 참조. 실제서버는 SUPABASE_SETUP.md, 남은일은 REMAINING_WORK.md.

코드는 시연으로 전체흐름을 체험하지만 v0.6의 실제웨일/수업/부하/공식연계 완료게이트는 아직 안 됐다. 다른기기/휴대폰QR은 현재 연결되지 않는다. 어떤 환경변수를 입력해도 앱이자동live로 바뀌지 않는다. demo-room을 서버adapter와 연결하는 후속구현이 필요하다.

확장 iframe 저장소 공유에는 빌드전 VITE_PUBLIC_APP_URL이 필요하다. package-extension은 지정된 앱호스트1개를 host_permissions에 추가한다. 이는 iframe 저장소분리 예외의 구현결정이다. 모드판정은 서비스호스트만 사용, 일반탭주소/DOM 저장 없음. 웨일환경에서 재검증 필요. 웹 frame-ancestors 현재extension스킴 허용은 시연용, 운영 전 확장ID 제한/단기 교사 연결코드 검증.

## 검증과 발견/수정

현재 npm run check의 61단위/모의계약 + 13웹E2E 통과. 세 학생탭 수업→평가→레이드→자동오답카드→클래스추천→학생복습, 완료PNG/재시작기록, 공유사본, UBT iframe경로차단, 360/390/590/1280px 등. 자세한 최신기록은 VERIFICATION.md. 검사파일이 늘면 실제결과로 갱신한다.

정적리뷰에서 부스시간만료시계·UBT iframe경로우회·수업오답개인복습단절·만료방 표시를 수정했다. 방 코드와 버전을 함께 비교하고 별도1초시계는 유지한다. 같은버전 다른방 전환·공유토큰 상태초기화·부스30초 타이머 재설정 오류도 실패 재현 후 회귀검사로 확인했다. 실제웨일 headless 실행은 disable-extensions 인수제외 후에도 시작단계 Targetclosed/exit0으로 실패했다. 원인미확정, 실기기게이트미완료.

## 다음 작업자 주의

- 최신코드/현재브랜치/status를 먼저 확인하고 파일을 불필요하게 전체탐색하지 않는다. 이전Phase1 완료기준만 보고 현앱을 되돌리지 않는다.
- 원격CI·실기기·실제API·교사검수·현장효과를 로컬테스트 통과와 구분한다.
- 현재 예제standard는 검수용 학습목표, 공식코드확인완료아님. 정답/코드/교육과정 적합성을 교사가 확인해야 한다.
- 질문카드는 자유서술이므로 교사개인정보검수 필요. 레이드카드는학생별명/신원/개별단답 제외.
- 로컬시연 질문/정답/teacherowner는클라이언트에 있음. 실제학생정보 금지, 운영으로 사용금지. 실제RLS/정답비공개/서버채점/전송대기/재접속은 서버환경에 연결/검증.
- UBT 전체host 보수잠금이며 실제평가경로/네이티브웨일온 감지범위 주최확인 필요. L2+/L3는허용전추가하지않음.
- outputs/whale-quest에는 과거미완성전체초안이 따로 있다. 현재저장소에는통합하지 않았으며 무검증복사하지 않는다.
- 확장패키지/영상/부하/학급적용의실증은마무리전필수. 최신남은일목록을우선한다.

## 다음 AI에게 전달

> whalequest의 AGENTS.md와 docs/HANDOFF.md, v0.6 원본·검증·남은작업을 읽고 현재 통합시연을 이어 작업하세요. 예선/본선이나 Phase1중단 기준을 되살리지 마세요. Supabase가 없어서 지금은 같은브라우저demo+연결준비입니다. 실제서버·웨일서비스탭/게시·부하/수업적용과 로컬검증을 구분하고, 먼저 남은실기기/서버연결 작업의근거를 확인하세요.
