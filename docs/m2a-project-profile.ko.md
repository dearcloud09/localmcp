# M2a — 프로젝트 전용 설정과 파일 연결 검증 준비

이 단계는 **서버를 켜는 명령이 아니다.** 설정 파일·샘플을 만들고 연결 전 범위를 확인한다. 네트워크 요청, 토큰 생성, 브라우저 조작, 기존 설정 변경을 하지 않는다. Node 22 이상에서 npm 의존성 설치 없이 실행할 수 있다.

## 1. 준비 도구 자체의 검사

저장소 작업 브랜치의 최신 변경을 받은 checkout에서 실행한다. 기존 변경을 지우거나 강제 pull하지 않는다.

```sh
node --test test/project-profile.test.mjs
# 또는 npm run test:profile
```

새 도구를 포함한 전체 검사:

```sh
npm run check && npm run build && npm test
```

이번 개발환경은 신규 검사 28개만 실제로 실행했다. 위 전체 명령의 현재 변경에 대한 성공은 아직 확인하지 않았다.

## 2. 비밀정보 없는 샘플과 전용 프로필 생성

예시는 기존 `~/Developer` 아래에 무작위 접미사가 붙은 새 샘플 폴더를 만들고, 설정은 작업 폴더 밖에 저장한다. 같은 설정 파일이 이미 있으면 **덮어쓰지 않고 종료**한다.

```sh
node scripts/project-profile.mjs demo \
  --parent "$HOME/Developer" \
  --config "$HOME/.localmcp/profiles/smoke.json"

node scripts/project-profile.mjs doctor \
  --config "$HOME/.localmcp/profiles/smoke.json"
```

기존 테스트 전용 프로젝트를 쓰는 경우에는 `init --workspace /absolute/project --config /outside/project/smoke.json`을 사용한다. 홈 전체, 루트·홈의 상위 디렉터리, `.ssh` 등 자격증명 위치, 프로젝트 내부 설정은 거부한다. 존재하지 않는 프로젝트를 임의로 생성하거나 현재 폴더를 자동 선택하지 않는다.

doctor는 **이 도구가 생성한 파일 전용 프로필**만 검증한다. 모든 upstream 설정의 일반 검사기가 아니다. 상태 `profile-check-passed`는 설정 검사 성공이지 MCP/ChatGPT 연결 성공이 아니다.

생성 설정은 파일 수정·삭제를 포함한 파일 도구를 허용한다. 읽기 전용이 아니며, 프로젝트 안의 비밀 파일을 자동 필터링하지 않는다. 셸·지속 프로세스·Skills·외부 MCP는 꺼진다. `LOCALMCP_ROOT`나 셸 활성화 환경변수가 있으면 doctor가 거부한다. 잘못된 JSON이나 환경변수의 값은 오류에 복사하지 않는다.

## 3. 실제 연결 수용 기준 — 아직 미실행

서버와 계정 연결은 별도 단계다. **기존 bare `localmcp` 명령은 홈 workspace 기본값을 사용할 수 있으므로 실행하지 않는다.** 실제 시작 경로에 위 프로필이 사용되는지 반드시 확인해야 한다. 이 문서는 터널을 자동 시작하거나 기존 에이전트를 변경하지 않는다.

연결이 마련되면 다음 요청으로 첫 파일 작업을 검증한다:

> 연결된 테스트 전용 workspace를 확인하고 README.md, calculator.mjs, calculator.test.mjs를 읽어. calculator.mjs의 add 버그만 고쳐. 테스트·README·설정은 바꾸지 말고 셸이나 외부 MCP를 켜지 마. 수정 후 소스를 다시 읽어서 확인한 내용을 보고해.

사용자는 도구가 반환한 `workspace` 경로에서 아래 검사를 직접 실행해 전후 결과를 비교한다. 모델의 성공 요약만으로 통과시키지 않는다.

```sh
node --test calculator.test.mjs
```

원본 샘플은 고의로 3개 실패한다. 올바른 소스 수정 후에는 동일한 테스트 3개가 통과해야 한다. 소스만 바뀌고 테스트 파일은 그대로여야 한다. 현재 개발환경에서는 이 샘플의 실패/성공을 로컬에서 확인했지만, ChatGPT가 직접 수정한 것은 아니다.

## 4. 다음 단계

파일 연결이 확인된 뒤에만 격리된 검사 명령 실행을 별도 검증한다. 안전한 기본값의 런타임 강제, 민감 경로 차단, 하위 MCP 권한, OS 격리, 영속 복구는 후속 작업이다. 진행 상태는 [1pager](onepager.ko.md)와 [진행표](progress.md)를 기준으로 삼는다.
