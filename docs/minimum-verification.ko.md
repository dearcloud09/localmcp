# 최소 검증 실행 안내

**대상:** `feat/m1-modular-runtime`, macOS/Linux, Node 22 이상. Git 문서가 기준이다. 이 절차는 새 기능을 계속 추가하기 전에 누적 구현을 실제 의존성으로 확인하는 관문이다.

## 1. 파일-only 최소 검증 — 기본 경로

이미 M1 의존성을 설치한 로컬 checkout에서 변경을 가져온 뒤 실행한다. 기존 파일을 초기화하거나 강제 덮어쓰지 않는다.

```sh
cd "$HOME/Developer/localmcp" &&
test "$(git branch --show-current)" = "feat/m1-modular-runtime" &&
git pull --ff-only origin feat/m1-modular-runtime &&
npm run verify:minimum
```

현재 브랜치는 `feat/m1-modular-runtime`이어야 한다. 다른 브랜치이거나 local 변경으로 pull이 거부되면 reset/force를 사용하지 말고 기존 변경을 보존한다. 새 checkout에서 의존성이 없다면 원본 lockfile을 사용해 `npm ci --ignore-scripts`를 먼저 수행한다. 검증 실행기는 자동 설치·계정 연결·공개 터널을 하지 않는다.

실행 순서: 타입 검사 → 빌드 → 모든 기존/신규 npm 테스트 → 실제 SDK/서버 stdio 파일 smoke. 어느 단계든 실패하면 다음 단계는 실행하지 않고, 첫 실패 로그와 JSON 보고서를 보관한다.

성공 표시는 **`MINIMUM_LOCAL_OK (Docker and live ChatGPT not tested)`**다. 단위 테스트만 통과하거나 SDK를 찾지 못했을 때는 이 표시를 출력하지 않는다.

보고서는 출력에 표시된 저장소 밖 `localmcp-verification-*` 디렉터리에 있다. `report.json`에는 커밋·dirty 여부·환경·단계 상태가 있고, 각 단계의 `.log`는 소유자 전용 파일이다. 로그를 공유하기 전 비밀정보가 없는지 확인한다. 실행 중 강제 종료되어 running으로 남은 단계는 성공도 재실행 허가도 아니다.

## 2. Docker까지 최소 검증 — 선택한 경우에는 필수 관문

사용자가 이미 준비하고 검토한 Linux Node 22+ 이미지와 로컬 Docker context가 필요하다. 이미지에는 `/usr/local/bin/node`, `/bin/sh`, `/bin/cp`가 있어야 한다. 입력 사본은 읽기 전용 `/input`이고 검사는 크기가 제한된 tmpfs의 `/workspace/project`에서 실행된다. 자동 설치·pull·과금 변경은 없다. 태그가 아니라 `docker image inspect`에서 확인한 로컬 이미지의 전체 `sha256:...` ID를 사용한다.

```sh
npm run verify:minimum -- --image sha256:<64자리_실제_로컬_이미지_ID>
```

기본 E0에 이어 실제 MCP run_check로 red/green, 파일·네트워크·권한 검사, 타임아웃 후 컨테이너 제거를 검증한다. 성공 표시는 **`MINIMUM_LOCAL_AND_SANDBOX_OK`**다. Docker나 이미지가 없거나 runtime inspect 조건이 다르면 실패하며 일반 셸로 대체하지 않는다. Docker Desktop 경로 표기 등 플랫폼 차이는 실제 검사로 확인해야 한다.

## 3. 새 도구의 설정

운영자가 프로젝트 밖 설정에 검사 정의를 넣을 때만 `run_check`가 노출된다. 아래는 경로와 실제 이미지 ID를 채워야 하는 형식 예시다.

```json
{
  "root": "/absolute/project",
  "features": {"files": true, "shell": false, "processes": false},
  "permissions": {"fileRead": true, "fileWrite": true},
  "checks": {
    "test": {
      "image": "sha256:<64자리_실제_로컬_이미지_ID>",
      "executable": "/usr/local/bin/node",
      "args": ["--test"],
      "timeoutMs": 30000
    }
  },
  "skills": {"dir": "skills", "enabled": []},
  "mcpServers": {}
}
```

모델의 호출은 `run_check({"check":"test"})`다. 명령 문자열·추가 mount·환경변수·이미지 선택을 호출 인자로 받지 않는다. 검사 결과에는 종료 코드, 시간 초과/출력 상한, 사본 해시, cleanupConfirmed, writeback=false가 포함된다. 실패 검사 결과를 성공적인 테스트로 읽으면 안 된다.

사본은 최대 10,000개 항목/64 MiB/깊이 64이고 민감 이름을 제외한다. 링크와 특수 파일은 거부한다. 일반 코드에 적힌 비밀 내용은 탐지하지 않는다. node_modules가 크거나 심볼릭 링크에 의존하면 초기 범위를 벗어날 수 있다. 원본 Git 메타데이터도 제외되므로 Git 메타데이터가 필수인 검사는 별도 설계가 필요하다.

## 4. 실제 ChatGPT 연결과 제품 전체 복구는 별개

위 두 성공 표시는 **결정적 테스트 스크립트가 MCP를 호출한 결과**다. 사용자 계정에서 모델이 도구를 선택한 E1 결과가 아니다. E1은 테스트용 프로필로 계정을 연결한 뒤 실제 도구 호출을 관찰해야 한다. 기존 M2a 샘플/안내를 따른다. 연결 URL의 토큰은 채팅·Git·스크린샷에 올리지 않는다.

현재 legacy shell/하위 MCP 실행을 새 Docker 경로로 자동 전환하지 않았다. 파일-only 테스트에서 이들을 꺼 둔다. 검증 로그의 영속화도 제품 전체 작업 복구·중복 실행 방지를 의미하지 않는다. M2c/M3와 교차 플랫폼 검증은 진행표의 별도 항목이다.

공식 Docker 옵션 참고: https://docs.docker.com/reference/cli/docker/container/run/
Docker 신뢰 경계: https://docs.docker.com/engine/security/
