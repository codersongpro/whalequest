# 검증 기록

기준일: 2026-10-01. 대상: Phase 1 소스 및 handoff 체크포인트. Windows 로컬 검증이며 원격 CI·실서비스 검증과 구분한다.

| 검사 | 결과 | 범위와 한계 |
|---|---|---|
| npm run lint | 통과 | verify-whale.mjs의 bare chrome 참조 2개를 globalThis.chrome으로 바꾼 뒤 재실행 |
| npm run typecheck | 통과 | TypeScript 소스 |
| npm test | 11/11 통과 | 웹앱 URL 정규화·위험 주소 거부 |
| npm run build | 통과 | dist/web, dist/extension 및 자체 아이콘 패키징 |
| npm run test:e2e | 5/5 통과 | 설치된 Edge, 웹 소개 화면·앵커·JS 오류·360/390/590/1280px 넘침·첫 Tab 접근성 |
| 원본 PRD 보존 | SHA-256 일치 | C2117ED090B600D21D9E891229DBC9DB7BA0E7903D706A599F84DC2D4B6B38FA |

E2E 통과는 웹 소개 화면에 한정된다. 확장앱 주소 저장·웨일 실제 사이드바 동작·학생 참여·실시간·개인 학습을 검증한 결과가 아니다. npm run check를 한 번에 실행한 결과는 없고 위 하위 명령을 각각 실행했다.

## 실기기와 외부 환경

- 이전 npm run test:whale 시도는 Chromium launchPersistentContext 단계에서 프로세스 종료/Target closed로 실패했다. worker/page가 로드되기 전이므로 확장앱 설치 검증은 미완료다. handoff 작성 중에는 재실행하지 않았다.
- scripts/verify-whale.mjs의 headless·기본 disable-extensions 인수·Whale API 네임스페이스·실행 환경 권한을 확인해야 한다. 현재 원인을 특정하지 않았다.
- 실제 웨일 사이드바 버튼·390/590px·주소 영속성·새 탭 연결은 미확인. Phase 1 완료 게이트가 남아 있다.
- Chrome·모바일 실기기·전자칠판: 미확인. Edge viewport 검사와 구분한다.
- Supabase 권한/DB/실시간/학교 공동 IP/30~50명: 구현 및 검증 전.
- Vercel 배포·GitHub 원격 CI: 이 문서 작성 시 실행 결과 미확인. CI 정의가 있다는 것과 통과를 구분한다.
- 사용자 제공 공모전 화면을 참고했으며 현행 접수/심사 조건 전체를 재확인하지 않았다.

## 다음 기록

실제 웨일 확인 결과는 브라우저 버전·설치 방식·확인 항목·실패 항목과 함께 기록한다. 소개 UI를 변경하면 해당 웹 E2E/반응형을 재실행한다. 각 단계의 검증 범위를 넘어서 전체 앱 완료라고 표현하지 않는다.
