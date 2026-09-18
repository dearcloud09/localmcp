# M1 remote handoff status

Date: 2026-09-18
Upstream baseline: `fff33cfb5249be914ec7bab54455e793c1617321`
Target: `dearcloud09/localmcp`, branch `feat/m1-modular-runtime`

## Important: this branch is documentation-only

The M1 source implementation has NOT been committed to this branch. This commit contains the agreed plan and this status report only. It does not install the modular runtime or make the original defaults safe.

The branch was created successfully through the connected GitHub app. Bulk source uploads and a single-file CLI adapter upload were then blocked by the tool security check with an indeterminate-security-status message. A reduced metadata-only source request succeeded, but no partial source tree was committed. Source-write attempts were stopped rather than routing the blocked code through another write path. The exact cause of the security-check failure was not supplied.

## Validation actually rerun in this session

- The supplied M1 patch SHA-256 matches `fc72da17c05199e4f20cba3d823f35a182c7d8d15903b4cb552dfc4212685ae7`.
- All 24 supplied overlay files match their manifest SHA-256 values.
- The four modified upstream files match their recorded Git blob hashes.
- `git apply --check` and patch application succeed on a reconstructed baseline file subset; all 24 resulting files are byte-identical to the supplied overlay. This is NOT a full repository clone.
- Strict TypeScript compilation of the independent core/CLI/Git/files/process test subset passed.
- The independent Node test run passed 43 tests with zero failures, cancellations or skips.
- Environment: Linux, Node 22.16.0, TypeScript 5.8.3, Git 2.47.3. These are the available verification tools, not proof of validation with the upstream dependency versions.

## Still unverified

The execution container cannot resolve `github.com` or `registry.npmjs.org`. No full clone or original dependency installation was possible. Complete `npm run check`, `npm run build`, `npm test`, SDK integration, Worker relay, live ChatGPT connection and cross-platform behavior remain unverified in this session. No CI success is claimed.

## Applying the implementation

The accompanying `localmcp-m1-fork-handoff.zip` is an implementation patch bundle, not a complete checkout. It contains the original 24-file patch, source overlay, tests, current validation logs, and a guarded local application helper. The revised helper accepts the pinned baseline plus documentation-only commits, verifies original source identities, and refuses a dirty checkout. It does not commit, push, start a service or deploy.

After applying the patch in an authenticated local checkout, run:

```sh
npm ci --ignore-scripts
npm run check
npm run build
npm test
```

Only after these pass should the implementation be committed and pushed to this branch. A disposable-project ChatGPT round trip is a separate acceptance check. Keep the pull request in draft until the missing checks have been resolved or explicitly reviewed.

The home-workspace default, broad legacy shell authority, OS isolation and durable recovery are M2 work. Do not start this on a sensitive host with the upstream defaults. No tunnel, account setting, package publication or deployment was performed.
