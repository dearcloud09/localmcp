# LocalMCP 모듈형 코딩 실행환경 — 1pager

갱신: 2026-09-20 · `dearcloud09/localmcp` · `feat/m1-modular-runtime` · [진행표](progress.md)

## 현재 판단 — D의 최초 편집이 호스트 안전 검사에서 차단됨
**D: blocked — 별도 대화의 사용자 전달 보고. 전체 프로젝트: verification_pending.** LocalMCP-D의 workspace_info·파일 목록·참조 읽기·probe 읽기 4회는 성공했다고 보고됐다. 5번째 edit_file 요청은 “OpenAI의 안전 검사에서 이 도구 요청을 차단했습니다.”로 차단됐고, 이후 6–12번 호출과 다른 도구/ID 재시도는 수행하지 않았다고 보고됐다. [이번 근거](validation/m2c-d-host-safety-block-user-report.json)

최초 편집 영수증과 replayed=false는 없으며 replay·stale-hash 검사는 미실행이다. D_CHAT_GUARDED_EDIT_OK는 성립하지 않는다. 서버 도달 여부·최종 파일 상태·호스트의 세부 차단 규칙은 독립 확인하지 않았으므로 “변경 없음”이나 “서버의 해시 보호 실패”로 단정하지 않는다. 이전 502 및 주 담당 대화의 FORBIDDEN과도 구분한다.

## 확인한 범위
사용자는 D root/profile 대응, project/defaultWorkspace, 파일 읽기·쓰기 및 file-tools 범위, shell/processes/persistentProcesses=false, skills/mcpServers/availableChecks=[]를 확인했다고 보고했다. memory recovery와 restartPersistent/automaticRetry/atomicFileAndJournal=false 및 M2c 읽기/편집 입력 정의도 보고됐다.

초기 파일 집합은 probe.txt와 reference.txt다. 전달된 LF 포함 내용의 SHA-256을 재계산해 probe 13바이트와 reference 66바이트의 보고값이 각각 일치함을 확인했다. 이는 초기 데이터의 내부 일치 검사이지 원시 MCP transcript·맥 파일의 독립 관측이나 차단 뒤 상태 증명이 아니다. 공개 기록에는 세션 UUID·작업 ID 원문·개인 경로·접속 URL을 넣지 않는다.

## 다음 행동 — 편집 재시도가 아닌 D 종료
기존 d-session.mjs의 바이트와 SHA-256 `16da8fc1721e5c4d7cbe712d5979175b8192a832909075fef6aaf56a561cc072`를 다시 확인했다. status는 D 신원과 현재 샘플 상태를 읽고, stop은 D 전용 제어 소켓·등록·launch 기록을 대조해 해당 에이전트만 종료한다. 이 두 동작은 MCP 편집을 대신하지 않는다. 기존 check는 state=after를 요구하므로 이번 차단 건에는 실행하지 않는다.

status 실패가 편집·초기화 허가는 아니다. stop은 자체 대상 검증을 통과한 경우에만 실행하며, 종료 성공은 아직 미수신이다. 파일·증거·원격 등록·앱은 보존한다. 다른 ID/도구/대화·직접 HTTP·로컬 파일 수정, 승인 설정 완화, 서버 재기동으로 차단 요청을 반복하지 않는다. 차단 검토는 공식 지원 경로로 분리한다.

## 관문별 상태
| 관문 | 현재 상태 | 남은 작업 |
|---|---|---|
| A / DEP-01 | 감사 수집·패키지/advisory·의존 경로 식별 완료 | high 3개 수정 및 수정 후 감사·영향 검증 미실행 |
| 기존 E1 연결·읽기 | 별도 대화의 사용자 근거 기준 pass | 기존 샘플 보존, 동일 검사 반복 없음 |
| B / E0-D | 알려진 Docker CLI 경로 없음 | 실제 Docker 미실행. 설치·이미지 다운로드는 별도 승인 |
| C / 영속 lifecycle | SDK 1.30.0, 두 전송 18개 사용자 실행 근거 기준 pass | 열거한 범위 완료. D 차단이 C 결과를 취소하지 않음 |
| D / 새 실계정 guarded edit | 읽기 4회 성공 보고, 최초 편집 호스트 차단 | mutation/replay/stale/최종 상태 미검증. D 종료 확인 대기 |

## 후보·기록·변경 경계
앞선 R2 소스 기준은 `8dd7876192c1290d7d18bd70cc9b6d264aca34c4`, dist manifest는 `d093a515eca545d75117ae7b9fb363445502dcfd03c48b7c902ffedd58c7f637`다. 이번에는 프로세스·빌드 기준을 새로 확인하지 않았고 exactSourceToBuildProven=false를 유지한다.

이번 변경은 문서와 새 차단 보고뿐이다. 제품 소스·테스트·의존성·이전 증거 JSON·기존 E1·설정·권한·main·배포·비용은 변경하지 않았다. 주 담당 세션의 LocalMCP 호출은 0회다. PR Draft와 MIT 고지를 유지하며 문서 때문에 R2 pull·재빌드·성공한 검사를 반복하지 않는다.

[D 승인·준비](validation/m2c-d-authorization-preparation.json) · [기존 읽기](validation/m2c-versioned-read-user-report.json) · [C 통과](validation/m2c-scoped-lifecycle-user-report.json) · [감사·재기동](validation/m2c-audit-reconnect-user-report.json) · [직전 1pager](https://github.com/dearcloud09/localmcp/blob/a98e8470aefabb8713c828c96bd5d5b28ad85052/docs/onepager.ko.md)
