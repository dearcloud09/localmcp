# 실행 진행표

갱신: 2026-09-20 · [1pager](onepager.ko.md) · `feat/m1-modular-runtime` · PR #1 Draft.

## 현재 판정
**A 설치·회귀: verification_pending — 설치·타입·빌드는 통과했으나 full-tests가 종료 코드 1로 실패한 사용자 보고.** 기존 R2와 원래 후보는 보존됐다. 원인 확인 없이 의존성 회귀나 검사 환경 문제로 단정하지 않는다. [새 실행 보고](validation/m2c-a-install-test-failure-user-report.json)

## 새 실제 실행 보고와 실패 진단
사용자가 A_INSTALL_VERIFIED 뒤 전체 A_install_regression JSON과 PHASE_EXIT=1을 제공했다. Node v23.11.0, npm 11.4.2, darwin/arm64, 소스 HEAD 8dd7876192c1290d7d18bd70cc9b6d264aca34c4다. 주 담당은 원시 로그·맥 파일을 직접 읽지 않았고 제품 검사를 재실행하지 않았다.

| 단계 | 결과 |
|---|---|
| npm-version | passed, exitCode=0 |
| npm-ci | passed, exitCode=0; 패키지 본문 설치, 설치 lifecycle 비활성 |
| typecheck | passed, exitCode=0 |
| build | passed, exitCode=0 |
| full-tests | failed, exitCode=1, signal=null, reason=null, cleanupConfirmed=true |

모든 실행된 단계에서 cleanupConfirmed=true다. reason=null은 실행기에서 timeout/output_limit/launch failure를 기록하지 않았다는 뜻이며 개별 테스트 내부 timeout까지 부정하지 않는다. TESTS_FAILED는 wrapper의 요약 코드이며 구체적인 assertion·실패 개수·하위 npm 스크립트 위치는 미확인이다.

검토한 원본 실행기는 npm test가 0인지 확인한 뒤에만 tapTotals를 저장한다. 따라서 실패 보고에 counts가 없다는 것은 로그가 사라졌다는 뜻이 아니다. 또한 그 집계는 TAP의 # lines를 대상으로 하며, Node v23.11 공식 문서는 기본 spec reporter 및 버전별 출력 변화 가능성을 설명한다. 이것은 집계의 한계로 확인했지만 이번 테스트 실패의 원인으로 확정하지 않는다. https://nodejs.org/download/release/v23.11.0/docs/api/test.html#test-reporters

내보낸 추적 파일은 138개, source manifest는 207cd73a6d49ff05329987bdf93a5eb373d9b32d10a62f51d7488428c9c1633f라는 보고다. 새 candidateBuildManifestSha256은 d093a515eca545d75117ae7b9fb363445502dcfd03c48b7c902ffedd58c7f637로 앞선 기준 문자열과 같다. raw dist를 독립 수신·전수 재계산한 것은 아니며 native 의존성은 이 dist 집계와 별개다. reproducibleBuildVerified=false와 exactSourceToBuildProven=false를 유지한다.

originalProjectUnchanged=true와 originalCandidateUnchanged=true는 원래 R2 snapshot 및 원래 후보 파일에 대한 사후 검사 결과다. 검증 사본의 candidateFilesAndTrackedSourceUnchanged 최종 검사는 full-tests 뒤에 있어 도달하지 않았다. 따라서 검증 사본의 테스트 후 전체 소스 불변까지 성공으로 추정하지 않는다. 임시 디렉터리는 보존돼 있다.

실행기 SHA-256 3ace131e96c8f66bc8d415acf02e6edf75a01238a57bd535c6ff975bd4b3c4f8를 이번에 ZIP에서 재확인하고 실패·로그 저장 분기를 대조했다. 이후 sdk-smoke, wrangler-version, native-smoke, installed-audit, final invariance는 미실행이다. 최종 성공 표시와 원본 의존성 수정 완료는 성립하지 않는다.

### 다음 한 단계: 기존 로그만 읽기
고정된 해당 검사 디렉터리의 report.json, logs/full-tests.stdout, logs/full-tests.stderr 세 파일만 읽는다. 후보 해시·sourceHead·실패 단계가 이번 보고와 같은지 먼저 확인한다. 링크/소유자/크기·읽기 중 변경을 검사하고, 실패 제목·진단 문맥·집계 줄을 한정해 추출하며 경로·URL·민감 필드·명령을 가린다. 파일 쓰기·서브프로세스·네트워크·패키지 로딩·재설치·재테스트·LocalMCP 호출은 없다.

진단기는 합성 TAP/spec/stderr fixture와 실제 Node 읽기 실행으로 9개 조건을 검사했다. 이는 제품 실패 원인의 검증이 아니다. 정확한 오류를 받은 뒤 해당 테스트·관련 코드만 읽어 다음 행동을 결정한다. 미리 패키지 버전 변경, npm rebuild, 설치 lifecycle 활성화, .git 복사, 실패 테스트 제외로 우회하지 않는다. 신규 실패 원인 없이 전체 설치/후보 생성/C/E1/D 검사를 반복하지 않는다.

## 후보와 승인된 실행 계약
후보의 직접 devDependencies는 wrangler 4.131.0, @cloudflare/workers-types 5.20260910.1이다. Miniflare 5.20260910.0-alpha → Sharp 0.35.4, workerd 1.20260910.1을 포함한다. 앞선 lock-only 감사 0건은 그 후보·실행 시점의 사용자 보고이고 설치 트리 감사는 이번에 아직 도달하지 않았다. 기존 원본의 high 3개를 해결 완료로 표시하지 않는다.

고정 후보 package SHA-256은 6694256b3bbe76baa5bd4e169a266ac62bcb9ebe8db88092f71b4d744330a591, lock SHA-256은 d0397dedfdbac5fdf8f0eb95aaaaaaba9833cfb58ba0a9a2e0faa75d9cef13bd다. 원시 후보·설치 트리·native 바이너리를 주 담당이 직접 수신하지 않았다. 사용자 보고와 실제 도구 응답을 혼동하지 않는다.

승인 범위는 새 임시 사본의 패키지/해당 플랫폼 네이티브 파일 설치와 명시적 로컬 회귀 검사다. 원본 R1/R2·E1/D·원격 package/lock에 후보를 반영하거나 설치 스크립트 활성화·npm rebuild·Docker 설치·공개 중계·로그인·배포하는 승인이 아니다. 별도 HOME/cache/logs는 OS 샌드박스가 아니다.

실행기는 R2의 고정 Git 객체만 새 사본으로 내보내고 .git 및 기존 node_modules/dist, 미추적 파일은 복사하지 않았다. npm ci --ignore-scripts 및 strict-peer/dev/optional/peer 조건을 사용했다. 이 환경 차이는 조사 변수일 뿐 이번 실패 원인으로 확정하지 않는다. 재개는 기존 설치 자료를 활용하고 실패 로그가 다음 검사 범위를 결정하도록 한다.

## 유지되는 관문과 변경 경계
기존 E1 연결·versioned read와 C의 SDK 1.30.0, stdio 9 + loopback HTTP 9개 한정된 통과는 유지한다. 새 의존성 조합의 통과로 자동 승계하지 않는다. D는 최초 edit_file 호스트 차단 blocked 및 이후 before 확인·D agent 종료 pass다. D 파일·ID·차단 요청을 이번 회귀에서 재사용하거나 다른 경로로 대신 실행하지 않는다. B의 실제 Docker는 알려진 경로가 없어 미실행이다.

이번 주 담당의 LocalMCP 호출·맥 실행·제품 재테스트는 0회다. Git 변경은 1pager·진행표·새 설치/테스트 실패 보고뿐이고 이전 근거 JSON·제품 소스·테스트·package/lock은 보존한다. PR Draft·main 미병합·배포 없음과 MIT 고지를 유지한다. 문서 갱신 때문에 R2 pull·재빌드·완료 검사를 반복하지 않는다.

[설치 승인·원본 실행 계약](validation/m2c-a-install-authorization-runner.json) · [후보 lock 보고](validation/m2c-a-lock-candidate-user-report.json) · [C 기록](validation/m2c-scoped-lifecycle-user-report.json) · [D 종료](validation/m2c-d-status-stop-user-report.json) · [직전 상세 진행표](https://github.com/dearcloud09/localmcp/blob/a47d918fd071c2be60c5476778c13ad6b7e43726/docs/progress.md).
