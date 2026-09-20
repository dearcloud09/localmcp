# 실행 진행표

갱신: 2026-09-20 · [1pager](onepager.ko.md) · `feat/m1-modular-runtime` · PR #1 Draft.

## 현재 판정
**A 후보 lock 해석·감사: pass — 사용자 실행 근거. 전체 프로젝트: verification_pending.** 원본 프로젝트에는 아직 수정 후보를 반영하지 않았다. 기존 E1 연결·읽기와 C의 한정된 통과, D 호스트 차단 및 전용 에이전트 종료 결과는 유지한다.

## A — 수정 후보 생성·감사 0건 수용
### 출처와 사전 기준 대조
사용자는 A_CANDIDATE_VERIFIED, A_LOCK_CANDIDATE_READY, 전체 요약 JSON, LOCALMCP_A_CANDIDATE_END와 PHASE_EXIT=0을 전달했다. Node v23.11.0, npm 11.4.2, 소스 HEAD 8dd7876192c1290d7d18bd70cc9b6d264aca34c4다. 주 담당은 원시 후보 package/lock 파일·감사 파일·registry 응답을 직접 받지 않았고 맥에서 재실행하지 않았다. [정규화한 사용자 보고](validation/m2c-a-lock-candidate-user-report.json)

원래 전달한 prepare-a-candidate.mjs를 ZIP에서 읽어 SHA-256 `c9ae4a0567f921c7c06b107b26cbdcee9735f7592ae5742ec2753561a2abdd59`를 재계산했다. 게시 버전/의존 경로, 허용한 루트 변경, 비개발 lock 항목 불변, 정상 감사 JSON과 종료 코드, node_modules 미생성, 원본 snapshot 일치의 성공 분기를 대조했다. helper나 후보 생성 검사를 다시 실행한 것은 아니다.

정상 감사는 exitCode=0, validAuditReport=true, info/low/moderate/high/critical/total 모두 0, findings=[]다. 이번 감사는 변경 후보에 대한 package-lock-only 감사이며 dev/optional/peer를 포함했다. 기존 원본 high 3개 보고와 모순되지 않는다. productionFixApplied=false, copiedBackToProject=false이며 원본 설치 환경은 미변경이다.

### 후보와 변경 범위
| 구성 | 이전 | 후보 |
|---|---|---|
| Wrangler | 4.129.0 | 4.131.0 |
| Workers types | 5.20260906.1 | 5.20260910.1 |
| Miniflare | 5.20260903.0-alpha | 5.20260910.0-alpha |
| Sharp | 0.35.2 | 0.35.4 |
| workerd 및 플랫폼 패키지 | 1.20260903.1 | 1.20260910.1 |
| Sharp libvips 플랫폼 패키지 | 1.3.1 | 1.3.3 |

루트 package의 의도한 변경은 wrangler와 @cloudflare/workers-types 두 devDependencies의 정확한 버전 고정이다. Miniflare/Sharp를 루트에 추가하거나 overrides를 사용하지 않았다. 보고된 npm 게시 메타데이터에서 Wrangler의 Miniflare 고정 버전, Miniflare의 Sharp 고정 버전, Workers types peer 조건이 후보와 일치했다. 네 패키지의 integrityMatchesMetadata=true는 lock 값과 registry 메타데이터의 비교이며 실제 다운로드 본문 검증이나 게시자 provenance 증명은 아니다.

전달된 changedLockEntries를 계수하면 중복 없는 비루트 항목 36개다: workerd 플랫폼 5, workers-types 1, Sharp 플랫폼 16, libvips 플랫폼 10, miniflare/sharp/workerd/wrangler 각 1. 모두 devBefore/devAfter=true 및 runtimeAffected=false다. 원본·후보 lock의 직접 전수 대조를 주 담당이 수행한 것으로 표시하지 않는다.

helper는 버전 문자열뿐 아니라 각 lock entry 전체를 비교한다. 다만 runtimeAffected는 두 entry 중 어느 쪽이 dev=true가 아닌지를 분류한 값이다. 따라서 runtimeLockEntriesUnchanged=true는 비개발 분류 entry 불변이고, 변경된 개발 도구가 실행되지 않는다거나 타입·플랫폼 호환성이 보장된다는 뜻이 아니다. 플랫폼 패키지 36개 전부를 이 맥에 설치하거나 시험한 것도 아니다.

### 고정할 후보 식별값
- package.json SHA-256: `6694256b3bbe76baa5bd4e169a266ac62bcb9ebe8db88092f71b4d744330a591`.
- package-lock.json SHA-256: `d0397dedfdbac5fdf8f0eb95aaaaaaba9833cfb58ba0a9a2e0faa75d9cef13bd`.

두 값은 사용자 보고다. 원시 후보 바이트가 없어 여기서 재계산하지 않았다. 다음 실행은 이미 생성된 후보를 이 해시로 확인해 재사용하며, 임시 파일이 사라졌거나 해시가 다르면 자동 재생성/업그레이드하지 않는다. 개인 임시 경로는 공개 Git 기록에서 제외한다.

### 원본 불변과 미실행 범위
originalProjectUnchanged=true는 helper의 Git HEAD/status, package.json SHA-256/Git blob, package-lock SHA-256 비교 범위다. 이번 helper는 기존 dist manifest나 node_modules 전체를 전수 측정하지 않는다. 원본 파일 쓰기, packageBodiesInstalled, npmLifecycleScriptsRun, buildRun, testsRun, localmcpCalled, existingE1OrDAccessed는 모두 false라는 보고다. nodeModulesCreated=false도 확인됐다.

감사 0건은 해당 후보와 그 실행 시점의 advisory DB에 대한 결과이며 알려지지 않은 문제나 native 바이너리의 안전성·실제 프로그램 도달 불가능을 증명하지 않는다. 후보 설치·실행 회귀·원본 적용·원격 package/lock 반영이 남아 있으므로 DEP-01 전체를 해결 완료로 표시하지 않는다.

## 다음 A 설치·회귀 관문 — 구체적 승인 대기
새 임시 검증 사본에 R2의 고정된 추적 소스와 위 후보 manifest 두 파일을 배치한다. 기존 R2 node_modules/dist를 재사용하거나 변경하지 않는다. 개인 파일/비밀/기존 E1·D 샘플을 복사하지 않는다. 승인 범위는 후보 lock에 따른 실제 npm 패키지·해당 플랫폼의 네이티브 파일 다운로드, 별도 HOME/cache/logs, 명시적 로컬 검사 실행이다. 임시 HOME 분리는 OS 샌드박스가 아니다.

설치는 npm ci --ignore-scripts와 후보 생성 때의 strict-peer/include 조건을 사용한다. npm ci는 manifest와 lock 불일치 시 오류로 중단하고 lock을 갱신하지 않는다. 설치 lifecycle을 막아도 명시적으로 요청한 npm run/test는 실행되므로 두 권한을 구분한다. [npm ci 공식 계약](https://docs.npmjs.com/cli/v11/commands/npm-ci/)

예정 검증은 타입 검사, 사본 내부 빌드, 기존 테스트와 독립 SDK smoke, 변경된 Wrangler/Miniflare/Sharp/workerd의 실제 로딩 및 작은 네이티브 동작, 설치된 트리 감사, 후보 파일과 원본 snapshot 불변이다. Sharp의 플랫폼별 패키지 선택과 바이너리 로딩은 설치 전 lock 해석만으로 확인할 수 없다. [Sharp 설치 계약](https://sharp.pixelplumbing.com/install/)

이 새 의존성 조합의 회귀 검사는 근거 없는 동일 검사 반복과 다르다. 그래도 앞서 완료한 C/E1/D 운영자 검증 블록, 기존 재연결, 후보 생성은 반복하지 않는다. 독립 임시 서버가 필요한 테스트는 그 서버만 생성·종료하며 D의 차단된 편집을 대신 실행하지 않는다.

설치 스크립트 재활성화·npm rebuild·전역 설치·새 서비스/Docker·공개 중계 등록·클라우드 로그인·배포·원본 copyback·main 병합은 포함하지 않는다. 바이너리 누락·호환성 실패 등이 있으면 실패 근거를 보존하고 자동으로 설치/권한 범위를 넓히지 않는다. 이번 턴에는 실제 패키지 다운로드·설치·빌드·테스트를 하지 않았다.

## 보존한 관문과 이력
| 관문 | 현재 상태 |
|---|---|
| 기존 M2c 코드·최소 검사 | 코드 50cad2d 및 통합 8dd7876의 이전 원격 확인과 사용자 검사 성공 근거 유지 |
| 기존 E1 | 별도 대화의 workspace_info·versioned read 사용자 보고 기준 pass; 기존 샘플 보존 |
| C | SDK 1.30.0의 stdio 9 + loopback HTTP 9개, 정리/프로젝트 불변의 한정된 pass. 새 의존성 조합 실행 결과는 아님 |
| D | 첫 편집 호스트 차단 blocked. 조회 4회 성공 보고; 후속 before 확인 및 D 전용 agent 종료 pass |
| B | 알려진 Docker CLI 없음. 실제 E0-D 미실행; 새 설치·이미지 다운로드는 별도 승인 |

D는 편집/replay/stale 검증이 미완료이며 새 도구·ID·대화·직접 HTTP·로컬 편집으로 대신 수행하지 않는다. status/stop을 반복하지 않는다. D 샘플/등록/앱은 보존됐고 종료를 자격증명 폐기로 확대하지 않는다. 과거 502, 주 대화 FORBIDDEN, D 호스트 안전 차단의 원인도 단일 원인으로 확정하지 않는다.

이전 C 통과의 한계(apply_patch 실행, 의도적 crash/전원 장애, 교차 프로세스 동시 잠금, 모든 agent/relay lifecycle 미검증)와 정확한 source-to-build 미증명은 유지한다. 미완료 기능을 이번에 추가하지 않는다.

## Git 변경
직전 원격 HEAD aeb0f7985df87b6012b77f452a73d24c6e816e64를 읽고 두 문서의 원본 blob과 보관 사본을 대조했다. 앞선 턴에는 쓰기 도구가 없었으나 이번 탐색에서 문서 쓰기 도구가 다시 노출됐다. 계정 권한 변경 원인을 추정하지 않는다. 이번 변경은 onepager·progress·새 후보 사용자 보고 JSON뿐이며 package/lock·제품 소스·테스트·이전 증거 JSON은 수정하지 않는다. PR Draft, 문서 commit [skip ci], main 미병합·배포 없음으로 유지한다.

[직전 상세 진행표](https://github.com/dearcloud09/localmcp/blob/aeb0f7985df87b6012b77f452a73d24c6e816e64/docs/progress.md) · [원래 감사](validation/m2c-audit-reconnect-user-report.json) · [C 통과](validation/m2c-scoped-lifecycle-user-report.json) · [기존 읽기](validation/m2c-versioned-read-user-report.json) · [D 차단](validation/m2c-d-host-safety-block-user-report.json) · [D 종료](validation/m2c-d-status-stop-user-report.json) · [원격 코드 반영](validation/m2c-publication-readback.json)
