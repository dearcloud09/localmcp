# LocalMCP 모듈형 코딩 실행환경 — 1pager

갱신: 2026-09-21 · `dearcloud09/localmcp` · `feat/m1-modular-runtime` · [진행표](progress.md)

## A — 검증된 의존성 manifest 채택
`248f4edac3343c832e8d0967af853a6a14d7f49e`의 package.json·package-lock.json은 사용자에게 받은 검증 후보 원문이다. 두 파일의 SHA-256과 Git blob을 직접 재계산해 기존 후보 실행 보고의 해시와 일치함을 확인했다. 새로 해석하거나 재포맷한 lock이 아니다. [채택 기록](validation/m2c-a-manifest-adoption.json)

직접 변경은 개발 의존성 Wrangler `^4.129.0` → `4.131.0`, Workers types `^5.20260906.1` → `5.20260910.1` 두 값이다. 실행 의존성 선언·스크립트·engines·제품 버전·MIT 고지는 유지한다. lock에는 Miniflare `5.20260910.0-alpha`, Sharp `0.35.4`, workerd `1.20260910.1`이 포함된다.

후보의 macOS arm64 설치·타입·빌드, 기존 npm test 379개, 실제 SDK stdio smoke, Wrangler 실행, 네이티브 7개 점검과 설치 후 감사 0건은 이전 사용자 실행 근거로 수용했다. 이번 파일 채택에서 그 검사를 다시 실행하지 않았다. [후보 실행 근거](validation/m2c-a-isolated-regression-pass-user-report.json)

## 반영 범위와 완료 판정
게시 도구는 고정 부모의 기존 파일 blob, manifest 전체 차이, 정확히 다섯 파일의 커밋 범위를 검사한 후 일반 push를 한 번만 수행한다. 이 커밋의 원격 게시 완료는 운영자 결과와 branch ref 재읽기로 확인하며, 초안 파일 존재만으로 게시 성공이라 하지 않는다.

원격 작업 브랜치의 manifest 채택과 맥의 R1/R2 설치환경 갱신은 별개다. 원래 node_modules/dist·기존 E1/D·서버·권한은 변경하지 않는다. PR Draft, main 미병합, 배포 없음 및 전체 프로젝트 verification_pending은 유지한다.

## 남아 있는 관문
| 관문 | 상태와 경계 |
|---|---|
| A 후보 설치·회귀 | pass — 이전 사용자 실행 근거. 원문 수신·해시 대조 완료. 작업 브랜치 게시·직접 원격 대조 완료 |
| 기존 E1 | 별도 대화의 연결·versioned read 한정된 pass 유지; 기존 샘플 보존 |
| C | SDK 1.30.0, 두 전송 18개 한정된 pass 유지; 새 검사와 합산하지 않음 |
| D | 최초 편집 호스트 차단 blocked; D 전용 agent 종료 pass. 차단된 요청 재시도 없음 |
| B | 실제 Docker 미실행; 설치·이미지 다운로드 별도 승인 |

감사 0건은 검증 시점과 후보의 결과이지 모든 취약점 부재의 보장이 아니다. Linux 등 다른 플랫폼의 설치·네이티브 호환성, 정확한 실행 commit 및 재현 빌드는 미증명이다. 성공한 검사·설치·빌드를 이유 없이 반복하지 않는다.

[이전 상세 상태](https://github.com/dearcloud09/localmcp/blob/d523b3da30dc4cbfe4252902bf317ffcc2498507/docs/progress.md) · [D 종료](validation/m2c-d-status-stop-user-report.json) · [C 결과](validation/m2c-scoped-lifecycle-user-report.json)

## 챗 직접 개발을 시작하는 다음 관문
[호스트 차단 검토·실사용 준비안](chat-development-readiness.ko.md)을 추가했다. 원격 소스의 edit_file annotations 전달 경로와 현재 D 앱 승인 설정을 확인했지만, 차단 원인은 미확인이다. 쓰기 지원에 관한 공식 문서의 불일치는 지원 요청에서 확인한다. 기존 차단을 재시도하거나 권한을 바꾸지 않았다.

첫 대상은 LocalMCP의 비밀정보 없는 단일 분리 사본으로 준비하되 아직 만들거나 연결하지 않았다. fileWrite는 편집만이 아니라 변경 6종의 공통 권한임을 명시한다. 파일-only 사용은 Docker와 분리하고, 공개 샘플 중계의 실제 프로젝트 확대는 하지 않는다. 지원 요청 초안은 작성했지만 미제출이다.
