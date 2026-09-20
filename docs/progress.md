# 실행 진행표

갱신: 2026-09-20 · [1pager](onepager.ko.md) · `feat/m1-modular-runtime` · PR #1 Draft.

## 현재 판정
**A 설치·회귀: verification_pending — 설치·타입·빌드 성공은 유지하고, 테스트 단계의 실패를 tsx IPC 시작 오류로 좁혔다.** 새 의존성 조합의 실제 테스트·네이티브 실행·설치 트리 감사는 아직 통과하지 않았다.

## 최신 진단 — 테스트 assertion 전 tsx IPC 기동 실패
**A 설치·회귀: verification_pending.** 기존 로그 진단에서 stdout에는 npm test 명령만 있고, stderr에는 `createIpcServer`의 `listen EINVAL`과 `.pipe` 주소가 보고됐다. 테스트 assertion 실패 목록이 아니라 tsx 실행기 기동 오류다. 제공했던 실행기의 `TMPDIR=검사디렉터리/tmp`와 보고된 경로·UID/PID를 대조해 재구성한 소켓 경로는 105바이트로, Node 23.11 문서의 macOS 기준 103바이트를 넘는다. 실행기 임시 경로 설계의 결함으로 판단하며, 변경된 의존성의 회귀로 단정하지 않는다. [진단·재개 기록](validation/m2c-a-tsx-ipc-diagnosis-resume.json)

검토한 tsx v4.23.13 원문은 os.tmpdir()/tsx-<uid>/<pid>.pipe에서 IPC 서버를 먼저 만든 뒤 테스트 자식을 시작한다. 이번 실패 경로에서 테스트 자식 실행에 도달하지 못했다는 판단을 뒷받침한다. 원시 맥 stderr는 주 담당이 받지 않았고 경로 길이 계산은 마스킹 전 경로를 재구성한 값이다. 재개 도구가 원래 로그의 길이·해시와 실제 주소를 로컬에서 확인하도록 했다. 맥의 수정 전후 실행 대조는 아직 미실행이다.

재개는 기존 설치·타입 검사·빌드 성공을 보존하고 새 전용 짧은 임시 디렉터리에서 TMPDIR/TMP/TEMP만 변경한다. 짧은 Unix 소켓 생성/종료와 같은 설치본 tsx 기동을 먼저 확인한 뒤 기존 npm test → SDK smoke → Wrangler → native smoke → 설치 트리 감사 → 불변 검사를 진행한다. 재설치·재빌드·후보 재생성·테스트 제외·설치 스크립트 활성화는 없다. 이전 report/로그를 덮지 않고 별도 create-only 결과 경로를 사용한다. 이 수정은 D의 호스트 차단과 무관하며 D 편집을 재시도하지 않는다.

### 증거 및 계산
사용자는 기존 report와 full-tests stdout/stderr 세 파일의 읽기 결과를 제공했다. filesRead=3, inputsMetadataStable=true, subprocessesRun/packagesInstalled/testsRerun/filesWritten/localmcpCalled=false, LOG_READ_EXIT=0이다. stdout은 116바이트/5줄, SHA-256 ed83f60e4880d06636c9e6c8834fc9aaedc96b8f3862b88070a620d830c82bee; stderr는 1092바이트/21줄, SHA-256 c1942dc8e972e8aed4a11a1a58ecc209196d58ecaf21d9d2385f2c7579b1b4d0이라는 보고다. 두 스트림 모두 테스트 totals/failureHeadings는 없다. 이 해시는 사용자 보고로, 원시 로그를 직접 받아 재계산한 값이 아니다.

원본 validate-a-install.mjs SHA-256 3ace131e96c8f66bc8d415acf02e6edf75a01238a57bd535c6ff975bd4b3c4f8를 첨부 ZIP에서 재확인했다. cleanEnv가 긴 검사 경로의 tmp를 세 환경변수에 넣는 것을 읽었다. Node 23.11 net 공식 문서가 설명하는 macOS Unix 소켓 경로 기준은 103바이트다. 앞서 제공된 실제 검사 경로와 로그 접미사를 조합한 UTF-8 계산값 105는 이 기준을 2바이트 초과한다. 개인 원시 경로·UID/PID는 공개 문서에서 제외한다.

1차 자료: https://nodejs.org/download/release/v23.11.0/docs/api/net.html#identifying-paths-for-ipc-connections 및 tsx v4.23.13의 src/utils/temporary-directory.ts, src/utils/ipc/get-pipe-path.ts, src/utils/ipc/server.ts, src/cli.ts. tsx upstream 원문은 해당 버전의 동작 설명이고, 설치된 배포 번들 전체와 원문을 전수 대조한 것은 아니다. Linux 자체 검사만으로 Darwin 경로 제한을 놓친 기존 실행기 검증의 한계도 기록한다.

### 수정한 운영자 경로와 수용 조건
새 resume-a-regression.mjs SHA-256: `8c90606f0150b11821ca3a2667883c5dce551b7727c9661efc206852d1610071`. 채팅 운영자 도구이며 제품 소스 패치가 아니다. 기존 R2/후보/검증 work의 manifest와 Git 객체 138개, 기존 실패 report의 식별값, 원시 로그 길이·해시, 설치된 주요 버전을 읽어 확인한다. 실제 로컬 stderr의 주소가 예상 실행기 TMP 아래이고 103바이트보다 길 때만 진행한다. 다른 실패나 파일 변경이면 중단한다.

새 짧은 소유자 전용 임시 디렉터리의 최대 예상 IPC 경로는 UTF-8 90바이트 이하로 제한한다. 기존 HOME/cache와 설치 스크립트 비활성은 유지하며, 호스트·사용자 전역 환경 설정은 바꾸지 않는다. 테스트 자식에만 TMPDIR/TMP/TEMP를 덮어쓴다. Unix socket bind/close → 기존 tsx의 작은 TypeScript 실행 → 원래 npm test를 수행한다. 테스트 선택·코드·기대값은 변경하지 않는다. 이어서 이전 승인 범위의 SDK smoke, Wrangler/native smoke, 설치 트리 감사, 원본/후보/검증 소스/빌드/기존 보고 불변을 확인한다.

기존 report.json과 full-tests 로그는 수정하지 않으며 새로운 resume-short-tmp-v1 결과 디렉터리는 create-only다. 같은 재개를 자동 반복하지 않는다. 실패한 새 단계의 가린 제한 로그를 최종 JSON에 넣어 다음 진단에서 설치나 전체 테스트를 다시 요구하지 않도록 했다. 임시 자료를 보존하고, 종료 검사는 실행기가 만든 process group과 도달한 Miniflare dispose 범위다. OS 샌드박스나 모든 detached 자식의 전수 정리가 아니다.

사전 통과한 npm-ci/typecheck/build를 다시 실행하지 않고 현재 사본의 해시가 같을 때만 그 근거를 재사용한다. 성공 표시 A_ISOLATED_INSTALL_REGRESSION_OK는 이전 설치·빌드 근거와 수정 환경의 후속 검사 전체를 결합한 상태다. 새 설치·원본 copyback·재현 빌드 증명·D 성공을 뜻하지 않는다. 재개 전 단계는 아직 미실행이다.

Linux/Node v22.16.0에서 자체 검사 15개를 통과했다. 원래 로그/보고 식별 조건, UTF-8 경로 길이, 환경 변경 세 필드, 실제 짧은 Unix 소켓 bind/close, 링크 거부, 로그 가림, 오류/timeout, 실행기 install/build 부재 및 macOS guard를 검사했다. 실제 macOS·설치된 tsx·제품 테스트/네이티브 실행 결과로 확대하지 않는다.

이전 설치/실패 판단은 [고정 진행표](https://github.com/dearcloud09/localmcp/blob/03c78d391663cc28d713aec3445564b5c42834a0/docs/progress.md)와 기존 JSON에 보존한다. 이전 TESTS_FAILED 집계를 제품 assertion 실패로 해석하지 않도록 현재 설명만 갱신한다.

## 후보와 승인된 실행 계약
후보의 직접 devDependencies는 wrangler 4.131.0, @cloudflare/workers-types 5.20260910.1이다. Miniflare 5.20260910.0-alpha → Sharp 0.35.4, workerd 1.20260910.1을 포함한다. 앞선 lock-only 감사 0건은 그 후보·실행 시점의 사용자 보고이고 설치 트리 감사는 이번에 아직 도달하지 않았다. 기존 원본의 high 3개를 해결 완료로 표시하지 않는다.

고정 후보 package SHA-256은 6694256b3bbe76baa5bd4e169a266ac62bcb9ebe8db88092f71b4d744330a591, lock SHA-256은 d0397dedfdbac5fdf8f0eb95aaaaaaba9833cfb58ba0a9a2e0faa75d9cef13bd다. 원시 후보·설치 트리·native 바이너리를 주 담당이 직접 수신하지 않았다. 사용자 보고와 실제 도구 응답을 혼동하지 않는다.

승인 범위는 새 임시 사본의 패키지/해당 플랫폼 네이티브 파일 설치와 명시적 로컬 회귀 검사다. 원본 R1/R2·E1/D·원격 package/lock에 후보를 반영하거나 설치 스크립트 활성화·npm rebuild·Docker 설치·공개 중계·로그인·배포하는 승인이 아니다. 별도 HOME/cache/logs는 OS 샌드박스가 아니다.

실행기는 R2의 고정 Git 객체만 새 사본으로 내보내고 .git 및 기존 node_modules/dist, 미추적 파일은 복사하지 않았다. npm ci --ignore-scripts 및 strict-peer/dev/optional/peer 조건을 사용했다. Git metadata 미복사 등의 차이는 별도 변수이며, 현재 확인된 tsx 기동 오류의 설명은 위 TMP 경로 길이 진단이다. 재개는 기존 설치 자료를 활용하고 실패 로그가 다음 검사 범위를 결정하도록 한다.

## 유지되는 관문과 변경 경계
기존 E1 연결·versioned read와 C의 SDK 1.30.0, stdio 9 + loopback HTTP 9개 한정된 통과는 유지한다. 새 의존성 조합의 통과로 자동 승계하지 않는다. D는 최초 edit_file 호스트 차단 blocked 및 이후 before 확인·D agent 종료 pass다. D 파일·ID·차단 요청을 이번 회귀에서 재사용하거나 다른 경로로 대신 실행하지 않는다. B의 실제 Docker는 알려진 경로가 없어 미실행이다.

이번 주 담당의 LocalMCP 호출·맥 실행·제품 재테스트는 0회다. Git 변경은 1pager·진행표·새 IPC 진단/재개 준비 기록뿐이고 이전 근거 JSON·제품 소스·테스트·package/lock은 보존한다. PR Draft·main 미병합·배포 없음과 MIT 고지를 유지한다. 문서 갱신 때문에 R2 pull·재빌드·완료 검사를 반복하지 않는다.

[설치 승인·원본 실행 계약](validation/m2c-a-install-authorization-runner.json) · [후보 lock 보고](validation/m2c-a-lock-candidate-user-report.json) · [C 기록](validation/m2c-scoped-lifecycle-user-report.json) · [D 종료](validation/m2c-d-status-stop-user-report.json) · [직전 상세 진행표](https://github.com/dearcloud09/localmcp/blob/a47d918fd071c2be60c5476778c13ad6b7e43726/docs/progress.md).
