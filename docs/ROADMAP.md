<h1 align="center">🗺️ Roadmap</h1>

<p align="center">
  <em>From an empty CLI to a public mcp-tool-rugpull-gate that diffs a pasted tools/list on a live demo, in the order it has to happen.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/now-public_release-F59E0B?style=for-the-badge" alt="Now: public release">
  <img src="https://img.shields.io/badge/stage-incubating-2ea44f?style=for-the-badge" alt="Stage: incubating">
  <a href="README.md"><img src="https://img.shields.io/badge/↩-docs_home-6B7280?style=for-the-badge" alt="Back to docs"></a>
</p>

---

The MCP-Tool-Rugpull-Gate roadmap routine works this file top to bottom, one item per run, as
`roadmap/auto-` PRs: it takes the first open item that isn't `🔒 Needs owner` (or up to six
`small` ones), builds it and ticks it. **Every item above
`## After public release` is a release gate.** The repo goes public when all of them are ticked
and Mike says so. Ticking an item adds its line to the [changelog](CHANGELOG.md) and updates any
doc it made stale, in the same commit.

Markers: `- [ ]` open, `- [-]` claimed by a run in progress, `- [x]` done, `- [!]` blocked
(the reason follows on the line). `small` marks docs or config a run can batch, up to six
per PR (untagged means a feature, one per run); `🔒 Needs owner` marks one only Mike can do.

The slices come from [product/build-plan.md](product/build-plan.md), which marks Slices 0 to 3
as the MVP. Slice 0's scaffold and CI shipped with the repo, so what's left of it is the gate
check. Slices 1 to 3 are the three features above the line, and deploying Slice 3's page is the
live-demo item in the release phase. Every slice is tested against fixture `tools/list` files
this repo owns, with fictional servers; no item needs a running MCP server or network access.

## 🧭 Slice 0: Gate check (done 2026-11-10)

- [x] `small` **Is this already built? (falsifier 1).** Write `docs/reports/2026-gate-check.md`: read the docs and source of Snyk agent-scan and Pipelock and answer two questions for each, does it hash tool annotations, and does it show a reviewer a readable per-field diff (description, schema, annotations) of what changed? Link each repo or doc, say when it was checked, and end with a one-line verdict. If either tool does **both**, add a `🔒 Needs owner` item under this one asking whether to stop and PARK (the build plan's first stop rule) and build nothing else until Mike answers. Link the report from `docs/README.md`. — done 2026-11-10: `docs/reports/2026-gate-check.md`, linked from `docs/README.md`; Pipelock hashes annotations but has no per-field diff, agent-scan does neither, so no stop question

## 🔨 Slice 1: Canonicalise, lock, diff (done 2026-11-14)

- [x] **Lock and diff a snapshot** (MVP feature 1). A pure core module (no Node imports, ADR-001) canonicalises each tool in a `tools/list` result: name, title, description, `inputSchema`, `outputSchema`, annotations, keys sorted, empty values dropped, the same field set as leanproxy PR 352. It hashes the canonical form with SHA-256 through Web Crypto. `rugpull-gate lock <tools-list.json> --server <id>` writes `mcp-tools.lock.json` with a `lockVersion` field and, per tool, the hash and the full approved definition. `rugpull-gate check <tools-list.json>` reports every tool as unchanged, changed, cosmetic-only, new or removed, and for a changed tool gives the description diff word by word, schema properties added, removed or changed, and annotation values before and after. Tests: key order and whitespace alone give "unchanged"; a title-only change is cosmetic-only; every canonicalisation rule has a passing and a failing fixture; a corrupt lock file is refused and left untouched. CI runs on `ubuntu-latest` and `windows-latest`. — done 2026-11-14: pure core in `src/canonical.ts`, `src/lockfile.ts`, `src/diff.ts` and `src/report.ts` (Web Crypto hash, no Node imports), `lock` and `check` in `src/cli.ts`, rule-pair and acceptance tests in `tests/core.test.ts` and `tests/cli.test.ts` on the fictional `fernhill-helpdesk` fixtures, CI matrix on Ubuntu and Windows

## ⚖️ Slice 2: Risk reasons, approve, outputs (done 2026-11-17)

- [x] **Risk reasons, approve and the inventory report** (MVP feature 2). Each change gets a risk level and a plain-English reason: a new tool is high; a description that gains an instruction with an address, a URL or an "always" directive is high; a new schema property implying an external destination (the `close_ticket` tool gaining `notify_webhook`) is high; `destructiveHint` false to true or `readOnlyHint` true to false is at least medium, and the reason names the flipped hint; a title-only change is none. `--fail-on <level>` exits 1 at or above that level and a title-only change never trips it. `rugpull-gate approve <tool>` rewrites that tool's lock entry and nothing else. `--format text|json|inventory`: the inventory output is an agent inventory document (schema v0.1, vendored to `schemas/agent-inventory.schema.json`) with each MCP server as an identity and each drift as a finding with `ruleId` `rugpull-gate/<rule>`, and a test validates it against the schema. Missing, empty, malformed-JSON and paginated-merged inputs each have a fixture and fail with a one-line message, never a stack trace. A test runs the CLI with `net`, `http`, `https` and `child_process` stubbed to throw and proves no socket or process is opened. — done 2026-11-17: risk rules with reasons in `src/risk.ts` (a firing and a non-firing fixture each in `tests/risk.test.ts`), `--fail-on`, `--format json|inventory` (`src/report.ts`, `src/inventory.ts`, schema vendored to `schemas/`, Ajv-validated in `tests/inventory.test.ts`) and `approve` in `src/cli.ts`; bad-input fixtures in `tests/fixtures/input-*.json`; the trapped-I/O run in `tests/no-io.test.ts`

## 🖥️ Slice 3: Browser demo (done 2026-11-21)

- [x] **Paste-and-diff page** (MVP feature 3). `site/index.html` gets two paste boxes, approved and current `tools/list`, that run the same core as the CLI (imported as ES modules from the build, no copy of the engine) and render the diff with risk reasons. On first load, with no click, a sample with fictional servers fills both boxes and the planted `send_customer_email` drift shows as a banner at the top. A test loads the page's script with `fetch` and `XMLHttpRequest` stubbed to fail and proves the diff still renders and nothing is sent. `npm run build` writes the page to `_site/`, keeping the source bar, the favicon and the `__BUILD_SHA__` build-stamp meta tag. — done 2026-11-21: paste boxes, banner and fictional sample in `site/index.html` and `site/app.js`, the compiled core copied into `_site/engine/` by `scripts/build-site.ts`, CSP `connect-src 'none'`, `tests/demo.test.ts` with `fetch`, `XMLHttpRequest` and `WebSocket` stubbed to fail

## 🚦 Public release

- [x] `small` **CI.** `.github/workflows/ci.yml` runs `npm ci`, `npm run lint`, `npm test` and `npm run build` on push to `main` and on every PR, with `permissions: contents: read`. — done 2026-11-08: shipped with the scaffold
- [x] `small` **Security.** `SECURITY.md` says how to report a vulnerability and what counts as one. — done 2026-11-08: shipped with the scaffold
- [x] `small` **Demo shell.** `site/index.html` with the org source bar across the top, `<meta name="build" content="__BUILD_SHA__">` in `<head>` and a "coming soon" body, and `site/favicon.svg`, the app icon in the shared dark-tile format. — done 2026-11-08: shipped with the scaffold
- [x] `small` **Secret scan.** `gitleaks git . --log-opts=--all` comes back clean on the full history. — done 2026-11-08: clean on the scaffold commit
- [ ] `small` **README usage matches the code.** Install line, every command and flag (`lock`, `check`, `approve`, `--server`, `--fail-on`, `--format`), a sample run on a fixture `tools/list` with its real output, and the spec's Won't list stated plainly (no live fetching, no call blocking, no network, no account). Each command run against the packed build (`npm pack`, installed in a scratch folder) and behaving as written.
- [ ] `small` **Responsible use.** A README section saying the tool is defensive only: run it against MCP servers you own or are authorized to review; it never exploits anything, never starts or connects to a server, and never writes to a server or a client config (the only file it writes is the lock file, and only when you run `lock` or `approve`); it can't catch a tool that was already poisoned when first locked; the demo uses planted fixtures with fictional servers only.
- [ ] `small` **Inventory output validates in CI.** A CI step runs `rugpull-gate check --format inventory` on a committed fixture that carries the planted drift (the `close_ticket` tool gaining `notify_webhook`) and validates the output against `https://ai-automation-tools.dev/schemas/agent-inventory/v0.1.json` (the vendored copy in `schemas/`, checked to match the published one). The step fails the build when the output doesn't validate or the drift finding is missing.
- [ ] **Live demo at `https://ai-automation-tools.dev/mcp-tool-rugpull-gate/`.** An `actions/deploy-pages` workflow builds and publishes `_site/` from `main`, replacing `__BUILD_SHA__` with `${{ github.sha }}` before the upload (enable Pages for the repo with `gh api` in the same PR), until the publish step moves it to `https://mcp-tool-rugpull-gate-demo.ai-automation-tools.dev/`. The page shows the MVP working: the planted drift banner on first load, then paste two `tools/list` blobs and see the diff. It keeps the source bar and app-icon favicon from the shell, holds no real personal data or real vendor listings, and makes no network call. The README hero's Live Demo badge points at it.

## After public release

Nothing below blocks go-live.

### 🧩 Next slices

- [ ] **Slice 4: opt-in live fetch.** `rugpull-gate fetch` reads `tools/list` from a stdio or streamable-HTTP server, behind an explicit flag and a clear "this runs the server" warning. If it needs more than 5 runs, stop and write up (falsifier 4).
- [ ] **Slice 5: watch mode.** Re-check on `notifications/tools/list_changed`.
- [ ] **Slice 6: a GitHub Action and SARIF.** `--format sarif` that GitHub code scanning accepts, and a composite Action that runs `check` on a repo's committed lock file. Tested in this repo's own CI.
- [ ] **Slice 7: pin `initialize` instructions.** The server's `instructions` string is locked and diffed like a tool description.
- [ ] **Slice 8: import leanproxy and Pipelock pin files** into `mcp-tools.lock.json`.

### 📣 Publish and promote

- [ ] `small` `CONTRIBUTING.md` saying how to run the tests and add a risk rule with its passing and failing fixtures.
- [ ] `small` Cross-link mcp-frisk in the README: frisk lints a config before first use, this tool watches the tools after you approve them.
- [ ] `npm publish --dry-run` is clean, then tag v0.1 and publish to npm. 🔒 Needs owner
- [ ] Launch post built on the demo ("paste yesterday's and today's `tools/list`, see what changed"), sent where agent-security practitioners read. 🔒 Needs owner
- [ ] Custom subdomain `mcp-tool-rugpull-gate-demo.ai-automation-tools.dev`. 🔒 Needs owner
- [ ] 90 days after the repo goes public, run the build plan's stop test: under 40 stars and no outside users means archive it. 🔒 Needs owner

### 💰 Revenue

None planned. The spec rules out accounts and any network service; revisit only if users ask
for a hosted feature.

---

<p align="center">
  <a href="README.md">← Docs home</a> ·
  <a href="CHANGELOG.md">Changelog →</a>
</p>
