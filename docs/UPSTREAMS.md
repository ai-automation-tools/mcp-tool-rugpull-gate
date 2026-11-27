# Upstreams

Every external spec, format and platform mcp-tool-rugpull-gate depends on, what the code assumes
about each, and where to check whether that assumption still holds. The biweekly
**MCP-Tool-Rugpull-Gate Upstream Check** routine (`upstream/auto-*` PRs) works from this file.
Keep it current by hand too: a new assumption about an outside format is a new row.

The tool is offline by design: it makes no network call, so there is no API or SDK upstream.
What it reads is a saved MCP `tools/list` response, and a drift in that shape is the one that
can turn a right answer into a wrong "unchanged".

**Last checked** is filled in by the routine, and only with a date it actually read the
source. `—` means never checked.

## Formats it reads and writes

| Upstream | What the code assumes | Code | Check at | Last checked |
|:---|:---|:---|:---|:---|
| **MCP `tools/list` result** | A saved response is the JSON-RPC response, its `result`, or `{"tools": [...]}`. Each tool has `name`, and optionally `title`, `description`, `inputSchema`, `outputSchema`, `annotations`. A set `nextCursor` means one page of a paginated list: the input is refused and the user is told to merge every page | `src/canonical.ts`, `src/cli.ts` | modelcontextprotocol.io/specification (Server › Tools, the latest revision and its changelog) | — |
| **MCP tool annotations** | `readOnlyHint`, `destructiveHint`, `idempotentHint` and `openWorldHint`, with the spec's defaults for an unset hint (readOnlyHint false, destructiveHint true, idempotentHint false, openWorldHint true; the code cites the 2025-06-18 revision). A new annotation or a changed default would change what "flipped" means | `src/risk.ts` | modelcontextprotocol.io/specification (Server › Tools › Tool annotations) and its schema reference | — |
| **leanproxy PR 352 hashed field set** | The lock hashes name, title, description, `inputSchema`, `outputSchema` and annotations, keys sorted, an absent, `null` or empty top-level field dropped. The lock format is a one-way door: a change to this set is a `lockVersion` change | `src/canonical.ts`, `src/lockfile.ts` | the leanproxy repo's PR 352 and whatever field set its tool hashing uses now | — |
| **Agent inventory schema v0.1** (org format) | `schemas/agent-inventory.schema.json` is a vendored copy of the published schema; `check --format inventory` output validates against it, with the server as an identity and each risk reason as a `rugpull-gate/<rule>` finding, extras only under `x` | `schemas/agent-inventory.schema.json`, `src/inventory.ts` (`SCHEMA_ID`), `scripts/validate-inventory.ts` | ai-automation-tools.dev/schemas/agent-inventory/v0.1.json compared with the vendored file; a v0.2 would be a deliberate migration | — |

## Toolchain and platform

| Upstream | What the code assumes | Code | Check at | Last checked |
|:---|:---|:---|:---|:---|
| **Node.js** | `engines.node: ">=22.18"`: running `.ts` files directly (type stripping on by default) is what lets scripts and tests skip a compile step; CI and the Pages workflow use Node 22 | `package.json`, `.github/workflows/ci.yml`, `.github/workflows/pages.yml` | nodejs.org/en/about/previous-releases (EOL dates); raw.githubusercontent.com/nodejs/Release/main/schedule.json | — |
| **TypeScript and typescript-eslint** | TypeScript is pinned `~6.0` because `typescript-eslint` does not yet support 7.x; `erasableSyntaxOnly` and `rewriteRelativeImportExtensions` are on. Dependabot ignores majors, so this is the check that notices when typescript-eslint supports 7 | `package.json`, `tsconfig.json`, `tsconfig.build.json`, `eslint.config.js` | github.com/typescript-eslint/typescript-eslint/releases (supported TypeScript range); devblogs.microsoft.com/typescript | — |
| **Web Crypto** (`globalThis.crypto.subtle`) | The core hashes with SHA-256 through Web Crypto, so the same module runs in Node and in the browser demo | `src/canonical.ts` (the demo reaches it through the compiled core) | developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto (browser support) | — |
| **ESLint 9 and Ajv 8** (dev only) | Flat config with `typescript-eslint` recommended; Ajv with `ajv-formats` validates the inventory output in a test and in CI. Majors are the upstream check's to flag | `eslint.config.js`, `tests/`, `scripts/validate-inventory.ts` | github.com/eslint/eslint/releases ; github.com/ajv-validator/ajv/releases | — |
| **GitHub Pages (workflow deploy)** | Build type `workflow`: `pages.yml` builds `_site/`, stamps the commit into `<meta name="build">` and deploys; the repo's custom domain is `mcp-tool-rugpull-gate-demo.ai-automation-tools.dev` (set by the publish script, so no `CNAME` file here); every page path is relative | `.github/workflows/pages.yml`, `scripts/build-site.ts`, `site/index.html` | docs.github.com/en/pages ; github.blog/changelog (Pages) | — |
| **GitHub Actions** | `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`; the runners `ubuntu-latest` and `windows-latest` | `.github/workflows/ci.yml`, `.github/workflows/pages.yml` | github.com/actions/checkout/releases ; github.com/actions/setup-node/releases ; github.com/actions/upload-pages-artifact/releases ; github.com/actions/deploy-pages/releases ; github.com/actions/runner-images (image changes) | — |

## Competing tools (the wedge)

| Upstream | What the code assumes | Code | Check at | Last checked |
|:---|:---|:---|:---|:---|
| **Snyk agent-scan, Pipelock** | As of the 2026-11 gate check neither does both of: hashing annotations and showing a reviewer a readable per-field diff. The README and roadmap lean on that. If one starts to, flag it for the owner; do not change the product | `docs/reports/2026-gate-check.md`, `README.md` | the two tools' repos and release notes | — |

## Framework majors

Majors only: a patch or minor bump is Dependabot's job and never makes this table wrong. The
exact ranges are in `package.json`. *Latest* is the npm registry's on the *Last checked* date.

| Upstream | Major in `package.json` | Latest | Check at | Last checked |
|:---|:---|:---|:---|:---|
| TypeScript | 6.0 (`~`, minor pinned) | — | devblogs.microsoft.com/typescript | — |
| typescript-eslint | 8 | — | github.com/typescript-eslint/typescript-eslint/releases | — |
| ESLint, @eslint/js | 9 | — | github.com/eslint/eslint/releases | — |
| ajv, ajv-formats | 8, 3 | — | each package's GitHub releases | — |
| @types/node | 22 | — | npmjs.com/package/@types/node | — |

Flag breaking majors, EOL runtimes, and security advisories only. Routine bumps are
Dependabot's job.
