# LocalMCP 모듈형 코딩 실행환경 — 1pager

갱신: 2026-09-20 · `dearcloud09/localmcp` · `feat/m1-modular-runtime` · [진행표](progress.md)

## 목표와 구조
ChatGPT가 판단하고 포크가 실행·권한·기록을 맡는다. `ChatGPT → MCP → 공통 코어 → 파일 / Git / 검사 / 전문 도구`. 현재 우선순위는 새 기능이 아니라 실제 연결과 독립 검증이다.

## 최신 연결 결과 — 별도 대화의 workspace_info 성공 보고
사용자가 연결 확인용 별도 대화의 결과를 전달했다. 첫 LocalMCP-E1 호출 workspace_info({}) 1회가 정상 응답했고 workspace/defaultWorkspace는 project, root는 E1 샘플 경로 형태, files와 fileRead/fileWrite는 true, shell/processes/persistentProcesses는 false였다. mutationRecovery는 memory, restartPersistent/automaticRetry/atomicFileAndJournal=false이며 보호 scope와 M2c 입력 필드가 보고됐다. **별도 대화의 단일 연결 점검: pass — 전달된 사용자 보고 범위.** [새 연결 보고](validation/m2c-separate-chat-workspace-user-report.json)

주 담당 대화의 마지막 직접 호출 FORBIDDEN은 그대로 보존하며 이번에 재시도하지 않는다. 대화에 따라 다른 결과를 관측했지만 같은 시점의 통제 실험은 아니므로 정확한 거부 원인이나 과거 502 원인을 확정하지 않는다. 이 대화의 제한 해소, 실제 파일 읽기/쓰기, guarded edit 실계정 E1 통과 또는 정확한 실행 커밋 증명으로 확대하지 않는다.

configFile·skills·mcpServers·availableChecks는 전달문에 없어 미확인이다. 실제 원응답에도 없다고 추정하지 않는다. 별도 exec 필드는 응답에 없었다는 사용자 보고만 있다. 다음 읽기 점검은 성공한 대화의 기존 원응답에서 file-only 조건을 확인한 뒤 calculator.mjs에 includeVersion=true 읽기 1회로 한정한다. 기존 E1·확인 코드·성공 증거·설정은 쓰지 않는다.

## C의 한정된 영속 수명주기 검증 통과
사용자가 해시 확인된 lifecycle.mjs의 전체 결과를 제공했다. R2의 실제 SDK 1.30.0과 built server를 사용한 stdio 9개 + loopback HTTP 9개, 총 18개 점검이 모두 passed다. C_SCOPED_LIFECYCLE_OK, cleanupConfirmed=true, cleanupErrors=[], projectUnchanged=true, PHASE_EXIT=0을 사전 수용 기준과 대조해 **C: pass — 사용자 실행 근거, 열거한 범위 한정**으로 갱신한다. [C 실행 근거](validation/m2c-scoped-lifecycle-user-report.json)

독립 프로세스의 정상 종료 후 재시작, 과거 영수증, 실제 watcher 권한 회수/복원과 부적합 reload 거부를 포함한다. apply_patch 실행·강제 종료/crash·전원 장애·교차 프로세스 동시 잠금·relay/agent 전체 수명주기·Docker·실제 ChatGPT 호출은 이 통과 범위가 아니다. exactSourceToBuildProven=false도 유지한다.

## 이전 감사·재기동 및 주 대화 거부 이력
사용자가 R2의 감사 및 기존 E1 재연결 블록 결과를 제공했다. 정상 npm 감사 JSON에서 high 3개를 확인했고 프로젝트 불변 검사도 성공했다. 기존 등록으로 E1_RECONNECTED/ready=true, 기동 종료 코드 0, 빌드 manifest 안정성 및 기존 샘플·성공 증거 보존을 보고했다. 이는 사용자 실행 근거이며 이번 어시스턴트의 직접 macOS 실행 결과는 아니다.

이전 턴에서 사용자가 앱 Refresh와 멘션 완료를 알린 뒤 탐색에서 LocalMCP-E1 도구 20개가 다시 노출됐다. read_file.includeVersion과 edit_file/apply_patch의 expectedSha256·operationId가 정의에 포함돼 있다. 첫 실제 호출 시도 workspace_info({})는 `FORBIDDEN: This conversation does not support developer MCPs`를 반환했다. 당시 이 대화에서는 정상 서버 응답을 받지 못했다. 이후 별도 대화 결과는 위 새 보고로 구분한다. 이번 결과는 이전 도구 미노출이나 502와 다른 Chat 호스트의 대화 지원 거부다. 앱 승인 설정은 found/기본값 Allow low-risk actions 상속이며 변경하지 않았다. [이번 직접 관측](validation/m2c-chat-host-forbidden-observation.json)

주 담당은 이 대화로 유지한다. 성공한 별도 대화는 허용된 읽기 점검용이며 개발/Git 기록을 중복 관리하지 않는다. 이미 성공한 연결 대조·감사·C 검사·재기동을 반복하지 않고, 이 대화의 거부를 직접 HTTP나 다른 도구로 우회하지 않는다.

[이번 감사·재연결 근거](validation/m2c-audit-reconnect-user-report.json)

## 관문별 상태
| 관문 | 현재 상태 | 남은 작업 |
|---|---|---|
| A / DEP-01 | 감사 수집·패키지/advisory 식별·원격 lock 대조 완료 | 도달 가능성의 런타임 확인, 의존성 수정과 수정 후 감사는 미실행 |
| 연결 복구 | **별도 대화 workspace_info 1회 성공 사용자 보고**. 주 대화의 이전 FORBIDDEN은 별도 | 기존 원응답의 미전달 필드 확인 후 versioned read 1회. 서버/권한 변경 없음 |
| B / E0-D | PATH와 지정 설치 위치에서 Docker CLI 미발견 | 알려진 실행 경로 없음. 설치/이미지 다운로드는 승인 없이 진행하지 않음 |
| C / 영속 lifecycle | **한정된 범위 통과 — 실제 SDK, 두 전송의 18개 점검 사용자 보고** | 동일 검사의 재실행 불필요. 범위 밖 복구 보장은 별도 |
| D / 최종 후보 실계정 E1 | 연결 전제 일부 확인. 실제 guarded edit는 미실행 | 버전 포함 읽기와 후보 기준 확인. 새 편집용 샘플·공개 범위는 별도 결정 |

감사 경로는 `wrangler 4.129.0 → miniflare 5.20260903.0-alpha → sharp 0.35.2`이고 모두 lock의 dev 의존성이다. high 3개는 세 패키지 항목이며, sharp의 GHSA-rgj7-g3m4-5g8c와 두 상위 의존성의 전파 경고다. 이 advisory는 upstream libheif 문제 두 개를 참조한다. sharp 수정 범위는 0.35.4 이상이지만 dev 표시만으로 안전하다고 판정하거나 fixAvailable=true를 수정 완료로 해석하지 않는다. [maintainer advisory](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c)

## 빌드·증거·변경 경계
R2 소스 기준은 `8dd7876192c1290d7d18bd70cc9b6d264aca34c4`, 기동 전후 dist manifest는 `d093a515eca545d75117ae7b9fb363445502dcfd03c48b7c902ffedd58c7f637`다. exactSourceToBuildProven=false를 유지한다. 원격 문서가 앞서 있다는 이유로 R1 갱신·R2 pull·재빌드·동일 최소 검사를 요구하지 않는다.

이전 E0/파일-only E1, M2C_LOCAL_CHECKS_OK, 코드 50cad2d/통합 8dd7876의 원격 반영과 기존 해시 대조 근거는 유지한다. C의 새 근거는 별도로 추가하되 새 실계정 편집·Docker·전체 복구로 확대하지 않는다. 교차 프로세스 다른 ID 잠금, 수동 복구, 다중 파일, 프로세스 복구, 전원 장애 보장, 실과제 성능은 미완료다.

이번 원격 변경은 문서와 새 근거 JSON뿐이다. 기존 E1을 재편집/초기화하지 않고 audit fix·설치·lockfile 변경·권한 확대·main 병합·배포·CI 과금 변경을 하지 않는다. PR Draft·MIT 고지를 유지한다. 상세 이전 상태는 [기동 전 진행표](https://github.com/dearcloud09/localmcp/blob/8fa9a34fb103389b24ab0b1f56d988263f7cd309/docs/progress.md)에 보존한다.
