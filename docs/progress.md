# 실행 진행표

갱신: 2026-09-19. [1pager](onepager.ko.md). 브랜치 `feat/m1-modular-runtime`, PR #1 Draft. Git 문서가 기준이며 다운로드는 시점 사본이다.

## 현재 결과 — E0 및 파일-only E1 통과, 사용자 제공 근거 기준
E0는 사용자 macOS 실행 결과 기준 통과다. `d5b4ea9..88f455c` fast-forward 뒤 typecheck/build/full-tests/mcp-smoke와 최종 MINIMUM_LOCAL_OK를 확인했고, 원격 실행기와 성공 조건을 대조했다. 처음의 Missing script 오류는 pull 전 결과이며 이후 해결됐다. report.json·개별 로그는 미수신이므로 정확한 테스트 수/skip, Node/npm 버전, dirty 상태와 설치 버전 일치는 확정하지 않는다. 어시스턴트 재실행·GitHub CI 결과와 구분한다. [E0 기록](validation/e0-macos-user-report.json)

사용자는 LocalMCP-E1 앱 생성·연결 성공을 보고했고, 새 ChatGPT 세션의 수행 답변을 전달했다. 답변은 workspace_info → 세 파일 읽기 → edit_file 한 번 → 같은 세 파일 재읽기를 보고한다. workspace=project, 파일 읽기/쓰기 허용, shell/processes/persistentProcesses=false, skills/mcpServers/availableChecks=[]다. 변경은 calculator.mjs의 `return a - b` → `return a + b` 한 곳이며 44바이트, 테스트 파일과 확인 코드의 내용/끝 개행 불변을 보고했다. 해당 세션에서는 테스트를 실행하지 않았다고 명시했다.

이어 사용자가 로컬 check JSON을 제공했다: status=E1_LOCAL_CHECK_OK, tests=3, pass=3, changedFiles=[calculator.mjs], testFileUnchanged=true. 로컬 결과와 새 세션 보고의 확인 코드가 원문으로 같고, 개행 없는 UTF-8 문자열의 SHA-256도 이전 기록의 8222d6c37149e230698a76bb890bc57f1c3b9ccc8d6971347708f2645a52a9d4와 일치함을 계산해 확인했다.

**파일-only E1의 최소 수용 기준은 사용자 제공 근거 기준 통과다.** 근거는 다른 세션의 답변과 사용자가 붙여넣은 로컬 JSON이며, 이 대화의 원시 MCP 호출·승인 기록·맥 파일 직접 관찰은 아니다. 로컬 검사의 chatgptActorVerified=false를 true로 바꾸지 않는다. 그 값은 파일만으로 수정 주체를 판별하지 않는다는 한계이고 검사 실패가 아니다. 보고들 사이의 일치는 확인했지만 행위 주체를 독립적으로 인증했다고 주장하지 않는다.

확인 코드 원문·접속 URL/토큰·개인 경로는 원격 기록에서 제외한다. [최종 로컬 대조 기록](validation/e1-local-check-user-report.json)이 현재 E1 결론이며, [이전 수행 보고](validation/e1-chat-session-user-report.json)의 local_check_pending은 당시 시점의 이력으로 유지한다. 원본 evidence 파일·서버 로그·정확한 실행 버전/작업 트리·서버와 앱의 종료 여부는 별도 미확인이다.

이번 변경은 문서/결과 기록만 갱신한다. 런타임 src, E1 스크립트, 테스트, package/lockfile을 수정하지 않는다. E1을 다시 prepare/start하거나 같은 편집·테스트를 반복할 필요가 없다.

## 단계별 상태와 수용 기준
| ID | 할 일 | 현재 상태 | 근거 / 남은 기준 |
|---|---|---|---|
| M1-01/02 | 포크·공통 코어·모듈·CLI/Git | 구현 완료 | M1 d5b4ea9, 누적 88f455c E0 성공 보고 |
| M1-03 | 권한 비트·UTF-8·macOS cwd | 과거 기준선 및 E0 성공 보고 | 과거 64개와 현재 미확인 개수 합산 안 함 |
| CI-01 | GitHub CI·교차 플랫폼 | 보류 | 사용자 확인 한도 초과; 재실행/과금 변경 없음 |
| M2A-01/04 | 프로필·doctor·샘플·검사 연결 | 구현, E0 명령 성공 보고 | 명시적 파일 권한, 외부 설정, 기존 파일 보호 |
| M2A-05 | 누적 전체 결합 검사 | E0 성공 보고 확보 | 개별 검사 로그는 미수신 |
| M2B-01a | 시작·reload 프로젝트 정책 | 구현, E0 명령 성공 보고 | config/진입점 검사 포함 |
| M2B-01b | 읽기/쓰기 분리 | 구현, E0 명령 성공 보고 | 실제 SDK smoke의 쓰기 거부 검사 |
| M2B-02a | 민감 경로·부모 이동/삭제 | 구현, E0 명령 성공 보고 | 이름 정책; 내용 비밀 탐지 아님 |
| M2B-02b | 하위 MCP 허용 목록·명세 고정 | 구현, E0 명령 성공 보고 | 프로세스 OS 권한 격리와 구분 |
| M2B-02c | 누적 SDK/config/Worker 회귀 | E0 명령 성공 보고 확보 | E1의 파일 연결 보고도 확보. public Worker 전체 보안 감사와 구분 |
| M2B-03a | Docker 사본 어댑터·run_check | 구현, 실제 Docker 미검증 | 대역 수명주기와 실제 격리 별도 |
| M2B-03b | 실제 격리·타임아웃 | **다음 명령 실행 관문: E0-D 미실행** | 실제 Docker 설정/파일/네트워크/정리 확인 필요 |
| M2B-03c | 기존 셸/외부 MCP 전역 격리 | 미구현 | 새 run_check만 격리 대상 |
| E0-01/02 | check/build/full-tests/SDK smoke | 사용자 macOS 성공 보고 | 88f455c MINIMUM_LOCAL_OK |
| E0-03 | 실패 중단·결과 기록 | 독립 검증+결과 파일 생성 보고 | 제품 전체 복구와 다른 범위 |
| E1-P | 샘플·상태 분리·확인 코드·검사 절차 | 구현·독립 9개 검사 이력 및 사용자 실사용 보고 | 앱 연결·후속 check 보고 확보. 9개를 재실행했다고 표시하지 않음 |
| E1-01 | 실제 ChatGPT 읽기·편집·재읽기 | **사용자 전달 수행 보고 및 로컬 대조 확보** | 원시 호출/승인 기록은 이 대화에서 직접 확인하지 않음 |
| E1-02 | 로컬 불변·테스트·행위 대조 | **통과 — 사용자 제공 근거 기준** | E1_LOCAL_CHECK_OK, 테스트 3/3, 소스만 변경, testFileUnchanged=true, 확인 코드 일치 |
| M2C-01 | 제품 충돌·동시성·중복 실행 | 미구현 | 기존 stale 해시 검사만으로 완료 아님 |
| M2C-02 | 제품 영속 로그·프로세스 복구 | 미구현 | 검증 보고서 저장과 구분 |
| M3-01 | 실과제/호출 지연 | 미실행 | 같은 입력/출력, 최초/반복, 실패/재시도 분리 |

## E1 준비 구현 이력
`4a5e66c99ca95efe99fc1890942e8ac9c34ce9c8`는 `66fb82dff4faf94bc0f7b8cee3e511668af0a6d6` 위에 E1 보조 도구·검사·절차를 추가했다. 준비 당시 현재 대화에 LocalMCP 도구가 노출되지 않았고 검색에도 결과가 없었지만, 이는 이후 새 세션의 연결/수행 보고를 부정하는 근거가 아니다.

`scripts/e1-session.mjs`는 기존 createDemo/inspectProfile과 빌드된 agent를 재사용한다. prepare는 새 `~/.localmcp-e1`만 만들고 기존 디렉터리는 EEXIST로 중단한다. home과 profile, 기준 해시는 workspace 밖에 있다. 외부에 허용하는 파일은 calculator 소스·테스트·README·새 E1_CHALLENGE.txt 네 개다. 셸/프로세스/Skills/하위 MCP/Docker 검사는 꺼 둔다.

start는 `--public-relay`를 요구하고 프로필·원본 샘플 불변을 확인한 뒤 foreground agent를 시작한다. 원본 프로젝트의 제3자 공개 Cloudflare Worker를 사용한다는 점과 URL 자체가 비밀이라는 점을 명시한다. 에이전트 상태 HOME을 분리하고 기존 토큰·workspace override·NODE_OPTIONS를 전달하지 않는다. 이 대화의 어시스턴트가 직접 실제 네트워크 start를 실행한 것은 아니다.

check는 네 파일 이름과 비소스 파일 해시를 비교하고 소스가 지정한 한 연산자 수정과 정확히 같은지 먼저 확인한다. 그 뒤에만 기존 테스트를 Node로 실행한다. 예상 외 코드를 실행하거나 테스트 변경으로 성공을 만들지 않는다. 3개 통과 후 확인 코드를 반환하고 새 evidence JSON을 workspace 밖에 저장한다. 로컬 파일만으로 수정 주체는 알 수 없어 chatgptActorVerified=false를 유지한다. 이는 검사 실패가 아니며 외부 세션의 행위 증거와 결합해야 한다.

## 준비 시점의 독립 검증 이력
Linux / Node 22.16.0에서 `node --test test/e1-session.test.mjs`: 9개 통과, 실패/취소/건너뜀 0. 생성→red 확인→정확한 소스 수정→green, 기존 세션 보존, 테스트/파일 집합 변경 거부, 예상 밖 생성 코드 실행 거부, 설정 권한 확대 거부, 링크 대체 거부, 하위 환경 분리, start 동의 플래그 요구를 검사했다. 새 스크립트와 테스트의 문법 검사도 수행했다.

재사용한 project-profile.mjs의 Git blob이 3e111618af5a7d2f8e05ceb5a33dcaffde7f3f27과 일치했다. 준비 시점에는 실제 Worker start/ChatGPT 앱 등록/모델 호출, macOS의 새 보조 도구, 전체 E0 재실행, Docker를 수행하지 않았다. 이후 사용자 연결·새 세션 수행 보고·로컬 검사 성공과 당시의 미실행 기록을 구분한다. 새 테스트는 별도 Node 명령이며 기존 npm test 목록은 바꾸지 않았다. [E1 준비 검증](validation/e1-preparation-local.json), [실행 안내](e1-live-chatgpt.ko.md).

## 보존한 구현/검증 이력
88f455c는 선택형 Docker 사본 검사와 최소 검증 실행기를 추가했다. 사본은 민감 이름 제외, 10,000개 항목/64 MiB/깊이 64 한도이며 원본은 마운트하지 않는다. Docker는 로컬 context/이미지 ID 고정, pull 금지, 네트워크 없음, 비루트/권한/자원 제한, 생성 후 inspect 및 정리 확인을 사용한다. legacy shell/하위 MCP의 전역 격리는 아니다.

verify-minimum은 check→build→전체 npm test→실제 SDK stdio smoke를 순차 실행한다. 실패/취소/미확인을 성공으로 바꾸지 않는다. smoke는 읽기 전용 거부·민감 이름 비노출·소스만 수정·재읽기·stale patch 거부와 동일 테스트 red/green을 검사한다. --image 없이 실행한 사용자 E0에는 실제 Docker가 포함되지 않았다.

과거 Linux 독립 실행은 65개였고 GitHub DNS 및 SDK/Docker 부재로 전체 E0가 막혔으나, 이후 사용자 macOS 성공 보고로 E0 상태를 갱신했다. 이전 64/28/67/77/65개와 준비 도구 9개·이번 로컬 샘플 3개를 합산하지 않는다. 기존 validation JSON과 각 단계 안내 문서를 이력으로 유지한다.

## 다음 행동과 진행 경계
파일-only E1은 종료한다. 추가 증거나 구체적인 실패 없이 재설치·E0 반복·샘플 재생성·재편집·동일 check 반복을 요구하지 않는다. 아직 실행 중인 테스트 에이전트와 앱은 종료/선택 해제하되, 실제 종료·자격증명 폐기 완료를 추정하지 않는다. 세션 파일은 자동 삭제하지 않는다.

다음 검증은 [최소 검증 안내](minimum-verification.ko.md)의 E0-D다. 로컬 Docker와 검토한 기존 이미지가 실제로 준비됐는지 확인하고 격리된 run_check의 red/green·원본 불변·네트워크/권한·타임아웃 정리를 검사한다. 준비 여부는 아직 확인되지 않았다. 공개 중계를 이용한 파일-only 테스트 성공은 호스트 셸·외부 MCP·Docker 격리나 코딩 성능 검증이 아니다.

접속 URL/토큰·개인 경로는 공유하지 않는다. 새 세션 답변과 붙여넣은 JSON을 원시 도구 기록이나 독립적인 행위 인증으로 바꾸어 기록하지 않는다. CI 비용·계정 변경·이미지 다운로드·배포·main 병합은 하지 않는다. E0-D, M2c, M3는 별도 미완료다.
