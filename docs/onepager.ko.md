# LocalMCP 모듈형 코딩 실행환경 — 1pager

갱신: 2026-09-20 · `dearcloud09/localmcp` · `feat/m1-modular-runtime` · [진행표](progress.md)

## 최신 결과 — A 후보 설치·회귀 관문 통과
**A의 분리된 후보 설치·회귀: pass — 사용자 실행 근거. 전체 프로젝트: verification_pending.** 최종 A_NATIVE_RESUME_VERIFIED 뒤 A_ISOLATED_INSTALL_REGRESSION_OK와 PHASE_EXIT=0을 받았다. 설치본 옵션 타입 검사, 수정한 native smoke, 설치 후 npm 감사가 모두 통과했다. [최종 수용 근거](validation/m2c-a-isolated-regression-pass-user-report.json)

이전 설치·타입·빌드, npm test 336+32+11=379개, 실제 SDK stdio smoke, Wrangler 4.131.0 실행 근거를 보존하고 재사용했다. 이번에는 이를 재실행하지 않았다. Sharp PNG 왕복, workerd 버전, Miniflare 생성·loopback 응답·dispose와 감사 0건까지 확보해 예고한 후보 검사 범위를 완료한다. SDK/C/대역 검사 개수를 379개에 합산하지 않는다.

원본 운영자 ZIP의 실행기·native 코드 해시를 재계산하고 이전 결과 재사용 및 최종 불변 조건과 대조했다. 근거는 사용자가 전달한 최종 요약이며 주 담당의 직접 macOS 실행이나 원시 manifest/감사 파일 수신이 아니다. 기존 R2·후보·기존 증거·검증 소스/빌드 불변과 프로세스 그룹/dispose 정리를 보고된 범위로 수용한다.

## 다음 단계 — 검증된 manifest 원문 확보·반영
검사 실행은 완료됐지만 copiedBackToProject=false, productionFixApplied=false다. 원격 package.json·package-lock.json도 이번에 변경하지 않았다. 검증된 두 파일의 실제 바이트를 받아 아래 해시와 원격 차이를 대조한 뒤 작업 브랜치 반영 범위를 확정한다. 원시 파일 없이 lock을 재구성하거나 후보를 재생성하지 않는다.

- package.json SHA-256: `6694256b3bbe76baa5bd4e169a266ac62bcb9ebe8db88092f71b4d744330a591`.
- package-lock.json SHA-256: `d0397dedfdbac5fdf8f0eb95aaaaaaba9833cfb58ba0a9a2e0faa75d9cef13bd`.

기존 설치/후보 생성/타입/빌드/379개 테스트/SDK/네이티브/감사를 이유 없이 반복하지 않는다. 맥 원본 적용·기존 서버 변경·main 병합·배포는 이번 수용에 포함되지 않는다.

## 관문과 한계
| 관문 | 상태 |
|---|---|
| A 후보 설치·회귀 | **pass**. 후보에 대한 설치·실행·감사 완료, 원본 및 원격 의존성 반영은 남음 |
| 기존 E1 | 별도 대화의 연결·versioned read pass 근거 유지. 기존 샘플 보존 |
| C | 실제 SDK 1.30.0의 두 전송 18개 한정된 pass 유지. 이번 결과와 합산하지 않음 |
| D | 호스트 편집 차단 blocked, 로컬 before 확인·D agent 종료 pass. 재시도하지 않음 |
| B | 실제 Docker 미실행. 알려진 실행 경로 없음, 새 설치·이미지 다운로드 별도 승인 |

검증 조합은 Wrangler 4.131.0 → Miniflare 5.20260910.0-alpha → Sharp 0.35.4, workerd 1.20260910.1 및 Workers types 5.20260910.1이다. 보고된 실행은 macOS arm64/Node v23.11.0/npm 11.4.2다. Sharp는 PNG 동작 검사이며 HEIF 취약 입력 검사가 아니다. 감사 0건을 모든 취약점 부재, 다른 플랫폼 호환성 또는 재현 빌드 증명으로 확대하지 않는다. exactSourceToBuildProven=false를 유지한다.

이번 변경은 1pager·진행표·새 최종 보고 JSON뿐이다. 과거 실패/승인 JSON, 제품 코드·테스트·package/lock·E1/D·권한·main·배포·비용은 변경하지 않았다. PR Draft·MIT 고지를 유지한다. [이전 상세 기록](https://github.com/dearcloud09/localmcp/blob/37b9db434cce420f1d407f63c263bd13311c69a9/docs/progress.md)
