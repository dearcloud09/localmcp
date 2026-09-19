# 실행 진행표

갱신: 2026-09-19 · [1pager](onepager.ko.md) · `feat/m1-modular-runtime` · PR #1 Draft.

## 이번 인계 점검과 후속 실행 기준
판정: **verification_pending**. 최초 및 재시도 workspace_info가 연결 계층 502로 실패해 로컬 실행 관문은 보류한다. 앱 등록/도구 발견을 실시간 호출 성공으로 취급하지 않는다. 원격 읽기·정적 검토·검증 준비는 수행했다. [관측 JSON](validation/m2c-session-readonly-handoff.json)

### 이번 세션에서 직접 확인한 것
원격 PR과 branch ref를 각각 읽어 시작 HEAD `4ecf0654b4dd9e3b43fc02025b37a01f42b2cc15`, Draft·open·미병합을 확인했다. GitHub 승인 설정과 저장소 메타데이터의 pull/push 권한은 따로 확인했다. 코드 커밋 50cad2d부터 이 HEAD까지 compare는 docs 아래 5개 변경만 반환했다. 이번에는 이전 overlay ZIP의 전체 소스 해시 검사를 반복하지 않았다.

발견한 LocalMCP 도구 정의는 20개다. read_file 입력에는 workspace/path만 있고 includeVersion이 없으며, edit_file에는 expectedSha256/operationId가 없다. apply_patch에는 expectedSha256이 있으나 operationId는 없다. 원격 src/modules/files.ts의 M2c 정의와 다르지만 현재 실행 중인 서버가 구버전이라는 확정 근거는 아니다.

workspace, root, configFile, files, filePermissions, shell, processes, persistentProcesses, skills, mcpServers, availableChecks, mutationRecovery: **응답에 없음 — 정상 workspace_info 응답 미수신**. 필드 값이 false/빈 배열이라는 뜻이 아니다. 기존 E1 샘플인지 확인되지 않아 calculator.mjs를 읽지 않았고 LocalMCP 쓰기·셸·프로세스 호출도 하지 않았다.

원격 src/server.ts의 MCP 버전은 고정 0.3.0이고 package.json은 0.3.9다. 실행 프로세스의 시작 경로/시각, 사용 중인 dist, 로컬 HEAD/dirty 상태는 확인하지 못했다. M2c 기능 포함 여부와 정확한 실행 커밋은 모두 미확인이다. 앱의 정의 새로고침은 서버 빌드/재시작과 별개다. 재연결 후에도 실행 경로·빌드 해시·프로세스 시작 근거 없이 디스크 HEAD만으로 실행 버전을 확정하지 않는다.

### 남은 A–D의 수용 기준 — 실행 결과가 아닌 준비
| 관문 | 준비한 검사 범위 | 현재 막힌 조건 |
|---|---|---|
| A / DEP-01 | 실제 checkout에서 npm audit JSON·종료 코드·Node/npm·HEAD/dirty·lock 해시·감사 범위를 함께 확보. 패키지→advisory→의존 경로→prod/dev 및 실제 노출 조건을 구분 | 실행 경로와 실제 감사 보고 없음. high 3개는 과거 사용자 보고만 유지 |
| B / E0-D | 기존 smoke-sandbox가 새 임시 fixture에서 실제 SDK stdio/run_check를 호출. red 3, green 8, 격리·원본 불변·timeout cleanup을 확인하도록 작성됨 | Docker daemon/context, 검토한 로컬 이미지 전체 ID, 빌드/의존성, 허용된 검사 경로 미확인 |
| C / 영속 lifecycle | 독립 fixture·profile·기록소·검사용 자식 서버에서 초기화, 별도 프로세스 재시작, replay, 권한 회수, 실제 config watcher reload를 stdio/loopback HTTP별 확인 | 유일한 연결과 분리된 실행 경로 없음. 기존 연결을 종료하는 방식은 사용하지 않음 |
| D / 최종 후보 ChatGPT | M2c 도구 필드의 실제 모델 전달을 검증할 새 비밀 없는 샘플. versioned read→해시 제한 편집→재읽기→동일 ID 재전달 및 stale hash 거부. 고정 참조 파일/확인 코드는 불변 | 실행 후보 식별·정상 연결·별도 샘플/연결 범위가 아직 확보되지 않음 |

A에서는 npm audit fix, lockfile 갱신, 패키지 설치를 하지 않는다. npm audit는 registry에 의존성 정보를 보내며 cache/log를 쓸 수 있으므로 순수 오프라인 읽기 검사로 부르지 않는다. 비영 종료는 취약점 발견과 실행 오류를 JSON/표준오류로 구분한다. 의존성 전파 경고를 독립 advisory 3개로 추정하지 않는다. 현재 package-lock.json은 앞 60줄과 blob ID만 읽었으며 전체 의존 경로를 분석했다고 표시하지 않는다. 공식 명령 계약: https://docs.npmjs.com/cli/v11/commands/npm-audit/

B의 최소 검증 안내와 smoke-sandbox/minimum-fixture 소스만 검토했다. 실행은 하지 않았다. 준비 조건이 충족되면 기존 단독 sandbox smoke 경로를 사용해 이미 성공 보고된 verify:minimum 전체를 이유 없이 반복하지 않는다. 단독 smoke 성공을 실제로 실행하지 않은 전체 runner 성공 표시로 바꾸지 않는다. Docker 대역을 실제 컨테이너 근거로 취급하지 않으며 새 이미지 pull·일반 셸 대체도 하지 않는다.

C의 검사 순서는 미초기화 기록소의 fail-closed 시작 → create-only 초기화/중복 초기화 거부 → guarded edit → 검사용 프로세스만 재시작 → 동일 ID/동일 payload의 과거 영수증과 실제 현재 파일 재읽기다. 이어 fileWrite 회수 후 도구 목록 제거와 캐시 replay 거부를 확인한다. 실제 설정 파일 watcher를 거치는 reload와 권한 snapshot을 코드에서 직접 교체하는 SDK 검사는 구분한다. 기록소/모드 변경과 권한 회수를 섞으면 전체 reload가 거부되어 기존 권한이 유지되므로 별도 거부 사례로 검사한다. 기존 SDK 검사 파일은 실제 SDK와 InMemoryTransport를 쓰며 같은 프로세스의 protocol server 재생성이다. 이를 별도 프로세스 재시작·실제 HTTP·전체 lifecycle 통과로 확대하지 않는다.

D의 새 검사가 필요한 이유는 이전 E1이 파일-only 구실행 코드의 근거이고, 이번 발견 스키마도 원격 M2c 정의와 다르기 때문이다. 새 샘플은 기존 E1과 다른 디렉터리·확인 코드·기준 해시를 사용하고 실제 프로젝트·비밀은 넣지 않는다. 기존 E1의 파일/테스트/확인 코드/증거는 읽기 전제 확인 전 접근하지 않고, 수정·초기화·회귀시키지 않는다. 현재 scripts/e1-session.mjs CLI는 기본 세션 경로만 받으며 prepare는 create-only, start는 수정 전 소스를 요구한다. 따라서 기존 prepare/start를 반복하거나 존재하지 않는 directory 옵션을 안내하지 않는다. 새 공개 중계 범위는 이 준비만으로 승인된 것으로 보지 않는다. 새 helper 구현이나 소스 업로드도 이번에 하지 않았다.

### 이번 변경과 중단 기준
문서 3개만 갱신한다: onepager, progress, 새 관측 JSON. 기존 사용자 보고와 원격 반영 JSON은 시점별 증거로 보존한다. 상세 설계/과거 E1 안내의 옛 상태 문구는 당시 기록이며 최신 상태는 이 진행표와 1pager를 따른다. 제품 소스·테스트·의존성·설정·토큰·영속 기록소·기존 E1은 변경하지 않는다.

연결 오류를 한 번만 재시도했고, workspace 밖 접근·권한 확대·소스 업로드 차단 우회·새 서비스/이미지 설치·main 병합·배포는 하지 않는다. 문서 전용 커밋에는 [skip ci]를 사용하며 CI 실행/통과를 주장하지 않는다. 독립 실행 경로와 샘플 전용 연결이 확보되어야 로컬 관문을 재개할 수 있다. 토큰·원시 argv/env·중계 URL·개인 로컬 경로는 공개 기록에 저장하지 않는다.

## 이전 확인 이력 — M2c 로컬 성공 보고 및 원격 소스 반영 확인
사용자는 마지막 커밋 블록에서 '커밋할 변경이 없어'와 shell_session_save의 parameter not set을 전달했다. 원격을 직접 조회한 결과 이미 사용자 코드 커밋과 문서 통합 커밋이 올라가 있었다. 코드 재적용이나 재커밋을 요구하지 않는다. 정확히 어느 터미널 실행에서 push했는지는 관찰하지 않았지만 원격 반영 자체는 확인했다.

- 코드 커밋: `50cad2dcd02a3766a42580b5831c986319364fb7`.
- 사용자 통합 커밋 및 확인 시 PR HEAD: `8dd7876192c1290d7d18bd70cc9b6d264aca34c4`.
- 통합 커밋의 다른 부모: 문서 커밋 `9c4fdf0cf19a468e8b94e3b96f471e26f9e8922c`.
- 코드 기준 트리: `42c0b411cece17214095ff98040b69fce61a2e43`.
- 이전 코드 미반영/보안 차단 문서는 그때의 이력이며, 지금 원격에 코드가 없다는 의미가 아니다. 이번 어시스턴트는 차단된 소스 쓰기를 재시도하지 않고 이미 존재하는 사용자 commit을 읽었다.

## 핵심 관문
| ID | 수용 기준 | 현재 판정 | 근거 / 남은 조건 |
|---|---|---|---|
| IG-01 | 원본 source-mode 자식 실행 | 사용자 실행 근거 확보 | 이전 실제 로그와 수정 후 전체 명령 성공 보고 |
| IG-02 | 누적 단일 패치 적용 | 로컬 적용 및 원격 변경 확인 | 원격 비교의 27개 경로가 통합 overlay와 일치 |
| IG-03 | 새 코드 전체 검사·SDK smoke | **통과 — 사용자 최종 표시 기준** | 새 report.json·세부 로그·정확한 개수/버전은 미수신 |
| IG-03a | 루트 이동 순서 회귀 | **수정 후 성공 보고 + 원격 수정 확인** | 고정 Workspace SHA-256에 대응하는 Git blob 일치 |
| IG-04 | 검증한 코드의 원격 반영 | **완료 — 원격 직접 조회** | 사용자 commit/merge와 예상 production 소스 대조. main 병합은 별도 |
| IG-05 / E0-D | 실제 Docker 격리·정리 | 미실행 | Docker 대역 검사를 실제 격리 결과로 취급하지 않음 |
| DEP-01 | npm high 경고 3개 | advisory 미수신·미해결 | 자동 audit fix 없이 영향/패키지 확인 필요 |

## 원격 대조의 실제 범위
문서 기준 9c4fdf0과 사용자 통합 8dd7876의 compare는 추가/수정 27개를 반환했다: production 소스 14, 테스트/fixture/helper 12, 벤치마크 1. 변경 경로는 통합 검토 ZIP의 overlay 목록과 일치한다. 삭제나 package/lockfile 변경은 비교 결과에 없다.

확인한 Git tree 항목의 blob ID와 로컬 통합 ZIP 바이트에서 계산한 Git blob ID를 대조했다. production 소스 14개 전부 및 벤치마크 1개가 일치했다. Workspace에만 이미 안내했던 두 줄의 루트 이동 검사 순서 수정을 적용한 예상 바이트를 사용했으며 SHA-256은 `383ae04f869399db08318a72ebc0945ddd6e55d17c73401df7fae7664756239b`, 원격 Git blob은 `8153dc653963bf502568d8beb40d2bcd1570ab14`였다. 이번에 테스트 12개의 blob까지 개별 대조했다고 쓰지는 않는다.

50cad2d와 8dd7876의 compare에서는 docs/onepager.ko.md, docs/progress.md, docs/validation/m2c-local-checks-user-report.json, docs/validation/m2c-root-order-local.json만 변경됐다. 사용자 문서 병합이 실행 코드/테스트/의존성을 바꾸지 않은 것을 확인했다. [원격 대조 기록](validation/m2c-publication-readback.json)

## 로컬 검사 성공 근거와 한계
M2C_LOCAL_CHECKS_OK는 안내한 순차 블록 완료 보고다. 블록은 sensitive-paths, verify:minimum(check/build/full-tests/mcp-smoke), 별도 e1-session 검사 뒤에만 이 표시를 출력한다. 이것은 사용자 실행 근거이며 이번 어시스턴트가 맥의 테스트를 재실행한 결과가 아니다.

최신 report.json·상세 결과는 미수신이고 정확한 성공 검사 수/skip/버전은 추정하지 않는다. 원격 소스 대조는 현재 업로드된 코드의 확인이며 사용자 테스트 시점의 작업 트리 전체나 설치 의존성의 독립 증명은 아니다. 별도 E1 보조 검사는 실제 ChatGPT 계정의 도구 선택·승인·편집 재수행과 다르다. [성공 보고](validation/m2c-local-checks-user-report.json)

## 보존한 실패·수정 이력
수정 전 사용자 보고는 darwin / Node v23.11.0, revision=7a11495, dirtyWorkingTree=true였다. 타입 검사/빌드는 성공했고 TS 검사 336개 중 335개 성공/1개 실패/취소·skip 0이었다. 유일한 실패는 루트 이동 거부 오류 우선순위다. 같은 실패는 Linux에서 재현됐고 공개 move 진입점에 루트 출발지 검사와 주석을 추가했다. 이동을 허용한 사고나 macOS 전용 문제로 기록하지 않는다.

수정 전에도 mutation-integration 5개와 recovery-runtime-sdk 7개는 성공했다. 12개는 당시 335개의 부분집합이다. 이전 Linux 독립 168개 성공과 현재 사용자 성공 보고를 합산하지 않는다. [실패·수정 근거](validation/m2c-root-order-local.json)

## 사용자에게 표시된 두 안내
첫 문장은 이전 안내 스크립트의 staged diff가 비었을 때 내보내는 중단 문구다. 원격 반영과 모순되지 않으며 이미 완료된 블록을 다시 실행한 설명과 일치한다. 해당 블록은 이미 commit/push된 경우를 별도 성공 상태로 처리하지 못했다.

Saving session/parameter not set은 별도의 shell_session_save 오류다. 직전에 사용한 set -u와 zsh의 미정의 매개변수 오류 동작이 원인일 가능성이 높지만 사용자 종료 함수/설정은 직접 읽지 않았다. 터미널 환경/이력 저장 오류를 테스트나 Git push 실패로 바꾸어 기록하지 않는다. 향후 실행 블록은 명시적인 비대화형 셸과 범위가 제한된 옵션을 사용하도록 안내하며, 현재 .zshrc 수정이나 테스트 재실행은 요구하지 않는다.

## 기존 단계와 남은 범위
| ID | 작업 | 상태 / 잔여 기준 |
|---|---|---|
| M1·M2a·M2B-01/02 | 모듈·프로필·시작·파일/하위 MCP 정책 | 기존 원격 구현과 검사 이력 유지 |
| 이전 E0·E1 | 최소 통합·ChatGPT 파일-only | 이전 사용자 근거 기준 통과. 새 코드 실계정 재검증과 구분 |
| M2B-03a/03b | Docker 사본·격리 검사 | 원격 어댑터/대역 존재, 실제 Docker 미검증 |
| M2B-03c | 기존 셸·하위 MCP 전역 격리 | 미구현 |
| M2C-01a/01b | 큐·해시·ID·실제 SDK | **원격 코드 반영 및 사용자 최소 검사 성공 근거 확보** |
| M2C-01c | 다른 ID의 교차 프로세스 잠금·일반 쓰기 | 미구현 |
| M2C-02a | 영속 기록·강제 종료 | **원격 코드 반영.** 전원/커널 장애 보장은 아님 |
| M2C-02b-1/2 | 서버 연결·초기화/권한 | **원격 코드 반영.** 영속 모드 전체 lifecycle 검증과 구분 |
| M2C-02b-3a | 읽기 전용 운영 점검 | **원격 코드 반영.** 복구 명령은 아님 |
| M2C-02b-3b/02c | 수동 복구·다중 파일·프로세스 복구 | 미구현 |
| M3 | 지연·실과제 성능 | 이전 국소 측정만 존재 |
| CI-01 | CI·교차 플랫폼 | 사용자 한도 때문에 보류 |

이번 어시스턴트 커밋은 문서/대조 기록만 갱신한다. 소스·테스트·의존성·사용자 터미널 설정은 수정하지 않는다. 기존 검증 JSON의 시점별 기록을 보존하며 추가 재커밋·push·동일 테스트를 요구하지 않는다. main 병합·배포·CI 과금·계정·공개 중계·이미지 설치 변경 없음. 토큰/접속 URL·개인 로컬 경로·기기명은 저장하지 않는다.
