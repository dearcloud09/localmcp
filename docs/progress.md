# 실행 진행표

갱신: 2026-09-20 · [1pager](onepager.ko.md) · `feat/m1-modular-runtime` · PR #1 Draft.

## 현재 판정
**별도 대화의 workspace_info 단일 연결 점검: pass — 전달된 사용자 보고 범위. C: pass — 한정된 수명주기 관문. 전체 프로젝트: verification_pending.** 주 담당 대화의 이전 FORBIDDEN은 미해결로 유지한다. 실제 파일 읽기/guarded edit, 정확한 실행 커밋, 취약점 수정, Docker 및 범위 밖 복구 보장은 남아 있다. [C 실행 근거](validation/m2c-scoped-lifecycle-user-report.json) · [이전 감사·재연결](validation/m2c-audit-reconnect-user-report.json)

## 별도 대화 연결 대조 — 정상 workspace_info 보고 확보
### 출처와 판정
사용자는 연결 확인용 별도 대화에서 LocalMCP-E1의 첫 호출로 workspace_info({})를 1회 실행한 결과를 전달했다. 추가 호출·파일 접근·셸·변경은 없었다고 보고했다. 이 주 담당 세션은 해당 대화의 도구 transcript나 서버 원본 JSON을 직접 읽지 않았으며, 전달된 표/요약을 사용자 근거로 수용한다. [정규화한 연결 보고](validation/m2c-separate-chat-workspace-user-report.json)

| 항목 | 전달된 관측 | 증거 범위 |
|---|---|---|
| workspace / defaultWorkspace | project / project | 별도 대화의 정상 응답 보고 |
| root | E1 샘플 경로 형태 | 개인 절대경로는 저장하지 않음. 현재 session 파일과 독립 대조하지 않음 |
| files / 파일 읽기·쓰기 | true / true·true, scope=file-tools | 권한 보고. 실제 read/write 성공과 다름 |
| shell / processes / persistentProcesses | false / false / false | npm·Docker·범용 exec 권한으로 확대하지 않음 |
| mutationRecovery | memory; restartPersistent=false; automaticRetry=false; atomicFileAndJournal=false | scope는 operationId와 expectedSha256을 사용하는 edit_file/apply_patch. memory는 M2c 부재가 아님 |
| M2c 입력 정의 | read_file.includeVersion; edit_file/apply_patch의 expectedSha256·operationId | 별도 대화에 노출된 스키마 보고. 실제 필드 동작·mutation은 미검증 |
| configFile / skills / mcpServers / availableChecks | 전달문에 없음 | 서버 원응답의 누락·false·빈 배열/객체로 바꾸지 않음 |
| 별도 exec 권한 필드 | 응답에 없음으로 보고됨 | 사용자가 보고한 누락. 실행 권한이 따로 있다는 뜻은 아님 |

### 원인 분리와 후보 기준
별도 대화에서 실제 도구 응답이 돌아왔다는 보고는 그 시점에 해당 경로가 사용 가능했다는 근거다. 주 담당 대화의 마지막 직접 관측은 FORBIDDEN이었다. 두 결과는 다른 대화·시점의 관측이며 동시 통제 비교가 아니므로 대화 유형·모드·계정·호스트 내부 상태를 원인으로 확정하지 않는다. 기존 502·도구 미노출·M2c 정의 변경·현재 연결 성공을 하나의 원인으로 합치지 않는다.

이번에는 LocalMCP 도구 탐색/호출·앱 설정 변경·서버 조작을 하지 않는다. 다른 대화 성공이 이 대화의 실행 제한을 해제하지 않는다. 원격 Git 읽기/기록은 주 담당에서 유지하고, 별도 대화는 사용자에게 허용된 범위의 읽기 점검만 담당한다. 토큰 추출·직접 HTTP·다른 도구로 제한을 우회하지 않는다.

이번 workspace 응답에는 실행 commit·dist 해시·프로세스 시작 근거가 없다. 기존 R2 HEAD/기동 manifest와 C 통과는 이전 근거로 유지하되, 새 응답만으로 정확한 실행 commit을 확정하지 않는다. M2c recovery 정보 반환과 입력 스키마 노출은 확인됐지만 versioned read·guarded edit·replay 동작의 실계정 검증은 아직 아니다.

### 다음 최소 읽기 점검
성공한 대화에서 이미 받은 workspace_info 원응답을 재사용해 configFile의 존재/기존 E1 경로 대응, skills/mcpServers/availableChecks를 먼저 확인한다. 파일 도구 읽기 허용, 기존 E1 샘플 경로, shell/processes 비활성 및 추가 기능/검사 목록이 비어 있음을 원응답에서 확인할 때만 read_file({workspace:"project",path:"calculator.mjs",includeVersion:true})를 정확히 1회 요청한다. content·sha256·bytes를 실제 반환값대로 보고하고 같은 파일도 편집하지 않는다. 이 조건이 미확인이거나 호출이 거부되면 추가 호출 없이 상태만 보고한다.

기존 workspace_info를 자동 반복하지 않고 원응답 누락과 전달 생략을 구분한다. 정상 read는 연결의 추가 관측이지 새 guarded-edit E1 통과가 아니다. 기존 샘플·테스트·확인 코드·성공 증거를 초기화하거나 버그로 복원하지 않는다. 별도 편집 샘플의 새 공개 노출은 이 읽기 계획에 포함되지 않는다.

## A — 실제 감사 수집 완료, 수정은 미실행
사용자 실행 환경은 R2 HEAD `8dd7876192c1290d7d18bd70cc9b6d264aca34c4`, Node v23.11.0, npm 11.4.2다. lock SHA-256은 `8185650314a8799924768a54193de71332d3a5c1037a87d58b4e08ba5442b1d4`다. dev/optional/peer를 포함한 공개 npm registry 감사가 validAuditReport=true, exitCode=1, 실행 오류 없음, high=3/그 외=0을 반환했다. wrapper의 PHASE_EXIT=0은 수집 성공이고 취약점 0개라는 뜻이 아니다. projectUnchanged=true를 사용자 보고로 기록한다. 원본 감사 JSON/stderr 파일을 직접 수신하거나 독립 재감사하지는 않았다.

| 패키지 | 설치/lock 버전 | 보고 범위 | 관계 |
|---|---|---|---|
| wrangler | 4.129.0 | <=0.0.0-7ae5dd357 또는 4.16.0–4.130.0 | 직접 dev 의존성, miniflare 경고 전파 |
| miniflare | 5.20260903.0-alpha | <=0.0.0-fec45ed61 또는 4.20250508.3–5.20260908.0-alpha | 간접 dev 의존성, sharp 경고 전파 |
| sharp | 0.35.2 | <0.35.4 | 간접 dev 의존성, GHSA-rgj7-g3m4-5g8c |

현재 원격 package-lock의 wrangler→miniflare 고정 버전과 miniflare→sharp 0.35.2 고정 의존성을 직접 읽어 위 경로와 대조했다. 세 패키지 항목을 독립 advisory 세 개로 세지 않는다. npm의 meta-vulnerability 집계와 일치한다. [npm 감사 계약](https://docs.npmjs.com/cli/v11/commands/npm-audit/)

2026-09-20 읽은 [sharp maintainer advisory](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c)는 <0.35.4를 영향 범위, >=0.35.4를 수정 범위로 명시한다. 미신뢰 이미지 입력 처리가 핵심 조건이며, glibc Linux의 특정 조건에서 가능한 RCE를 설명한다. 이를 macOS 무영향 판정으로 바꾸지 않는다. 참조한 libheif 원문은 [GHSA-g89c-p67h-r497](https://github.com/strukturag/libheif/security/advisories/GHSA-g89c-p67h-r497) 및 [GHSA-2jg2-4ch7-h545](https://github.com/strukturag/libheif/security/advisories/GHSA-2jg2-4ch7-h545)다. 첫 항목은 현재 CVE-2026-84383으로도 표기된다.

dev 표시만으로 런타임 도달 불가능을 증명하지 않는다. 검토한 LocalMCP agent/index/server와 Worker relay 진입점에는 sharp 이미지 처리 호출이 없지만, 설치된 전체 종속 그래프의 실행 추적이나 실제 native libheif 바이너리 검사는 하지 않았다. 이번 파일-only 재연결 장애를 이 advisory 때문이라고 판단할 근거도 없다.

수정 후보는 호환되는 wrangler/miniflare 경로에서 sharp 수정판을 해석하도록 만드는 것이다. miniflare가 0.35.2를 고정하므로 루트 sharp 패키지만 추가하는 처방을 제시하지 않는다. 정확한 업그레이드 조합·회귀 영향은 미검증이다. fixAvailable=true는 registry의 해결 가능성 안내일 뿐이다. audit fix, overrides, 설치, lockfile 변경은 수행하지 않았다. DEP-01의 수집·식별은 완료, 해결은 미완료다.

## 기존 E1 — 재기동 성공 보고와 Chat 도구 노출을 분리
사용자는 기존 등록/샘플을 검증하는 블록에서 E1_RECONNECTED, startExitCode=0, ready=true, launchAttempted=true를 보고했다. 요청 시각은 2026-09-19T23:49:03.792Z다. buildStable=true와 existingSampleAndEvidencePreserved=true이며, 디스크 전체 dist manifest는 `d093a515eca545d75117ae7b9fb363445502dcfd03c48b7c902ffedd58c7f637`다. PID와 개인 경로는 공개 기록에서 제외한다. mcpToolCalled=false, exactSourceToBuildProven=false를 그대로 유지한다.

### 이전 Refresh·멘션 직후 직접 관측 — 정의 노출, 대화 지원 거부
앞선 턴에는 namespace가 없었지만 사용자가 Refresh 및 멘션 완료를 알린 이번 턴에는 LocalMCP-E1 도구 20개가 노출됐다. read_file 입력에 includeVersion이 있고, edit_file과 apply_patch 모두 expectedSha256·operationId를 제공한다. 이는 호스트에 노출된 M2c 정의이며 실행 중 서버의 커밋이나 기능 실행 증명이 아니다.

첫 LocalMCP 호출 시도는 workspace_info({}) 한 번이다. 결과는 `ToolError: FORBIDDEN: This conversation does not support developer MCPs`였다. 이 거부 후 다른 LocalMCP 도구를 호출하거나 재시도하지 않았다. 정상 workspace payload 수신은 0회다. workspace, root, configFile, files, filePermissions, shell, processes, persistentProcesses, skills, mcpServers, availableChecks, mutationRecovery는 모두 응답에 없음이며 false/빈 값으로 추정하지 않는다. 기존 E1 여부를 현재 응답으로 확인하지 못했으므로 calculator.mjs를 비롯한 파일은 읽거나 편집하지 않았다.

앱 승인 설정은 이번에 다시 읽어 found / Use my default / Allow low-risk actions를 확인했다. 승인이 허용된 상태와 대화가 developer MCP를 지원하는지는 별개다. 기존 502와 이번 FORBIDDEN을 합쳐 같은 원인으로 기록하지 않는다. 오류 문구는 Chat 호스트의 대화 지원을 지목하지만 실제 백엔드 전달 여부는 추적하지 않았고, 프로젝트 종류·계정·모드·호스트 결함 중 원인도 미확정이다. 현재 E1 ready·실행 빌드·프로세스는 이번에 직접 확인하지 않았다. [새 관측 JSON](validation/m2c-chat-host-forbidden-observation.json)

[공식 Developer mode 안내](https://developers.openai.com/api/docs/guides/developer-mode)는 웹에서의 기능 활성화, 앱 메타데이터 Refresh와 대화별 앱 선택을 구분한다. 읽은 공식 안내에서는 이 정확한 FORBIDDEN의 원인이나 확정적인 복구법을 찾지 못했다. 이 오류만으로 요금제 변경, 권한 확대 또는 프로젝트 미지원 판정을 요구하지 않는다.

이때 준비한 최소 대조는 이미 허용된 별도 웹 대화에서 같은 앱으로 workspace_info만 1회 호출하는 것이었다. 현재는 위 별도 대화 성공 보고를 받았으므로 같은 대조를 반복하지 않는다. 당시 이 대화의 거부 이력은 그대로 보존하며 새 성공을 이 대화의 지원 복구나 D 전체 통과로 확대하지 않는다.

이전 502의 정확한 발생 계층과 종료 원인은 미확정이다. 재기동 성공 보고로 당시 원인을 소급 확정하지 않는다. 기존 E1은 파일-only memory profile이며, 향후 memory/restartPersistent=false 응답 자체는 M2c 부재를 의미하지 않는다. 재연결/읽기만으로 D의 새로운 guarded-edit 실계정 검사를 통과시키지 않는다. 같은 재연결·감사 블록을 자동 반복하지 않는다.

## B — 실제 Docker는 별도 보류
이번 고정 설치 위치 점검도 executableCandidates=[]였고 daemonContacted=false다. 이전 PATH 미발견과 합쳐도 시스템 전체 미설치 증명은 아니다. 현재 알려진 Docker 실행 경로가 없으므로 실제 E0-D는 미실행이다. Docker 설치/실행환경 추가·새 이미지 다운로드·비용·원격 context 전환은 구체적 승인 없이 하지 않는다. C 검사는 Docker와 무관하게 진행 가능하다.

## C — 실제 SDK·독립 프로세스의 한정된 수명주기 관문 통과
### 수용 기준과 근거
사용자는 LIFECYCLE_VERIFIED 뒤의 점검 18개와 전체 durable_lifecycle 요약, LOCALMCP_LIFECYCLE_END, PHASE_EXIT=0을 제공했다. 상태는 C_SCOPED_LIFECYCLE_OK이며 sdkLoaded=true, sdkVersion=1.30.0, passedChecks=18, cleanupConfirmed=true, cleanupErrors=[], projectUnchanged=true다. 예고한 완료 조건을 바꾸지 않고 **C: pass**로 수용한다. [정규화한 사용자 실행 기록](validation/m2c-scoped-lifecycle-user-report.json)

실행 근거는 사용자가 붙여넣은 출력이다. 어시스턴트가 맥에서 직접 실행하거나 임시 report.json을 독립 수신한 것은 아니다. 이번에는 제공했던 ZIP의 실제 lifecycle.mjs 바이트를 읽고 SHA-256 `fd8b756a4933a2cb38746166f1f4a3bd1f751443e21ae51d16b36c7e56c222dc`와 출력·assertion 대응을 대조했다. 이전 합성 SDK/서버 대역의 18개 자체 검사와 이번 실제 SDK 실행 보고 18개는 다른 실행이며 합산하지 않는다.

### 열거한 실제 검사 범위
| 검사 묶음 | stdio | loopback HTTP |
|---|---|---|
| 미초기화 시작 거부·기록소 미생성 | passed | passed |
| create-only 초기화·중복 거부·기록 내용 불변 | passed | passed |
| 실제 workspace·권한·M2c 도구 스키마 | passed | passed |
| versioned read·edit_file guarded edit·stale hash 거부 | passed | passed |
| 별도 PID 재시작·과거 receipt·외부 변경 파일 보존 | passed | passed |
| 실제 watcher를 통한 권한 회수·도구 제거·cached replay 거부 | passed | passed |
| 호환되는 권한 복원·기존 receipt replay | passed | passed |
| 부적합 recovery 변경의 전체 reload 거부·기존 권한 유지 | passed | passed |
| 검사가 만든 서버만 종료 | passed | passed |

9개 점검 묶음 × 2개 전송 = 18개다. 내부 assertion 수나 npm 전체 테스트 수로 표시하지 않는다. 권한 회수와 부적합 recovery 변경을 같은 설정에 넣은 사례는 전체 reload가 거부되어 이전 쓰기 권한이 유지됨을 확인했다. 이를 권한 회수 성공 사례로 오인하지 않는다.

### 후보·불변·종료 근거의 범위
스크립트는 R2 HEAD `8dd7876192c1290d7d18bd70cc9b6d264aca34c4`, clean 상태, lock SHA-256 `8185650314a8799924768a54193de71332d3a5c1037a87d58b4e08ba5442b1d4`, dist manifest `d093a515eca545d75117ae7b9fb363445502dcfd03c48b7c902ffedd58c7f637`를 사전 검사한다. 성공 출력은 이 guard와 전후 snapshot 일치에 대한 사용자 실행 근거다. manifest 값은 이번 JSON에서 새로 출력된 필드가 아니라 해시 확인된 스크립트의 비교 상수다. Node/npm 버전은 이번 최종 JSON에 없어 앞선 환경 보고를 신규 측정으로 재표기하지 않는다.

재시작은 client/transport close와 검사용 자식 종료 후 별도 PID로 시작한 경로다. HTTP 종료 함수에는 실패 시 SIGKILL fallback이 있지만 성공 출력은 fallback 사용 여부를 기록하지 않는다. 강제 중단을 주입한 crash/recovery 검사가 아니다. cleanupConfirmed는 검사용 서버 종료이지 임시 fixture/기록소/보고서 디렉터리 삭제가 아니다. 스크립트는 report.json과 임시 자료를 남긴다.

projectUnchanged는 Git HEAD/status, package.json, lockfile, dist manifest의 snapshot 일치 범위다. node_modules 전체 바이트나 모든 미추적/ignored 파일의 전수 무결성 증명이 아니다. existingE1Accessed=false, publicRelayUsed=false, dockerUsed=false, packagesInstalled=false, buildRun=false와 exactSourceToBuildProven=false를 그대로 보존한다.

### 한계와 종료 규칙
이번 실행은 edit_file 경로를 검사했다. apply_patch는 권한 회수 후 목록 제거 검사에 포함되지만 실제 patch 실행·재시작 replay는 수행하지 않았다. 전원 장애, 의도적 SIGKILL/crash, 교차 프로세스 동시 잠금, 수동 복구, 모든 영속 모드/agent/relay lifecycle, Docker, 실제 ChatGPT 실계정 E1 및 source-to-build 재현성은 통과로 확대하지 않는다.

C는 위 범위에서 완료했으므로 새 변경·실패 근거 없이 동일 lifecycle, verify:minimum, 감사·재연결 블록을 재실행하지 않는다. 이후 새 코드·의존성 변경이 있으면 영향 범위에 맞춰 필요한 검사만 선택한다. 별도 대화 workspace_info 성공 보고는 위 연결 근거로 추가했다. C의 독립 fixture 응답과는 별개이며 다음 versioned read/실계정 편집을 대신하지 않는다.

## 유지하는 기준과 이력
M1·M2a·M2b 구현, 이전 E0/파일-only E1의 사용자 근거, M2C_LOCAL_CHECKS_OK, IG-04의 코드 50cad2d/통합 8dd7876 반영과 이전 production/benchmark 해시 대조는 유지한다. 정확한 최신 전체 검사 수를 추정하거나 이전 335/336을 현재 실패로 바꾸지 않는다. 교차 프로세스 다른 ID 잠금·수동 복구·다중 파일·프로세스 복구·실과제 성능·CI 한도 관문은 여전히 미완료다.

[최소 검사 사용자 보고](validation/m2c-local-checks-user-report.json) · [원격 반영](validation/m2c-publication-readback.json) · [기동 전 진단](validation/m2c-macos-execution-path-report.json) · [이전 상세 진행표](https://github.com/dearcloud09/localmcp/blob/8fa9a34fb103389b24ab0b1f56d988263f7cd309/docs/progress.md).

이번 Git 변경은 onepager·progress·새 별도 대화 연결 보고 JSON뿐이다. 감사·재연결을 포함한 기존 시점별 JSON은 수정하지 않는다. 기존 E1/과거 증거 JSON·제품 소스·테스트·의존성·설정·권한·main·배포·과금은 변경하지 않는다. 문서 커밋에 [skip ci]를 사용하며 CI 성공을 주장하지 않는다.
