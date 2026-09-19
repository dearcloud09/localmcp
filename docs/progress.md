# 실행 진행표

갱신: 2026-09-19 · [1pager](onepager.ko.md) · `feat/m1-modular-runtime` · PR #1 Draft.

## 현재 상태 — M2C-02b-3a 운영자 점검의 로컬 구현
기준 원격 커밋은 `10a7eb72666e85f7e87698f8f8704ae0de21c5cc`다. 이전 runtime 검토 보관본 72개 파일의 해시를 확인하고 읽기 전용 inventory·개별 작업/현재 파일 비교·운영자 CLI를 추가했다. **새 33개와 이전 121개를 같은 실행에서 154개 통과했다. 원격에는 실행 코드가 아니라 1pager·진행표·점검 계약·검증 JSON을 갱신한다.** 기존 업로드 차단의 재시도/우회는 하지 않았다.

## 단계별 수용 기준과 상태
| ID | 작업 | 현재 상태 | 남은 기준 |
|---|---|---|---|
| M1-01/03 | 모듈·CLI/Git·권한 비트·UTF-8 | 원격 구현·과거 사용자 검증 | 현재 원격 실행 코드 유지 |
| M2A-01/05 | 프로젝트 프로필·doctor·샘플 | 원격 구현·과거 E0 성공 보고 | 새 M2c 코드 E0와 구분 |
| M2B-01a/01b | 시작/reload·읽기/쓰기 | 원격 구현·과거 E0 성공 보고 | 신규 연결 코드 로컬 작성·공통 dispatch 검사. 실제 SDK 미검증 |
| M2B-02a/02c | 민감 경로·하위 MCP 정책·SDK 회귀 | 원격 구현·과거 E0/E1 보고 | 이름 필터·allowlist를 OS 격리로 보지 않음 |
| M2B-03a | Docker 사본·run_check | 원격 어댑터 구현 | 실제 Docker 미검증 |
| M2B-03b / E0-D | 실제 격리·타임아웃 정리 | 보류 | 사용자 로컬 Docker/기존 이미지 필요 |
| M2B-03c | 기존 셸·외부 MCP 전체 격리 | 미구현 | 새 run_check가 기존 실행을 자동 격리하지 않음 |
| E0-01/03 | check/build/test/SDK smoke·결과 파일 | 이전 사용자 macOS 통과 보고 | 원본 세부 로그·정확한 개수/버전은 미수신 |
| E1-P/01/02 | 실접속·편집·재읽기·로컬 대조 | 이전 사용자 근거 기준 통과 | 원시 MCP 기록의 독립 감사와 구분 |
| CI-01 | GitHub CI·교차 플랫폼 | 한도 때문에 보류 | 재실행/비용/설정 변경 없음 |
| M2C-01a | 공유 큐·기준 해시·ID 중복 방지 | 로컬 구현·이번 회귀 성공, 원격 미반영 | 이전 보관본 6개 해시 대조 |
| M2C-01b | config/Zod/SDK 통합 5개 | 이전 로컬 작성·미실행 | 원본 의존성 확보와 새 코드 전체 검사 |
| M2C-01c | 다른 프로세스의 파일 충돌·다중 파일·일반 쓰기 | 미구현 | 영속 동일-ID 예약만으로 완료하지 않음 |
| M2C-02a | 영속 편집 작업 journal·선택적 Workspace 주입 | 로컬 구현·이번 회귀 성공 | 원격 미반영; 새 연결 코드에 대한 SDK 검증 필요 |
| M2C-02a-test | 실제 SIGKILL·동일 ID 다중 프로세스 | **실제 프로세스 검사 통과** | 전원·커널 장애/다른 FS·macOS 미검증 |
| M2C-02b-1 | 서버 설정·공유 journal·Workspace 연결 | **로컬 연결 코드 작성·독립 검증** | 전체 config/Zod/SDK 7개 미실행 |
| M2C-02b-2 | create-only 초기화·existing-only 시작·reload/권한 | **새 독립 30개 통과** | HTTP/stdio 실제 실행·launcher 수명주기 검증 남음 |
| M2C-02b-3a | 운영자 읽기 전용 조회·현재 파일 비교 | **로컬 구현·새 33개 및 기존 121개 통과** | 원격 코드 미반영, 실제 macOS/SDK 검증 대기 |
| M2C-02b-3b | 검토 후 수동 복구 명령 | 미구현 | 조회 결과가 재시도/잠금 삭제/기록 초기화 권한을 부여하지 않음 |
| M2C-02c | 제품 프로세스 재시작 복구·다중 파일 트랜잭션 | 미구현 | journal은 프로세스 부활/자동 롤백/영속 exactly-once가 아님 |
| M3-00 | journal 영속화 비용의 국소 측정 | 이전 100쌍+재전달 100회 측정 | 단일 환경의 4 KiB 파일 microbenchmark |
| M3-01 | ChatGPT/MCP/Worker 실과제 지연 | 미실행 | 모델·원격 왕복·호출·재시도 포함 비교 필요 |

## 이번 점검 구현과 실제 검사
- 기존 namespace만 열고 metadata를 다시 확인한다. 조회 중 namespace 교체, 손상, 링크/권한 위반, 예상 밖 항목은 거부하거나 검토 필요로 보고한다. 읽기 때문에 atime이 바뀔 수 있지만 의도적인 기록 쓰기·chmod·삭제는 없다.
- 목록은 hash reference/state만 반환하고 limit/after 페이지를 제공한다. 최대 페이지 200개, 전체 열거는 설정 capacity 이내다. 원자적 snapshot/전체 건강 상태를 주장하지 않는다.
- 남은 allocation lock을 보고하되 실행 중/죽은 프로세스 여부를 추정하거나 잠금을 제거하지 않는다. 시작만 있는 기록과 absent ID도 자동 재실행 대상으로 바꾸지 않는다.
- 알려진 ID와 workspace에 한해 현재 파일 해시를 선택적으로 대조한다. 기존 Workspace 민감 경로/링크/크기 정책을 따른다. 성공 영수증과 현재 내용이 다르면 둘을 그대로 보존한다.
- CLI는 runtime 설정이나 MCP를 실행하지 않고 명시한 경로만 받는다. 종료 코드 0=조회 완료, 2=운영자 검토 필요, 1=차단이다. JSON 오류는 개인 경로·원문을 출력하지 않는다. reset/retry/unlock/force는 없다.

Linux / Node 22.16.0 / TypeScript 5.8.3 / @types/node 25.1.0, 실제 UID 1000. **새 33개 + 이전 121개 = 한 실행 154개 통과**, 실패/취소/건너뜀 0. 독립 production core/Workspace/CLI와 테스트에 strict 타입 검사를 적용했다. 실제 CLI 자식 프로세스로 종료 코드와 JSON을 검사했다.

실제 worker를 효과 후 완료 기록 전에 SIGKILL하고 별도 CLI로 조사했다. unresolved이며 효과는 한 번, 파일/기록은 그대로였다. 활성 콜백도 같은 unresolved 의미이며 점검이 취소/재실행하지 않는 것을 검사했다. before/after의 파일 집합·내용·모드·inode·mtime·ctime을 비교했고 atime은 검사에서 제외했다. 페이지/용량/손상/링크/설정 오류·출력 비노출과 대소문자 보존 경로를 검사했다.

전체 고정 의존성 check/build/test, M2c 실제 SDK/HTTP/stdio/Worker, macOS/Windows, Docker E0-D와 새 코드 E1은 미실행이다. GitHub Git와 npm HTTPS는 DNS 실패했고 Docker/SDK를 사용할 수 없었다. 대역 SDK로 대체하지 않았고 이전 E0/E1 근거를 새 코드에 적용하지 않는다. 이번에는 성능 재측정을 하지 않았다.

[점검 계약](m2c-operator-inspection.ko.md) · [154개 실행 기록](validation/m2c-inspection-local.json). 새 소스·검사·patch·로그는 `localmcp-m2c-inspection-review.zip` 검토 보관본에 있다. 전체 저장소나 자동 설치/업로드 도구가 아니다.

## 이전 M2C-02b-1/2 구현 이력
- recovery 설정은 생략 시 memory를 유지하고 durable은 명시적으로 선택한다. 모든 workspace와 겹치지 않는 소유자 전용 저장소, 절대 경로·타입·용량을 검사한다. 검증만으로 파일을 생성하지 않는다.
- 기존 라이브러리에 create-only/existing-only 열기를 추가했다. 별도 초기화만 새 namespace를 만들며 실제 서버는 기존 기록소만 연다. 삭제·손상·미초기화 상태는 자동 재생성·fallback으로 숨기지 않는다.
- config/index/server/context/파일 도구 설명/workspace_info 연결 코드를 로컬에 작성했다. RuntimeSnapshot으로 같은 journal을 전달하고 직접 durable embedding에 상태가 없으면 거부한다. 하위 MCP나 네트워크 왕복은 추가하지 않았다.
- hot reload의 모드·경로·용량·workspace 집합 변경은 거부하고 마지막 유효 설정을 유지한다. 같은 경로 alias/순서는 허용한다. 파일 권한 회수는 후속 dispatch에서 과거 성공 재전달보다 먼저 검사한다.
- 별도 초기화 CLI와 실제 SDK용 신규 검사 7개를 작성했지만 실제 SDK/전체 서버 실행은 미검증이다. 부모 에이전트 등록·중계 수명주기는 수정하지 않았다.

## 이전 runtime 검증 이력
Linux / Node 22.16.0 / TypeScript 5.8.3 / @types/node 25.1.0 / 실제 테스트 UID 1000. **새 독립 30개와 이전 91개를 같은 실행에서 121개 통과**, 실패·취소·건너뜀 0. 이전 91개는 강제 종료·동일 ID 다중 프로세스·파일/CLI 회귀를 포함하며 과거 수치를 별도로 더하지 않는다.

실제 두 Node 프로세스가 runtime을 따로 열고 동일 ID로 요청했을 때 첫 실행은 편집, 두 번째는 과거 영수증 반환이었다. 사이에 외부 변경한 파일은 보존됐다. 새 Workspace 20개 동시 호출도 수정 한 번이었다. 실제 공통 registry/Workspace 조합에서 권한 회수 후 재요청은 parser/실행 전에 거부됐다. 이 조합 검사의 descriptor/parser는 검사 전용이며 실제 Zod/SDK 검사로 표시하지 않는다.

부분 독립 소스의 strict 타입 검사와 변경 TS 13개 문법 검사가 통과했다. 새 SDK 검사 7개와 기존 M2c SDK 검사 5개, 전체 pinned check/build/test, 현재 코드 macOS/Windows/E1, 실제 Docker E0-D는 미실행이다. GitHub Git 및 npm HTTPS는 DNS 실패, SDK는 ERR_MODULE_NOT_FOUND, Docker 실행 파일은 없었다.

[현재 검증 JSON](validation/m2c-runtime-local.json) · [런타임 연결 계약](m2c-runtime-integration.ko.md). 코드·컴파일된 독립 검사·확장 패치·로그는 대화의 `localmcp-m2c-runtime-review.zip`에만 있으며 전체 저장소나 자동 설치/업로드 도구가 아니다.

## 보존한 근거와 남은 단계
[이전 영속 기록 검사/측정](validation/m2c-recovery-local.json)의 91개와 4 KiB microbenchmark는 당시 이력이다. 이번에 91개 회귀는 재실행했지만 속도는 재측정하지 않았다. [최초 M2c와 업로드 차단](validation/m2c-mutations-local.json)은 보존한다.

[E0](validation/e0-macos-user-report.json)는 사용자 맥의 88f455c 최소 검증 성공 보고, [E1](validation/e1-local-check-user-report.json)은 다른 ChatGPT 세션 답변과 로컬 3/3·확인 코드 일치에 근거한다. 원시 호출·승인·실행 버전의 독립 감사는 아니며 chatgptActorVerified=false를 보존한다. 원격 실행 코드는 변하지 않아 기존 근거를 유지하지만 새 검토본에 자동 적용하지 않는다.

다음 관문은 허용된 코드 반영 경계와 전체 SDK/서버 통합 검증이다. 읽기 전용 운영 조회는 로컬 완료했고 검토 후 복구, 서로 다른 ID의 교차 프로세스 파일 잠금, 일반 쓰기 버전 계약, 다중 파일 트랜잭션, E0-D·M3는 남아 있다. 영속 모드도 ID/기준 해시 없는 작업까지 보호하지 않는다. 부모 relay 등록 순서, 전원/커널 장애, 자동 롤백/프로세스 부활을 검증했다고 주장하지 않는다.

사용자가 밖에 있는 동안 맥 명령·계정 조작·설치를 요구하지 않는다. 원격은 문서만 변경하며 CI/과금·공개 중계·배포·main 병합은 수행하지 않는다. Git 문서가 기준이고 PR은 Draft다.
