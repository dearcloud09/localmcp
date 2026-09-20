# LocalMCP 모듈형 코딩 실행환경 — 1pager

갱신: 2026-09-20 · `dearcloud09/localmcp` · `feat/m1-modular-runtime` · [진행표](progress.md)

## 목표와 현재 판단
ChatGPT가 판단하고 포크가 실행·권한·기록을 맡는다. `ChatGPT → MCP → 공통 코어 → 파일 / Git / 검사 / 전문 도구`. 새 기능보다 남은 검증을 우선한다. 전체 프로젝트는 **verification_pending**, PR #1은 Draft다.

## D — 별도 샘플·중계 등록·실계정 편집 승인 확보
사용자는 기존 E1을 그대로 둔 채 두 무비밀 텍스트 파일을 사용하는 별도 테스트 서버·중계 등록·앱 연결과 guarded-edit 검증을 승인했다. 이 범위의 운영자 패키지를 준비했다. **승인 및 실행 도구 준비 완료이며, 맥의 D 샘플 생성·등록·기동·ChatGPT 호출은 아직 수행하지 않았다.** [승인·준비 기록](validation/m2c-d-authorization-preparation.json)

패키지는 기존 R2의 HEAD·clean·lock·dist manifest를 확인한 뒤 새 전용 디렉터리에 probe.txt와 reference.txt만 생성하고 별도 HOME/profile/state로 기존 lifecycle start를 호출한다. 원래 E1에는 접근하지 않는다. 새 등록 URL은 앱 등록용 클립보드로만 복사하고 원시 출력·로그·토큰을 채팅에 내보내지 않는다. 중복 setup은 초기화나 재등록 대신 거부한다. check와 stop은 D 전용으로 분리했다.

실계정 검사는 최초 workspace_info, 파일 집합/참조/버전 읽기, 단일 guarded edit, 동일 요청 replay, 별도 ID의 stale-hash 거부, 최종 재읽기와 파일 집합 대조다. Chat 결과와 별도 로컬 최종 상태 검사를 함께 수용하며, 준비 성공을 D 통과로 표시하지 않는다. memory/edit_file 범위이고 기존 E1·apply_patch·재시작 내구성·Docker·취약점 해결은 포함하지 않는다.

## 관문별 상태
| 관문 | 현재 상태 | 남은 작업 |
|---|---|---|
| A / DEP-01 | 감사 수집·패키지/advisory·의존 경로 식별 완료 | high 3개 수정 및 수정 후 감사·영향 검증 미실행 |
| 연결·읽기 | 별도 대화 workspace_info 및 versioned read 성공 사용자 근거 | 기존 E1 읽기 점검 완료. 주 대화의 마지막 FORBIDDEN은 별도 유지 |
| B / E0-D | 알려진 Docker CLI 경로 없음 | 실제 Docker 미실행. 설치·이미지 다운로드는 별도 승인 |
| C / 영속 lifecycle | SDK 1.30.0, stdio 9 + loopback HTTP 9개 사용자 실행 근거 기준 pass | 열거한 범위 완료. 동일 검사 반복 없음 |
| D / 새 실계정 guarded edit | **새 전용 샘플·등록·앱·편집 범위 승인, 운영자 패키지 준비** | 맥 setup → 허용된 웹 대화의 새 앱 호출 → 로컬 check → D만 stop |

## 후보·근거·변경 경계
R2 기준은 `8dd7876192c1290d7d18bd70cc9b6d264aca34c4`, dist manifest는 `d093a515eca545d75117ae7b9fb363445502dcfd03c48b7c902ffedd58c7f637`다. exactSourceToBuildProven=false를 유지한다. 문서 갱신 때문에 R2 pull·재빌드·성공한 감사/C/재연결을 반복하지 않는다.

기존 읽기는 수정 완료된 44바이트 코드와 SHA-256 `76f26bd292166033d02e77bdb8fe6aec01e915ccb8cb3f93b8971f9dcd78250e`의 사용자 보고 및 재계산 일치 근거다. 과거 502, 주 대화 FORBIDDEN, 별도 대화 성공의 원인을 하나로 단정하지 않는다. 파일 권한을 npm·Docker 실행 권한으로 확대하지 않는다.

이번 변경은 1pager·진행표·승인/준비 JSON이다. 제품 소스·테스트·의존성·기존 증거·기존 E1·main·배포·과금은 변경하지 않았다. 패키지의 Linux 대역 17개 동작 점검과 14회 출력 canary 검사는 실제 macOS/중계/ChatGPT 검사가 아니다. PR Draft와 MIT 고지를 유지한다.

[기존 읽기](validation/m2c-versioned-read-user-report.json) · [C 통과](validation/m2c-scoped-lifecycle-user-report.json) · [감사·재기동](validation/m2c-audit-reconnect-user-report.json) · [이전 상세 1pager](https://github.com/dearcloud09/localmcp/blob/cc86a388565e8d474b70a7fc0b3c3a9d7364f709/docs/onepager.ko.md)
