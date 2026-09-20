# LocalMCP 모듈형 코딩 실행환경 — 1pager

갱신: 2026-09-20 · `dearcloud09/localmcp` · `feat/m1-modular-runtime` · [진행표](progress.md)

## 최신 결과 — 379개 테스트·SDK smoke 통과, native 검사 옵션 오류
**A 설치·회귀와 전체 프로젝트: verification_pending.** 사용자 재개 보고에서 짧은 IPC probe, 동일 tsx 기동, npm test, SDK smoke, Wrangler 버전이 모두 통과했다. npm test 집계는 336/32/11개, 합계 379개이며 실패·skip·cancelled·todo는 0이다. SDK smoke는 별도 검사로 합산하지 않는다. 이전 긴 소켓 105바이트와 짧은 probe 42바이트도 로컬 확인됐다는 보고를 확보했다.

남은 실패는 native-smoke의 Miniflare 생성자 ERR_VALIDATION이다. 제공했던 검사 코드의 최상위 script/modules 옵션은 이 Miniflare 5.20260910.0-alpha가 요구하는 workers[].config.manifest 구조와 다르다. 고정 upstream 태그의 실제 스키마와 테스트를 대조해 **운영자 검사 코드의 API 불일치**로 진단했다. 제품 소스나 패키지를 바꿀 근거로 보지 않는다. [이번 결과·진단](validation/m2c-a-miniflare-options-resume.json)

## 다음 실행 — 남은 네이티브·감사만
기존 설치 사본과 두 실패 기록을 보존한다. 새 실행기는 설치된 Miniflare 타입으로 수정 옵션만 확인한 뒤 Sharp PNG 왕복·workerd 버전·Miniflare loopback 요청/종료, 설치 트리 감사와 불변 검사를 수행한다. 네이티브 내부 checkpoint를 별도 출력한다. 설치·전체 타입 검사·빌드·npm test·SDK smoke·Wrangler 버전은 반복하지 않는다.

기존 R2·후보·검증 소스·빌드·이전 로그를 사전/사후 대조하며 새 결과 경로는 create-only다. 실제 재개 결과는 아직 미수신이다. 실행기 자체의 21개 합성/로컬 Node 검사는 실제 Miniflare 패키지·macOS 실행 통과가 아니다. HOME/TMP 분리는 OS 샌드박스가 아니며 정리는 실행기가 만든 process group과 도달한 dispose 범위다.

## 관문과 보존 경계
| 관문 | 상태 |
|---|---|
| A lock 후보 | 당시 후보 감사 0건 사용자 보고 유지. 원본 적용 아님 |
| A 실행 | 설치·타입·빌드 및 379개 테스트·SDK smoke·Wrangler 통과 보고. 수정 native 검사와 설치 트리 감사 대기 |
| 기존 E1 | 별도 대화의 연결·versioned read pass 근거 유지, 기존 샘플 보존 |
| C | 실제 SDK 1.30.0, 두 전송 18개 한정된 pass 유지. 이번 결과와 합산하지 않음 |
| D | 호스트 편집 차단 blocked, 로컬 before 확인·D agent 종료 pass. 재시도하지 않음 |
| B | 실제 Docker 미실행. 설치·이미지 다운로드 별도 승인 |

후보는 Wrangler 4.131.0 → Miniflare 5.20260910.0-alpha → Sharp 0.35.4와 Workers types 5.20260910.1이다. R2 소스 기준은 8dd7876192c1290d7d18bd70cc9b6d264aca34c4이며 정확한 실행 commit/source-to-build 재현성 미증명은 유지한다.

이번 Git 변경은 1pager·진행표·새 결과/진단 JSON뿐이다. 제품 코드·테스트·원격 package/lock·이전 증거·E1/D·서버·권한·main·배포·비용은 변경하지 않는다. PR Draft·MIT 고지를 유지한다. [이전 상세 기록](https://github.com/dearcloud09/localmcp/blob/5767247fd752f7ceee472efb3e7fc1eb9ba2a429/docs/progress.md)
