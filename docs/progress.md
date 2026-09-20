# 실행 진행표

갱신: 2026-09-20 · [1pager](onepager.ko.md) · `feat/m1-modular-runtime` · PR #1 Draft.

## 현재 판정
**별도 대화의 연결 및 버전 포함 읽기: pass — 사용자 전달 근거. C: pass — 한정된 수명주기 관문. 전체 프로젝트: verification_pending.** 기존 E1 읽기 점검은 완료한다. 실제 새 guarded edit/replay, 정확한 실행 커밋, 의존성 취약점 수정, 실제 Docker와 범위 밖 복구 보장은 남아 있다.

## 최신 실행 보고 — read_file(includeVersion=true)
### 출처와 권한 전제
사용자는 성공한 별도 대화의 workspace_info 원응답을 재사용해 조건을 확인했고, workspace_info를 다시 호출하지 않았다고 보고했다. root와 configFile은 기존 E1 샘플/프로필 경로에 대응하며 fileRead=true, shell=false, processes=false, skills=[], mcpServers=[], availableChecks=[]였다. 이전 전달문에서 빠졌던 필드를 이번에 보완한 것이며, 새 workspace 응답을 얻은 것으로 표시하지 않는다.

그 조건 아래 read_file({workspace:"project",path:"calculator.mjs",includeVersion:true})를 정확히 1회 실행했다고 보고했다. 반환된 코드는 이미 수정된 덧셈 구현이며 bytes=44, sha256=76f26bd292166033d02e77bdb8fe6aec01e915ccb8cb3f93b8971f9dcd78250e다. 추가 LocalMCP 호출·다른 파일 접근·mutation·셸·프로세스·서버 조작·Git 작업은 없다는 보고다. [정규화한 읽기 근거](validation/m2c-versioned-read-user-report.json)

이 주 담당 세션은 별도 대화의 원시 tool transcript나 맥의 실제 파일을 직접 받지 않았다. 제공된 표/코드/해시/바이트를 사용자 근거로 수용하고 별도 계산으로 내부 일치 여부를 검사했다. 이전 단일 workspace 호출과 이번 read 호출은 서로 다른 단계이며, 이번 workspace 호출 수는 0이다.

### 해시·바이트 대조
표시된 코드 한 줄은 줄 끝 문자를 제외하면 UTF-8 43바이트다. 끝 LF 1바이트를 포함한 알려진 수정 완료 샘플 표현은 44바이트이며, 계산한 SHA-256은 보고된 값과 정확히 같다. 끝 문자가 없거나 CRLF인 비교 후보는 각각 43/45바이트이고 해시도 다르다. 세 후보 비교는 전달된 내용·메타데이터의 일치 검사이지 별도 서버 관측이 아니다. 코드 블록 표시만으로 원시 개행을 직접 수신했다고 주장하지 않는다.

수용 기준인 경로/권한 전제 보고, includeVersion=true 읽기 성공 보고, content·sha256·bytes 반환 및 재계산 일치를 충족해 이 읽기 관문을 pass로 기록한다. 해당 파일의 현재 값이 알려진 green fixture와 일치한다는 근거이며, 이 한 파일로 모든 E1 파일/증거의 불변이나 과거 편집 주체를 증명하지 않는다. 기존 E1의 전후 보존은 앞선 재기동 보고의 별도 근거다.

### 연결·빌드에 대한 해석
별도 대화에서는 workspace_info와 버전 포함 read_file이 성공했다는 보고를 확보했다. 주 담당 대화의 마지막 직접 결과는 FORBIDDEN이며 이번에 LocalMCP 도구를 재탐색/호출하지 않았다. 과거 502, 도구 미노출, 정의 새로고침, FORBIDDEN, 별도 대화 성공을 단일 원인으로 합치지 않는다. 대화 유형·계정·모드·호스트 내부 결함이나 과거 종료 원인은 미확정이다.

앞선 R2 HEAD는 8dd7876192c1290d7d18bd70cc9b6d264aca34c4이고 기동/검증 기준 dist manifest는 d093a515eca545d75117ae7b9fb363445502dcfd03c48b7c902ffedd58c7f637다. 이번 read 응답에는 실행 commit·dist 해시·프로세스 시작 정보가 없으므로 그 기준을 새로 증명하지 않는다. exactSourceToBuildProven=false 및 정확한 실행 commit 미확인을 유지한다.

기존 E1의 filePermissions.read/write=true, scope=file-tools와 shell/processes/persistentProcesses=false를 별도로 취급한다. recovery는 memory, restartPersistent=false, automaticRetry=false, atomicFileAndJournal=false라는 앞선 응답이다. M2c versioned read 동작 보고는 확보했지만 새 실계정 edit_file/apply_patch mutation, stale hash 거부, replay 검증은 아직 아니다.

## 다음 D 범위 — 승인 전 실행하지 않음
기존 calculator.mjs에 같은 패치를 다시 적용하거나 버그로 되돌리지 않는다. 기존 E1 root에 새 검사용 파일을 추가하는 것도 하지 않는다. 기존 E1 helper의 파일 집합/기준 검사를 훼손할 수 있기 때문이다.

제안하는 별도 검증 범위는 기존 E1 밖의 새 전용 디렉터리·프로필·런타임 상태와 무비밀 텍스트 샘플 2개(probe.txt 편집 대상, reference.txt 불변)다. 실과제 저장소/비밀 파일은 포함하지 않는다. versioned read → expectedSha256/operationId 편집 → 재읽기 → 동일 ID/동일 payload의 과거 영수증 → 별도 ID와 오래된 해시의 변경 거부를 수용 기준으로 삼는다. 불변 참조 파일 및 작업 파일 집합도 전후 대조한다.

새 샘플을 같은 제3자 공개 중계로 연결하면 샘플 내용·요청·응답의 새 노출과 별도 등록/앱이 필요할 수 있다. 기존 E1 앱/URL/설정은 바꾸지 않고 공개 노출 범위에 대한 구체적 승인을 받은 뒤에만 준비·등록·실계정 mutation으로 진행한다. 이 문서화는 승인이나 실행 완료가 아니다. 현재 승인된 별도 대화 역할은 읽기 점검까지이며 자동으로 쓰기 작업에 확대하지 않는다. D에도 메모리 모드의 한계를 적용하고 재시작 내구성 보장은 C와 구분한다.

## A — 감사 수집·식별 완료, 수정 미실행
앞선 사용자 감사는 R2, Node v23.11.0, npm 11.4.2, lock SHA-256 8185650314a8799924768a54193de71332d3a5c1037a87d58b4e08ba5442b1d4 기준이다. validAuditReport=true, npm exitCode=1, wrapper PHASE_EXIT=0, high=3, projectUnchanged=true였다. 새 감사 실행이나 새로운 환경 측정으로 재표기하지 않는다.

| 패키지 | 당시 설치/lock 버전 | 보고 관계 |
|---|---|---|
| wrangler | 4.129.0 | 직접 dev 의존성, miniflare 전파 경고 |
| miniflare | 5.20260903.0-alpha | 간접 dev 의존성, sharp 0.35.2 고정 경로 |
| sharp | 0.35.2 | GHSA-rgj7-g3m4-5g8c, 보고 영향 범위 <0.35.4 |

위 경로는 이전 원격 lock 대조와 일치한다. 세 패키지 경고를 독립 advisory 3개로 세지 않는다. dev 표시만으로 안전/도달 불가능을 판정하지 않는다. 정확한 업그레이드 조합, 실제 native 이미지 처리 도달 가능성과 수정 후 회귀는 미검증이다. audit fix·override·설치·lockfile 수정은 하지 않았다. [감사 및 이전 조사 근거](validation/m2c-audit-reconnect-user-report.json)

## B — 실제 Docker 미실행
이전 PATH 및 지정 설치 위치의 후보 목록은 비어 있었고 daemon에 접속하지 않았다. 시스템 전체 미설치로 단정하지 않지만 현재 알려진 허용 실행 경로는 없다. Docker 설치·새 이미지 다운로드·원격 context·비용 변경은 구체적 승인 없이 수행하지 않는다. 파일-only E1과 독립 C 통과는 Docker 검사 권한이나 성공이 아니다.

## C — 실제 SDK의 한정된 수명주기 통과 유지
사용자 출력은 sdkLoaded=true, sdkVersion=1.30.0, C_SCOPED_LIFECYCLE_OK, passedChecks=18, cleanupConfirmed=true, cleanupErrors=[], projectUnchanged=true, PHASE_EXIT=0으로 사전 기준을 충족했다. [C 실행 기록](validation/m2c-scoped-lifecycle-user-report.json)

stdio 및 loopback HTTP 각각 9개 점검은 미초기화 시작 거부, create-only/중복 초기화 거부, 실제 workspace/스키마, guarded edit/stale hash 거부, 별도 PID 재시작과 historical receipt, 실제 watcher 권한 회수와 cached replay 거부, 권한 복원, 부적합 reload 전체 거부, 검사용 서버 종료다. 이전 합성 SDK/서버 대역 검사와 합산하지 않는다.

검사는 R2 HEAD/clean/lock/dist manifest 사전 guard와 전후 snapshot 대조를 포함했다. projectUnchanged는 Git HEAD/status, package.json, lockfile, dist manifest 범위이며 node_modules 전수 바이트 증명이 아니다. cleanupConfirmed는 검사용 서버 종료이고 임시 fixture/기록소/보고서 삭제가 아니다. HTTP 종료 fallback 사용 여부는 별도 로그에 없으며 의도적 crash 주입 검사도 아니다.

실제 apply_patch 변경·재시작 replay, 의도적 SIGKILL·전원 장애, 교차 프로세스 동시 잠금, 수동 복구, 모든 agent/relay 수명주기, Docker, 새 실계정 guarded edit, source-to-build 재현성은 통과에 포함하지 않는다. existingE1Accessed/publicRelayUsed/dockerUsed/packagesInstalled/buildRun=false, exactSourceToBuildProven=false를 유지한다.

## 기존 이력·종료 규칙
M1·M2a·M2b 구현, 이전 E0/파일-only E1의 사용자 근거, M2C_LOCAL_CHECKS_OK, IG-04 코드 50cad2d/통합 8dd7876의 원격 반영과 이전 소스 blob 대조는 유지한다. 이전 335/336은 수정 전 이력이며 현재 실패로 되돌리지 않는다. 교차 프로세스 다른 ID 잠금, 수동 복구, 다중 파일, 프로세스 복구, 실과제 성능과 CI 한도 관문은 미완료다.

[이전 진행표 전체](https://github.com/dearcloud09/localmcp/blob/bb92ca9bbd3c9fb8b9a985ea70b4ebccef3756c6/docs/progress.md) · [최소 검사](validation/m2c-local-checks-user-report.json) · [원격 반영](validation/m2c-publication-readback.json) · [별도 대화 연결](validation/m2c-separate-chat-workspace-user-report.json) · [주 대화 거부](validation/m2c-chat-host-forbidden-observation.json)

이번 변경은 onepager·progress·새 versioned-read 보고 JSON이며 과거 JSON은 수정하지 않는다. 제품 코드/테스트·기존 E1·설정·권한·의존성·main·배포·과금 변경은 없다. 성공한 workspace/read·감사·재기동·C/최소 검사를 새 근거 없이 반복하지 않는다. 문서 commit은 [skip ci]이며 CI 성공을 주장하지 않는다. 문서 최신화 때문에 R2 pull·재빌드를 요구하지 않는다.
