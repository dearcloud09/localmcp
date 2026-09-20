# 실행 진행표

갱신: 2026-09-20 · [1pager](onepager.ko.md) · `feat/m1-modular-runtime` · PR #1 Draft.

## 현재 판정
**A lock 후보: pass — 사용자 실행 근거. A 분리 설치·회귀: 범위 승인·실행기 준비, 실제 제품 결과 대기. 전체 프로젝트: verification_pending.** 기존 후보 생성은 반복하지 않으며 R1/R2 및 E1/D는 보존한다. [이번 승인·준비](validation/m2c-a-install-authorization-runner.json)

## A의 기존 후보 근거
사용자는 A_LOCK_CANDIDATE_READY, 정상 후보 감사 exitCode=0/total=0, PHASE_EXIT=0을 보고했다. 실행 환경은 R2 HEAD 8dd7876192c1290d7d18bd70cc9b6d264aca34c4, Node v23.11.0, npm 11.4.2였다. 원본 snapshot 불변, node_modules 미생성, 설치 lifecycle/빌드/테스트/원본 반영 없음으로 보고됐다. 원시 후보 manifest·감사 원본을 주 담당이 직접 받은 것은 아니다. [후보 실행 기록](validation/m2c-a-lock-candidate-user-report.json)

Wrangler 4.131.0과 Workers types 5.20260910.1을 직접 devDependencies에 고정한 후보이며 Miniflare 5.20260910.0-alpha → Sharp 0.35.4, workerd 1.20260910.1을 포함한다. lock/registry 메타데이터의 integrity 비교와 실제 패키지 본문 다운로드 검증은 별개다. 보고된 변경 항목 36개는 모두 dev 분류이며 비개발 entry 불변을 런타임 호환성 보장으로 확대하지 않는다.

후보 package SHA-256은 `6694256b3bbe76baa5bd4e169a266ac62bcb9ebe8db88092f71b4d744330a591`, lock SHA-256은 `d0397dedfdbac5fdf8f0eb95aaaaaaba9833cfb58ba0a9a2e0faa75d9cef13bd`다. 기존 원본 high 3개와 후보 감사 0건은 다른 상태다. 원본 수정은 아직 완료하지 않았다.

## A 설치·회귀 승인과 실행 계약
사용자는 새 임시 사본에만 실제 패키지·해당 플랫폼의 네이티브 파일을 다운로드/설치하고 명시적인 회귀 검사를 수행하는 범위를 승인했다. 설치 스크립트 재활성화, npm rebuild, 전역 설치, 원본 copyback, Docker 설치, 공개 중계, 로그인·배포 승인은 아니다.

채팅 산출물 validate-a-install.mjs의 SHA-256은 `3ace131e96c8f66bc8d415acf02e6edf75a01238a57bd535c6ff975bd4b3c4f8`다. 운영자가 이미 생성한 후보를 해당 해시로 재사용한다. 후보 디렉터리 누락·내용 변경은 자동 복구하지 않는다. 같은 후보의 설치 검증 디렉터리가 존재하면 재설치 대신 중단한다.

### 사전 조건과 복사 범위
R2의 고정 HEAD, clean 상태, 원본 package Git blob, lock SHA-256, dist manifest를 확인한다. Git ls-tree/cat-file로 그 커밋의 추적 파일을 새 사본에 내보내고 각 Git blob을 계산·대조한다. 미추적/ignored 파일, .git, 기존 node_modules/dist를 복사하지 않는다. 링크·submodule·민감 파일명·경로 이탈·크기 초과를 거부한다. 후보 manifest는 새 사본의 두 파일만 교체한다.

원본 package blob은 0faca9632cc8929ea262d39dc7b0f981f9ea34e7, 원본 lock SHA-256은 8185650314a8799924768a54193de71332d3a5c1037a87d58b4e08ba5442b1d4, 기존 dist manifest는 d093a515eca545d75117ae7b9fb363445502dcfd03c48b7c902ffedd58c7f637다. 이 사전 조건과 사후 snapshot을 비교한다. R1은 읽거나 쓰지 않고 기존 E1/D 경로도 사용하지 않는다.

### 실행 순서
1. 기존 npm 실행 파일의 실제 버전 11.4.2 확인.
2. 새 사본에서 npm ci --ignore-scripts --strict-peer-deps 및 dev/optional/peer 포함 설치.
3. npm run check, npm run build, npm test를 순서대로 실행.
4. 원본 scripts/smoke-mcp.mjs로 사본의 새 빌드와 실제 SDK stdio smoke 실행.
5. Wrangler --version, Sharp의 작은 신뢰된 raw 이미지 PNG 왕복, workerd 버전, Miniflare 로컬 요청 및 dispose 확인.
6. 설치 트리의 npm audit 정상 JSON·종료 코드·모든 심각도 0건 확인.
7. 사본의 추적 소스와 후보 manifest, 원본 R2 snapshot 및 원래 후보 파일 불변 확인.

기존 verify:minimum은 Git 저장소를 요구하므로 .git 없는 사본에서는 같은 명시적 내부 검사들을 직접 실행한다. verify:minimum runner 자체를 실행했다고 보고하거나 그 성공 표시를 재사용하지 않는다. npm 설치 lifecycle은 차단하지만 명시적 build/test는 실행한다. 공식 계약: https://docs.npmjs.com/cli/v11/commands/npm-ci/

새 조합의 회귀 검사는 기존 C/E1/D 운영자 블록을 다시 수행하는 것과 다르다. SDK smoke는 자체 임시 fixture만 사용하며 차단된 D 요청·작업 ID·파일을 재사용하지 않는다. Miniflare의 workerd 요청/종료 API는 wrangler@4.131.0의 README와 runtime 소스로 확인했다.

### 실패·정리·결과의 범위
각 명령의 실제 종료 코드·signal·timeout/출력 한도/launch failure를 구분한다. 설치 중 실패하면 패키지 부분 설치 가능성을 남기고 성공으로 단정하지 않는다. 원시 stdout/stderr는 별도 HOME/cache/logs와 함께 비공개 임시 디렉터리에 보존하고 콘솔에는 고정된 단계 요약만 표시한다.

단계별 process group은 실행기가 직접 생성한 것만 종료 대상이다. cleanupConfirmed는 이 범위와 native smoke의 Miniflare.dispose 확인이며 독립 session의 모든 자손에 대한 전수 조사가 아니다. 정리 불명확성은 실패로 남긴다. HOME 분리는 OS 파일/네트워크 샌드박스가 아니다.

A_ISOLATED_INSTALL_REGRESSION_OK는 모든 필수 단계, 정상 감사 0건, 원본·후보·사본 소스 불변과 정리 조건이 충족된 경우에만 출력한다. 현재는 그 실제 실행 결과를 받지 않았다. 성공해도 원본 적용·원격 package/lock 반영·main 병합·배포·재현 빌드 증명이 완료되는 것은 아니다. 새 빌드 manifest는 기록하되 exactSourceToBuildProven=false를 유지한다.

## 실행기 자체 검사와 이번 실제 수행
Linux/Node v22.16.0에서 문법 검사와 17개 자체 검사를 수행했다. 작은 합성 manifest/lock의 승인 범위 검사, Git 객체 내보내기, 링크·경로 거부, 감사 오류/집계 모순 거부, 환경변수 정리, 실제 Node 자식의 출력 캡처·실패·timeout·한도·취소, Linux에서 배포본의 기동 전 거부를 확인했다. macOS·실제 후보 npm ci·제품 타입/빌드/테스트·Sharp/Miniflare/workerd 실행 검증은 아니다.

이번 주 담당의 LocalMCP 호출과 맥 명령 실행은 0회다. 실행기는 채팅 산출물로 제공하며 제품 소스/테스트를 새로 업로드하지 않는다. Git 변경은 1pager·진행표·새 승인/준비 JSON뿐이고 기존 증거·package/lock은 유지한다.

## 보존하는 관문
기존 E1 연결·버전 포함 읽기는 별도 대화 사용자 근거 기준 pass다. C는 SDK 1.30.0의 stdio 9개와 loopback HTTP 9개, 정리/불변 확인의 한정된 pass이며 새 의존성 조합에 자동 승계하지 않는다. D는 최초 edit_file 호스트 차단 blocked, 후속 로컬 before 확인과 전용 agent 종료 pass다. 차단된 편집을 다른 ID·도구·대화·직접 HTTP·로컬 수정으로 대신하지 않는다. 등록·앱·증거는 보존한다.

B는 알려진 Docker CLI 경로가 없어 실제 E0-D 미실행이다. 이번 설치 승인은 Docker·이미지 다운로드·비용·공개 범위 변경을 포함하지 않는다. 과거 502·주 대화 FORBIDDEN·D 안전 차단의 원인도 통합해서 단정하지 않는다.

PR Draft·MIT 고지를 유지한다. 제품 소스·테스트·의존성의 원격 변경, main 병합·배포·권한 변경은 없다. 문서 갱신 때문에 R2 pull·재빌드·완료된 검사를 반복하지 않는다. [직전 상세 진행표](https://github.com/dearcloud09/localmcp/blob/b0311f0a025cab87363a09264caf17993f57573c/docs/progress.md) 및 기존 시점별 JSON에 이전 세부 근거를 보존한다.
