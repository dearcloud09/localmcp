# 실행 진행표

갱신: 2026-09-20 · [1pager](onepager.ko.md) · `feat/m1-modular-runtime` · PR #1 Draft.

## 현재 판정
**A 후보의 분리 설치·회귀: pass — 사용자 실행 근거. 전체 프로젝트: verification_pending.** 설치·실행·감사의 사전 완료 조건을 충족했다. 원본과 원격 의존성 반영은 아직 하지 않았다. [최종 수용 기록](validation/m2c-a-isolated-regression-pass-user-report.json)

## A 최종 수용 — 설치·회귀·네이티브·감사
사용자는 최종 A_native_resume JSON, LOCALMCP_A_NATIVE_RESUME_END, PHASE_EXIT=0을 제공했다. 새 단계 miniflare-options-types/native-smoke-v5/installed-audit가 모두 passed, exitCode=0, signal/reason=null, cleanupConfirmed=true다. A_ISOLATED_INSTALL_REGRESSION_OK를 예고한 범위 그대로 수용한다.

| 근거 | 이번 판단 |
|---|---|
| 이전 npm-version/npm-ci/typecheck/build | 재사용. 이번에 설치·빌드하지 않음 |
| 이전 npm test | 336/336 + 32/32 + 11/11 = 379개, 실패·skip·cancelled·todo 0. 재실행 없음 |
| 이전 SDK smoke | 실제 SDK stdio, red fail 3 → green pass 3 및 stale patch 거부. 379개에 합산하지 않음 |
| 이전 Wrangler 버전 | 4.131.0. 재실행 없음 |
| 설치본 옵션 타입 검사 | installedOptionsTypesChecked=true |
| native checkpoint | 설치 버전/Sharp PNG/workerd 버전/Miniflare 생성/loopback 준비/로컬 응답/dispose, 고유 7개 모두 passed |
| native 결과 | A_NATIVE_SMOKE_V5_OK, vips 8.18.6, workerd 날짜 2026-09-10, Miniflare 요청·종료 true |
| 설치 후 감사 | 정상 npm audit, exitCode=0, 모든 심각도 및 total=0, findings=[] |

## 증거 수준과 불변 범위
주 담당은 원본 ZIP의 resume-a-native.mjs와 native-smoke-v5.mjs 바이트를 읽어 각각 SHA-256 8a6b98cb6710882a59b43bfdfd82209db3df8b8ec61ef078fb64a2715cf933c3, feaa4882d1addb7e2cdff943dedb80b82333518e97aa8017e2a923e8c3e28fdc 일치를 재계산했다. 이전 보고/로그/후보 기준 확인, 7개 checkpoint, 감사 집계와 최종 불변 실패 시 성공을 취소하는 분기를 대조했다. 자체 검사나 제품 검사를 다시 실행하지 않았다.

실행 근거는 사용자가 붙여넣은 요약이다. 맥의 원시 report.json·audit.json·후보 package/lock·패키지 본문을 주 담당이 독립 수신한 것은 아니다. 코드/조건 대조를 별도의 서버 실행 증명으로 부르지 않는다. 명령 실행 시각은 전달문에 없어 추정하지 않는다.

originalProjectUnchanged, originalCandidateUnchanged, priorEvidenceUnchanged, installedHiddenLockUnchanged, executionAndOptionsFilesUnchanged, candidateFilesAndTrackedSourceUnchanged, candidateBuildUnchanged가 모두 true다. 원본 R2의 Git 상태/manifest/빌드, 원래 후보 두 파일, 열거된 과거 보고/로그, 검증 사본의 추적 소스/후보/빌드, 실행기 지정 입력 파일의 비교 범위다. 모든 node_modules 바이트나 모든 독립 자손 프로세스까지 전수 확인한 뜻은 아니다.

cleanupConfirmed=true 및 miniflareDisposed=true를 수용한다. 정리 범위는 새 stage process group과 Miniflare dispose이며 임시 디렉터리와 새 로그는 남아 있다. HOME/TMP 분리는 OS 샌드박스가 아니다. E1/D 접근·공개 중계·Docker·새 설치·빌드·전체 테스트·SDK/Wrangler 재실행은 이번에 없다는 보고다.

이전 두 실행기 결함(TMPDIR에 따른 tsx IPC 경로 초과, Miniflare v5 옵션 계약 불일치)은 과거 기록으로 보존한다. 수정 후 성공을 과거 실패가 없었던 것으로 바꾸지 않는다. 기존 제품 테스트를 제외하거나 라이브러리 검증을 완화하지 않았다.

## 확정한 후보와 남은 반영 관문
- 소스 기준: 8dd7876192c1290d7d18bd70cc9b6d264aca34c4.
- 후보 package SHA-256: 6694256b3bbe76baa5bd4e169a266ac62bcb9ebe8db88092f71b4d744330a591.
- 후보 lock SHA-256: d0397dedfdbac5fdf8f0eb95aaaaaaba9833cfb58ba0a9a2e0faa75d9cef13bd.
- 버전: Wrangler 4.131.0, Workers types 5.20260910.1, Miniflare 5.20260910.0-alpha, Sharp 0.35.4, workerd 1.20260910.1.
- 실행 환경: macOS arm64, Node v23.11.0, npm 11.4.2.

후보의 설치·회귀 검사는 닫는다. 다음은 검증 사본의 package.json과 package-lock.json 실제 바이트 확보, 위 해시 재계산, 최신 원격과 변경 범위 대조 후 작업 브랜치 반영 범위 확정이다. 이번에 받은 해시는 사용자 보고이며 실제 두 파일이 없어 주 담당이 그 해시를 재계산했다고 하지 않는다. 후보를 다시 해석하거나 registry에서 다른 lock을 만들지 않는다.

copiedBackToProject=false, productionFixApplied=false다. 원격 package/lock 역시 아직 변경하지 않았다. 원본 맥 환경의 설치·재기동·main 병합·배포를 추가로 승인받았다고 해석하지 않는다. 파일을 확보하기 위해 검사를 다시 실행하거나 홈 전체를 탐색할 필요는 없다. 동일 테스트/재설치/재빌드/감사를 요구하지 않는다.

## 수용 한계와 보존한 관문
설치 후 npm 감사 0건은 해당 후보와 실행 시점 registry의 결과다. 네이티브 바이너리의 보안 전수 검사나 모든 취약점 부재 증명이 아니다. Sharp 검사는 2×2 RGB 이미지의 PNG 왕복이며 HEIF/libheif 취약 입력 재현은 아니다. 다른 운영체제/아키텍처, 정확한 실행 commit·재현 빌드는 별도다. exactSourceToBuildProven=false와 reproducibleBuildVerified=false를 유지한다.

기존 E1 읽기와 C의 실제 SDK 두 전송 18개 한정된 pass는 당시 근거로 보존한다. 새 의존성 테스트와 C 전체 수명주기를 같다고 하지 않는다. D는 최초 편집 호스트 차단 blocked 및 전용 agent 종료 pass다. 차단 요청을 다른 도구/ID/대화/로컬 편집으로 재시도하지 않는다. B 실제 Docker는 여전히 미실행이며 새로운 설치·이미지 다운로드는 별도 승인 범위다.

이번 원격 변경은 1pager·진행표·새 최종 수용 JSON 3개뿐이다. 과거 증거 JSON·제품 코드·테스트·package/lock·서버·권한·main·배포·비용을 변경하지 않는다. 문서 커밋은 [skip ci]이며 CI 실행 성공으로 표시하지 않는다. [직전 상세 진행표](https://github.com/dearcloud09/localmcp/blob/37b9db434cce420f1d407f63c263bd13311c69a9/docs/progress.md)에 이전 진단과 준비 내용을 보존한다.
