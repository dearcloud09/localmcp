# 실행 진행표

갱신: 2026-09-20 · [1pager](onepager.ko.md) · `feat/m1-modular-runtime` · PR #1 Draft.

## 현재 상태 — 새 macOS 진단으로 실행 경로 식별
판정: **verification_pending**. 동일한 502 호출이나 보류 문구를 반복한 것이 아니라, 사용자 진단으로 두 checkout과 E1 제어 경로의 실제 관측을 추가했다. 연결 복구·감사·수명주기 실행 성공은 아직 없다. [새 진단 근거](validation/m2c-macos-execution-path-report.json)

### 증거의 출처
사용자는 지정 진단 스크립트의 SHA-256 일치 표시와 JSON 출력 전체를 제공했다. 아래 macOS 정보는 사용자 실행 보고이며 어시스턴트의 직접 macOS 접근 결과가 아니다. 원격 PR/commit 비교와 다음 실행 경로의 소스 검토는 GitHub 직접 읽기 결과다. 원시 사용자 경로·PID·토큰·접속 URL은 새 공개 기록에서 제외한다.

| 구분 | 새 관측 | 해석과 한계 |
|---|---|---|
| E1 제어 소켓 | ECONNREFUSED | 현재 지정 제어 경로에서 정상 status 응답 없음. 과거 502의 정확한 발생 계층을 증명하지 않음 |
| 제한된 관련 프로세스 탐색 | 0건, ps/lsof 사용 가능 | 두 checkout 및 E1 PID 범위에서 대응 프로세스 미관측. 시스템 전체의 모든 LocalMCP 프로세스 부재로 확대하지 않음 |
| 기존 E1 기록 | 등록 파일·연결 기록 존재, PID 기록 존재 | 살아 있는 프로세스나 유효한 중계 인증을 증명하지 않음. 기록 PID를 종료 대상으로 사용하지 않음 |
| E1 로그 | tailAvailable=false | 로그가 없거나 읽기 조건을 만족하지 못함. 오류가 없었다는 뜻은 아님 |
| R1 | 4a5e66c99ca95efe99fc1890942e8ac9c34ce9c8 / feat/m1-modular-runtime / clean | 소스·디스크 빌드에서 M2c 문자열 없음. 과거 스키마와 일관되지만 실제 과거 실행 경로는 미확인 |
| R2 | 8dd7876192c1290d7d18bd70cc9b6d264aca34c4 / verify/m2c-integration / clean | 소스·디스크 빌드에 M2c 문자열, dist/recovery-init.js 존재. 실행 커밋 증명과 구분 |
| 독립 터미널 | Node v23.11.0 / npm 발견 / npm 메타데이터 11.4.2 | npm 명령의 실제 성공과 의존성의 실제 로딩은 다음 실행에서 확인 |
| Docker | cliFound=false | 현재 PATH에서 미발견. Docker Desktop/다른 설치 위치·daemon·이미지 상태는 미확인 |

두 checkout의 lock SHA-256은 `8185650314a8799924768a54193de71332d3a5c1037a87d58b4e08ba5442b1d4`로 같았다. SDK 1.30.0, Express 5.2.1, ws 8.21.3, Zod 4.5.4, tsx 4.23.13, TypeScript 7.0.2는 설치 메타데이터 기준이다. 두 위치의 nonDocsCommittedChangesFromReference는 null로, 차이 없음으로 바꾸지 않는다.

### 원격 기준과 R2 선택
세션 시작 원격 HEAD는 `2ad5944c07f925c65f6423e121e5da20d7451e77`이고 PR은 open/Draft/미병합이었다. `8dd7876 → 2ad5944` 원격 compare는 ahead 2 commits, docs 4개만 반환했다: onepager, progress, publication-readback, session-readonly-handoff. 실행 소스·테스트·package/lock 변경은 없다. 이는 원격 두 커밋의 비교이며 macOS 디스크 빌드의 재현 빌드 증명은 아니다.

따라서 독립 검증 및 연결 복구의 후보는 R2다. 문서 최신화를 이유로 R1 pull·R2 checkout 변경·npm 설치·재빌드·verify:minimum 전체 재실행을 요구하지 않는다. R2가 진단 이후 변경되면 후속 블록은 자동 덮어쓰기 대신 중단한다.

## 다음 실행과 변경 경계
### A — npm 감사
R2에서 npm의 실제 버전을 확인하고, dev/optional/peer를 포함한 npm audit JSON·종료 코드·lock SHA·HEAD를 수집한다. 공개 npm registry를 해당 명령에서 명시하고 재시도·로그 범위를 제한한다. 원본 감사 JSON과 stderr는 저장소 밖 소유자 전용 임시 디렉터리에 저장하며, 공유 출력은 필요한 advisory·의존성 필드로 제한한다. 프로젝트 HEAD/status/package/lock 불변을 전후 비교한다.

이 명령은 registry에 의존성 정보를 보내고 임시 보고서·cache를 쓰므로 읽기 전용 진단이라고 부르지 않는다. audit fix·설치·lockfile 갱신은 하지 않는다. 종료 코드 1만으로 실행 실패라고 단정하지 않고 JSON의 정상 보고 여부를 함께 판정한다. 과거 high 3개의 이름·원인은 보고서 수신 전 추정하지 않는다. 공식 명령 계약: https://docs.npmjs.com/cli/v11/commands/npm-audit/

### 연결 복구 — 기존 E1 등록과 샘플 유지
현재 확인된 원본 lifecycle start는 E1 전용 HOME과 기존 profile로 실행할 수 있다. 일반 HOME의 localmcp 명령, E1 helper prepare/start, 버그 복원은 사용하지 않는다. 기존 helper의 sessionEnvironment와 inspectProfile을 이용하되 prepare/check를 실행하지 않으며 테스트·증거 JSON을 재생성하지 않는다.

기동 전 R2 HEAD/clean 상태·보고된 핵심 dist 해시, 기존 session/profile/등록/연결 기록의 일치, file-only 권한, 수정 완료 소스 및 불변 파일의 baseline을 검사한다. 현재 살아 있는 제어 소켓이 있으면 중단한다. 등록 파일이 없거나 샘플/노출 범위가 다르면 시작 전에 중단하고 자동 등록을 해결책으로 사용하지 않는다. 실행 중 session·등록 파일을 다른 터미널에서 동시에 변경하지 않는다.

실제 기동은 검토한 dist/index.js start 경로다. 이 경로의 lock·stale socket 처리와 에이전트 자식 실행을 사용하므로 PID/소켓/로그/연결 기록이 갱신된다. 이전에 실행 중인 서버를 stop/reload하지 않는다. stdout/stderr에는 접속 URL이 들어갈 수 있어 원문을 표시하지 않고 제어 소켓 readback의 PID·ready·기존 URL/설정 일치 여부만 요약한다. raw 로그는 공유하지 않는다.

기동 전후 dist 전체 manifest와 기존 sample/session/profile/worker/evidence 내용을 대조한다. 이 provenance는 특정 디스크 산출물로 시작했다는 근거이지 source-to-build 재현성 증명은 아니다. start 실패/시간 초과 후에는 outcome을 미확인으로 남기고 자동 재실행하지 않는다. ready 확인이 생긴 뒤 실제 ChatGPT workspace_info를 한 번 호출해 새 근거를 얻는다. 앱 스키마 새로고침은 이 작업과 별개다.

기존 E1은 memory recovery profile이다. 새 M2c가 memory/restartPersistent=false를 반환해도 기능 부재로 보지 않는다. 새 코드로 기존 샘플을 다시 읽는 것은 접속 확인이며 D의 새 guarded-edit 실계정 검증 통과가 아니다.

### B·C·D
B는 Docker CLI의 알려진 기존 설치 위치를 고정된 소수 경로로만 확인한다. PATH 영구 변경·Desktop 시작·설치·이미지 pull은 포함하지 않는다. CLI를 찾으면 기존 local Unix context/daemon/검토된 이미지를 확인해야 한다. 없다고 확인돼 설치가 필요할 때 구체적 승인을 요청한다.

C의 R2 실행 후보는 확보했지만 실제 전체 lifecycle은 미실행이다. 별도 fixture/profile/기록소와 stdio/loopback HTTP 자식 서버를 사용한다. 미초기화 fail-closed, create-only 초기화/중복 거부, guarded edit, 별도 프로세스 재시작과 과거 receipt, 권한 회수, 실제 watcher reload를 분리한다. 기존 InMemoryTransport SDK 테스트나 같은 프로세스의 서버 재생성만으로 이 관문을 통과시키지 않는다. recovery namespace 변경과 권한 회수를 섞어 reload가 거부되면 기존 권한이 유지되는 사례도 별도다.

D는 연결 복구와 별개다. 기존 E1 파일·확인 코드·테스트·증거는 유지한다. 최종 후보의 실제 모델 필드 전달/guard/replay를 검증할 별도 비밀 없는 샘플 범위를 정하고 새 공개 범위가 필요하면 구체적으로 승인받는다. 파일 도구 노출을 npm/Docker/셸 권한으로 확대하지 않는다.

## 유지되는 구현·검증 상태
| ID | 현재 상태 / 한계 |
|---|---|
| M1·M2a·M2b-01/02 | 기존 모듈·프로필·파일/하위 MCP 정책 구현과 검사 이력 유지 |
| 이전 E0·파일-only E1 | 당시 사용자 근거 기준 통과, chatgptActorVerified=false의 한계 유지 |
| IG-01/02/03/03a | 누적 M2c·source-mode·루트 순서 수정 후 M2C_LOCAL_CHECKS_OK 사용자 보고. 정확한 최신 test/skip 수·새 report 미수신 |
| IG-04 | 코드 50cad2d·통합 8dd7876의 원격 반영 완료. 이전 production 14+benchmark 1 blob 대조 이력 유지. 이번 전수 재검사 아님 |
| M2b-03 / E0-D | Docker 어댑터/대역 구현, 실제 Docker 미검증 |
| M2b-03c | legacy shell/하위 MCP 전역 격리 미구현 |
| M2c-01a/01b/02a/02b | 큐·hash/ID·영속 journal·runtime·읽기 전용 점검 반영. 전체 lifecycle/전원 장애 보장과 구분 |
| M2c-01c/02b-3b/02c | 다른 ID 교차 프로세스 잠금·수동 복구·다중 파일·프로세스 복구 미구현 |
| M3 / CI-01 | 국소 측정만 존재. 실과제 성능·교차 플랫폼 CI는 미완료/한도 보류 |

[사용자 최소 검사 성공](validation/m2c-local-checks-user-report.json) · [코드 원격 반영](validation/m2c-publication-readback.json) · [수정 전 실패·수정](validation/m2c-root-order-local.json) · [첫 인계 점검](validation/m2c-session-readonly-handoff.json).

과거 상세 문장과 시점별 이력은 [이전 고정 revision의 진행표](https://github.com/dearcloud09/localmcp/blob/2ad5944c07f925c65f6423e121e5da20d7451e77/docs/progress.md)에 남긴다. 현재 문서는 새 진단에 맞춰 정리했으며 기존 증거 JSON을 수정하지 않았다. 과거 335/336 실패나 빈 stage 안내를 현재 검사 실패/코드 미반영으로 되돌리지 않는다.

## 이번 어시스턴트 실행 범위
원격 읽기·compare, 사용자 진단 해석, 운영자용 감사/재연결 블록 준비와 Linux 대역 자체 검사만 수행했다. 두 블록의 문법과 10개 대역 점검은 실제 macOS·npm registry 감사·중계·제품 lifecycle 실행이 아니다. 자체 검사에서는 fixture용 기대 hash와 helper/CLI 대역을 사용했다. 배포되는 운영자 블록에는 사용자 보고의 R2 hash를 고정한다.

Git 변경은 onepager·progress·새 사용자 진단 JSON뿐이다. 제품 코드/테스트 업로드·차단 우회·E1 편집·로컬 설정 변경·권한 확대·서비스/이미지 설치·main 병합·배포·비용 변경 없음. 문서 commit은 [skip ci]이며 CI 통과로 표시하지 않는다.
