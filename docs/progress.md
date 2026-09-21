# 실행 진행표

갱신: 2026-09-21 · [1pager](onepager.ko.md) · `feat/m1-modular-runtime` · PR #1 Draft.

## 현재 판정
A 후보의 분리 설치·회귀 pass를 유지하며, 검증된 package.json·package-lock.json 원문 수신과 해시 확인을 완료했다. 채택 커밋 248f4edac3343c832e8d0967af853a6a14d7f49e의 게시와 원격 대조도 완료했다. 원격 branch ref 게시 결과와 맥 원본 설치환경 갱신은 별개이며 전체 프로젝트는 verification_pending이다. [원문 채택 기록](validation/m2c-a-manifest-adoption.json)

## 직접 확인한 파일
| 파일 | 바이트 | SHA-256 | Git blob |
|---|---:|---|---|
| package.json | 2692 | 6694256b3bbe76baa5bd4e169a266ac62bcb9ebe8db88092f71b4d744330a591 | 9c13f284bf129281dedd4d770cb23ae79e368e8b |
| package-lock.json | 125093 | d0397dedfdbac5fdf8f0eb95aaaaaaba9833cfb58ba0a9a2e0faa75d9cef13bd | 48253e020d8901ed96b2fc422d7122bbdde05d64 |

두 SHA-256은 이전 사용자 실행 보고와 일치한다. 첨부 lock의 packages는 루트 제외 248개이고 그 중 dev=true가 아닌 항목은 95개다. PR 설명에 나타났던 233개라는 집계와 구분해 실제 원문 파싱값을 사용한다. 원본 manifest의 실행 여부를 새로 검증한 것이 아니라, 기존 성공 보고에서 지정한 파일과 받은 바이트를 결합한 증거다.

package.json은 이전 원격 blob 0faca9632cc8929ea262d39dc7b0f981f9ea34e7과 대조해 두 devDependencies 값만 다름을 확인했다. scripts·실행 dependencies·engines·라이선스·name/version·나머지 메타데이터는 그대로다. lock 루트의 dependencies/devDependencies가 package.json과 일치하고 overrides는 추가하지 않았다.

## 게시 직전 차이·불변 검사
원격 부모 d523b3da30dc4cbfe4252902bf317ffcc2498507과 기존 lock blob 32b1658c5497d908a5fb91f2448519f788bf6b31을 고정한다. 게시 도구는 원격에서 받은 전체 바이트의 blob을 검사한 후 JSON 전체를 대조한다. 비루트 lock 항목 추가·제거 0개, 변경 36개, 변경 전후 dev=true 및 비개발 95개 항목 전체 불변을 요구한다. 허용한 Sharp/libvips·workerd 플랫폼 항목과 Miniflare/Wrangler/Workers types 이외의 변경이 있으면 게시하지 않는다.

libc 등 플랫폼 메타데이터를 임의로 추가하거나 lock을 재생성하지 않는다. 현재 검증 범위는 macOS arm64다. Linux의 설치 및 네이티브 동작은 별도 관문으로 남겨 둔다.

새 임시 Git 저장소에서만 다섯 파일의 blob/tree/commit을 작성한다. 커밋에서 다시 읽은 파일들이 원문 해시와 정확히 같고 변경 경로가 다섯 개뿐인지 확인한다. 기존 원격 대상과 Git 작성자 설정을 읽되 자격증명·전체 설정·원시 프로세스 인자를 출력하지 않는다. 원격 부모가 달라졌거나 기존 보안/서명/훅 설정을 이 경로에서 유지할 수 없으면 중단한다. 정상 push 1회 및 원격 ref readback 외에 force·재시도·다른 remote fallback은 없다.

## 재사용한 실행 근거
[기존 최종 수용 기록](validation/m2c-a-isolated-regression-pass-user-report.json)은 macOS arm64, Node v23.11.0, npm 11.4.2 및 소스 8dd7876192c1290d7d18bd70cc9b6d264aca34c4 기준이다. 설치·타입·빌드, npm test 336+32+11=379개, 실제 SDK stdio smoke와 Wrangler 버전, 네이티브 7개 checkpoint, 설치 후 감사 0건의 사용자 실행 근거를 유지한다. 이번 게시 단계에서 재설치·빌드·제품 테스트·감사는 하지 않는다.

이전 실행기의 긴 TMPDIR와 Miniflare 옵션 불일치, 그 수정 뒤 통과는 과거 증거 JSON에 보존한다. 실패를 삭제하거나 기준을 낮추지 않는다. 원시 맥 report/audit 및 모든 의존성 본문을 새로 수신했다고 하지 않는다. 받은 것은 검증 manifest 두 파일이다.

## 변경·승인 경계
채택 커밋 248f4edac3343c832e8d0967af853a6a14d7f49e은 package.json, package-lock.json, docs/onepager.ko.md, docs/progress.md, docs/validation/m2c-a-manifest-adoption.json만 포함한다. 이전 JSON·제품 소스·제품 테스트·원본 작업 파일·node_modules/dist·서버·권한·E1/D·main·배포는 변경하지 않는다. 채팅 산출물에 있는 게시 도구의 존재는 원격 게시 완료 증명이 아니며 결과는 운영자 report/실제 ref로 확인한다.

기존 E1 읽기 및 C의 두 전송 18개 한정된 pass, D의 blocked/전용 agent 종료 상태는 유지한다. B 실제 Docker는 미실행이다. exactSourceToBuildProven=false, reproducibleBuildVerified=false도 유지한다. 문서와 동일 바이트 게시 때문에 이미 통과한 검사를 반복하지 않는다.

[직전 상세 진행표](https://github.com/dearcloud09/localmcp/blob/d523b3da30dc4cbfe4252902bf317ffcc2498507/docs/progress.md)에 이전 설치·검증 수용의 전체 맥락을 보존한다.

## 2026-09-21 — 챗 실사용 시작 관문 검토

이번 추가 작업은 [실사용 준비안](chat-development-readiness.ko.md)의 근거와 승인 경계를 정한 것이다.

- 직접 조회: PR HEAD 248f4ed, Draft/open/미병합; LocalMCP-D 앱 설정 found, Allow low-risk actions 상속. 계정 요금제·조직 정책·차단 당시 설정은 이 조회로 확인할 수 없다.
- 정적 코드 검토: files.ts → define.ts → registry.ts → server.ts. edit_file은 readOnlyHint=false/destructiveHint=true/openWorldHint=false이고 세 필드가 tools/list까지 전달되는 코드 경로를 확인했다. 차단 당시 실서버 descriptor나 호스트 snapshot을 확보한 것은 아니다.
- 권한 경계: fileWrite는 변경 6종 및 등록된 workspace 전체에 적용한다. edit_file만 강제로 허용하는 기능으로 오인하지 않는다.
- 공식 자료 확인: Developer mode 가이드와 Help Center의 Pro 쓰기 지원 설명이 불일치한다. 계정 지원 여부를 단정하거나 요금제 변경을 요청하지 않고 지원 검토 항목으로 남겼다.
- 준비 완료: 비밀값을 제외한 지원 요청 초안과 첫 LocalMCP 분리 사본의 도입 기준. 지원 제출·사본 생성·새 연결은 미실행이다.
- 전송 후보: 공식 Secure MCP Tunnel의 공개 listener 불필요 구조와 별도 Platform 권한/키/client 조건을 확인했다. 사용자 이용 가능성·비용은 미확인이다. 새 설치·등록·키 발급은 하지 않았다. 호스트 차단 우회 경로로 사용하지 않는다.

이번 LocalMCP 호출·차단 편집 재시도·제품 코드 변경·설치·테스트·서버 조작·권한 변경은 0회다. 새 파일은 위 준비안이며 1pager/진행표에 연결한다. 과거 증거 JSON과 manifest 바이트는 보존한다. 이후 실제 행동은 지원 검토와 사용자에게만 보이는 계정/대화 조건 확인에 따라 정한다.
