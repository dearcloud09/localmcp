# 실행 진행표

갱신: 2026-09-19. [1pager](onepager.ko.md). 브랜치 `feat/m1-modular-runtime`, PR #1 Draft. Git 문서가 기준이며 다운로드는 시점 사본이다.

## 단계별 상태와 수용 기준
| ID | 할 일 | 현재 상태 | 근거 / 남은 기준 |
|---|---|---|---|
| M1-01/02 | 포크·공통 코어·모듈·CLI/Git | 구현 완료 | `d5b4ea9`; 현 버전 검증과 과거 기준선 구분 |
| M1-03 | 권한 비트·UTF-8·macOS cwd | 과거 기준선 검증 | 사용자 맥 M1 64개 성공 보고 |
| CI-01 | GitHub CI·교차 플랫폼 | 보류 | 사용자 확인 한도 초과. 재실행/과금 변경 없음 |
| M2A-01/02 | 편집 프로필·doctor | 구현·과거 독립 검증 | 명시적 읽기/쓰기, 외부 설정, 기존 파일 보호 |
| M2A-03/04 | 샘플·프로필 테스트 연결 | 구현·과거 독립 검증 | 과거 red/green, 테스트 불변; 실제 ChatGPT와 구분 |
| M2A-05 | 현재 전체 결합 검사 | **E0로 통합, 미완료** | 기존 모든 TS 및 프로필 검사를 실행해야 함 |
| M2B-01a | 시작·reload 프로젝트 정책 | 구현·과거 독립 검증 | `62b179c`; 실제 진입점 통합은 E0 |
| M2B-01b | 읽기/쓰기 분리 | 구현·과거 독립 검증 | `aaeb0cc`; 실제 SDK/reload는 E0 |
| M2B-02a | 민감 경로·부모 이동/삭제 | 구현·과거 독립 검증 | `dc5e385`; 이름 정책이지 내용 검사 아님 |
| M2B-02b | 외부 MCP 허용 목록·명세 고정 | 구현·과거 정책 검증 | `dc5e385`; 서버 실행 권한 격리가 아님 |
| M2B-02c | 누적 실제 SDK/config/Worker 회귀 | **E0로 통합, 미완료** | 작성된 통합 검사를 삭제하거나 대역으로 대체하지 않음 |
| M2B-03a | 스냅샷 Docker 검사 어댑터·run_check | **구현·독립 검사, Docker 미검증** | 파일 읽기 권한·검사 이름 제한, 고정 이미지, 별도 복사본, 종료/정리 확인 |
| M2B-03b | 실제 격리·타임아웃 검증 | **E0-D 작성, 미실행** | 실제 Docker 설정/프로세스/파일/네트워크·원본 불변 확인 |
| M2B-03c | 기존 셸·외부 MCP 전역 격리 | 미구현 | 새로운 run_check 경로만 격리 대상. 기존 실행은 별도 |
| E0-01 | 단일 명령 check/build/full test | **실행기 구현, 전체 실행 차단** | 원본 의존성·전체 checkout 필요 |
| E0-02 | 실제 SDK 파일 red/green smoke | **구현, 실제 SDK 미실행** | 읽기/거부/편집/재읽기, 테스트 불변, stale patch 거부 |
| E0-03 | 실패 중단·결과 파일·복구 시 상태 구분 | **독립 검증** | 단계별 로그/JSON, 실패·취소·실행 중 구분. 자동 재시도 없음 |
| E1-01/02 | 사용자 ChatGPT 연결·로컬 대조 | 대기 | 실제 맥·계정·연결 필요. E0와 구분 |
| M2C-01 | 제품 전체 충돌·동시성·중복 실행 | 미구현 | 해시/잠금/중복 방지. 기존 stale hash 검사만으로 완료 아님 |
| M2C-02 | 제품 영속 로그·프로세스 복구 | 미구현 | 검증 실행기의 보고서 저장과 다른 범위 |
| M3-01 | 실제 작업/호출 지연 | 미실행 | 동일 입력·출력·최초/반복·오류/재시도 비교 필요 |

## 이번 변경 — 최소 검증 경로
기준 커밋: `dc5e3853c838a256b05c379885ff2bc9e497a1a0`.

- `src/adapters/docker-snapshot.ts`: 기존 argv CLI 실행기를 재사용한다. 이름 정책을 통과한 일반 단일 링크 파일만 복사하며 원본은 마운트하지 않는다. 최대 10,000개 항목/64 MiB/깊이 64, 링크·특수 파일·사본 위치 중첩은 거부한다. Git 메타데이터 및 민감 이름은 제외한다.
- `run_check`: 운영자 설정의 정확한 검사 이름만 받는다. 명령·이미지·환경변수를 모델이 임의로 전달하지 않는다. 기본 비노출, legacy shell과 별개다. workspace_info에 availableChecks를 추가했다.
- Docker: 로컬 Unix context만 허용하고 현재 context를 고정한다. 기존 이미지의 sha256 ID만 허용하며 pull하지 않는다. 네트워크 없음, 비루트, capability 제거, no-new-privileges, 읽기 전용 rootfs, 제한된 tmpfs(/workspace 128 MiB, /tmp 64 MiB) 및 읽기 전용 /input 사본 마운트, CPU/메모리/PID 상한을 사용한다. 생성 후 inspect 결과가 다르면 시작하지 않는다.
- Docker 클라이언트 종료를 컨테이너 종료로 가정하지 않는다. 소유한 무작위 이름의 컨테이너를 제거하고 정리 실패는 CLEANUP_UNCONFIRMED로 표시한다. 자동 호스트 fallback·writeback·재시도는 없다.
- `scripts/verify-minimum.mjs`: check → build → 기존 전체 test → 실제 SDK smoke를 순서대로 실행한다. 원본 의존성이 없으면 중단하고 자동 설치하지 않는다. 성공 출력 전에 모든 요청된 관문이 성공해야 한다.
- 로그/보고서는 저장소 밖 새 임시 디렉터리에 저장한다. HOME·Node 테스트 IPC·프로젝트 환경변수를 분리한다. Docker 단계만 신뢰된 호스트 Docker context를 읽도록 원래 HOME을 사용하며 컨테이너에 전달/마운트하지 않는다. 중간 중단의 running 상태는 성공으로 복구하지 않는다.
- `smoke-mcp.mjs`: 실제 설치 SDK와 빌드된 stdio 서버로 읽기 전용 거부, 민감 파일 비노출, 편집, 오래된 patch 거부, 동일 테스트 3실패→3통과를 검사한다. 모델이 아니라 결정적 검증 스크립트가 호출하므로 E1이 아니다.
- `smoke-sandbox.mjs`: 실제 MCP run_check로 테스트 전후와 격리 프로브, 타임아웃 정리를 검사한다. 실제 Docker가 없으면 실패한다.
- npm scripts에 검증 진입점과 도구 테스트를 연결했다. 외부 의존성/lockfile/기존 CLI 실행기/기존 정책 구현은 변경하지 않았다.

## 실제 실행한 검증과 한계
Linux / Node 22.16.0 / TypeScript 5.8.3. 실제 비루트 UID 1000으로 한 명령에서 65개 통과, 실패/취소/건너뜀 0: 새 snapshot 14 + Docker CLI **대역** 수명주기 7 + 검증 도구 11 + 기존 CLI/Git 15 + 기존 registry 18.

대역은 별도 자식 프로세스로 Docker 메시지·종료·오류를 재현해 실행 순서와 정리 분기를 확인한다. 실제 컨테이너·커널 격리·Docker API 호환성을 검증한 것은 아니다. snapshot 검사와 generated fixture red/green은 실제 임시 파일/Node 프로세스를 사용했다. 지정된 PATH에 Docker가 없을 때 ENOENT로 거부되고 원본 파일이 변하지 않는 것도 별도 확인했다.

독립 TS strict 검사 및 변경 TS/JS 문법 검사 통과. 실제 SDK/config 통합 테스트 6개와 두 smoke 시나리오는 작성했지만 실행되지 않았다. 현재 도구 환경의 GitHub DNS 실패 및 SDK·Docker 부재로 전체 E0/E0-D는 미완료다. partial fixture의 prerequisite 검사와 SDK import가 실패 시 성공 표시 없이 중단되는 것을 확인했다. 이것을 사용자 저장소에 lockfile이 없다는 뜻으로 해석하면 안 된다.

[검증 JSON](validation/minimum-preparation-local.json)에 환경·명령·소스 해시·검증 범위를 남긴다. 과거 64/28/67/77개와 이번 65개를 합산하지 않는다. 이전 단계의 상세 증거는 기존 validation JSON과 안내 문서에 유지한다.

## 실행 순서와 남은 경계
[최소 검증 안내](minimum-verification.ko.md)의 단일 명령을 우선한다. 기능 추가보다 누적 E0 결과 확보가 다음 관문이다. Docker가 없을 때 파일-only E0를 수행할 수 있지만 격리 성공으로 표시하지 않는다.

이름 필터는 내용 비밀 탐지기가 아니며 일반 소스에 적힌 키는 복사될 수 있다. symlink 기반 node_modules, 64 MiB 초과 프로젝트는 현재 snapshot 범위를 벗어날 수 있다. 이미지 자체를 신뢰한다는 가정, Docker 데몬/커널, 같은 사용자 파일 경쟁 공격까지 안전하다고 보장하지 않는다. legacy shell/하위 MCP는 자동 격리하지 않는다. 실제 ChatGPT는 계정 연결이 필요하다.

Git 문서·코드·PR은 함께 갱신한다. CI 비용·계정 설정·공개 터널·이미지 다운로드·배포·main 병합은 수행하지 않는다. 제품 전체 M2c/M3는 최소 smoke와 별도로 미완료를 유지한다.
