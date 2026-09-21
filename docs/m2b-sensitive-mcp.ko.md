# M2B-02 — 민감 경로와 하위 MCP 허용 목록

기준: `aaeb0cc`의 M2B-01b 위에 추가하는 애플리케이션 정책. [1pager](onepager.ko.md) · [진행표](progress.md) · [검증 기록](validation/m2b-boundaries-local.json)

## 파일 도구에서 달라지는 동작
읽기 권한이나 쓰기 권한을 켜도 다음 이름은 접근하지 않는다. 경로의 어느 깊이든 적용하며 대소문자와 일부 플랫폼 별칭을 보수적으로 정규화한다.

- `.env`, `.env.*` 전부(예제 파일도 포함).
- `.git`, `.localmcp`, `.ssh`, `.aws`, `.azure`, `.gnupg`, `.kube`, `.docker` 및 그 하위.
- `.npmrc`, `.pypirc`, `.netrc`, `_netrc`, `.git-credentials`, `localmcp.json`.
- id_rsa/id_dsa/id_ecdsa/id_ed25519 계열 이름, `.key/.pem/.p12/.pfx/.jks/.keystore` 확장자.

직접 읽기/쓰기/patch/stat뿐 아니라 목록·트리·검색에서도 제외한다. 목록의 total/pagination은 숨긴 항목을 제외한 값이다. 심볼릭 링크는 목록에서 제외하고 기존 경로 검사를 유지한다. 하드링크가 여럿인 파일의 내용 읽기는 거부한다.

디렉터리를 이동/삭제할 때는 자손까지 검사한다. 보호 파일이나 링크가 있으면 작업 전에 거부하며 node_modules 같은 일반 검색 제외 폴더도 이 검사에서는 건너뛰지 않는다. 노드 10,000개/깊이 64를 넘으면 TREE_SCAN_LIMIT으로 거부한다. 보호 파일을 담은 큰 프로젝트를 통째로 이동/삭제하는 작업은 파일 도구가 대신하지 않는다.

**비밀 내용 탐지기가 아니다.** 예를 들어 `src/config.ts`에 직접 적힌 API 키는 이름만으로 발견하지 못한다. `.pem` 공개 인증서처럼 비밀이 아닌 파일도 제한될 수 있다. `.gitignore`/`.gitkeep`은 허용한다. 임의 예외 옵션은 아직 없으며, 비밀 없는 명시적 작업 폴더가 기본 전제다.

## 외부 MCP는 사용할 도구 이름까지 명시
하위 MCP를 쓰지 않는 `mcpServers: {}` 설정은 그대로다. 활성 서버가 있다면 allowedTools가 필요하다. 아래는 형식 예시이며 해당 실행 파일을 설치하거나 시작하지 않는다.

```json
{
  "mcpServers": {
    "analysis": {
      "command": "/absolute/path/to/trusted-server",
      "args": ["mcp"],
      "allowedTools": ["find_symbol", "find_references"]
    }
  }
}
```

도구 이름은 서버가 문서화한 실제 이름으로 지정한다. 빈 목록·누락·중복·와일드카드 `*`는 거부한다. 사용하지 않는 항목은 `enabled: false`로 둔다. 기존 설정을 자동 수정하지 않는다. 허용된 도구만 list_mcp_tools에 반환하고 직접 call_mcp_tool 호출도 같은 목록으로 확인한다. readOnlyHint는 권한 근거가 아니다.

첫 발견에서 허용된 도구의 설명·inputSchema·outputSchema·annotations를 현재 연결의 기준으로 저장한다. 이후 발견에서 바뀌면 MCP_TOOL_CHANGED로 격리하며 예전 이름으로 직접 호출해도 거부한다. 원래 명세로 되돌린 것만으로 자동 해제하지 않는다. 운영자가 변경을 검토한 후 서버를 재시작해 새 연결을 만들어야 한다. 이는 패키지 무결성이나 실제 실행 의미의 증명이 아니며, 최초 발견 자체의 신뢰는 로컬 운영자에게 있다.

도구가 계속 새 목록 cursor를 반환하는 경우를 제한하고, 실패한 목록 갱신 뒤 과거 descriptor로 계속 호출하지 않는다. 모든 활성 서버의 허용 목록을 먼저 검사해, 뒤쪽 설정 오류가 앞쪽 프로세스 시작 이후에 발견되지 않게 한다. 매 호출마다 별도 네트워크 발견을 추가하지는 않는다.

## 정책 범위
파일 도구 이름 필터와 외부 MCP 도구 허용 목록은 서로 다른 경계다. 허용된 하위 도구가 어떤 경로를 읽는지, 셸이 호스트에 무엇을 실행하는지까지 이 정책이 제한하지 않는다. `fileWrite=false`도 외부 서버 전체를 read-only로 만들지 않는다. Git 상태 출력에는 파일 도구가 숨긴 이름이 나올 수 있다. OS 격리·하위 서버 환경/네트워크 제한은 M2B-03이다.

검사 중 악의적인 같은 사용자 프로세스가 경로를 바꾸는 모든 경쟁 조건, 실행 중인 작업 취소, 서버 구현이 설명과 달라지는 문제를 해결했다고 주장하지 않는다. 실패한 hot reload는 마지막 유효 설정을 유지한다.

## 검증과 적용
새 검사는 기존 `test/*.test.ts` 경로로 npm test에 포함된다. 완전한 checkout/의존성 환경에서 먼저 `npm run check && npm run build && npm test`를 실행한다. CI는 한도 때문에 보류하며 로컬 독립 검사와 실제 SDK/ChatGPT 연결을 분리한다.

이번 환경에서 77개 독립 검사는 실행했으나 `boundary-integration.test.ts`의 실제 SDK/config/stdio 검사 5개는 미실행이다. 해당 검사는 가짜 비밀 파일·임시 폴더·테스트용 로컬 MCP만 사용하고 공개 터널이나 계정 연결은 시작하지 않는다. 샘플 E1은 별도 실제 연결 검증이다.
