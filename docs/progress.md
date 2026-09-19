# 실행 진행표

갱신: 2026-09-20 · [1pager](onepager.ko.md) · `feat/m1-modular-runtime` · PR #1 Draft.

## 현재 판정
**verification_pending**. 정상 감사 보고와 E1 재기동 성공이라는 새 실행 근거를 확보했다. 다만 실제 ChatGPT workspace_info 호출, 취약점 수정, Docker 및 독립 영속 lifecycle 제품 실행은 아직 완료되지 않았다. [이번 근거](validation/m2c-audit-reconnect-user-report.json)

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

이번 어시스턴트는 Plugin_Management 검색과 LocalMCP-E1 workspace_info 도구 탐색을 실제 수행했다. 검색 결과는 비어 있었고 LocalMCP-E1은 유효한 도구 namespace 목록에 없었다. 반면 해당 앱 승인 설정 조회는 found였으며 기본값 Allow low-risk actions를 상속했다. 등록 설정 존재는 도구 노출이나 호출 성공을 뜻하지 않는다. 이번 workspace_info 호출 횟수는 0이며, 502 재시도가 아니다.

남은 Chat 단계는 기존 앱 상세의 refresh와 대화 내 앱 선택이다. [공식 Developer mode 안내](https://developers.openai.com/api/docs/guides/developer-mode)에 따라 도구 설명/스키마 새로고침과 대화 선택을 수행한다. 서버 build/restart, 권한 확대, 새 URL 등록과 같은 작업으로 취급하지 않는다. 도구가 노출되면 첫 실제 LocalMCP 호출은 workspace_info이며, 정상 응답 전에 기존 calculator 파일을 읽거나 편집하지 않는다. 현재 workspace/권한/mutationRecovery의 실시간 값은 아직 미확인이다.

이전 502의 정확한 발생 계층과 종료 원인은 미확정이다. 재기동 성공 보고로 당시 원인을 소급 확정하지 않는다. 기존 E1은 파일-only memory profile이며, 향후 memory/restartPersistent=false 응답 자체는 M2c 부재를 의미하지 않는다. 재연결/읽기만으로 D의 새로운 guarded-edit 실계정 검사를 통과시키지 않는다. 같은 재연결·감사 블록을 자동 반복하지 않는다.

## B — 실제 Docker는 별도 보류
이번 고정 설치 위치 점검도 executableCandidates=[]였고 daemonContacted=false다. 이전 PATH 미발견과 합쳐도 시스템 전체 미설치 증명은 아니다. 현재 알려진 Docker 실행 경로가 없으므로 실제 E0-D는 미실행이다. Docker 설치/실행환경 추가·새 이미지 다운로드·비용·원격 context 전환은 구체적 승인 없이 하지 않는다. C 검사는 Docker와 무관하게 진행 가능하다.

## C — 독립 실행 블록 준비, 제품 결과 대기
R2의 이미 설치된 SDK 1.30.0과 dist를 사용하는 운영자용 lifecycle.mjs를 별도 채팅 산출물로 준비했다. SHA-256은 `fd8b756a4933a2cb38746166f1f4a3bd1f751443e21ae51d16b36c7e56c222dc`다. 제품 소스나 저장소 테스트를 새로 업로드한 것이 아니다. HEAD/clean/lock/dist manifest가 보고된 후보와 다르면 실행 전에 중단한다. 설치·재빌드·공개 중계·기존 E1 접근·agent start/stop/reload를 하지 않는다.

새 소유자 전용 임시 fixture/profile/journal만 만들고, 각 stdio 및 loopback HTTP 모드에서 다음 범위를 검사한다: 미초기화 시작 거부, create-only 초기화와 중복 거부/기록 불변, 실제 workspace/도구 schema, versioned read와 guarded edit/stale hash 거부, 다른 PID의 검사용 프로세스 재시작과 historical receipt, 실제 설정 파일 watcher를 통한 fileWrite 회수/도구 목록 제거/캐시 replay 거부, 권한 복원, 호환되지 않는 recovery 변경과 회수를 섞었을 때 전체 reload 거부/이전 권한 유지, 자기가 시작한 서버만 종료 및 프로젝트 불변.

이 블록은 읽기 전용이 아니다. 임시 파일/기록소를 쓰고 독립 서버를 시작·종료하며 loopback 포트를 사용한다. 원시 stderr·argv/env·token/URL은 출력하지 않는다. 기존 E1이나 실제 프로젝트 파일에는 도구 호출을 보내지 않는다. 예외·timeout·cleanup 실패는 통과가 아니며 자동 재실행하지 않는다.

이번에 수행한 것은 문법 검사와 명시적 합성 SDK/서버 대역을 사용한 운영자 harness 시험이다. 합성 경로의 18개 점검, 원래 후보 guard의 거부, 토큰/URL canary 출력 차단, 합성 checkout 불변을 확인했다. 실제 SDK 1.30.0·macOS·제품 lifecycle 실행은 아직 하지 않았다. upstream SDK v1.30.0 Git ref 조회도 404였으므로 그 원문을 읽었다고 주장하지 않는다. 설치 SDK 인터페이스가 다르면 블록은 실패 상태를 반환한다.

향후 C_SCOPED_LIFECYCLE_OK와 cleanupConfirmed/projectUnchanged=true를 받아도 열거한 범위만 통과다. 전원 장애·모든 crash/recovery·교차 프로세스 동시 잠금·relay/agent 전체 lifecycle·Docker·실계정 E1은 포함하지 않는다.

## 유지하는 기준과 이력
M1·M2a·M2b 구현, 이전 E0/파일-only E1의 사용자 근거, M2C_LOCAL_CHECKS_OK, IG-04의 코드 50cad2d/통합 8dd7876 반영과 이전 production/benchmark 해시 대조는 유지한다. 정확한 최신 전체 검사 수를 추정하거나 이전 335/336을 현재 실패로 바꾸지 않는다. 교차 프로세스 다른 ID 잠금·수동 복구·다중 파일·프로세스 복구·실과제 성능·CI 한도 관문은 여전히 미완료다.

[최소 검사 사용자 보고](validation/m2c-local-checks-user-report.json) · [원격 반영](validation/m2c-publication-readback.json) · [기동 전 진단](validation/m2c-macos-execution-path-report.json) · [이전 상세 진행표](https://github.com/dearcloud09/localmcp/blob/8fa9a34fb103389b24ab0b1f56d988263f7cd309/docs/progress.md).

이번 Git 변경은 onepager·progress·새 사용자 실행 근거 JSON뿐이다. 기존 E1/과거 증거 JSON·제품 소스·테스트·의존성·설정·권한·main·배포·과금은 변경하지 않는다. 문서 커밋에 [skip ci]를 사용하며 CI 성공을 주장하지 않는다.
