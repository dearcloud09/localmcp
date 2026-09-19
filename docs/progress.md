# 실행 진행표

갱신: 2026-09-19 · [1pager](onepager.ko.md) · `feat/m1-modular-runtime` · PR #1 Draft.

## 현재 상태 — 기능 확장 중단, 통합 관문에 집중
기준 원격 커밋은 `9ce1f38031696a3dda1394186bc88f2823170879`다. 원격 compare에서 `2850cf4` 이후 기준 커밋까지의 변경이 문서뿐임을 확인했다. 이전 inspection 보관본의 84개 파일과 원격 문서 blob을 대조했다. **이번에는 새 제품 기능을 추가하지 않고 테스트 실행 경로와 누적 패치의 통합 준비를 보완했다.**

새 실행 코드는 여전히 로컬 검토본에만 있다. 이전 코드 업로드 보안 차단의 해제 근거가 없어 같은 쓰기를 재시도하거나 다른 경로로 우회하지 않았다. 이번 원격 변경은 1pager·진행표·통합 안내·검증 JSON이다. 문서 갱신을 코드 반영으로 간주하지 않는다.

## 핵심 관문 상태
| ID | 수용 기준 | 현재 판정 | 근거 / 남은 조건 |
|---|---|---|---|
| IG-01 | 원본 소스 테스트 방식과 자식 실행 경로 일치 | 로컬 수정·독립 검증 | 테스트 3개 수정, 새 helper/검사. 실제 pinned tsx source run은 미실행 |
| IG-02 | 누적 변경의 단일 원격 기준 패치 | 로컬 검토 통과 | 기존 7개 blob 대조, 27개 변경 파일 적용 및 바이트 일치 |
| IG-03 | 고정 의존성 전체 check/build/test와 실제 SDK 통합 | BLOCKED | GitHub/npm DNS 실패, SDK/tsx 부재. 부분 fixture를 전체 clone으로 표시하지 않음 |
| IG-04 | 원격 코드 반영 및 재조회 | 해제 확인 대기 | 과거 보안 차단, 이번 코드 upload 시도 없음. 문서만 반영 |
| IG-05 | 실제 Docker red/green·격리·timeout cleanup | BLOCKED | Docker 실행 파일 없음. 이전 대역 검사를 실제 컨테이너 결과로 바꾸지 않음 |

## 이번 발견과 수정
이전 독립 테스트는 컴파일된 compiled/test/*.js를 실행했다. 원래 저장소의 npm test는 tsx --test test/*.test.ts다. 이전 검토본의 durable-crash, recovery-runtime, recovery-inspection 테스트는 자식으로 .js 파일을 직접 실행하고 loader도 전달하지 않았다. 원본 소스 위치에는 해당 .js가 없고 .ts만 있다.

실제 Node로 durable-child.js, runtime-journal-child.js, recovery-inspect.js의 원래 실행 요청을 재현해 세 경로 모두 종료 코드 1 및 MODULE_NOT_FOUND를 확인했다. 테스트 전용 entry 선택기를 로컬에 추가해 source mode에서는 .ts와 명시적 --import tsx, compiled mode에서는 방출된 .js만 선택한다. 테스트 runner의 --test/IPC/inspector 플래그는 전달하지 않고 누락 파일의 자동 fallback도 없다. 실제 pinned tsx 실행은 의존성 부재로 검증하지 못했다.

누적 패치 4개의 역적용 중 이전 recovery 패치가 요구하는 benchmarks/journal.mjs가 최신 inspection ZIP에 없음을 확인했다. 원래 recovery 보관본에서 SHA-256 f095e76099046e82d3ed9049e2101b480e30cb296cf83d0a228f578bde22db07을 대조해 복원했다. 과거 패치 이력은 보존하고, 현재 원격 기준의 소스 변경 27개를 단일 검토 패치로 작성했다. 임시 부분 Git 저장소에서 git apply --check, 실제 적용, 결과 바이트 대조를 수행했다. 원격이나 사용자 맥에 적용하지 않았다.

## 이번 실제 검증
Linux / Node 22.16.0 / TypeScript 5.8.3 / @types/node 25.1.0 / 테스트 UID 1000. 새 entry 검사 8개와 기존 154개를 같은 실행에서 **162개 통과, 실패·취소·건너뜀 0**. 해당 독립 소스 strict 타입 검사 통과. 실제 plain JavaScript 자식 실행·literal argv·fork IPC와 누락 파일 거부도 검사했다.

검토 ZIP을 다시 풀어 105개 파일 해시를 확인하고 같은 162개 검사를 실행했다. 이를 324개로 합산하지 않는다. 실제 SDK/config/HTTP/stdio/Worker·macOS/Windows·Docker 검증과 구분한다. 실제 SDK용 mutation-integration 5개와 recovery-runtime-sdk 7개는 그대로 유지했다.

[현재 기계 판독 기록](validation/integration-gate-local.json)과 대화의 localmcp-integration-review.zip에 소스·독립 컴파일 결과·단일 패치·기준 해시·로그를 보관한다. 전체 저장소나 자동 적용/업로드 도구가 아니다. 검토 전용 package.json을 실제 저장소 package.json과 혼동하지 않도록 overlay와 independent 영역을 분리했다.

## 기존 단계 상태 — 이전 상세 기록 보존
| ID | 작업 | 현재 상태 | 잔여 기준 |
|---|---|---|---|
| M1-01/03 | 모듈·CLI/Git·권한 비트·UTF-8 | 원격 구현·과거 사용자 검증 | 새 M2c 코드 수용과 별도 |
| M2A-01/05 | 프로필·doctor·샘플 | 원격 구현·이전 E0 성공 보고 | 새 코드 전체 통합 필요 |
| M2B-01a/01b | 시작/reload·읽기/쓰기 | 원격 구현·이전 E0 | 새 recovery 연결의 실제 SDK 검증 대기 |
| M2B-02a/02c | 민감 경로·하위 MCP 정책 | 원격 구현·이전 E0/E1 | 이름 필터/allowlist는 OS 격리가 아님 |
| M2B-03a | Docker 사본·run_check | 원격 어댑터 구현 | 실제 Docker 미검증 |
| M2B-03b / E0-D | 실제 격리·타임아웃 정리 | IG-05 보류 | Docker와 검토한 기존 이미지 필요 |
| M2B-03c | 기존 셸·하위 MCP 전역 격리 | 미구현 | 새 run_check가 자동 격리하지 않음 |
| E0-01/03 | check/build/test/SDK smoke·결과 | 이전 사용자 macOS 통과 보고 | 원본 세부 로그/버전 미수신, 새 코드에 자동 승계하지 않음 |
| E1-P/01/02 | 실접속·편집·재읽기·로컬 대조 | 이전 사용자 근거 기준 통과 | 원시 도구 기록의 독립 감사와 구분 |
| CI-01 | GitHub CI·교차 플랫폼 | 사용자 확인 한도 때문에 보류 | 재실행·과금 변경 없음 |
| M2C-01a | 공유 큐·해시·ID 중복 방지 | 로컬 구현·회귀 통과, 원격 미반영 | IG-03/04 필요 |
| M2C-01b | 실제 config/Zod/SDK 5개 | 작성·미실행 | IG-03에 포함 |
| M2C-01c | 서로 다른 ID의 교차 프로세스 파일 잠금·일반 쓰기 | 미구현 | 동일 ID 예약과 별도 |
| M2C-02a | 영속 기록·Workspace 주입 | 로컬 구현·회귀 통과 | 전원/커널 장애·다른 FS 검증 아님 |
| M2C-02a-test | 실제 SIGKILL·동일 ID 다중 프로세스 | 이전 검사 재실행 통과 | 전원 장애로 일반화하지 않음 |
| M2C-02b-1/2 | 서버 연결·초기화/시작·reload/권한 | 로컬 코드·독립 검사 | 실제 SDK 7개와 전체 lifecycle 대기 |
| M2C-02b-3a | 운영자 읽기 전용 점검 | 로컬 코드·회귀 통과 | 복구·retry·unlock 기능이 아님 |
| M2C-02b-3b | 검토 후 수동 복구 | 미구현 | 조회 결과를 재실행 승인으로 쓰지 않음 |
| M2C-02c | 다중 파일 트랜잭션·프로세스 복구 | 미구현 | 영속 journal만으로 완료하지 않음 |
| M3-00/01 | 국소 비용·실과제 지연 | 이전 국소 측정만 보존 | 이번 새 벤치마크 실행 없음 |

## 근거와 다음 행동의 경계
[업로드 차단/최초 M2c](validation/m2c-mutations-local.json), [영속 기록](validation/m2c-recovery-local.json), [서버 연결](validation/m2c-runtime-local.json), [운영자 점검](validation/m2c-inspection-local.json)은 당시 환경의 상세 기록으로 유지한다. 이전 기록의 검사 수를 현재 162개에 더하지 않는다.

[E0](validation/e0-macos-user-report.json)는 이전 실행 코드의 사용자 macOS 성공 보고다. [E1](validation/e1-local-check-user-report.json)은 새 세션 수행 답변과 로컬 3/3·확인 코드 일치에 근거한다. chatgptActorVerified=false를 보존하며 이 대화의 원시 호출·맥 파일 직접 감사로 바꾸지 않는다.

외부 앱 검색에서 사용 가능한 설치된 실행 환경을 확보하지 못했고, 미설치 배포 서비스를 새로 사용하거나 과금/계정을 변경하지 않았다. 기존 업로드 차단을 해제할 수 있다는 근거도 없다. 따라서 다음은 기능 추가가 아니라 허용된 원격 코드 반영과 원본 pinned 의존성 전체 검증이다. 그 선행조건 없이 전체 완료·병합·배포로 상태를 올리지 않는다.

사용자가 밖에 있는 동안 새 맥 명령·설치·계정 조작을 요구하지 않는다. 코드 쓰기 차단 우회·공개 중계·CI 재실행/과금·이미지 다운로드·main 병합·배포는 수행하지 않는다. Git 문서가 기준이고 PR은 Draft다.
