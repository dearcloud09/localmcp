# LocalMCP 모듈형 코딩 실행환경 — 1pager

갱신: 2026-09-20 · `dearcloud09/localmcp` · `feat/m1-modular-runtime` · [진행표](progress.md)

## 현재 우선순위 — A의 승인된 분리 설치·회귀 검사
**전체 프로젝트: verification_pending.** 사용자는 새 임시 검증 사본에만 후보 패키지·해당 플랫폼의 네이티브 파일을 설치하고 회귀 검사를 실행하는 범위를 승인했다. 운영자 실행기를 준비하고 자체 검사 17개를 통과했다. 실제 맥의 후보 설치·빌드·회귀 결과는 아직 수신하지 않았다. [승인·실행기 기록](validation/m2c-a-install-authorization-runner.json)

이미 생성한 후보 manifest를 해시로 확인해 재사용하며 다시 해석하거나 업그레이드하지 않는다. R2의 고정 Git 객체에서 추적 파일을 새 사본으로 내보내고 후보 manifest만 그 사본에 적용한다. npm ci의 설치 lifecycle은 비활성화하고 명시적인 타입·빌드·기존 npm test·독립 SDK smoke·Wrangler 버전·Sharp/Miniflare/workerd 실행·설치 트리 감사를 순차 수행한다. 새 사본의 단계 하나가 실패하면 후속 검사를 실행하지 않는다.

기존 R1/R2 파일·node_modules·dist와 E1/D에는 쓰지 않는다. 별도 HOME/cache/logs는 OS 샌드박스가 아니다. 새 임시 자료는 보존하며 반복 실행은 거부한다. 원본 적용·원격 package/lock 반영·배포는 이 실행에 포함하지 않는다.

## 확인된 후보와 기존 결과
| 관문 | 상태 |
|---|---|
| A lock 후보 | 사용자 보고 기준 pass. Wrangler 4.131.0 → Miniflare 5.20260910.0-alpha → Sharp 0.35.4; Workers types 5.20260910.1. 후보 감사 0건 |
| A 설치·회귀 | 범위 승인·운영자 실행기 준비. 실제 제품 실행 결과 대기 |
| 기존 E1 연결·읽기 | 별도 대화의 사용자 근거 기준 pass. 기존 샘플 보존 |
| C | SDK 1.30.0, stdio 9 + loopback HTTP 9개 한정된 pass 유지. 새 의존성 조합에 자동 승계하지 않음 |
| D | 최초 편집 호스트 차단 blocked 유지. 로컬 before 확인·D 전용 agent 종료 pass. 재시도하지 않음 |
| B | 알려진 Docker 실행 경로가 없어 실제 E0-D 미실행. 설치·이미지 다운로드는 별도 승인 |

후보의 변경된 비루트 lock 항목은 사용자 보고에서 36개이며 모두 dev 분류다. 비개발 lock 항목 불변은 개발 도구의 실행 영향 부재를 의미하지 않는다. 후보 감사 0건도 원본 설치 환경의 수정 완료가 아니다.

## 식별값과 경계
R2 기준 HEAD: `8dd7876192c1290d7d18bd70cc9b6d264aca34c4`. 기존 dist manifest: `d093a515eca545d75117ae7b9fb363445502dcfd03c48b7c902ffedd58c7f637`.

후보 package SHA-256: `6694256b3bbe76baa5bd4e169a266ac62bcb9ebe8db88092f71b4d744330a591`. 후보 lock SHA-256: `d0397dedfdbac5fdf8f0eb95aaaaaaba9833cfb58ba0a9a2e0faa75d9cef13bd`.

실행기 SHA-256: `3ace131e96c8f66bc8d415acf02e6edf75a01238a57bd535c6ff975bd4b3c4f8`. 성공 표시는 A_ISOLATED_INSTALL_REGRESSION_OK이며 설치·검사·불변·정리·감사 조건을 모두 요구한다. 이것도 원본 반영이나 source-to-build 재현성 증명은 아니다.

이번 Git 변경은 문서와 승인/준비 기록뿐이다. 제품 소스·테스트·package/lock·기존 증거는 변경하지 않는다. PR Draft·main 미병합·배포 없음. 이전 502·주 대화 FORBIDDEN·D 안전 차단을 하나의 원인으로 단정하지 않고, 차단된 요청을 다른 경로로 실행하지 않는다. 기존 성공 검증과 MIT 고지를 유지한다.

[후보 보고](validation/m2c-a-lock-candidate-user-report.json) · [C 기록](validation/m2c-scoped-lifecycle-user-report.json) · [D 종료](validation/m2c-d-status-stop-user-report.json) · [직전 상세 1pager](https://github.com/dearcloud09/localmcp/blob/b0311f0a025cab87363a09264caf17993f57573c/docs/onepager.ko.md)
