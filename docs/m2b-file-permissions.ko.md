# M2b-01b — 파일 읽기·쓰기 권한

이 단계는 `62b179c`의 시작 정책 위에서 **파일 도구**의 조회와 변경을 분리한다. [1pager](onepager.ko.md)·[진행표](progress.md)·[검증 JSON](validation/m2b-file-permissions-local.json)을 함께 확인한다.

## 설정과 기본값

설정에 다음 블록을 사용한다. 생략하면 같은 읽기 전용 기본값을 사용한다.

```json
"permissions": {
  "fileRead": true,
  "fileWrite": false
}
```

읽기와 편집을 함께 허용할 때만 `fileWrite`를 true로 바꾼다. `fileRead=false, fileWrite=true`는 지원하지 않는다. 편집과 패치는 기존 내용을 읽기 때문이다. 문자열 `"true"`, null, 알 수 없는 키 등은 거부한다. `features.files=false`는 두 권한을 모두 끄는 상위 스위치다. 별도의 권한 확대용 환경변수는 추가하지 않았다.

이 정책은 서버에 등록된 모든 workspace의 **파일 도구**에 적용한다. workspace별 권한은 후속 범위다. 셸·프로세스·외부 MCP는 다른 권한이며, 이것만으로 머신 전체가 읽기 전용이 되지는 않는다.

## 실제 호출에서의 적용

조회 7종은 files + fileRead를 요구한다: list_directory, workspace_tree, stat_path, find_files, search_files, read_file, read_file_lines.

변경 6종은 files + fileRead + fileWrite를 모두 요구한다: write_file, edit_file, apply_patch, create_directory, delete_path, move_path.

권한이 없으면 tools/list에서 제외하고, 이름을 알고 직접 호출해도 공통 registry가 parse/execute 전에 거부한다. 이전에 받은 도구 목록이나 호출 인자의 `fileWrite:true`는 권한이 아니다. readOnlyHint 같은 MCP annotation도 권한 검사 대신 사용하지 않는다. 저수준 Workspace 라이브러리를 직접 호출하는 임베딩에는 이 dispatcher 검사가 자동으로 생기지 않는다.

workspace_info의 `filePermissions`는 유효 read/write와 `scope: file-tools`를 보여준다. shell을 명시적으로 켰거나 외부 MCP에 별도 실행 권한을 줬다면, 그 프로그램은 파일 도구 설정과 무관하게 호스트 권한으로 작업할 수 있다. 민감 파일과 OS 격리는 아직 미완료다.

## 구버전에서의 전환

기존 JSON에 permissions가 없으면 이제 파일 수정이 거부된다. 필요한 프로젝트에 한해 외부 설정 파일에 권한을 명시한다. 코드가 자동으로 기존 설정을 넓히거나 덮어쓰지는 않는다.

M2a init/demo는 **편집 연결 검증용** 도구다. 새로 생성하는 프로필에는 fileRead=true와 fileWrite=true를 명시하고, 셸·프로세스·Skills·외부 MCP는 끈다. 기본 예제 localmcp.example.json과 일반 생략 설정은 read-only다. 두 목적을 혼동하지 않는다.

구버전 M2a 프로필은 doctor에서 NOT_SMOKE_PROFILE로 거부된다. 기존 파일을 보존한 상태로 새 이름에 init/demo 프로필을 만들거나, 변경 필요성을 검토한 뒤 명시적 권한을 추가한다. doctor의 성공은 실제 MCP 연결 성공이 아니다.

직접 createServer를 쓰는 개발자는 Config에 fileRead/fileWrite를 명시해야 한다. 없는 값을 임의로 쓰기 허용으로 바꾸지 않는다. 파일 권한 추가로 도구 입력 스키마는 바꾸지 않았지만, 노출되는 도구 수는 설정에 따라 줄어든다.

## 설정 재로딩과 검증

유효한 새 설정이 적용된 뒤 다음 호출은 새 권한을 따른다. 이미 실행 중인 호출은 중단하거나 롤백하지 않는다. malformed reload를 거부하고 이전 설정을 유지하는 기존 규칙은 그대로다. 일괄 권한 회수가 필요하면 별도의 종료/프로세스 관리가 필요하다.

이번에 독립 권한/프로필/기존 모듈 67개와 해당 TS strict 검사를 실행했다. 전체 의존성 기반 SDK/config/hot reload 6개는 작성했지만 미실행이다. 전체 체크아웃에서 검증할 명령은 다음과 같다. 서버나 터널은 시작하지 않는다.

```sh
npm run check && npm run build && npm test
```

이번 구현은 내부 boolean 검사와 함수 호출을 사용하며 하위 MCP나 새 네트워크 왕복을 추가하지 않았다. 실제 지연시간은 아직 측정하지 않았다.
