# AGENTS.md

Standing orders for the agent that works this repo, usually the MCP-Tool-Rugpull-Gate Weekly
Roadmap routine (Tuesday, Thursday and Saturday).

## What mcp-tool-rugpull-gate is

A lock file for MCP tool definitions, with a diff a tired reviewer can read. The CLI is
`rugpull-gate`:

- `lock <tools-list.json> --server <id>` canonicalises every tool in a saved MCP `tools/list`
  response (name, title, description, `inputSchema`, `outputSchema`, annotations; sorted keys,
  empties dropped, the same field set as leanproxy PR 352) and writes its SHA-256 and the full
  approved definition to `mcp-tools.lock.json`, which carries a `lockVersion`.
- `check <tools-list.json>` reports each tool as unchanged, changed, cosmetic-only, new or
  removed. For a changed tool it prints a word-level description diff, schema properties
  added, removed or changed, and annotation hints that flipped, each with a risk level and a
  plain-language reason. It exits non-zero at or above `--fail-on`.
- `approve <tool> <tools-list.json>` rewrites that tool's entry in the lock from the given
  `tools/list` (or drops it if the list no longer has it).
- Output is text, JSON, or the Agent Security Suite's agent inventory format (MCP servers as
  identities, drift as findings).

A static browser demo on GitHub Pages runs the same engine on two pasted `tools/list` blobs and
shows a planted `send_customer_email` drift as a banner on first load.

The wedge against Snyk agent-scan, Pipelock and leanproxy, which pin (or once pinned) tool
hashes (see `docs/reports/2026-gate-check.md`): a
committed lock file, a reviewer-grade per-field diff with annotation flips named, no account,
no proxy, no network. It **reports** drift. It does not sit in the call path and cannot block
a call.

Full spec: `docs/product/spec.md`. Slice order: `docs/product/build-plan.md`. Work queue:
`docs/ROADMAP.md`.

## Stack

- TypeScript 6.0, ESM (`"type": "module"`), Node 22.18 or newer. **npm**, not pnpm or yarn.
  TypeScript is pinned to `~6.0` because `typescript-eslint` doesn't support 7.x yet.
- Sources import each other with `.ts` extensions (`import { VERSION } from "./version.ts"`).
  Node strips types at runtime and `tsc` rewrites the extensions on build
  (`rewriteRelativeImportExtensions`). `erasableSyntaxOnly` is on: no enums, no namespaces,
  no parameter properties.
- Tests: `node:test` and `node:assert/strict`, files in `tests/*.test.ts`. No Jest, no Vitest.
- Lint: ESLint 9 flat config with `typescript-eslint` recommended, plus `tsc --noEmit`.
- `src/cli.ts` is the bin entry and stays thin: argument parsing, file reads and writes, exit
  codes. The core (`canonicalise`, `diff`, risk rules, output formatting) is pure functions
  that take parsed JSON and return data. **The core must not import Node built-ins**: the
  browser demo in `site/` imports it too (ADR-001). Hashing in the core uses Web Crypto
  (`globalThis.crypto.subtle`), which Node and browsers both have. `npm run build` copies the
  compiled core from `dist/` into `_site/engine/` (`scripts/build-site.ts`, which fails on a
  `node:` import); `site/app.js` imports it from there and is never a second copy of a rule.
  Pasted text reaches the page as `value` or `textContent` only, never as HTML.
- Runtime dependencies: at most a word-diff routine, and only if a few dozen lines of our own
  can't do it. A JSON Schema validator is a dev dependency for the inventory test.
- Settings live in `.env` at the repo root, names in `.env.example`; the real environment
  wins. There are none today, and the product's promise (offline, no account) means there
  should rarely be one. If one is ever needed, load it with Node's `util.parseEnv`. Never tell
  anyone to set a Windows user environment variable.

## Verify

Run all three from the repo root. All three must pass before a PR opens.

```
npm run lint
npm test
npm run build
```

## Architecture decisions that are already made

- **ADR-001: one TypeScript core** (`docs/decisions/adr-001-typescript-shared-core.md`). The
  CLI and the demo run identical diff code. Don't add a second language or a WASM build.
- **The lock-file format is a one-way door.** Once a user commits `mcp-tools.lock.json`,
  changing it forces a migration. Keep `lockVersion` from the first commit, keep the hashed
  field set identical to leanproxy's list, and treat any change to the format as a decision
  to flag in the PR body, not to make quietly.
- **Zero execution.** Never start, connect to or probe an MCP server. Never spawn a child
  process. Never `eval` or `new Function` anything from input. Input files are hostile.
- **Zero network.** The CLI and the demo make no network calls. A test proves it for each.
- **A corrupt lock file is never overwritten.** `lock` and `approve` refuse and say why.

## Won't (this version)

Carried from the spec. If a roadmap item seems to need one of these, stop and flag it.

- **Live fetching** from stdio or HTTP servers. Snapshot input only until after release.
- **Sitting in the call path** or blocking or holding live calls. That needs a proxy.
- **Any network access.**
- **Signature schemes** (ETDI).
- **Scanning descriptions for known injection phrases.** That is mcp-frisk's and Snyk's job.
- **Detecting a changed implementation behind an unchanged definition.** Hashing can't see it.
- **Any account.**
- **Real vendor or server names in demo data.** Fictional servers only.

## Standards

- Every canonicalisation rule and every risk rule ships with a fixture that fires it and one
  that doesn't. The spec's acceptance criteria are tests: key order and whitespace alone give
  "unchanged"; a title-only change is cosmetic, risk none, and doesn't trip `--fail-on`; a
  description-identical tool that gains a `notify_webhook` property is high.
- Missing, empty, malformed-JSON and paginated-merged inputs fail with a clear one-line
  message and a non-zero exit, never a stack trace.
- Risk reasons are plain English a reviewer can act on ("`destructiveHint` went from false to
  true"), not rule ids alone.
- No new runtime dependency without a line in the PR body saying why.
- This repo goes public at graduation. Never commit `.env*`, real tokens, real personal data,
  real vendor tool listings, or local paths like `C:\Users\...` or `D:\...`.
- Every deployed page keeps `<meta name="build" content="__BUILD_SHA__">` in `<head>`; the
  Pages workflow replaces it with the commit SHA.
- Commit messages: plain imperative sentences ("Add the lock command"), no Conventional
  Commit prefixes.

## What "done" means for a roadmap item

1. The item's own text is true of the code, checked by running it.
2. `npm run lint`, `npm test` and `npm run build` pass, and new behaviour has a test.
3. Anything the change made untrue is fixed: `README.md`, `docs/`, this file.
4. `docs/CHANGELOG.md` has a line for it, tagged with the roadmap phase in italics, in the
   same commit that flips the box to `- [x]` with a dated note.
5. It's on a `roadmap/auto-<date>` branch with a PR into `main`. Never push to `main`.
