# LocalMCP 모듈형 코딩 실행환경 — 1pager

갱신: 2026-09-20 · `dearcloud09/localmcp` · `feat/m1-modular-runtime` · [진행표](progress.md)

## 목표와 구조
ChatGPT가 판단하고 포크가 실행·권한·기록을 맡는다. `ChatGPT → MCP → 공통 코어 → 파일 / Git / 검사 / 전문 도구`. 현재 우선순위는 새 기능이 아니라 남은 검증과 의존성 문제 해결이다.

## 최신 결과 — 별도 대화의 버전 포함 읽기 통과
사용자는 성공한 별도 대화에서 기존 workspace_info 원응답을 재사용해 E1 root/profile 대응, 읽기 허용, shell/processes=false, skills/mcpServers/availableChecks=[]를 확인했다고 보고했다. 이어 read_file에 includeVersion=true를 지정해 calculator.mjs를 1회 읽었고, 수정 완료된 덧셈 코드와 bytes=44, SHA-256 `76f26bd292166033d02e77bdb8fe6aec01e915ccb8cb3f93b8971f9dcd78250e`를 받았다. 추가 호출·변경은 없다는 보고다.

전달된 코드 한 줄에 끝 LF를 포함한 UTF-8 바이트를 별도 작업 환경에서 계산해 44바이트와 같은 SHA-256을 확인했다. **버전 포함 읽기: pass — 별도 대화 사용자 보고 + 전달 데이터의 내부 일치 확인.** 원시 MCP transcript나 맥 파일을 직접 읽은 독립 증명은 아니다. [새 읽기 근거](validation/m2c-versioned-read-user-report.json)

이번 결과로 기존 샘플의 읽기 점검을 종료한다. 같은 읽기·workspace_info·재기동을 반복하지 않고 기존 E1을 편집하거나 파일을 추가하지 않는다. 새 실계정 guarded edit/replay, 정확한 실행 커밋, 주 대화의 FORBIDDEN 해소로 확대하지 않는다.

## 관문별 상태
| 관문 | 현재 상태 | 남은 작업 |
|---|---|---|
| A / DEP-01 | 감사 수집·패키지/advisory 식별·원격 lock 대조 완료 | 취약점 수정·수정 후 감사 및 영향 검증은 미실행 |
| 연결·읽기 | 별도 대화 workspace_info 및 버전 포함 읽기 성공 보고 | 주 대화의 마지막 FORBIDDEN은 유지. 이번에 재시도하지 않음 |
| B / E0-D | PATH와 지정 설치 위치에서 Docker CLI 미발견 | 실제 Docker 미실행. 새 설치/이미지 다운로드는 별도 승인 |
| C / 영속 lifecycle | 실제 SDK 1.30.0, stdio 9 + loopback HTTP 9개 점검 사용자 보고 기준 pass | 열거한 범위 완료. 동일 검사 반복 불필요 |
| D / 최종 후보 실계정 E1 | 연결·versioned read 전제 확인, 새 mutation 검증 미실행 | 기존 E1과 분리된 무비밀 샘플·프로필·연결의 범위 및 공개 노출 승인 필요 |

파일 읽기·쓰기 권한은 file-tools 범위다. shell/processes/persistentProcesses=false이며 추가 검사·Skills·하위 MCP 목록도 비어 있다고 보고됐다. memory recovery의 restartPersistent/automaticRetry/atomicFileAndJournal=false는 C의 별도 durable 환경 통과와 모순되지 않는다. 파일 도구를 npm·Docker 실행 경로로 취급하지 않는다.

## 후보·근거·변경 경계
R2의 앞선 소스 기준은 `8dd7876192c1290d7d18bd70cc9b6d264aca34c4`, 기동/검증 기준 dist manifest는 `d093a515eca545d75117ae7b9fb363445502dcfd03c48b7c902ffedd58c7f637`다. 이번 읽기에서 프로세스·빌드를 새로 측정하지 않았고 exactSourceToBuildProven=false를 유지한다.

A의 이전 감사 경로는 wrangler → miniflare → sharp이며 high 3개가 미해결이다. C 통과를 apply_patch 실제 실행·의도적 crash·전원 장애·교차 프로세스 동시 잠금·수동 복구·모든 agent/relay 수명주기·Docker·새 실계정 편집으로 확대하지 않는다. 이전 E0/E1·최소 검사·원격 반영 근거도 유지한다.

이번 Git 변경은 문서와 새 읽기 보고뿐이다. 기존 E1·과거 증거 JSON·제품 코드·테스트·의존성·설정·권한·main·배포·과금을 변경하지 않는다. PR Draft와 MIT 고지를 유지한다. 문서 갱신 때문에 R2 pull·재빌드·성공한 검사를 반복하지 않는다.

[연결 보고](validation/m2c-separate-chat-workspace-user-report.json) · [C 통과](validation/m2c-scoped-lifecycle-user-report.json) · [감사·재기동](validation/m2c-audit-reconnect-user-report.json) · [주 대화 거부](validation/m2c-chat-host-forbidden-observation.json) · [이전 1pager](https://github.com/dearcloud09/localmcp/blob/bb92ca9bbd3c9fb8b9a985ea70b4ebccef3756c6/docs/onepager.ko.md)
