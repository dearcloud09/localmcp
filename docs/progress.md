# 실행 진행표

갱신: 2026-09-19 · [1pager](onepager.ko.md) · `feat/m1-modular-runtime` · PR #1 Draft.

## 현재 상태 — 실제 macOS 통합 실행의 단일 실패 수정
기준 원격 커밋은 `7a114950225d10aa848aa671ac6fbf3b88c1a4bf`다. 사용자는 별도 검사용 worktree에서 통합 패치를 적용하고 원본 의존성을 설치한 뒤 verify:minimum을 실행했다. 이번에는 보고서 내용과 전체 TS 테스트 로그를 확보했다. 원격 실행 코드는 아직 그대로이며 사용자 작업 트리의 미커밋 코드와 구분한다.

## 최신 사용자 실행 결과
- 환경: darwin / Node v23.11.0. report revision=7a11495, dirtyWorkingTree=true. revision은 미커밋 패치까지 식별하는 해시가 아니다.
- typecheck와 build: 종료 코드 0으로 통과.
- full-tests: 종료 코드 1, nonzero_exit, 약 23.9초. 보고서상 timeout이나 signal 실패가 아니다.
- 첫 TS 검사 묶음: 336개 중 335개 통과, 실패 1, 취소/건너뜀 0.
- 유일한 실패: test/sensitive-paths.test.ts:129의 workspace-root movement and removal are refused. 예상 /workspace root/, 실제 Path is outside workspace.
- 이전 미실행이던 mutation-integration 5개와 recovery-runtime-sdk 7개는 이번 사용자 로그상 통과했다. 같은 335개에 포함된 부분집합이므로 별도 합산하지 않는다.
- 실제 source-mode 자식 프로세스, SIGKILL 복구, 기존 HTTP/stdio/Worker 및 hot-reload 검사에도 성공 표시가 있다. 모든 영속 모드 전송 경로의 독립 검증이나 공개 Worker 운영 검증으로 확대하지 않는다.
- test:profile/test:minimum-tools는 앞 TS 명령이 실패해 실행되지 않았다. 최종 mcp-smoke와 별도 e1-session 검사도 미도달이다.

## 핵심 관문
| ID | 수용 기준 | 현재 판정 | 남은 조건 |
|---|---|---|---|
| IG-01 | 원본 source-mode와 자식 실행 경로 일치 | 사용자 macOS 실행 근거 확보 | 현재 실패는 자식 로더 문제가 아님 |
| IG-02 | 누적 단일 기준 패치 | 사용자 M2C_PATCH_APPLIED 보고 | 미커밋 작업 트리 전체 바이트는 독립 확인하지 않음 |
| IG-03 | 새 코드 전체 검사·SDK smoke | **진행 중: 타입/빌드 통과, TS 335/336** | 한 회귀 수정 후 나머지 npm 단계와 최종 smoke까지 성공 필요 |
| IG-03a | 루트 이동 사전 검사 순서 회귀 | **Linux 재현·수정본 독립 168개 통과** | 사용자 맥 수정 후 재검사 미수신 |
| IG-04 | 새 코드 원격 반영 | 미완료 | 사용자 코드 commit/push 및 원격 대조. 현재 Git 문서만 갱신 |
| IG-05 / E0-D | 실제 Docker 격리·정리 | 미실행 | 기존 대역 결과와 구분 |
| DEP-01 | npm high 경고 3개 조사 | 세부 advisory 미수신 | 자동 audit fix/lockfile 변경 없이 원인·영향 별도 확인 |

## 실패 원인과 최소 수정
M2c의 move는 mutate([from,to])에서 두 경로의 잠금 키를 먼저 검증한다. 루트 자체를 '../new'로 옮기라는 요청은 목적지 범위 검사에서 먼저 거부되어, moveUnlocked에 있던 루트 이동 금지 검사에 도달하지 않는다. 기존 테스트는 루트 이동 거부 메시지를 기대하므로 실패한다. 동일 요청을 Linux에서도 실행해 재현했으며 Node 23이나 macOS 경로 alias를 원인으로 단정하지 않는다.

로컬 수정은 src/workspace.ts의 공개 move 진입점에 출발지 루트 검사와 설명 주석 두 줄을 추가한다. 기존 내부 루트 검사와 일반 이동의 두 경로 잠금, 민감 경로·경계·부모 변경 제한은 유지한다. 기존 테스트의 정규식 완화·삭제·skip은 없다. 파일 이동이 성공한 보안 사고로 기록하지 않는다.

## 이번 어시스턴트 실행 범위
통합 검토본 105개 파일의 manifest 해시를 검사했다. 원격의 원래 민감 경로 테스트를 읽고 동일한 실패 호출을 포함한 회귀 6개를 추가했다. 수정 전 회귀는 4개 통과/2개 실패였고 실패 오류가 사용자 보고와 일치했다.

수정 후 Linux / Node 22.16.0 / TypeScript 5.8.3 / @types/node 25.1.0 / UID 1000에서 이전 독립 162개와 새 회귀 6개를 한 실행으로 검사해 **168개 통과, 실패·취소·건너뜀 0**. 독립 소스 strict 검사도 통과했다. 루트 별칭, 잘못된 목적지, 민감 경로, 루트 교체 거부, 정상 이동/삭제와 파일 불변을 검사했다.

보수적 로컬 수정 도구는 정확한 이전/수정 후 소스 해시만 받아들이고, 알 수 없는 변경은 덮어쓰지 않는다. 정상 적용·재실행의 무변경·다른 편집 보존·심볼릭 링크 거부를 확인했다. 한 파일 패치를 임시 Git index에 적용해 수정 도구와 동일한 바이트를 얻는 것도 확인했다. 이 검사들을 168개에 합산하지 않는다. [기계 판독 기록](validation/m2c-root-order-local.json)

실제 전체 저장소의 수정 후 npm test, 새 macOS 실행, Docker, 실제 ChatGPT는 이 환경에서 재실행하지 않았다. 현재 진단은 사용자 결과와 코드 대조 및 Linux 재현에 근거한다. 사용자 기기를 직접 변경하거나 현재 업로드 차단 코드를 GitHub로 재전송하지 않았다.

## 기존 단계 상태
| ID | 작업 | 상태 / 잔여 기준 |
|---|---|---|
| M1·M2a | 모듈·CLI/Git·프로필·샘플 | 원격 구현. 기존 E0/E1 이력 유지 |
| M2B-01/02 | 시작/reload·파일 권한·민감 경로·외부 MCP | 원격 구현. 현재 로그에서 관련 검사 성공. OS 격리와 구분 |
| M2B-03a | Docker 사본·run_check | 원격 구현·대역 테스트. 실제 Docker 미검증 |
| M2B-03c | 기존 셸·하위 MCP 전역 격리 | 미구현 |
| 이전 E0·E1 | 최소 통합·실제 ChatGPT 파일-only | 사용자 제공 근거 기준 과거 통과. 새 M2c 전체 통과로 승계하지 않음 |
| M2C-01a | 큐·해시·ID 중복 방지 | 사용자 미커밋 패치에 포함. 단일 회귀 수정과 전체 재검사 필요 |
| M2C-01b | config/Zod/SDK 5개 | **사용자 이번 로그에서 5개 성공** |
| M2C-01c | 서로 다른 ID의 교차 프로세스 파일 잠금·일반 쓰기 | 미구현 |
| M2C-02a | 영속 기록·Workspace·강제 종료 | 로컬 구현. 사용자 로그에서 관련 검사 성공; 전원 장애 보장 아님 |
| M2C-02b-1/2 | 서버 연결·초기화/시작·권한 | **사용자 실제 통합 7개 성공**. 영속 모드 전체 lifecycle 검증과 구분 |
| M2C-02b-3a | 읽기 전용 점검 | 로컬 구현·사용자 검사 성공. 복구 명령 아님 |
| M2C-02b-3b/02c | 수동 복구·다중 파일·프로세스 복구 | 미구현 |
| M3 | 국소 비용·실과제 지연 | 이전 국소 측정만 보존, 실과제 미측정 |
| CI-01 | GitHub CI·교차 플랫폼 | 사용자 한도로 보류 |

## 다음 실행과 보존할 근거
현재 worktree에 한 파일 수정만 적용하고, 기존 sensitive-paths suite → verify:minimum → 별도 E1 보조 검사를 실행한다. 재설치·audit fix·테스트 무력화는 하지 않는다. 수정 후 소스도 기존 staged 패치에 포함해야 하며 전체 성공 전 commit/push·main 병합·배포는 진행하지 않는다. 보고서와 첫 실패 로그를 기준으로 다음 판정을 갱신한다.

[통합 준비 이력](validation/integration-gate-local.json), [최초 M2c](validation/m2c-mutations-local.json), [영속 기록](validation/m2c-recovery-local.json), [서버 연결](validation/m2c-runtime-local.json), [운영자 점검](validation/m2c-inspection-local.json)은 당시 환경의 기록이다. 이전 SDK 미실행 문구는 이번 사용자 실행 이후의 현재 상태가 아니다. 과거 테스트 수를 누적 합산하지 않는다.

[E0](validation/e0-macos-user-report.json)·[E1](validation/e1-local-check-user-report.json)의 근거 수준과 chatgptActorVerified=false는 유지한다. 접속 토큰·개인 로컬 경로·기기명은 새 원격 기록에서 제외했다. 이번 원격 변경은 문서/결과 기록만이며 소스 업로드 재시도·CI 비용·계정·공개 중계·이미지 설치·main 병합·배포 변경은 없다.
