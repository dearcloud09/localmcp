# 실행 진행표

갱신: 2026-09-19. [1pager](onepager.ko.md). 브랜치 `feat/m1-modular-runtime`, PR #1 Draft. Git 문서가 기준이며 다운로드는 시점 사본이다.

## 최신 결과 — E0 사용자 macOS 성공 보고
사용자는 `d5b4ea9..88f455c` fast-forward 후 `npm run verify:minimum`을 실행했다. 제공된 터미널 출력에는 `Checking: typecheck`, `Checking: build`, `Checking: full-tests`, `Checking: mcp-smoke`와 최종 `MINIMUM_LOCAL_OK (Docker and live ChatGPT not tested)`가 있다. 처음의 Missing script 오류는 pull 전 결과이며, pull 후 실행에서는 재현되지 않았다.

원격 `88f455c5c69945bdcb7bd6cda23e9a6dbaceb839`의 verify-minimum.mjs, verification.mjs, smoke-mcp.mjs를 읽어 성공 표시의 조건과 검사 범위를 대조했다. **E0를 사용자 실행 결과 기준 통과로 기록한다.** 어시스턴트 재실행·원격 CI·실제 ChatGPT 계정 테스트가 아니다. 원본 report.json과 단계별 로그는 미수신이므로 정확한 테스트 수/skip 수, Node/npm 버전, 작업 트리 변경 여부, 설치 버전의 lockfile 일치는 확정하지 않는다. pull 대상 커밋과 시험한 작업 트리가 바이트 단위로 같다는 독립 증명도 아직 없다.

현재 증거: [E0 결과 기록](validation/e0-macos-user-report.json). 로컬 보고서 경로는 사용자에게 출력됐지만 그 파일을 GitHub에 업로드한 것은 아니다. 개인 홈 경로·터미널 사용자명·기기명은 이 결과 기록에 복사하지 않는다. 이번 커밋은 문서/검증 기록만 변경하고 src·scripts·test·package 파일은 바꾸지 않는다.

## 단계별 상태와 수용 기준
| ID | 할 일 | 현재 상태 | 근거 / 남은 기준 |
|---|---|---|---|
| M1-01/02 | 포크·공통 코어·모듈·CLI/Git | 구현 완료 | M1 기준 `d5b4ea9`; 누적 버전 `88f455c`의 E0 성공 보고 확보 |
| M1-03 | 권한 비트·UTF-8·macOS cwd | 과거 기준선 및 E0 성공 보고 | 과거 M1 64개와 현재 미확인 개수를 합산하지 않음 |
| CI-01 | GitHub CI·교차 플랫폼 | 보류 | 사용자 확인 한도 초과. 재실행/과금 변경 없음. macOS 결과를 다른 OS 결과로 일반화하지 않음 |
| M2A-01/02 | 편집 프로필·doctor | 구현, E0 전체 명령 성공 보고 | 명시적 읽기/쓰기, 외부 설정, 기존 파일 보호 |
| M2A-03/04 | 샘플·프로필 테스트 연결 | 구현, E0 전체 명령 성공 보고 | 소스만 수정하는 샘플. 실제 ChatGPT와 구분 |
| M2A-05 | 현재 전체 결합 검사 | **E0 통과 보고 확보** | `npm test` 단계 성공; 세부 결과/skip 수는 로그 미수신 |
| M2B-01a | 시작·reload 프로젝트 정책 | 구현, E0 전체 명령 성공 보고 | config/진입점 검사를 포함하는 테스트 명령 성공. 개별 로그는 미수신 |
| M2B-01b | 읽기/쓰기 분리 | 구현, E0 전체 명령 성공 보고 | 추가 SDK 파일 smoke에서도 읽기 전용 수정 거부 검사 |
| M2B-02a | 민감 경로·부모 이동/삭제 | 구현, E0 전체 명령 성공 보고 | 이름 정책이지 내용 검사 아님. SDK smoke도 .env 비노출 검사 |
| M2B-02b | 외부 MCP 허용 목록·명세 고정 | 구현, E0 전체 명령 성공 보고 | 허용 목록은 외부 서버의 OS 권한 격리가 아님 |
| M2B-02c | 누적 실제 SDK/config/Worker 회귀 | **E0 전체 명령 성공 보고 확보** | 개별 SDK/Worker 로그는 미수신. 실제 public Worker 검증으로 간주하지 않음 |
| M2B-03a | 스냅샷 Docker 어댑터·run_check | 구현, 실제 Docker 미검증 | 대역 수명주기 검사와 실제 컨테이너 검증은 별도 |
| M2B-03b | 실제 격리·타임아웃 검증 | **E0-D 미실행** | 실제 Docker 설정/프로세스/파일/네트워크·원본 불변 확인 필요 |
| M2B-03c | 기존 셸·외부 MCP 전역 격리 | 미구현 | 새로운 run_check 경로만 격리 대상 |
| E0-01 | check/build/full test | **사용자 macOS 통과 보고** | `88f455c`로 pull 후 최종 성공 표시. 정확한 테스트 수는 미확인 |
| E0-02 | 실제 SDK 파일 red/green smoke | **사용자 macOS 통과 보고** | mcp-smoke 이후 최종 성공. SDK 자동 호출이며 ChatGPT 계정은 아님 |
| E0-03 | 실패 중단·결과 파일·중단 상태 구분 | 독립 검증 + 결과 파일 생성 보고 | 원본 report.json은 미수신. 제품 작업 복구와 구분 |
| E1-01/02 | 사용자 ChatGPT 연결·로컬 대조 | **다음 관문** | 파일-only 샘플, 셸/프로세스/외부 MCP 비활성. 실제 맥·계정·연결 필요 |
| M2C-01 | 제품 전체 충돌·동시성·중복 실행 | 미구현 | 기존 stale hash 검사만으로 완료 아님 |
| M2C-02 | 제품 영속 로그·프로세스 복구 | 미구현 | 검증 실행기의 보고서 저장과 다른 범위 |
| M3-01 | 실제 작업/호출 지연 | 미실행 | 동일 입력·출력·최초/반복·오류/재시도 비교 필요 |

## 구현 이력 — 최소 검증 경로
구현 커밋은 `88f455c5c69945bdcb7bd6cda23e9a6dbaceb839`, 그 기반은 `dc5e3853c838a256b05c379885ff2bc9e497a1a0`다.

- `src/adapters/docker-snapshot.ts`는 기존 argv CLI를 재사용한다. 이름 정책을 통과한 일반 단일 링크 파일만 별도 사본으로 만든다. 최대 10,000개 항목/64 MiB/깊이 64이며 링크·특수 파일·사본 위치 중첩을 거부한다. Git 메타데이터와 민감 이름은 제외한다.
- `run_check`는 운영자 설정의 정확한 검사 이름만 받는다. 이미지·프로그램·argv는 모델이 임의로 전달하지 않는다. 기본 비노출이며 legacy shell과 별개다.
- Docker 경로는 로컬 Unix context, 로컬 sha256 이미지, pull 금지, 네트워크 없음, 비루트, capability 제거, no-new-privileges, 읽기 전용 rootfs/input 및 제한된 tmpfs·CPU/메모리/PID를 사용한다. 생성 후 inspect 결과가 다르면 시작하지 않는다.
- Docker CLI 종료를 컨테이너 종료로 가정하지 않는다. 소유한 이름의 컨테이너를 제거하고 정리 실패는 CLEANUP_UNCONFIRMED로 표시한다. 자동 호스트 fallback·writeback·재시도는 없다. 실제 효과 검증은 E0-D에 남아 있다.
- `verify-minimum.mjs`는 check → build → 전체 npm test → 실제 SDK smoke를 실행한다. 원본 의존성 누락 때 자동 설치하지 않는다. 결과는 저장소 밖 새 임시 디렉터리의 단계별 로그/JSON에 저장한다. 실패·취소·중단된 running을 성공으로 바꾸지 않는다.
- `smoke-mcp.mjs`는 설치된 SDK와 빌드된 stdio 서버로 읽기 전용 거부, 민감 파일 비노출, 편집·재읽기, 오래된 patch 거부, 같은 테스트 3실패→3통과를 검사한다. 테스트/가짜 보호 파일 불변을 확인하며, 결정적 스크립트의 호출이지 ChatGPT 판단 테스트가 아니다.
- `smoke-sandbox.mjs`는 실제 MCP run_check로 red/green·격리 프로브·타임아웃 정리를 검사한다. Docker가 없으면 실패한다. 이번 사용자 실행에는 --image가 없으므로 이 단계는 수행되지 않았다.

## 이전 개발환경 검증 — 역사적 기록
구현 시점 Linux / Node 22.16.0 / TypeScript 5.8.3 / UID 1000의 독립 실행은 65개 통과였다: 새 snapshot 14, Docker CLI 대역 수명주기 7, 검증 도구 11, 기존 CLI/Git 15, registry 18. 실패/취소/건너뜀 0. 대역은 실제 Docker·커널 격리 검증이 아니다.

그 개발환경에서는 GitHub DNS 및 SDK/Docker 부재로 전체 E0를 실행하지 못했다. **이전의 미실행 기록은 당시 환경의 제한이고, 이후 사용자 macOS의 E0 성공 보고를 무효로 하지 않는다.** 원본 기록은 [minimum-preparation-local.json](validation/minimum-preparation-local.json)에 보존한다. 이전 64/28/67/77/65개를 합쳐 현재 전체 검사 수라고 표시하지 않는다.

## 다음 순서와 남은 경계
파일-only E1을 우선한다. E0를 재설치하거나 반복할 필요 없이 검증한 실행 코드를 사용한다. 계정·공개 중계·승인 흐름은 로컬 SDK 테스트에 포함되지 않았으므로 실제 연결 결과가 필요하다. Docker는 파일-only E1의 필수 조건이 아니며, 명령 실행을 검증할 때 검토한 로컬 이미지로 E0-D를 별도로 수행한다. [최소 검증 안내](minimum-verification.ko.md)

이름 필터는 소스 내부의 비밀값을 탐지하지 않는다. symlink node_modules나 64 MiB 초과 프로젝트는 snapshot 범위를 벗어날 수 있다. 이미지 신뢰·Docker 데몬/커널·같은 사용자 파일 경쟁 공격 전체를 방어한다고 주장하지 않는다. 기존 셸/하위 MCP의 전역 격리, M2c, M3는 미완료다.

Git 문서·PR을 함께 갱신한다. CI 비용·계정 설정·공개 터널·이미지 다운로드·배포·main 병합은 이번 작업에서 수행하지 않는다.
