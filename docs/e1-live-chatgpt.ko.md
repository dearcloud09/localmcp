# E1 — 실제 ChatGPT 파일 연결

기준 실행 코드: `88f455c`, 시작 기준 브랜치 HEAD: `66fb82dff4faf94bc0f7b8cee3e511668af0a6d6`. E0는 사용자 macOS 성공 보고를 확보했다. 이 절차는 E0를 반복하지 않고 동일한 서버를 실제 ChatGPT에 연결한다. **현재 E1은 준비 완료·실접속 대기이며 통과가 아니다.**

## 범위와 연결 경로

`ChatGPT → 원본 프로젝트의 공개 Cloudflare Worker → E1 전용 에이전트 → 샘플 workspace`

이 빠른 연결 경로는 제3자가 운영하는 공개 중계를 사용하므로 샘플 내용·도구 요청·결과가 중계를 거친다. 중요한 저장소나 비밀 파일은 넣지 않는다. 서버 시작은 `start --public-relay`로 사용자가 명시적으로 실행한다. `prepare`와 `check`는 등록/중계 접속을 하지 않는다. 자체 Worker 전환은 이 첫 파일-only E1 범위 밖이다.

`~/.localmcp-e1/`에 새 세션을 만들고 기존 `~/.localmcp` 설정과 접속 정보를 재사용하지 않는다. 세션의 `home`은 에이전트 상태 파일 분리를 위한 것이며 OS 샌드박스는 아니다. 설정과 기준 해시는 workspace 밖, 공개되는 폴더는 `projects/localmcp-smoke-*` 하나다. 파일 편집만 켜고 셸·프로세스·Skills·하위 MCP·Docker 검사는 끈다.

## 1. 준비와 시작

macOS의 기존 checkout에서 실행한다. 기존 세션이 있으면 덮어쓰지 않고 중단한다. 코드/프로필/토큰을 자동 초기화하지 않는다.

```sh
(
set -e
cd "$HOME/Developer/localmcp"
test "$(git branch --show-current)" = "feat/m1-modular-runtime"
git pull --ff-only origin feat/m1-modular-runtime
node scripts/e1-session.mjs prepare
node scripts/e1-session.mjs start --public-relay
)
```

준비 단계에서 고의 버그의 테스트 3개 실패를 확인한다. `E1_PREPARED` 뒤 에이전트가 시작하며 `MCP URL`이 출력된다. URL 전체는 접속 자격증명이다. **ChatGPT 앱 설정의 URL 칸에만 붙여넣고 채팅·스크린샷·GitHub에는 올리지 않는다.** 터미널은 켜 둔다. 접속 전/후 실패는 성공으로 추정하지 않는다.

에이전트의 Config 안내 문구는 기본 경로를 표시할 수 있으나 이 세션은 `~/.localmcp-e1/profile.json`을 명시적으로 사용한다. 종료는 이 터미널에서 Ctrl+C다. 별도 터미널에서는 저장소에서 `node scripts/e1-session.mjs stop`을 실행한다. 일반 `localmcp stop`은 원래 환경을 대상으로 할 수 있으므로 이번 세션 종료에는 쓰지 않는다.

## 2. ChatGPT 등록

2026-09-19 확인한 OpenAI Developer mode 문서 기준:

- 웹 ChatGPT의 Settings → Security and login → Developer mode를 켠다.
- Plugins의 `+`에서 developer-mode app을 생성한다. 이름은 `LocalMCP-E1`, URL은 방금 출력된 전체 MCP URL, 인증은 No Authentication이다. URL 안에 토큰이 있으므로 인증 수단 자체가 없다는 뜻은 아니다.
- 대화 입력창의 `+` → Developer mode에서 `LocalMCP-E1`을 선택한다. 생성만 하고 대화에 선택하지 않은 상태를 연결 성공으로 보지 않는다.
- 계정에서 메뉴가 제공되지 않거나 도구가 노출되지 않으면 그 단계에서 멈춘다. 유료 요금제 변경이나 URL 공개로 해결하지 않는다.

공식 근거: https://developers.openai.com/api/docs/guides/developer-mode (확인일 2026-09-19). UI 이름은 계정에 따라 다를 수 있다. 연결 후 읽기와 쓰기 도구의 실제 노출 여부를 확인한다.

## 3. 실제 모델에게 요청

같은 대화에서 앱을 선택하고 연결 완료를 알린다. 새 대화가 필요한 경우 아래 작업을 그대로 전달한다. 도구가 없으면 답변만으로 수정했다고 주장하지 않는다.

```text
LocalMCP-E1의 실제 도구로 E1 파일 연결을 검증해.
먼저 workspace_info를 읽고 workspace=project인지 확인해.
셸·프로세스·Skills·하위 MCP·availableChecks가 비활성/비어 있지 않으면 중단해.
E1_CHALLENGE.txt, calculator.mjs, calculator.test.mjs를 실제로 읽어.
calculator.mjs의 `return a - b`를 `return a + b`로 정확히 한 번만 바꿔.
다른 바이트나 파일은 바꾸지 말고, 셸·GitHub·코드 실행 도구로 대신 처리하지 마.
수정 후 같은 세 파일을 다시 읽고, 확인 코드와 변경 내용을 보고해.
실행하지 않은 테스트가 통과했다고 말하지 마. 쓰기 승인이 뜨면 승인 절차를 따라.
```

이는 모델의 일반 코딩 성능 평가가 아니라 연결·파일 편집·재읽기를 검증하는 작은 과제다. 새 무작위 확인 코드는 이전 대화의 소스 지식만으로 답변한 결과와 실제 로컬 읽기를 구별하기 위한 자료다.

## 4. 로컬 결과 확인과 종료

모델의 실제 호출·재읽기를 확인한 후 에이전트 터미널에서 Ctrl+C로 접속을 중단하고, 다음을 실행한다.

```sh
cd "$HOME/Developer/localmcp" && node scripts/e1-session.mjs check
```

검사는 먼저 파일 집합·테스트/README/확인 코드 불변을 확인한다. 소스가 사전에 정한 한 연산자 수정과 정확히 같을 때만 기존 Node 테스트를 실행한다. 예상과 다른 생성 코드는 실행하지 않고 거부한다. 테스트 3개 통과 시 `E1_LOCAL_CHECK_OK`와 확인 코드를 출력하고 workspace 밖에 `evidence-*.json`을 새로 저장한다.

이 확인 코드를 실제 ChatGPT 도구 응답과 대조한다. **로컬 검사만으로 편집 주체를 증명하지 않으므로 `chatgptActorVerified=false`를 유지한다.** 실제 모델 도구 호출과 로컬 결과가 함께 확인되어야 E1을 통과로 기록한다. 결과 JSON에는 접속 URL/토큰을 넣지 않는다. 작업 후 ChatGPT에서 테스트 앱을 선택 해제하거나 연결 해제하고 세션 파일은 자동 삭제하지 않는다.

## 현재 검증과 남은 것

새 보조 도구의 독립 테스트 9개를 Linux / Node 22.16.0에서 실행해 모두 통과했다. 원본 프로젝트 프로필 모듈의 Git blob을 원격과 대조했다. 로컬 준비·red/green·기존 세션 보호·테스트 변조/뜻하지 않은 코드 실행 거부·환경 분리 등을 검사했다. `start`의 실제 Worker 접속, macOS 보조 도구 실행, ChatGPT 등록/호출은 아직 수행하지 않았다. 런타임 src·의존성·기존 E0 실행 경로는 수정하지 않았다.
