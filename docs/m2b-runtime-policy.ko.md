# M2b-01a — 시작·설정 재로딩 정책

> M2b-01b 갱신: 파일 쓰기는 이제 별도 권한이며 기본값은 false다. [파일 권한·전환 안내](m2b-file-permissions.ko.md)를 함께 적용한다. 아래 시작 정책은 계속 유효하다.

이 변경은 `d22c579`의 M2a 위에 추가한다. 전체 로드맵은 [1pager](onepager.ko.md), 실제 검증 범위는 [진행표](progress.md)와 [검증 JSON](validation/m2b-policy-local.json)을 기준으로 한다.

## 바뀌는 동작

설정 파일과 프로젝트를 명시하지 않으면 실행하지 않는다. `LOCALMCP_ROOT`만 지정하고 없는 설정 파일을 가리키는 이전 방식도 거부한다. `localmcp init`은 기존 설정 검증만 수행하며, 더 이상 홈 전체를 연결하는 설정을 자동 생성하지 않는다.

설정에는 `root` 또는 비어 있지 않은 `workspaces` 중 하나를 사용한다. 설정은 모든 workspace 밖에 있어야 한다. 홈 전체·파일시스템 루트·홈의 상위 폴더·주요 자격증명/런타임 디렉터리와 겹치는 경로를 거부한다. 경로는 realpath로 확인한다. 설정 파일은 일반 파일/단일 hard link/64 KiB 이하이며 POSIX에서 그룹·다른 사용자 쓰기를 허용하지 않아야 한다. 이 조건은 악의적인 로컬 프로세스에 대한 완전한 방어가 아니다.

셸·지속 프로세스는 각각 설정에서 명시해야 하며 기본값은 false다. Skills도 enabled를 명시해야 로드된다. `LOCALMCP_SHELL=0`은 실행을 끌 수 있지만 `=1`로 설정에서 허용하지 않은 실행을 켤 수 없다. `LOCALMCP_ROOT`는 설정의 기본 프로젝트와 같은 실제 경로일 때만 허용한다.

기존 설정을 자동 변환하거나 덮어쓰지 않는다. 홈 workspace 설정은 업데이트 뒤 시작 시 거부될 수 있으며, 프로젝트 전용 프로필을 새로 만들어야 한다.

## 새 파일 전용 프로필

저장소에서 다음 형식을 사용한다. 프로젝트는 실제 존재해야 하고, 프로필 경로는 프로젝트 밖의 새 파일이어야 한다. 명령은 프로필만 만들며 서버/터널을 시작하지 않는다.

```sh
node scripts/project-profile.mjs init --workspace /absolute/project --config /absolute/outside/project-profile.json
node scripts/project-profile.mjs doctor --config /absolute/outside/project-profile.json
```

생성 프로필은 편집 검증용이므로 fileRead/fileWrite를 명시적으로 허용한다. `LOCALMCP_CONFIG`를 그 프로필로 지정해 사용한다. `localmcp.example.json`은 기본 읽기 전용이며 경로를 바꿔야 하는 예시이지 즉시 실행 가능한 설정이 아니다. 초기 파일 연결에는 생성 프로필의 셸/프로세스/Skills/외부 MCP 비활성 상태를 유지한다.

quick tunnel을 별도로 승인해 실행할 때의 상태 파일은 이제 현재 폴더의 `.localmcp` 대신 `~/.localmcp/quick`에 저장된다. 기존 quick 상태는 이동·삭제하지 않는다. 이 개발 작업에서 터널을 실행한 것은 아니다.

## 검사

완전한 checkout과 기존 의존성이 있는 환경에서:

```sh
npm run check && npm run build && npm test
```

새 `test/runtime-policy.test.ts`는 정책 단위 검사다. `test/runtime-config-integration.test.ts`는 실제 config loader와 init/start/agent/stdio/http/direct agent/quick launcher의 실패 경로를 검사한다. 이 검사는 잘못된 설정이 상태 파일·등록 호출을 만들지 않는지 확인하며, 잘못된 구현도 공개 Worker로 접속하지 않도록 로컬 HTTP 수신기를 사용한다.

기존 MCP·Worker·IPC·hot reload 검사도 새 명시적 프로필을 사용하도록 fixture를 갱신했다. 검사를 삭제하거나 검증되지 않은 검사를 통과로 표시하지 않는다.

## 아직 제공하지 않는 것

파일 도구의 읽기/쓰기 권한은 M2b-01b에서 분리했다. `.env` 등 workspace 내부 민감 파일 차단, 하위 MCP별 실행 제한, 셸 OS 격리, 프로세스의 즉시 권한 회수, 영속 복구는 후속 작업이다. 명시적으로 실행을 켜면 기존 셸은 호스트에 접근할 수 있다. 직접 createServer/내부 모듈을 사용하는 개발자는 별도로 설정·정책을 적용해야 한다.

잘못된 reload는 이전 설정을 유지한다. 설정을 지우거나 잘못 편집하는 것은 서버 종료 명령이 아니며, 확정 종료에는 기존 stop 경로를 사용한다.
