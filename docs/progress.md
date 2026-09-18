# 실행 진행표

갱신: 2026-09-19. [1pager](onepager.ko.md)가 요약 기준이다. 작업 브랜치: `feat/m1-modular-runtime`, PR #1은 Draft. Git 문서가 기준이고 다운로드는 스냅샷이다.

## 단계별 상태
| ID | 할 일 | 상태 | 근거 / 다음 수용 기준 |
|---|---|---|---|
| M1-01 | 포크·작업 브랜치·PR | 완료 | 구현 기준 `d5b4ea9511c5c05229bb34ab52747553a61e3f03` |
| M1-02 | 공통 코어·기능 모듈·CLI/Git | 구현 완료 | 원격 반영, 독립 검사 |
| M1-03 | 권한 비트·UTF-8·macOS cwd | 기준선 검증 완료 | 사용자 맥에서 M1 검사·빌드·64개 성공 보고. 현재 전체 코드 검증과 구분 |
| CI-01 | GitHub CI·교차 플랫폼 | 보류 | 한도 초과(사용자 확인). 재실행/과금 변경 없음 |
| M2A-01 | 파일 전용 프로필 생성 | 구현·독립 검증 | 새 편집용 프로필에 fileRead/fileWrite 명시. 기존 설정 보호 |
| M2A-02 | 로컬 doctor | 구현·독립 검증 | 프로필의 명시적 권한을 확인. 구버전을 writable로 잘못 보고하거나 자동 수정하지 않음 |
| M2A-03 | 연결 샘플 | 구현·이전 독립 검증 | 과거 소스 수정 전/후 3 실패→3 통과. 이번에는 새 권한 설정 연결 검사. 실연결과 구분 |
| M2A-04 | 신규 검사 연결 | 구현 | npm test:profile에 신규 권한 프로필 검사 4개도 포함 |
| M2A-05 | 현재 전체 결합 검사·macOS | 대기 | 원본 의존성으로 check/build/test 필요 |
| M2B-01a | 시작·reload 프로젝트 정책 | 구현·이전 독립 검증 | 기준 `62b179c`. 이전 정책 24 + 독립 43 성공. 실제 진입점/중계 통합 대기 |
| M2B-01b | 파일 읽기/쓰기 권한 분리 | **구현·독립 검증, SDK 통합 대기** | 새 권한/core 20 + 신규 프로필 4 + 기존 독립 43을 같은 실행에서 67개 성공. 실제 SDK/config/reload 6개 미실행 |
| M2B-02 | 민감 파일·하위 MCP 경계 | **다음 개발** | 비밀/정책 파일 비노출, 외부 서버별 정책. fileWrite=false가 셸까지 제한한다는 주장 금지 |
| M2B-03 | 격리 실행 | 예정 | 호스트 홈/자격증명/Docker 소켓 비노출, 실제 격리 검증 |
| E1-01 | ChatGPT 읽기·수정·재읽기 | 대기 | 편집용 샘플 프로필, 테스트 파일 불변 |
| E1-02 | 로컬 결과와 원격 결과 대조 | 대기 | 실제 맥/계정/중계 연결 필요 |
| M2C-01 | 충돌·동시성·중복 실행 | 예정 | 기준 해시·잠금·복구·재시도 안전성 |
| M2C-02 | 영속 로그·프로세스 복구 | 예정 | 성공/실패/중단/미확인 구분, 확정 종료 |
| M3-01 | 호출 경로·실과제 지연 | 예정 | 같은 작업/출력, 최초/반복/오류·재시도 분리 |

## 이번 변경: M2B-01b
기준 커밋은 `62b179cadd16c6330f806f3d1163af87e363af49`다.

- `src/core/file-permissions.ts`: 기본 read-only, boolean 검증, 쓰기에는 읽기가 필요하다는 규칙, files master switch. 새 외부 의존성 없음.
- `src/config.ts`: permissions 스키마와 같은 resolver를 초기/reload 경로에 연결.
- registry Feature에 fileRead/fileWrite 추가. 값이 없는 직접 임베딩도 허용으로 추정하지 않음.
- 파일 모듈의 조회 7종/변경 6종에 명시적 요구 권한을 부여. 목록 필터와 직접 호출에 같은 공통 검사 사용. annotations는 권한 근거가 아님.
- workspace_info에 file-tools 범위의 유효 권한 추가. 셸·외부 MCP·직접 Workspace 호출을 제한하는 권한으로 표시하지 않음.
- M2a init/demo 프로필에 명시적 편집 권한을 넣고 doctor도 해당 권한 검사. 기존 프로필 자동 덮어쓰기 없음.
- 기존 SDK/중계/외부 MCP fixture와 직접 임베딩 fixture가 필요한 쓰기를 명시적으로 허용하도록 수정. 기존 행위 검사를 삭제하지 않음.
- SDK를 쓰는 신규 통합 검사 6개 작성: 여섯 변경 도구의 비노출/거부/파일 불변, 읽기 차단, opt-in 복구, 실제 MCP 오류, 실제 config, stdio hot reload 후 stale 호출 거부.

## 이번에 실제 실행한 검사
Linux / Node 22.16.0 / TypeScript 5.8.3에서 새 권한 20개, 새 프로필 4개, 기존 독립 모듈 43개를 **같은 Node 테스트 실행**에서 검사했다. 총 67개 통과, 실패/취소/건너뜀 0. 이 67개는 이전 단계의 정책 24+기존 43 검사와 구성부터 다르다.

해당 pure policy/registry·독립 테스트만 엄격한 TS 검사에 통과했다. 변경 TS 파일 11개의 문법 검사를 별도로 수행했다. SDK/Zod/Worker를 테스트 더블로 대체해 검증했다고 표시하지 않는다.

현재 git clone은 github.com DNS 실패, npm ping은 registry.npmjs.org EAI_AGAIN으로 실패했다. 전체 checkout/원본 의존성이 없어 새 SDK 통합 6개, 기존 SDK/중계 수정 fixture, 현재 전체 check/build/test, 기존 M2a 프로필 28개 재실행, macOS/Windows, 실제 ChatGPT는 미검증이다. 과거 사용자 맥 64개나 이전 28/67개와 합산하지 않는다.

검증 및 소스 해시: [현재 JSON](validation/m2b-file-permissions-local.json). 이전 기록: [M2a](validation/m2a-local.json), [시작 정책](validation/m2b-policy-local.json). 전환 규칙: [파일 권한](m2b-file-permissions.ko.md), [시작 정책](m2b-runtime-policy.ko.md).

## 진행 경계
유효한 권한 설정 변경은 다음 dispatch부터 적용된다. 이미 승인되어 실행 중인 작업을 취소/롤백하거나 외부 프로그램의 권한을 회수하지 않는다. 잘못된 reload는 마지막 유효 설정을 유지한다. 파일 권한은 서버 단위이며 workspace별 override는 아직 없다. 파일 접근 경계·민감 경로·외부 MCP·OS 샌드박스는 별도 작업이다.

작업 브랜치의 코드·테스트·Git 문서·PR은 함께 갱신한다. CI 비용 증가, 공개 터널 시작, 계정 변경, 사용자 맥 실행, main 병합은 대신 수행하거나 완료로 표시하지 않는다.
