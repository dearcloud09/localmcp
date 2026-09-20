# LocalMCP 모듈형 코딩 실행환경 — 1pager

갱신: 2026-09-20 · `dearcloud09/localmcp` · `feat/m1-modular-runtime` · [진행표](progress.md)

## 최신 결과 — A 수정 후보 lockfile의 감사 0건
**A 후보 생성·lock 감사: pass — 사용자 실행 근거. 전체 프로젝트: verification_pending.** R2의 원본을 보존한 임시 후보에서 A_LOCK_CANDIDATE_READY, 감사 exitCode=0/total=0, PHASE_EXIT=0을 보고받았다. 패키지 본문 설치·빌드·테스트·원본 반영은 아직 없다. [후보 실행 근거](validation/m2c-a-lock-candidate-user-report.json)

직접 개발 의존성 후보는 wrangler 4.131.0과 @cloudflare/workers-types 5.20260910.1이다. 게시 메타데이터와 후보 lock에서 wrangler → miniflare 5.20260910.0-alpha → sharp 0.35.4 경로 및 네 패키지의 integrity 일치를 보고했다. 루트 Sharp 추가나 overrides는 사용하지 않았다.

변경된 비루트 lock 항목은 36개이며 모두 변경 전후 dev=true다. helper의 runtimeAffected=false는 dev 분류에 따른 lock 비교 결과이지 개발 도구의 실행 영향 부재를 뜻하지 않는다. Sharp/libvips와 workerd의 플랫폼 패키지도 바뀌었으므로 실제 설치·네이티브 실행 및 타입·빌드 검증이 필요하다. 감사 0건은 그 후보와 당시 registry 응답의 범위이며 모든 취약점 부재의 증명은 아니다.

## 관문별 상태
| 관문 | 현재 상태 | 남은 작업 |
|---|---|---|
| A / DEP-01 | **후보 lock 해석·감사 0건 사용자 보고 수용** | 별도 설치 승인 후 새 사본의 실제 설치·회귀 검사. 원본 의존성은 미변경 |
| 기존 E1 연결·읽기 | 별도 대화의 사용자 근거 기준 pass | 기존 샘플·성공 증거 보존, 반복 없음 |
| B / E0-D | 알려진 Docker CLI 경로 없음 | 실제 Docker 미실행. 설치·이미지 다운로드는 별도 승인 |
| C / 영속 lifecycle | SDK 1.30.0, 두 전송 18개 사용자 근거 기준 pass | 기존 후보의 열거된 범위만 유지. 새 의존성 조합의 실행 증명은 아님 |
| D / 실계정 guarded edit | **호스트 안전 차단 blocked; 로컬 before 확인·D 종료 pass** | mutation/replay/stale 미검증. 중지된 샘플·등록·앱 보존, 우회 재시도 없음 |

## 다음 설치 관문과 변경 경계
다음 제안은 R2의 고정된 소스 사본과 이번 후보 manifest 두 파일을 새 임시 검증 디렉터리에 두고 npm ci --ignore-scripts로 실제 패키지를 받는 것이다. 별도 HOME/cache에서 타입 검사·빌드·기존 테스트·독립 SDK smoke와 변경된 도구/네이티브 모듈 검사를 진행한다. 새 패키지 다운로드·실행이므로 구체적 승인 전에는 수행하지 않는다. 임시 HOME은 OS 보안 샌드박스가 아니다.

R1/R2의 node_modules·dist·설정이나 기존 E1/D를 변경하지 않는다. 설치 스크립트 재활성화·자동 rebuild·공개 중계·로그인·배포·Docker 설치는 포함하지 않는다. 기존 C/E1/D 운영자 블록과 같은 후보 생성도 반복하지 않는다. 실패 시 첫 실패를 보존하고 승인 범위를 넓혀 자동 복구하지 않는다.

## 후보·Git 기록
R2 소스 기준은 `8dd7876192c1290d7d18bd70cc9b6d264aca34c4`다. 후보 package SHA-256은 `6694256b3bbe76baa5bd4e169a266ac62bcb9ebe8db88092f71b4d744330a591`, lock SHA-256은 `d0397dedfdbac5fdf8f0eb95aaaaaaba9833cfb58ba0a9a2e0faa75d9cef13bd`로 보고됐다. 원시 후보 파일은 주 담당이 아직 수신하지 않았으므로 두 해시를 재계산했다고 하지 않는다. 이전 source-to-build 미증명은 유지한다.

이번에 GitHub 쓰기 도구가 다시 노출돼 문서와 새 사용자 후보 보고만 갱신한다. 제품 소스·테스트·package/lock·이전 증거 JSON·main·배포·비용·권한은 변경하지 않는다. PR Draft·MIT 고지 유지. 문서 때문에 R2 pull·재빌드를 요구하지 않는다.

[이전 상세 1pager](https://github.com/dearcloud09/localmcp/blob/aeb0f7985df87b6012b77f452a73d24c6e816e64/docs/onepager.ko.md) · [D 차단](validation/m2c-d-host-safety-block-user-report.json) · [D 종료](validation/m2c-d-status-stop-user-report.json) · [C 통과](validation/m2c-scoped-lifecycle-user-report.json) · [원래 감사](validation/m2c-audit-reconnect-user-report.json)
