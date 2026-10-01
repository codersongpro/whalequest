# Whale Quest

웨일 사이드바에서 오늘의 수업을 이어 주고, 학생의 개인 학습으로 연결하는 수업 도구입니다.

**현재: Phase 1 구현 중.** 실제 코드에는 한국어 웹 소개 화면, MV3 사이드바, 웹앱 기본 주소 저장 및 새 탭 열기만 있습니다. 수업방·활동 흐름 저장·문제 엔진·개인 학습은 아직 구현하지 않았습니다. Phase 1의 실제 웨일 설치 검증도 남아 있습니다.

## 이어서 작업하기

먼저 [HANDOFF](docs/HANDOFF.md)를 읽으세요. [제작 기준](docs/IMPLEMENTATION_PLAN.md), [페이즈별 로드맵](docs/ROADMAP.md), [검증 기록](docs/VERIFICATION.md)을 함께 확인하세요. 각 페이즈의 결과를 보고한 뒤 멈추며, 다음 페이즈는 사용자의 요청 후 시작합니다.

## 실행

Node.js 22.12 이상을 사용합니다. 의존성은 package-lock.json을 기준으로 설치합니다.

```sh
npm ci
npm run dev
```

로컬 주소: http://127.0.0.1:5183

```sh
npm run check
npm run test:whale
```

check는 lint → 타입 → 단위 테스트 → 웹/확장앱 빌드 → 웹 E2E입니다. Windows E2E는 설치된 Edge, CI는 Playwright Chromium을 사용합니다. test:whale은 별도 웨일 검증이며 현재 실행 성공이 확인되지 않았습니다. 필요한 경우 WHALE_EXECUTABLE 환경 변수로 실행 파일을 지정합니다.

## 개발용 확장앱 설치

1. npm run build를 실행합니다.
2. 웨일에서 whale://extensions를 열고 개발자 모드를 켭니다.
3. 압축해제된 확장앱 로드로 dist/extension 폴더를 선택합니다.
4. 사이드바 연결 설정에서 웹앱 주소를 저장하고 웹앱 열기를 누릅니다.

웨일에서 실제 설치·사이드바 버튼 동작·주소 유지·새 탭 연결을 직접 확인해야 합니다. 단순히 빌드 성공만으로 설치 검증을 완료했다고 판단하지 않습니다.

HTTPS 기본 주소만 저장할 수 있으며 localhost/127.0.0.1/[::1] 개발 주소는 HTTP를 허용합니다. 경로·쿼리·해시·사용자 인증 정보가 포함된 주소는 거부합니다. 선택적으로 .env.example을 .env로 복사해 VITE_PUBLIC_APP_URL을 설정할 수 있습니다. 비밀 키나 세션 토큰을 넣지 않습니다.

## 구조

- apps/web: 웹앱 진입점
- apps/extension: 확장앱 진입점·매니페스트·서비스 워커
- packages/ui: 공통 디자인·웹 소개·사이드바
- packages/shared: URL 검증·확장 API 연결
- scripts: 확장앱 패키징·웨일 검증
- tests: URL 단위 테스트·웹 E2E

빌드 결과는 dist/web과 dist/extension입니다. vercel.json은 웹 배포 설정만 제공하며 실제 배포는 하지 않았습니다. Supabase 프로젝트·DB·인증·실시간 연결도 아직 없습니다.
