# WhaleQuest Supabase 연결 준비

현재 상태는 **`livePending`** 이다. Supabase 프로젝트가 없으므로 프로젝트 생성, 데이터베이스 적용, 실제 익명 인증, 다른 기기 연결, 50명 부하 시험을 수행하지 않았다. 앱은 로컬 시연 모드를 사용하며 환경 변수를 넣는 것만으로 실시간 모드로 바뀌지 않는다. 이 문서는 최종 발표용 기능 전체의 서버 연결 준비를 설명한다.

## 포함된 준비물과 검증 범위

- `packages/server/client.ts`: 추가 SDK 없이 `fetch`로 익명 인증·토큰 갱신·RPC를 호출하는 어댑터. 타입검사와 모의 HTTP 계약 테스트 대상이다.
- `docs/reference/supabase-schema.sql`: 비공개 데이터 테이블과 RPC의 **검증 전 설계 초안**. 실제 마이그레이션 파일이 아니며 PostgreSQL에서 실행하거나 보안 Advisor를 통과한 상태도 아니다.
- `tests/server-contract.test.ts`: 브라우저 키 검증, 프로젝트별 탭 세션, 동시 인증 통합, 토큰 갱신, 오류·타임아웃, 요청·응답 매핑을 모의 응답으로 검증한다. 서버 채점·RLS·동시성 검증을 대체하지 않는다.

## 프로젝트가 준비되면 필요한 설정

1. 전용 Supabase 프로젝트와 프로젝트 소유자를 정하고 서울 리전 사용 가능 여부를 확인한다. 프로젝트 생성과 요금제 선택은 아직 수행하지 않았다.
2. 익명 로그인을 켠다. 브라우저에는 프로젝트 URL과 **publishable key**만 제공한다. `service_role`, `sb_secret_*`, 데이터베이스 비밀번호, JWT 서명 비밀 키를 `VITE_*`, Git, 확장 패키지에 넣지 않는다. 현재 어댑터는 호환용 legacy anon JWT도 받지 않는다. [API 키 문서](https://supabase.com/docs/guides/getting-started/api-keys)
3. 프로젝트 루트의 추적하지 않는 `.env.local`에 아래 두 값을 넣고 개발 서버를 다시 시작한다. 값이 있어도 앱은 시연 모드를 유지한다.

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_BROWSER_KEY
```

4. 익명 인증의 기본 제한은 현재 문서상 **IP당 시간당 30회**다. 학교 공동망에서 학생 50명과 교사·재시도를 수용할 설정을 확인하고, CAPTCHA/Turnstile 및 남용 방지를 함께 설계한다. 어댑터는 `signInAnonymously(captchaToken)` 전달을 지원하지만 CAPTCHA 화면/위젯은 연결하지 않았다. 브라우저에서 관리자 키로 제한을 우회하지 않는다. [익명 인증과 제한](https://supabase.com/docs/guides/auth/auth-anonymous)
5. Data API는 `public` RPC만 노출한다. **`whalequest_private`를 노출 스키마 또는 Realtime publication에 추가하지 않는다.** 테이블 자동 노출 설정에 의존하지 않고 권한을 직접 확인한다. [Data API 보안](https://supabase.com/docs/guides/api/securing-your-api)

## SQL 초안을 검증된 마이그레이션으로 만들기

현재 작업 환경에는 Supabase CLI, Docker, `psql`이 없어 로컬 데이터베이스 검증을 실행하지 못했다. 다음 순서는 앞으로 별도의 개발 환경에서 수행할 작업이다. 원격 프로젝트에 이 SQL을 그대로 실행했다고 간주해서는 안 된다.

1. 설치된 CLI의 `supabase --help`, 필요한 하위 명령의 `--help`와 `supabase --version`을 먼저 확인한다.
2. 폐기 가능한 **로컬** Supabase 데이터베이스에서 SQL 초안을 검토하고 실행한다. 기존 프로젝트에 적용할 때는 객체 이름·권한·기존 데이터와 충돌 여부를 먼저 검토한다.
3. `supabase db query`가 지원되는 CLI 또는 로컬 `psql`을 이용해 수정·실험한다. 로컬 실험 중 `apply_migration`으로 이력을 쌓지 않는다.
4. 보안·성능 Advisor를 실행하고 아래 권한·동시성 시험을 통과한다.
5. CLI로 마이그레이션을 생성한다. 파일명은 수동으로 만들지 않는다. 로컬 변경으로부터 생성할 때는 해당 버전 도움말을 확인한 뒤 `supabase db pull <설명> --local --yes`, `supabase migration list --local` 순서를 사용한다. 직접 신규 마이그레이션을 만드는 흐름이라면 반드시 `supabase migration new <설명>`으로 생성부터 한다.
6. 검토된 마이그레이션 적용, 앱 RPC 연결과 오류 표시, 실제 기기·네트워크 검증을 마친 뒤에만 live 상태로 전환한다. 이 문서는 배포나 원격 변경을 수행하지 않는다.

## 데이터·권한 모델

| 비공개 테이블 | 목적과 제한 |
|---|---|
| `rooms` | `auth.uid()` 소유자, 6자리 코드, 생성 후 24시간 만료, 상태 버전. 방 생성은 프로젝트 단위 잠금으로 동시 활성 방 1개 제한 |
| `participants` | 방·익명 사용자 UUID의 고유 관계. 재입장은 같은 참여자로 복구하며 신규 입장은 방 잠금 아래 50명 제한 |
| `activities` | 방당 활성 활동 1개. 이해도·빠른 확인·형성평가·레이드 및 비공개 정답 포함 문제 세트 |
| `submissions` | 실제 답안, 서버 정오답, 풀이 시간, 참여자별 고유 제출 UUID, 저장된 결과. 동일 키·동일 본문 재시도는 같은 결과 반환; 다른 본문은 거부. 신규 제출은 참여자당 분당 120회 제한 |
| `raid_contributions` | `(활동, 참여자, 문제)` 기본키로 정답 기여를 한 번으로 제한. 오답 뒤 정답은 기여 가능 |
| `shared_sets` | 추측하기 어려운 UUID 링크와 30일 만료. 로컬 개인 학습 사본은 정답을 포함하는 별도 공유 기능 |
| `question_inbox` | 학생 질문, 교사 전용 조회. 이름·연락처 없이 익명 세션 관계만 저장. 참여자당 분당 5개 제한 |

모든 테이블은 RLS를 켜고 `PUBLIC`, `anon`, `authenticated`의 직접 접근 권한을 회수한다. 클라이언트용 테이블 정책을 만들지 않으므로 기본 거부가 적용된다. `public.wq_*`는 `SECURITY INVOKER`이고, 비공개 `SECURITY DEFINER` 구현은 고정된 빈 `search_path`와 스키마를 명시한 참조를 사용한다. 정답 테이블에 접근하려고 `SECURITY DEFINER`를 공개 스키마에 두지 않는다. 기본 함수 실행 권한을 회수하고 허용 목록에만 `authenticated` 실행을 부여한다. 비공개 구현은 매번 `auth.uid()`의 방 소유·참여 관계를 확인하며 `user_metadata`를 권한 판단에 사용하지 않는다. [함수 권한 문서](https://supabase.com/docs/guides/database/functions)

익명 사용자는 기술적으로 `authenticated` 역할을 사용한다. 역할 이름만으로 교사 권한을 주지 않는다. 방 생성자만 교사 명령·교사 보고·질문함 조회를 수행한다. 학생 제출에는 `correct`, 점수, 기여량, 참여자 UUID 인자가 없으며 서버가 문항 유형별 답안을 채점한다. 단답형은 코어 엔진과 같이 NFKC 및 앞뒤 공백 정규화를 사용하고 대소문자·동의어·수학적 동치를 자동 확대하지 않는다. PostgreSQL과 JS의 정규화 동일성은 실제 DB 시험에서 확인해야 한다.

학생용 스냅샷은 문항 ID·유형·발문·선택지와 학급 집계만 담는다. 정답·해설·태그·성취기준·개별 답안·사용자/참여자 UUID는 담지 않는다. 이해도 통계는 참여자별 마지막 응답으로 계산한다. 교사 보고는 문제 세트와 문항별 마지막 답안 집계, 오답 상위 3문항을 반환하므로 학생 호출이 거부되는지 반드시 검증한다. 전자칠판은 학생용 스냅샷만 표시하고 별도의 익명 인증·방 참여 또는 향후 전용 표시 권한 설계가 필요하다. QR 코드만으로 교사 토큰을 전달하지 않는다.

공유 문제 링크는 로컬 학습을 위해 정답을 포함한다. 비공개 수업 문제를 같은 링크로 먼저 공개하면 정답이 알려질 수 있다. 공유 사본 가져오기와 수업방 문제 배포를 구분하고, 공유 가져오기 후 로컬 `importSet` 검증·교사 검수를 유지한다.

## 어댑터와 RPC 계약

`configured()`는 환경 설정의 형식만 확인한다. 프로젝트 존재·연결·SQL 설치 여부를 보장하지 않는다. `SupabaseClient` 생성자는 잘못된 URL, secret key와 legacy JWT를 거부한다. `call(name, body)`는 먼저 익명 인증 또는 토큰 갱신을 수행한 뒤 `POST /rest/v1/rpc/<name>`에 `apikey: publishable key`와 `Authorization: Bearer <사용자 JWT>`를 보낸다. 공개 키를 사용자 JWT로 사용하지 않는다. [공식 Auth 구현](https://github.com/supabase/auth-js/blob/master/src/GoTrueClient.ts)

| RPC | 인자 | 응답·권한 |
|---|---|---|
| `wq_create_room` | `{}` | 교사 방 스냅샷; 소유자는 호출자의 익명 세션 |
| `wq_join_room` | `p_code` | 입장 후 안전한 스냅샷 |
| `wq_snapshot` | `p_room_id` | 소유자 또는 참여자용 `RoomSnapshot` |
| `wq_start_activity` | `p_room_id, p_kind, p_set` | 교사 전용. 이해도는 `p_set: null`, 나머지는 검수한 `QuestionSet` |
| `wq_end_activity` / `wq_close_room` | `p_room_id` | 교사 전용, 활동 또는 방 종료 |
| `wq_submit` | `p_room_id, p_activity_id, p_question_id, p_answer, p_idempotency_key`, 선택 `p_duration_ms` | 학생 전용. `{ correct, contribution, stateVersion }`. 풀이 시간은 0~3,600,000ms, 기본 0이며 권한·채점에 쓰지 않는다. 이해도는 문제 ID `null`, 답은 `understood`/`unsure`/`help` |
| `wq_teacher_report` | `p_room_id` | 교사 전용 문항 집계·정답 포함 문제 세트 |
| `wq_share_set` | `p_set` | 공유 UUID·만료일; 세션별 유효 공유 최대 20개 |
| `wq_read_shared_set` | `p_token` | 인증된 링크 소지자에게 로컬 학습용 문제 세트 |
| `wq_send_question` | `p_room_id, p_text` | 참여 학생, 1~500자 질문의 ID |
| `wq_read_inbox` | `p_room_id` | 교사 전용 질문 목록, 학생 식별자는 제외 |

```ts
import { SupabaseClient } from './packages/server/client';
const client = new SupabaseClient();
const room = await client.call('wq_join_room', { p_code: 'A1B2C3' });
const snapshot = await client.call('wq_snapshot', { p_room_id: room.roomId });
```

위 코드는 준비된 계약의 사용 예이며 현재 앱을 live 모드로 연결하는 코드가 아니다. RPC 응답 타입은 계약을 표현하며 모든 응답의 런타임 스키마 검증을 제공하지 않는다. 실제 UI 연결 시 예상치 못한 응답을 거부하는 검증을 추가하고, 공유 문제는 기존 코어 검증기로 검사한다.

세션은 프로젝트 원점별 `sessionStorage`에 저장해 같은 탭 새로고침에서 복구한다. 저장소 접근이 차단되면 메모리 세션만 사용한다. 탭 종료·데이터 삭제·다른 기기에서는 같은 익명 사용자 복구를 보장하지 않는다. 다른 기기에서 교사 권한을 넘기는 기능도 포함하지 않았다. 갱신 토큰 거부 시 권한을 새 사용자로 몰래 바꾸지 않고 호출을 실패시킨다. 네트워크 오류는 기존 세션을 유지한다. 세션당 어댑터 인스턴스 하나를 사용해 회전 토큰 갱신 충돌을 피한다.

제출 재시도는 새 UUID를 만들지 말고 **동일 제출 UUID·동일 본문**을 유지한다. 어댑터는 쓰기 요청을 자동 재전송하지 않는다. 응답이 없으면 전송 대기 상태를 유지하고, 서버 확인 후 완료로 바꾼다. 새 활동·종료·5분 레이드 종료 이후의 새 제출은 거부된다. 이미 수락된 제출의 재시도는 저장된 결과를 반환한다. HP는 시작 인원×문항 수×70%의 올림이며 정답 기여는 1이다.

## 집계 전송과 Realtime 연결 전 요구사항

현재 어댑터는 WebSocket, Realtime 채널 또는 폴링 루프를 생성하지 않는다. 초기 연결 검증은 `wq_snapshot`을 **최대 초당 한 번**, 이전 요청 완료 후 다음 타이머를 시작하는 폴링 방식으로 진행할 수 있다. 탭이 숨겨지거나 연결이 끊기면 중단하고, 복귀·재연결 시 스냅샷을 다시 읽는다. 이 방식도 실제 지연·요금·50명 부하를 측정해야 한다.

정식 Realtime 연결에서는 별도 비공개 채널과 소유·참여 관계에 기반한 `realtime.messages` RLS 정책을 준비하고 클라이언트의 `private: true`와 프로젝트의 공개 채널 금지를 확인한다. 학생은 읽기만 허용하고 서버만 집계를 게시하도록 한다. 상태 버전으로 낡은 이벤트를 버리고 초당 한 번 이하로 집계를 묶는다. 정답·신원 테이블을 그대로 Postgres Changes로 전파하지 않는다. 현재 잠긴 `realtime` 스키마에 테이블·함수를 만들거나 `realtime.messages`의 RLS를 다시 켜는 문장을 추가하지 않는다. [Realtime 권한 문서](https://supabase.com/docs/guides/realtime/authorization)

초기 운영 제한은 활성 방 1개, 학생 50명이다. Free 요금제 수치를 고정된 보장으로 간주하지 말고 실제 프로젝트의 연결·메시지·월간 사용량 제한을 다시 확인한다. [Realtime 제한](https://supabase.com/docs/guides/realtime/limits)

## 보존 기간과 운영 시험

방은 생성 후 24시간 만료하고, 원시 제출·기여·활동 문제·학생 질문·참여 관계는 종료 또는 만료 **24시간 후** 삭제하는 관리자 전용 `whalequest_private.cleanup()` 초안을 포함한다. 실제 예약 작업은 생성하지 않았다. 시간별 관리자 작업을 별도로 설정하고 실행 성공·삭제 지연을 검증해야 한다. 방 메타데이터와 Auth 익명 계정의 별도 보존·삭제 정책도 필요하다. Auth 익명 계정은 자동 삭제되지 않으며 임의로 `auth.users`를 지우면 참조 제약·세션 문제가 생길 수 있다. 개인 기록·문제 원본·가져온 공유 사본은 로컬 저장으로 별도 유지한다.

live 전환 전에 다음을 실제 DB·다른 브라우저 세션에서 통과하고 증거를 기록한다.

- 학생의 활동 생성·종료·교사 보고·질문함 조회, 비회원 방 조회, direct table/정답 조회, 조작된 `correct`/참여자 UUID 제출이 모두 거부된다.
- `anon` 무세션 실행, 폐쇄·만료 방 입장, 이전 활동·시간 종료 후 제출이 거부된다. 교사는 자기 방만 제어한다.
- 51번째 신규 학생은 거부되지만 기존 학생은 같은 참여자로 재입장한다. 동시에 방 두 개를 생성하면 하나만 열린다.
- 같은 UUID의 병렬 재시도는 같은 결과를 반환하고 HP는 한 번만 감소한다. 같은 문항에 다른 UUID로 정답을 보내도 기여는 한 번이다. 오답 뒤 정답은 한 번 기여한다. 같은 UUID를 다른 답안·문항·활동에 재사용하면 거부된다.
- 스냅샷에 정답·해설·태그·개인 답안·사용자/참여자 UUID가 없다. 교사 보고의 최신 응답 분포와 오답 상위 문항이 수작업 계산과 일치한다.
- 교사 새로고침, 학생 재접속, 전송 도중 단절·시간초과, 브라우저 저장소 차단, 토큰 갱신·만료를 시험한다.
- 50명 동일 IP의 인증·입장·제출, 연결 지연, 합계 반영 시간, 메시지량, CAPTCHA와 무료 제한을 실제 네트워크에서 측정한다.
- RLS·실행 권한·`search_path`·비공개 스키마 노출 여부와 Advisor 결과, 예약 삭제 및 30일 공유 만료를 확인한다.

이 시험들은 아직 수행하지 않았다. 로컬 시연과 HTTP 모의 테스트 통과는 실제 서버 기능·보안·학교망 성능을 입증하지 않는다.
