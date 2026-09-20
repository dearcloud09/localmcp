# 실행 진행표

갱신: 2026-09-20 · [1pager](onepager.ko.md) · `feat/m1-modular-runtime` · PR #1 Draft.

## 현재 판정
**D: blocked — 최초 edit_file 요청의 호스트 안전 차단 사용자 보고. 전체 프로젝트: verification_pending.** 기존 E1 연결·읽기와 C의 한정된 수명주기 pass는 유지한다. D 읽기 성공을 guarded edit 성공으로 확대하지 않는다. [이번 차단 보고](validation/m2c-d-host-safety-block-user-report.json)

## D — 실제 진행 보고와 중단
### 근거의 출처
사용자가 별도 대화의 실행 요약을 전달했다. 주 담당은 원시 도구 transcript·호스트 오류 payload·맥 파일을 직접 받지 않았다. 사용자 보고와 제공했던 ZIP의 실제 코드, 전달된 텍스트·해시·길이의 재계산을 구분한다. 이번 주 담당의 LocalMCP 호출·맥 명령·mutation·서버 조작은 모두 0회다.

| 단계 | 보고된 결과 | 판정 범위 |
|---|---|---|
| 1 workspace_info | D root/profile, project/defaultWorkspace, 파일 전용 권한 및 memory 정보 확인 | 정상 조회 성공 보고 |
| 2 list_directory | probe.txt와 reference.txt 두 항목 | 초기 보이는 파일 집합 |
| 3 reference versioned read | 지정 형식, 66바이트와 SHA-256 반환 | 초기 참조 읽기 |
| 4 probe versioned read | state=before와 끝 LF, 13바이트와 H0 반환 | 초기 probe 읽기 |
| 5 edit_file 시도 | 호스트 안전 검사 차단 | 편집 영수증 없음, replayed=false 미수신 |
| 6–12 | 미실행 | 재읽기·replay·stale-hash·최종 참조/목록 비교 미검증 |

성공 호출 4회, 차단된 시도 1회다. 성공 경로 12회 완료나 최초 mutation 성공으로 세지 않는다. LocalMCP-E1은 사용하지 않았고 차단 뒤 추가 호출·다른 ID/도구 재시도는 없었다는 사용자 보고다.

### 권한·데이터의 확인 범위
workspace/defaultWorkspace는 project, files/read/write=true와 scope=file-tools다. shell/processes/persistentProcesses=false, skills/mcpServers/availableChecks=[]를 보고했다. mutationRecovery는 memory, restartPersistent/automaticRetry/atomicFileAndJournal=false다. read_file.includeVersion과 edit_file.expectedSha256/operationId 입력 정의도 확인했다고 보고됐다. 이 허용 보고는 별도 호스트 안전 판정의 통과를 보장하지 않는다.

초기 probe의 H0는 `95676c6c9cade5d14a4c9aba288b55b3018e0d86d2fca5fb589364eab07a1787`, 13바이트다. 초기 reference SHA-256은 `778d6236ff586381966db8ac01f9ffa1696256c18aef4b0725c9550461506731`, 66바이트다. 전달된 세션 UUID가 들어간 reference 및 probe를 끝 LF 포함 UTF-8로 재구성해 두 길이·해시가 모두 일치함을 계산했다. UUID·reference 원문·개인 경로는 공개 기록에서 제외한다. 이 계산은 초기 전달 데이터의 내부 일치만 확인하며 최종 상태를 증명하지 않는다.

요청은 probe.txt에서 state=before와 LF를 state=after와 LF로 바꾸고 H0 및 d-<세션 UUID>-edit를 사용하는 edit_file이었다. 작업 ID 형식은 적합하지만, 서버가 실제 입력을 받아 검증했다고 주장하지 않는다.

### 차단과 불확실성
전달된 오류 문구는 “OpenAI의 안전 검사에서 이 도구 요청을 차단했습니다.”다. 별도 기계 오류 코드는 제공되지 않았다. 최초 편집 영수증·replayed 값이 없고 최종 probe/reference/목록의 사후 관측도 없으므로 성공 또는 변경 없음 모두 확정하지 않는다. 요청의 서버 도달 여부, 구체적인 호스트 규칙 및 오탐 여부도 독립 확인하지 않았다.

이는 9번 단계에서 기대한 FILE_VERSION_CONFLICT가 아니다. 해시 보호 동작 검사는 아직 도달하지 않았으므로 LocalMCP의 guard 실패로 분류하지 않는다. 이전 502·주 담당 대화의 FORBIDDEN·이번 호스트 안전 차단은 별도 관측이다. D_CHAT_GUARDED_EDIT_OK 및 D_LOCAL_STATE_OK는 성립하지 않는다.

## 안전한 종료 — 원본 도구의 status / stop만 사용
기존 ZIP의 d-session.mjs SHA-256 `16da8fc1721e5c4d7cbe712d5979175b8192a832909075fef6aaf56a561cc072`를 다시 계산해 일치함을 확인했다. 파일을 수정하거나 새로운 mutation 경로를 만들지 않았다.

status는 D session/profile/launch/등록 및 제어 상태를 대조하고 sampleState를 before/after로 요약한다. 샘플·기록을 편집하거나 서버를 시작하지 않는다. 실패는 미확인으로 남기고 그 결과를 맞추기 위해 파일을 바꾸지 않는다. 기존 check는 GREEN(state=after) 상태를 요구하므로 차단 건의 일반 사후 검사로 사용하지 않는다.

stop은 D 전용 base·상태 디렉터리·launch 기록·제어 응답의 config/log/등록을 검증한 뒤 해당 D 제어 소켓에 stop만 보낸다. 현재 샘플이나 저장소를 수정할 필요가 없다. 상태 확인 실패 뒤에도 stop은 자체 대상 검증을 따로 수행하지만, 이 검증을 통과하지 못하면 범용 kill이나 경로 변경으로 우회하지 않는다.

D_STOPPED는 D 종료 확인일 뿐 guarded-edit 성공이 아니다. 샘플·증거·원격 등록·ChatGPT 앱은 삭제하지 않는다. status/stop의 실제 실행 및 종료 확인은 아직 미수신이다. 주 담당이 이미 맥 서버를 종료했다고 표시하지 않는다.

이번 차단 요청을 다른 ID·tool·대화·직접 HTTP·로컬 파일 수정으로 대신 수행하지 않는다. 승인 설정 완화·재등록·setup 반복·재빌드/재시작을 차단 해결책으로 안내하지 않는다. 재시도 대신 기존 오류·발생 시각·동작 범위를 비밀정보 없이 공식 지원에 전달해 검토받는 경로로 분리한다. 차단 원인 해소나 재실행 허가를 이 기록이 제공하지 않는다.

## 유지되는 A·B·C와 기존 연결 근거
A는 실제 감사 사용자 보고에서 high 3개와 wrangler→miniflare→sharp 경로를 식별한 상태다. 의존성 수정·새 설치·audit fix·overrides·lock 변경·수정 후 감사는 미실행이다. 이번 D 차단을 해당 취약점의 증상으로 추정하지 않는다. [A 근거](validation/m2c-audit-reconnect-user-report.json)

B는 PATH/지정 설치 위치에서 알려진 Docker CLI가 없어 실제 E0-D를 실행하지 못했다. 시스템 전체 미설치로 단정하지 않고 설치·이미지 다운로드는 별도 승인으로 남긴다.

C는 실제 SDK 1.30.0, stdio 9개와 loopback HTTP 9개, cleanupConfirmed/projectUnchanged=true 및 PHASE_EXIT=0을 받은 열거된 범위의 pass다. 이번 실계정 호스트 차단이 그 별도 서버 검사를 취소하지 않는다. C도 모든 crash/전원 장애·apply_patch 실행·동시 프로세스 잠금·agent/relay·Docker 보장은 아니다. [C 근거](validation/m2c-scoped-lifecycle-user-report.json)

기존 E1의 별도 대화 연결과 versioned read는 사용자 근거 기준 pass다. 기존 샘플이나 성공 증거를 새 검증용으로 초기화·편집하지 않는다. [기존 읽기](validation/m2c-versioned-read-user-report.json)

## 후보·기록·변경 경계
앞선 후보는 R2 HEAD `8dd7876192c1290d7d18bd70cc9b6d264aca34c4`, dist manifest `d093a515eca545d75117ae7b9fb363445502dcfd03c48b7c902ffedd58c7f637`다. 이번 D 보고에는 새 D_setup JSON/manifest·프로세스 provenance가 없어 정확한 실행 빌드 증명을 추가하지 않는다. exactSourceToBuildProven=false를 유지한다.

새 문서와 차단 보고 JSON만 갱신한다. 이전 D 승인·준비 JSON과 과거 성공/실패 근거를 수정하지 않는다. 제품 소스·테스트·의존성·기존 E1·설정·권한·main·배포·비용 변경 없음. PR Draft 및 [skip ci] 문서 커밋으로 유지하며 CI 성공을 주장하지 않는다. 문서 갱신 때문에 R2 pull·재빌드·감사/C/기존 E1 검사 반복을 요구하지 않는다.

[이전 D 승인·준비](validation/m2c-d-authorization-preparation.json) · [직전 상세 진행표](https://github.com/dearcloud09/localmcp/blob/a98e8470aefabb8713c828c96bd5d5b28ad85052/docs/progress.md) · [최소 검사 보고](validation/m2c-local-checks-user-report.json) · [원격 코드 반영](validation/m2c-publication-readback.json). 미완료 기능을 이번에 추가하지 않는다.
