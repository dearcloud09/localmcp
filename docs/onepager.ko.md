# LocalMCP 모듈형 코딩 실행환경 — 1pager

갱신: 2026-09-20 · `dearcloud09/localmcp` · `feat/m1-modular-runtime` · [진행표](progress.md)

## 최신 진단 — 테스트 assertion 전 tsx IPC 기동 실패
**A 설치·회귀: verification_pending.** 기존 로그 진단에서 stdout에는 npm test 명령만 있고, stderr에는 `createIpcServer`의 `listen EINVAL`과 `.pipe` 주소가 보고됐다. 테스트 assertion 실패 목록이 아니라 tsx 실행기 기동 오류다. 제공했던 실행기의 `TMPDIR=검사디렉터리/tmp`와 보고된 경로·UID/PID를 대조해 재구성한 소켓 경로는 105바이트로, Node 23.11 문서의 macOS 기준 103바이트를 넘는다. 실행기 임시 경로 설계의 결함으로 판단하며, 변경된 의존성의 회귀로 단정하지 않는다. [진단·재개 기록](validation/m2c-a-tsx-ipc-diagnosis-resume.json)

검토한 tsx v4.23.13 원문은 os.tmpdir()/tsx-<uid>/<pid>.pipe에서 IPC 서버를 먼저 만든 뒤 테스트 자식을 시작한다. 이번 실패 경로에서 테스트 자식 실행에 도달하지 못했다는 판단을 뒷받침한다. 원시 맥 stderr는 주 담당이 받지 않았고 경로 길이 계산은 마스킹 전 경로를 재구성한 값이다. 재개 도구가 원래 로그의 길이·해시와 실제 주소를 로컬에서 확인하도록 했다. 맥의 수정 전후 실행 대조는 아직 미실행이다.

재개는 기존 설치·타입 검사·빌드 성공을 보존하고 새 전용 짧은 임시 디렉터리에서 TMPDIR/TMP/TEMP만 변경한다. 짧은 Unix 소켓 생성/종료와 같은 설치본 tsx 기동을 먼저 확인한 뒤 기존 npm test → SDK smoke → Wrangler → native smoke → 설치 트리 감사 → 불변 검사를 진행한다. 재설치·재빌드·후보 재생성·테스트 제외·설치 스크립트 활성화는 없다. 이전 report/로그를 덮지 않고 별도 create-only 결과 경로를 사용한다. 이 수정은 D의 호스트 차단과 무관하며 D 편집을 재시도하지 않는다.

## 확인된 후보와 기존 결과
| 관문 | 상태 |
|---|---|
| A lock 후보 | 사용자 보고 기준 pass. Wrangler 4.131.0 → Miniflare 5.20260910.0-alpha → Sharp 0.35.4; Workers types 5.20260910.1. 후보 감사 0건 |
| A 설치·회귀 | 설치·타입·빌드 통과 보고. tsx IPC 경로 초과 진단, 짧은 TMP 재개 도구 준비; 실제 재개 결과 대기 |
| 기존 E1 연결·읽기 | 별도 대화의 사용자 근거 기준 pass. 기존 샘플 보존 |
| C | SDK 1.30.0, stdio 9 + loopback HTTP 9개 한정된 pass 유지. 새 의존성 조합에 자동 승계하지 않음 |
| D | 최초 편집 호스트 차단 blocked 유지. 로컬 before 확인·D 전용 agent 종료 pass. 재시도하지 않음 |
| B | 알려진 Docker 실행 경로가 없어 실제 E0-D 미실행. 설치·이미지 다운로드는 별도 승인 |

후보의 변경된 비루트 lock 항목은 사용자 보고에서 36개이며 모두 dev 분류다. 비개발 lock 항목 불변은 개발 도구의 실행 영향 부재를 의미하지 않는다. 후보 감사 0건도 원본 설치 환경의 수정 완료가 아니다.

## 식별값과 경계
R2 기준 HEAD: `8dd7876192c1290d7d18bd70cc9b6d264aca34c4`. 기존 dist manifest: `d093a515eca545d75117ae7b9fb363445502dcfd03c48b7c902ffedd58c7f637`.

후보 package SHA-256: `6694256b3bbe76baa5bd4e169a266ac62bcb9ebe8db88092f71b4d744330a591`. 후보 lock SHA-256: `d0397dedfdbac5fdf8f0eb95aaaaaaba9833cfb58ba0a9a2e0faa75d9cef13bd`.

원본 실행기 SHA-256: `3ace131e96c8f66bc8d415acf02e6edf75a01238a57bd535c6ff975bd4b3c4f8`. 성공 표시는 A_ISOLATED_INSTALL_REGRESSION_OK이며 설치·검사·불변·정리·감사 조건을 모두 요구한다. 이것도 원본 반영이나 source-to-build 재현성 증명은 아니다.

이번 Git 변경은 문서와 새 IPC 진단/재개 준비 기록뿐이다. 이전 승인/준비 기록은 보존한다. 제품 소스·테스트·package/lock·기존 증거는 변경하지 않는다. PR Draft·main 미병합·배포 없음. 이전 502·주 대화 FORBIDDEN·D 안전 차단을 하나의 원인으로 단정하지 않고, 차단된 요청을 다른 경로로 실행하지 않는다. 기존 성공 검증과 MIT 고지를 유지한다.

[후보 보고](validation/m2c-a-lock-candidate-user-report.json) · [C 기록](validation/m2c-scoped-lifecycle-user-report.json) · [D 종료](validation/m2c-d-status-stop-user-report.json) · [직전 상세 1pager](https://github.com/dearcloud09/localmcp/blob/b0311f0a025cab87363a09264caf17993f57573c/docs/onepager.ko.md)
