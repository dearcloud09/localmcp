# Modular execution foundation (M1)

## Scope and baseline

This patch targets `daodao97/localmcp` commit `fff33cfb5249be914ec7bab54455e793c1617321` (package metadata at that commit: 0.3.9). It is the first implementation of `onepager.ko.md`, not a complete production hardening release. The original dependency manifest and lockfile are unchanged.

## Boundaries

```text
ChatGPT --MCP--> existing transport / server.ts
                         |
                    ToolRegistry
              validation / feature gates /
              dispatch / bounded receipts
                         |
       +-----------------+------------------+
       |                 |                  |
  internal modules   CLI adapters     optional external MCP
  files/workspaces   Git / existing   existing McpLoader
  Skills/process IO  shell execution  discovery and forwarding
```

`src/server.ts` now performs protocol adaptation only. It creates a module registry and takes one runtime snapshot per call. Transport lifecycle, authentication, Worker relay, and hot reload remain in upstream code; this patch does not open a tunnel or alter account settings.

`src/core/registry.ts` is transport-independent. A registered tool supplies a descriptor, schema parser, required feature flags, execution function, and backend label. `list` and `call` use the same feature checks. Unknown and disabled tools fail before validation/execution. Schemas remain Zod definitions in `src/modules/`; the core is not a replacement schema validator.

The six module groups are workspaces, files, processes, Skills, external MCP, and Git. These are ordinary TypeScript modules in the same process, not separate services. `backend: internal | cli | mcp` describes an implementation, not a runtime plugin installer. Changing source modules requires a build/restart; existing external-MCP configuration hot reload is retained.

## Compatibility

All 26 upstream tool names and schema expressions are retained. Static comparison found no schema-expression differences. `git_status` is the one additional tool. The upstream stdio test's expected count changes from 26 to 27; shell-disabled operation still advertises 20 tools. Full runtime compatibility remains pending until the upstream dependency versions and SDK tests can run.

Successful local results still use the original JSON-in-text MCP result format. External MCP results are forwarded without discarding images, structured content, or `isError`. Errors still use `isError: true` and a text message. A deliberate tightening is that workspace and empty-object inputs now pass through their declared parser; malformed inputs no longer bypass validation in selected branches.

## CLI adapter

`src/adapters/cli.ts` executes a fixed executable and separate argv with `shell: false`, a restricted inherited environment, bounded stdout/stderr, timeout reporting and POSIX process-group cleanup. Trusted adapters may add explicit environment settings. There is no new arbitrary `run_cli` MCP tool: the adapter is a reusable internal implementation.

The original `run_command` tool still accepts a shell string for compatibility. It is not made safe by the existence of the new argv adapter. A CLI is not a sandbox. Windows `.cmd` / `.bat` execution has no automatic shell fallback; a dedicated adapter is required. Windows cleanup code and platform-specific behavior were not executed in this environment.

`git_status` uses the existing Git CLI, not another model or a nested Git MCP. It requires both `files` and `shell`; disabling shell cannot be bypassed through the Git adapter. It refuses implicit discovery of a parent repository, uses NUL-delimited porcelain v1 output, disables optional locks/fsmonitor and automatic prompting, and does not commit/push/fetch. The workspace must be the Git working-tree root. Repository/worktree configuration and the executable on PATH must still be trusted. UTF-8 filenames are supported; arbitrary non-UTF-8 filenames are not guaranteed to round-trip through JSON.

## Regression fixes

`Workspace.write` preserves existing ordinary permission bits on replacement and removes its temporary file when writing or replacement fails. It does not copy setuid/setgid bits. This is not preservation of ownership, ACLs, xattrs or every filesystem attribute; it also does not solve all external-editor races or provide multi-file transactions.

`Utf8TailBuffer` buffers incomplete multibyte sequences and trims retained output at code-point boundaries. Byte cursors refer to re-encoded decoded text, not UTF-16 offsets. A cursor inside a character is advanced and reported as truncated. Invalid original UTF-8 may still decode to replacement characters. The process manager also contains asynchronous spawn and stdin errors; `stop_process` remains a stop request, not proof that the process tree has exited.

## Execution evidence

`RecentExecutions` retains the most recent 200 invocation receipts in process memory. Receipt fields are tool/module/backend, identifier, timestamps, duration, outcome and a coarse error code. Raw arguments, output, paths and exception messages are not recorded by this mechanism. An observability sink failure cannot turn an already-completed edit into a retriable tool failure. A nonzero command result or upstream `isError` is recorded as failure.

This is not durable recovery, an authorization ledger or proof that a launched background task finished. A successful `start_process` receipt means that the invocation was accepted; clients must inspect its later process result. History disappears on restart and has no new MCP query tool in M1.

## Explicitly not solved in M1

The upstream home-directory default, general shell authority, relay credential model, per-project approval policy, OS sandbox, per-tool external-MCP permissions, persistent job recovery, process-count limits and durable audit storage remain follow-up work. Do not deploy M1 to an important host or expose a home workspace as though these issues were fixed. Use disposable test repositories and avoid host credentials. No actual ChatGPT account or tunnel connection was exercised here.

## Validation

Executed: 43 dependency-free Node tests after strict TypeScript compilation of the core/adapters/files/process subset; TypeScript syntax checking of all provided source/tests; static comparison of the 26 original input-schema definitions; negative controls on the verified upstream source; patch application/integrity checks.

Not executed: original `npm run check`, original complete `npm test`, complete build, SDK in-memory integration tests, Worker relay, ChatGPT connector, macOS/Windows. GitHub clone failed DNS resolution and npm registry access returned `EAI_AGAIN`; no dependency versions were silently replaced to claim a full build.

After applying to a full checkout with network access:

```sh
npm ci --ignore-scripts
npm run check
npm run build
npm test
```

The new `test/modular-integration.test.ts` exercises real Zod schemas, catalog/feature compatibility and an SDK client/server round trip once those dependencies are present. Run a disposable-project ChatGPT round trip separately before accepting M1 as integrated.

## Sources

- Upstream commit: https://github.com/daodao97/localmcp/commit/fff33cfb5249be914ec7bab54455e793c1617321
- Node child process: https://nodejs.org/api/child_process.html
- Node string decoder: https://nodejs.org/api/string_decoder.html
- Git porcelain status: https://git-scm.com/docs/git-status
