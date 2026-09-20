# 실행 진행표

갱신: 2026-09-20 · [1pager](onepager.ko.md) · `feat/m1-modular-runtime` · PR #1 Draft.

## 현재 판정
**전체 프로젝트: verification_pending.** 기존 E1의 별도 대화 연결·버전 포함 읽기와 C의 한정된 수명주기는 사용자 실행 근거 기준 pass다. 이번에는 별도 D 샘플·중계 등록·앱·guarded edit의 구체적 승인을 받았고 실행 패키지를 준비했다. 승인·준비를 실제 등록/기동/도구 호출 성공으로 바꾸지 않는다.

## D — 승인된 범위와 실행 패키지
사용자는 기존 E1 밖의 새 디렉터리·프로필·런타임 상태에서 probe.txt와 reference.txt 두 무비밀 텍스트 파일만 사용하는 서버, 기존 제3자 공개 중계의 별도 등록, 별도 앱 연결과 guarded-edit 검증을 승인했다. 기존 E1 앱/URL/profile/sample/evidence는 변경하지 않는다. 실제 프로젝트·셸·하위 MCP·Docker·새 설치·계정/비용 변경·main 병합·배포 승인이 아니다. [준비 기록](validation/m2c-d-authorization-preparation.json)

### 실제 준비와 소스 확인
원격 시작 HEAD는 cc86a388565e8d474b70a7fc0b3c3a9d7364f709였다. R2의 고정 ref에서 src/agent.ts, src/lifecycle.ts, src/core/mutation-coordinator.ts, src/workspace.ts를 읽었다. 별도 HOME의 lifecycle start가 새 worker 등록 및 agent/HTTP 자식을 지원하며, FILE_VERSION_CONFLICT와 replay receipt의 의미를 확인했다. 기존 e1-session prepare/start나 버그 복원을 사용하지 않는다.

운영자 패키지 d-session.mjs는 채팅 산출물이다. 제품 소스/테스트 업로드나 과거 차단된 소스 재전송이 아니다. SHA-256은 `16da8fc1721e5c4d7cbe712d5979175b8192a832909075fef6aaf56a561cc072`다. 기존 라이프사이클 구현을 호출하며 새 서버 구현이나 서비스 설치는 포함하지 않는다.

### setup / status / copy-url / check / stop
setup은 R2 HEAD 8dd7876192c1290d7d18bd70cc9b6d264aca34c4, clean 상태, lock SHA-256 8185650314a8799924768a54193de71332d3a5c1037a87d58b4e08ba5442b1d4, dist manifest d093a515eca545d75117ae7b9fb363445502dcfd03c48b7c902ffedd58c7f637를 요구한다. 다르면 pull/설치/빌드로 덮지 않고 중단한다.

D 전용 base는 create-only다. workspace에는 probe.txt 초기값 state=before와 LF, reference.txt에는 무비밀 세션 UUID를 담는다. profile·session·launch intent·등록·연결·증거는 workspace 밖에 둔다. 파일 읽기/쓰기는 허용하지만 shell/processes/skills/mcpServers/checks는 비활성·비어 있다. memory recovery를 사용한다. 기존 E1 경로에는 접근하지 않는다.

실제 setup은 파일 생성과 별도 lifecycle start, 새 공개 중계 등록/연결, PID/socket/log/connection 쓰기가 있으므로 읽기 전용이 아니다. 출력을 캡처하고 URL을 pbcopy의 표준입력으로만 전달한다. 클립보드에는 자격증명이 들어가므로 앱 URL 입력칸 외에는 붙여넣지 않는다. 실패하면 원시 stderr나 URL 대신 안전한 단계·오류 코드를 반환한다.

중복 setup, 예상과 다른 프로필/등록/참조/파일 집합, 후보 변경은 fail-closed다. start 결과가 불명확하면 자동 재시도하지 않는다. 기존 lifecycle의 실패 처리에는 자기가 시작한 자식 종료가 있을 수 있다. 성공한 D_READY는 서버 상태·등록/경로 대조 및 후보 불변 근거이지 MCP 호출이나 실계정 편집 성공이 아니다.

status/copy-url은 D 제어 상태와 기존 등록을 대조하며 서버를 시작하지 않는다. check는 최종 probe 및 불변 reference/파일 집합/profile, 동일 agent PID, 후보 snapshot을 검사하고 별도 evidence JSON을 남긴다. 이것만으로 편집 주체·replay·stale 거부를 증명하지 않는다. 동일 agent PID도 내부 자식이 절대 교체되지 않았다는 증명은 아니다.

stop은 D 제어 소켓의 config/log/등록과 launch 기록을 대조해 그 D agent에만 stop을 보낸다. setup 실패 후 launch.json이 없어도 해당 D launch intent와 소켓/등록을 확인할 수 있는 경우에만 종료한다. PID 추정·범용 kill·기존 E1 제어를 하지 않는다. 샘플·증거·원격 등록·앱은 삭제하지 않는다.

### 실계정 수용 기준
D-chat-request.txt는 허용된 일반 웹 대화에서 새 LocalMCP-D 앱만 사용한다. 주 담당 대화의 FORBIDDEN을 직접 URL/다른 도구로 우회하지 않는다. 첫 호출은 workspace_info이며 D의 root/profile과 파일-only/memory 조건을 확인한다.

성공 경로 12회 호출: workspace_info → 목록 → reference versioned read → probe versioned read → guarded edit → probe 재읽기 → 동일 인자의 replay → probe 재읽기 → 별도 ID/옛 해시 편집의 FILE_VERSION_CONFLICT → probe 재읽기 → reference 재읽기 → 목록 대조다. 실제 내용 변경은 최초 edit 한 번뿐이다. replay는 성공 확인된 요청의 의도적 중복 검사이며, 오류/timeout 재시도 허가가 아니다.

FILE_VERSION_CONFLICT가 아닌 오류·FORBIDDEN·502·timeout은 즉시 중단한다. 올바른 현재 oldText와 다른 operationId를 사용해 stale-hash 자체를 검사한다. reference 내용이나 보이는 파일 목록만으로 숨은 링크까지 증명하지 않고, 로컬 check의 원시 파일 집합 검사와 결합한다. 토큰/URL/개인 경로·원시 로그는 공유하지 않는다.

D_CHAT_GUARDED_EDIT_OK와 같은 세션 UUID의 D_LOCAL_STATE_OK를 결합하고 D_STOPPED는 별도 정리 상태로 기록한다. 파일 결과만으로 실제 모델의 편집/replay/거부를 증명하지 않는다. 이번 D는 memory/edit_file 한정이며 apply_patch·재시작 지속성·source-to-build 재현성·전체 agent/relay 수명주기 보장이 아니다.

### 이번 자체 검사와 아직 하지 않은 것
Linux/Node v22.16.0에서 합성 lifecycle controller/agent와 clipboard 대역을 사용했다. 실제 로컬 Unix socket을 사용했지만 MCP·공개 네트워크는 호출하지 않았다. 17개 동작 조건과 14회 비밀 출력 canary 확인이 통과했다. 테스트 사본만 합성 checkout의 platform/head/lock/dist/clipboard 상수로 바꿨고, 별도 검사는 배포본 후보 상수를 유지해 거부를 확인했다.

동작 점검은 create-only, 두 파일 범위, 등록 URL 출력 차단/clipboard, 초기 상태의 최종 검사 거부, 최종 상태 확인과 편집 주체 미증명 표시, reference/파일 추가/profile 변조 거부, 중복 setup 거부, disconnected 상태의 D만 종료, 시작 불확실성 및 안전한 종료, 기존 디렉터리 alias 거부를 포함한다. 대역의 canary 성공을 모든 비밀유출 부재의 증명으로 확대하지 않는다.

맥 setup, 실제 중계 등록·기동, 앱 생성, 실계정 mutation, 로컬 최종 검사·종료는 아직 수행하지 않았다. 앱 관리 도구에는 사용자 지정 MCP URL 등록 action이 없고 LocalMCP 검색도 비어 있어 앱 등록은 운영자 UI 단계로 남긴다. 기존 원격 Git 읽기/기록은 이 주 담당 세션이 관리한다.

## 유지되는 A·B·C 및 연결 근거
A는 R2의 실제 npm 감사 사용자 보고에서 high 3개를 확보하고 wrangler 4.129.0 → miniflare 5.20260903.0-alpha → sharp 0.35.2의 lock 경로와 advisory를 식별했다. 수정·새 설치·audit fix·overrides·lock 변경 및 수정 후 감사는 미실행이다. 이를 이번 D 준비에서 반복하지 않았다. [A 기록](validation/m2c-audit-reconnect-user-report.json)

B는 PATH/지정 설치 위치에서 알려진 Docker CLI가 없어서 실제 E0-D 미실행이다. 시스템 전체 미설치로 확정하지 않고 설치·이미지 다운로드는 별도 승인으로 남긴다.

C는 SDK 1.30.0의 stdio 9개와 loopback HTTP 9개, 총 18개 점검 사용자 보고, cleanupConfirmed/projectUnchanged=true, PHASE_EXIT=0으로 한정된 pass다. 의도적 crash·전원 장애·교차 프로세스 동시 잠금·apply_patch 실행·모든 agent/relay 수명주기·Docker·실계정 편집으로 확대하지 않는다. [C 기록](validation/m2c-scoped-lifecycle-user-report.json)

기존 E1의 별도 대화 workspace_info 1회와 versioned read 1회는 사용자 전달 근거로 pass다. 44바이트 수정 완료 코드와 SHA-256 76f26bd292166033d02e77bdb8fe6aec01e915ccb8cb3f93b8971f9dcd78250e를 재계산했다. 주 담당 대화의 마지막 FORBIDDEN과 과거 502 원인은 별도로 미확인이다. 이번에는 LocalMCP를 재탐색/호출하지 않았다. [읽기 기록](validation/m2c-versioned-read-user-report.json)

## 변경과 이력
이번 원격 변경은 1pager·progress·새 D 승인/준비 JSON뿐이다. 이전 보고 JSON, 기존 E1, 실행 소스·테스트·의존성·계정 승인 설정·main·배포·과금은 변경하지 않았다. [skip ci] 문서 커밋이며 CI 통과를 주장하지 않는다. 문서 차이로 R2 pull·재빌드·완료 검사 반복을 요구하지 않는다.

[직전 상세 진행표](https://github.com/dearcloud09/localmcp/blob/cc86a388565e8d474b70a7fc0b3c3a9d7364f709/docs/progress.md) · [최소 검사 보고](validation/m2c-local-checks-user-report.json) · [원격 코드 반영](validation/m2c-publication-readback.json). 기존 M1/M2a/M2b/M2c 구현·최소 검사·원격 반영 근거는 유지하고, 미완료 교차 프로세스 잠금·수동 복구·다중 파일·실과제 성능은 추가 구현하지 않는다.
