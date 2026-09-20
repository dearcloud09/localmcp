# LocalMCP 모듈형 코딩 실행환경 — 1pager

갱신: 2026-09-20 · `dearcloud09/localmcp` · `feat/m1-modular-runtime` · [진행표](progress.md)

## 최신 결과 — 후보 설치·타입·빌드 통과, 전체 테스트에서 중단
**전체 프로젝트 및 A 설치·회귀: verification_pending.** 사용자가 제공한 실행 보고에서 npm-version, npm-ci, typecheck, build는 모두 exitCode=0으로 통과했다. full-tests는 exitCode=1, signal=null, reason=null, cleanupConfirmed=true이며 TESTS_FAILED로 중단됐다. 테스트 이름·오류 본문·성공/실패 개수는 아직 받지 않았다. 설치 실패나 실행기 timeout으로 바꾸어 기록하지 않는다. [새 실행 보고](validation/m2c-a-install-test-failure-user-report.json)

새 사본에서 패키지 본문 설치와 빌드는 수행됐지만 기존 R2·원래 후보의 snapshot은 불변이라는 사용자 보고다. 새 dist manifest는 앞선 기준값과 동일하다. 이는 보고된 집계값의 일치이지 의존성 호환성·재현 빌드 증명이 아니다. exactSourceToBuildProven=false를 유지한다.

실행기 순서상 SDK smoke, Wrangler 버전, Sharp/Miniflare/workerd 네이티브 검사, 설치 트리 감사, 검증 사본의 최종 소스 불변 검사는 도달하지 않았다. 기존 후보 lock 감사 0건과 C/E1의 앞선 통과는 보존하되 이번 실행에 자동 승계하지 않는다.

다음 단계는 남아 있는 report.json 및 full-tests stdout/stderr의 읽기 전용 진단이다. 실패 요약에서 counts가 빠진 이유는 실행기가 exitCode 검증 뒤에만 TAP 집계를 저장하기 때문이다. Node 23.11의 기본 spec와 TAP 두 형식 모두를 진단 대상으로 삼되 텍스트 추출 자체를 테스트 판정으로 사용하지 않는다. npm ci·후보 생성·전체 설치 블록·rebuild·설치 스크립트 재활성화는 반복하지 않는다. 실패 근거가 확인된 뒤 원인이 제품 코드, 검사 환경, 의존성 중 어디인지 구분한다.

## 확인된 후보와 기존 결과
| 관문 | 상태 |
|---|---|
| A lock 후보 | 사용자 보고 기준 pass. Wrangler 4.131.0 → Miniflare 5.20260910.0-alpha → Sharp 0.35.4; Workers types 5.20260910.1. 후보 감사 0건 |
| A 설치·회귀 | 설치·타입·빌드 통과 보고, full-tests exit 1. 기존 로그에서 실패 항목 확인 중 |
| 기존 E1 연결·읽기 | 별도 대화의 사용자 근거 기준 pass. 기존 샘플 보존 |
| C | SDK 1.30.0, stdio 9 + loopback HTTP 9개 한정된 pass 유지. 새 의존성 조합에 자동 승계하지 않음 |
| D | 최초 편집 호스트 차단 blocked 유지. 로컬 before 확인·D 전용 agent 종료 pass. 재시도하지 않음 |
| B | 알려진 Docker 실행 경로가 없어 실제 E0-D 미실행. 설치·이미지 다운로드는 별도 승인 |

후보의 변경된 비루트 lock 항목은 사용자 보고에서 36개이며 모두 dev 분류다. 비개발 lock 항목 불변은 개발 도구의 실행 영향 부재를 의미하지 않는다. 후보 감사 0건도 원본 설치 환경의 수정 완료가 아니다.

## 식별값과 경계
R2 기준 HEAD: `8dd7876192c1290d7d18bd70cc9b6d264aca34c4`. 기존 dist manifest: `d093a515eca545d75117ae7b9fb363445502dcfd03c48b7c902ffedd58c7f637`.

후보 package SHA-256: `6694256b3bbe76baa5bd4e169a266ac62bcb9ebe8db88092f71b4d744330a591`. 후보 lock SHA-256: `d0397dedfdbac5fdf8f0eb95aaaaaaba9833cfb58ba0a9a2e0faa75d9cef13bd`.

실행기 SHA-256: `3ace131e96c8f66bc8d415acf02e6edf75a01238a57bd535c6ff975bd4b3c4f8`. 성공 표시는 A_ISOLATED_INSTALL_REGRESSION_OK이며 설치·검사·불변·정리·감사 조건을 모두 요구한다. 이것도 원본 반영이나 source-to-build 재현성 증명은 아니다.

이번 Git 변경은 문서와 새 실패/진행 보고뿐이다. 이전 승인/준비 기록은 보존한다. 제품 소스·테스트·package/lock·기존 증거는 변경하지 않는다. PR Draft·main 미병합·배포 없음. 이전 502·주 대화 FORBIDDEN·D 안전 차단을 하나의 원인으로 단정하지 않고, 차단된 요청을 다른 경로로 실행하지 않는다. 기존 성공 검증과 MIT 고지를 유지한다.

[후보 보고](validation/m2c-a-lock-candidate-user-report.json) · [C 기록](validation/m2c-scoped-lifecycle-user-report.json) · [D 종료](validation/m2c-d-status-stop-user-report.json) · [직전 상세 1pager](https://github.com/dearcloud09/localmcp/blob/b0311f0a025cab87363a09264caf17993f57573c/docs/onepager.ko.md)
