# 챗 개발 시작 관문과 호스트 차단 검토

기준일: 2026-09-21. 소스 검토 기준: `248f4edac3343c832e8d0967af853a6a14d7f49e`.

## 이번에 완료한 것

원격 PR HEAD와 파일 도구 정의, 공통 등록기, registry의 tools/list, MCP 응답 연결 경로를 읽었다. ChatGPT의 LocalMCP-D 승인 설정도 읽었다. LocalMCP 호출, 차단 편집 재시도, 앱·서버 재시작, 권한 변경, 설치, 실제 프로젝트 공개 연결은 하지 않았다. 지원 요청 초안을 만들었지만 제출하지 않았다.

확인한 원격 소스 blob:
- src/modules/files.ts: `9ac98604a58e45a0afece19a08e393967a5ddaa9`.
- src/modules/define.ts: `24fc7af06c82b7956d32700460ce83d095fea648`.
- src/core/registry.ts: `7f06b3ae57f8f6c6e287de4b6a173d85b6b74a8c`.
- src/server.ts: `ebc338fed7526782d4e7b585cc6b80e862bb06ea`.

files.ts에서 edit_file은 readOnly=false다. define.ts는 readOnlyHint=false, destructiveHint=true, openWorldHint=false를 만든다. registry는 annotations를 descriptor에 보존하고 list에서 반환하며, server.ts가 이 목록을 MCP tools/list 응답으로 연결한다. 따라서 이 소스 경로에는 세 annotation 누락이 없다. 이것은 정적 소스 확인이며 차단 당시 서버의 실제 tools/list 원문, 호스트의 저장된 snapshot, 정확한 실행 commit을 확인한 결과가 아니다. idempotentHint는 이 등록기에서 제공하지 않으며 공식 reference에서는 선택 항목이다.

LocalMCP-D의 현재 ChatGPT 승인 설정 조회 결과는 found, global=Allow low-risk actions, app=Use my default다. 이 조회는 계정 요금제·조직 RBAC·대화 지원 여부나 차단 원인을 반환하지 않는다. 과거 차단 시점의 설정과 반드시 같다는 증거도 아니다. 아무 설정도 바꾸지 않았다.

## 차단에 대한 판정

기존 D 보고의 읽기 4회 성공과 최초 edit_file 안전 차단, 이후 로컬 before 확인·D 전용 agent 종료를 유지한다. 호스트의 정확한 차단 규칙, 요청의 서버 도달 여부, 계정별 쓰기 지원은 미확인이다. 현재 판정은 `blocked_pending_host_review`이며 새로운 편집 성공을 주장하지 않는다.

파일 내용을 덮어쓰는 edit_file을 readOnlyHint=true 또는 destructiveHint=false로 바꾸는 수정은 하지 않는다. openWorldHint=false는 한정된 workspace 파일 작업에 관한 표시이지 서버의 인터넷 호스팅 여부만으로 정하는 값이 아니다. annotation은 권한을 부여하지 않으며 안전 차단 해제의 보장도 아니다.

2026-09-21 확인한 공식 자료에는 지원 범위 설명이 일치하지 않는 부분이 있다. Developer mode 가이드는 read/write MCP와 Pro·Plus 등을 지원 대상으로 안내한다. Help Center의 Pro 관련 FAQ는 Pro를 read/fetch로 제한한다고 설명한다. 어느 쪽으로 사용자의 실제 entitlement를 확정하지 않으며, 요금제 변경을 처방하지 않는다. 같은 Help Center는 위험한 동작이 승인 질문 대신 차단될 수 있다고 설명하지만 이것이 본 건의 구체적 판정 사유인지는 알려주지 않는다.

공식 지원 검토에는 정확한 오류, 기존 호출 순서, 제한된 파일·실행 권한, 최종 before/종료 상태, 정적 annotation 검토, 위 문서 불일치를 함께 전달한다. 계정 요금제, 개인/조직 workspace, 당시 모델·모드, 기존 오류 발생 시각·시간대, 승인 창 표시 여부, 기존 화면에 보이는 request ID는 사용자가 아는 범위만 보완한다. 없는 값은 미확인으로 둔다. 요청 ID나 HAR를 얻으려고 차단 요청을 다시 실행하지 않는다. 자격증명·접속 URL·원시 환경변수는 제출 자료에 넣지 않는다.

## 첫 실사용 범위 — 준비안, 아직 생성·연결하지 않음

최초 작업 대상은 현재 과제인 LocalMCP 저장소의 별도 작업 사본으로 잡는다. R1/R2·기존 E1/D·이전 증거는 그대로 둔다. 호스트 지원 검토가 끝나고 작업 대상·전송 경로·노출 범위가 승인되기 전에는 새로운 쓰기 연결을 시작하지 않는다.

| 항목 | 준비 기준 |
|---|---|
| 코드 기준 | 시작 시 원격 HEAD를 읽고 검증된 manifest·소스 기준과 대조. 현재 기준은 248f4ed이며 이 문서만의 갱신 때문에 설치/빌드를 반복하지 않음 |
| workspace | 비밀정보를 제외한 명시적 파일 집합으로 만든 단일 분리 사본. 실제 위치·파일 목록은 생성 전에 확정 |
| 연결 시작 | files=true, fileRead=true, fileWrite=false. shell/processes=false, skills/mcpServers/checks 비활성. 정확한 설정 형식은 기존 설정 계약에 따름 |
| 쓰기 확대 | 지원·승인 조건이 확인된 뒤에만 별도 승인. 호스트의 정상 승인 흐름과 현재 파일 해시를 확인하며 기존 차단 요청을 재전송하는 절차는 아님 |
| 검사 실행 | 첫 파일-only 사용에서는 운영자 터미널. 챗 안의 run_check는 실제 Docker B와 프로젝트 검사 정의·실계정 호출 확인을 추가한 뒤 사용 |
| 종료·반영 | 변경 파일·최종 내용·검사 결과를 확인. 원본 설치환경 갱신·main 병합·배포는 별도 |

현재 fileWrite는 edit_file만 켜는 권한이 아니다. [파일 권한 계약](m2b-file-permissions.ko.md)과 files.ts에 따라 write_file/edit_file/apply_patch/create_directory/delete_path/move_path 6종이 같은 쓰기 권한을 요구한다. 이 권한은 등록된 workspace 전체에 적용한다. 프롬프트나 UI에서 도구를 감추는 것만으로 서버의 per-tool/per-path 강제 제한이 생긴다고 하지 않는다. 이 단계에서 새로운 권한 기능을 개발하지는 않는다.

기존 제3자 공개 샘플 중계로 실제 프로젝트를 확대하지 않는다. 공식 Secure MCP Tunnel은 private stdio/HTTP 서버를 공개 listener 없이 연결하는 전송 후보다. 단, Platform tunnel 권한·runtime API key·tunnel-client와 workspace 연결 조건이 별도로 필요하다. 사용자 계정의 이용 가능 여부·비용 조건은 미확인이고, 키 생성·다운로드·설치·터널 생성·앱 연결은 하지 않았다. 이 후보는 전송 노출 범위 검토이며 D의 호스트 안전 차단을 우회하거나 해제하는 방법이 아니다.

## 시작 완료 기준

파일 편집 사용의 관문은 (1) 호스트 지원·승인 경계 확인, (2) 승인된 단일 작업 사본과 신뢰한 연결, (3) 실제 읽기·허용된 편집·재읽기 확인이다. Docker나 모든 복구/플랫폼 검증을 파일-only 시작의 일괄 선행 조건으로 만들지 않는다. 챗 안의 테스트 실행까지 요구하면 B와 실제 run_check 왕복은 추가 관문이다. B의 컨테이너 검사와 Linux 의존성 호환성은 서로 다른 검사다.

A의 검증·작업 브랜치 manifest 반영, 기존 E1 읽기, C의 한정된 18개 검사는 유지한다. D는 blocked·전용 agent 종료 상태를 유지한다. 이번 검토는 기존 성공 검사나 게시를 반복할 이유가 아니다.

## 공개 1차 자료

- https://developers.openai.com/api/docs/guides/developer-mode
- https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt
- https://developers.openai.com/plugins/reference
- https://developers.openai.com/plugins/plan/tools
- https://help.openai.com/en/articles/6614161-how-can-i-contact-support
- https://developers.openai.com/api/docs/guides/secure-mcp-tunnels

개인 절대경로·신원·계정 ID·토큰·MCP 접속 URL·원시 로그를 이 문서에 넣지 않는다. 문서 날짜는 검토일이지 과거 오류의 발생 시각이 아니다.
