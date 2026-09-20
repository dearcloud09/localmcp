# 실행 진행표

갱신: 2026-09-20 · [1pager](onepager.ko.md) · `feat/m1-modular-runtime` · PR #1 Draft.

## 현재 판정
**A: verification_pending.** 후보 설치·타입·빌드 성공에 더해 원래 npm test와 SDK smoke, Wrangler 버전 실행 성공 보고를 확보했다. native-smoke는 검사 코드가 이 버전의 Miniflare 옵션 계약을 따르지 않아 생성자에서 실패했다. 설치 트리 감사와 최종 수용은 아직 완료되지 않았다. [새 근거](validation/m2c-a-miniflare-options-resume.json)

## 이번 재개 결과
근거는 사용자가 붙여넣은 A_regression_resume 요약이다. 원시 맥 로그·전체 테스트 transcript를 주 담당이 직접 받은 것은 아니다. 이전 전달 ZIP의 실행기/네이티브 코드 바이트를 읽고 성공·실패 분기를 대조했다.

| 단계 | 보고된 결과 |
|---|---|
| short-ipc-probe | passed, 42바이트 소켓, closed=true |
| tsx-startup-probe | passed, 기존 tsx 4.23.13 |
| full-tests | passed, exitCode=0; 336/336, 32/32, 11/11 |
| sdk-smoke | passed, real-sdk-stdio, red fail=3 → green pass=3, stale patch 거부 |
| wrangler-version | passed, 4.131.0 |
| native-smoke | failed, exitCode=1, ERR_VALIDATION: workers undefined |

각 단계의 signal/reason=null 및 cleanupConfirmed=true다. 세 테스트 집계의 합은 379이며 bounded parser 결과와 npm test 종료 코드 0을 함께 수용한다. SDK fixture의 red/green 테스트나 이전 C 18개와 합산하지 않는다.

기존 raw stderr에서 oldSocketPathBytes=105, macosPathBudgetBytes=103, oldPathExceedsBudget=true를 로컬 확인했고 짧은 경로의 같은 tsx와 전체 테스트가 통과했다는 보고다. 이전 실행기 TMP 경로 문제의 진단을 지지한다. 같은 긴 listen을 다시 실행하지 않았다.

originalProjectUnchanged, originalCandidateUnchanged, priorEvidenceUnchanged, installedHiddenLockUnchanged, executionFilesUnchanged, candidateFilesAndTrackedSourceUnchanged, candidateBuildUnchanged는 모두 true다. 이 snapshot 범위를 모든 파일/설치 패키지의 전수 provenance로 확대하지 않는다. 새 설치·빌드·원본 copyback·공개 중계·Docker·E1/D 접근은 없다는 보고다.

## native 실패 원인과 수정
기존 native-smoke는 최상위 modules/script/compatibilityDate를 넘겼다. upstream cloudflare/workers-sdk의 wrangler@4.131.0 태그에서 확인한 실제 계약은 workers 배열, worker.config의 type/name/compatibilityDate, config.manifest의 mainModule/modulesRoot/modules 구조다. 단일 ES 모듈은 type=esm과 contents를 사용한다.

스키마: packages/miniflare/src/config/schema.ts, blob f6fbc043fd4841ab2c88125cde758c37153ee38a. 공식 단일 모듈 helper: packages/miniflare/test/test-shared/miniflare.ts, blob 0cf3333d5616a3cb8a8b653a1d795e6b06cad786. 실제 constructor/dispatchFetch 예제: packages/miniflare/test/logs.spec.ts, blob 44d44277b2a31c2e321be76a92a4520df65228b1.

따라서 이번 오류는 운영자 smoke의 API 불일치로 분류한다. 제품/의존성의 기능 회귀라고 단정하지 않으며 라이브러리 스키마를 완화하거나 테스트를 제외하지 않는다. 기존 코드 순서상 Sharp/workerd 앞선 assertion을 지났을 것으로 추론할 수 있지만, 개별 성공 영수증은 없으므로 전체 native 통과로 수용하지 않는다. 새 smoke가 그 작은 검사들도 명시적 checkpoint로 출력한다.

## 이미 승인된 범위의 제한 재개
새 채팅 산출물 resume-a-native.mjs는 기존 설치/재개 report와 로그, 후보 해시, Git 추적 소스/빌드, 주요 설치 버전을 확인한다. 기존 실패 native stdout/stderr 해시와 길이를 확인하고 이전 실행기·로그를 덮지 않는다. 새 결과 디렉터리 resume-native-v5-v1은 create-only다.

실행은 설치된 Miniflare 타입을 사용하는 옵션 전용 tsc --noEmit → 수정 native smoke → 설치 트리 npm audit 세 단계다. 옵션 타입 검사는 전체 제품 타입/빌드를 반복하는 것이 아니다. 새 옵션의 loopback host, cf=false, telemetry 비활성 및 검사 전용 resource/registry 경로를 명시한다. 짧은 TMPDIR/TMP/TEMP는 자식에게만 적용한다. 기존 R2·검증 소스·node_modules·후보 manifest는 수정하지 않는다.

네이티브 검사는 설치 버전, Sharp PNG 왕복, workerd 버전, Miniflare 생성/loopback 준비/로컬 응답/dispose의 checkpoint를 남긴다. 후속 감사는 dev/optional/peer를 포함하며 registry 요청이 있다. 이전 379개 테스트·SDK/Wrangler 및 설치/빌드 결과는 기준 파일이 일치할 때만 재사용한다. 원본 적용·원격 package/lock 반영은 여전히 별도다.

설치·rebuild·전체 테스트·SDK smoke·Wrangler 버전·이전 IPC probe·C/E1/D 운영자 블록은 반복하지 않는다. 단계 실패/불변 위반 시 후속 실행을 멈추고 가린 진단을 남긴다. 설치 스크립트 활성화, Docker, 공개 중계, 권한 변경, D 차단 요청의 대체 실행은 없다. HOME/TMP 분리는 OS 샌드박스가 아니다.

자체 검사 21개는 upstream에서 유도한 제한적 구조 모델, Miniflare 대역의 응답/실패/dispose, 실제 Node 프로세스와 오류/timeout, 환경·보고서 guard를 사용했다. 실제 설치된 Miniflare 스키마/네이티브 실행·macOS는 아직 시험하지 않았다. 이를 보완하는 실제 타입 검사와 native 실행은 운영자 재개에서 수행한다.

## 후보와 이전 관문
R2 source: 8dd7876192c1290d7d18bd70cc9b6d264aca34c4. 기존/후보 dist manifest: d093a515eca545d75117ae7b9fb363445502dcfd03c48b7c902ffedd58c7f637. 후보 package: 6694256b3bbe76baa5bd4e169a266ac62bcb9ebe8db88092f71b4d744330a591. 후보 lock: d0397dedfdbac5fdf8f0eb95aaaaaaba9833cfb58ba0a9a2e0faa75d9cef13bd.

기존 후보 lock 감사 0건, C의 두 전송 18개 한정된 pass, E1 읽기 pass는 각각 당시 근거로 보존한다. D는 편집 호스트 차단 blocked 및 전용 agent 종료 pass이며 재시도하지 않는다. B 실제 Docker와 정확한 source-to-build는 미확인이다. 원본 의존성 수정 완료를 주장하지 않는다.

이번 원격 변경은 문서 3개뿐이고 과거 증거 JSON·제품 코드·테스트·package/lock·main·배포는 변경하지 않는다. [이전 상세 진행표](https://github.com/dearcloud09/localmcp/blob/5767247fd752f7ceee472efb3e7fc1eb9ba2a429/docs/progress.md)에 기존 준비/실패 기록을 보존한다. 문서 때문에 R2 pull·재빌드·통과한 검사를 반복하지 않는다.
