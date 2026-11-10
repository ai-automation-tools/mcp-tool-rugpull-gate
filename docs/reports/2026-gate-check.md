# Gate check: is this already built? (falsifier 1)

Checked 2026-11-10 by the roadmap routine, against the source and docs of each tool at the
commit named below. The build plan's first stop rule says: if Snyk agent-scan or Pipelock
already **hashes tool annotations** and **shows a reviewer a readable per-field diff**
(description, schema, annotations), stop and PARK.

| Tool | Hashes annotations? | Readable per-field diff? | Does both? |
|:---|:---|:---|:---|
| Snyk agent-scan | No | No | No |
| Pipelock | Yes | No | No |

## Snyk agent-scan

Repo: [snyk/agent-scan](https://github.com/snyk/agent-scan), read at
[`59def8c`](https://github.com/snyk/agent-scan/tree/59def8c624f9d7bef4d49992a4da5e68f83f4e75)
(2026-11-09, v0.6.x).

- **Hashes annotations: no.** The current CLI keeps no local tool baseline. Its source has no
  code that hashes a tool definition or compares one against an earlier scan; the
  `--storage-file` flag survives in
  [`cli.py`](https://github.com/snyk/agent-scan/blob/59def8c624f9d7bef4d49992a4da5e68f83f4e75/src/agent_scan/cli.py)
  but nothing reads a tool hash from it. Per
  [`docs/scanning.md`](https://github.com/snyk/agent-scan/blob/59def8c624f9d7bef4d49992a4da5e68f83f4e75/docs/scanning.md),
  it connects to (and, for stdio, starts) each configured server, then sends server
  configurations and "signatures" to the Snyk Agent Scan API, which needs a Snyk account and
  `SNYK_TOKEN`. Whatever change tracking that API or Snyk Evo does is server-side and not
  visible in the repo.
- The old local "tool pinning" from its mcp-scan days (for example
  [`Storage.py` at v0.3.8](https://github.com/snyk/agent-scan/blob/v0.3.8/src/mcp_scan/Storage.py))
  hashed **the description only**: `hash_entity` in
  [`models.py`](https://github.com/snyk/agent-scan/blob/v0.3.8/src/mcp_scan/models.py) is
  `md5(description)`. Schema and annotation changes never registered.
- **Readable per-field diff: no.** The v0.3.8 pinning printed "has changed since last scan"
  and the whole previous description. The current CLI reports risk indicators
  ([`docs/risks.md`](https://github.com/snyk/agent-scan/blob/59def8c624f9d7bef4d49992a4da5e68f83f4e75/docs/risks.md)),
  not a diff.

## Pipelock

Repo: [pipelab-org/pipelock](https://github.com/pipelab-org/pipelock), read at
[`7a3440a`](https://github.com/pipelab-org/pipelock/tree/7a3440a90e7f5e3c5778d5f906119507a2937f95)
(2026-11-10).

- **Hashes annotations: yes.** With `mcp_tool_scanning.detect_drift: true`, it "hashes the
  canonical full tool object from `tools/list`", annotations and `_meta` included
  ([`docs/configuration.md`, MCP Tool Scanning](https://github.com/pipelab-org/pipelock/blob/7a3440a90e7f5e3c5778d5f906119507a2937f95/docs/configuration.md#mcp-tool-scanning)).
  It also keeps a separate digest of everything except the description, so a
  `destructiveHint` flip with an untouched description still blocks.
- **Readable per-field diff: no.** The drift detail a reviewer sees comes from
  `diffSummaryLocked` in
  [`internal/mcp/tools/tools.go`](https://github.com/pipelab-org/pipelock/blob/7a3440a90e7f5e3c5778d5f906119507a2937f95/internal/mcp/tools/tools.go):
  the description's length before and after, the text past the old length if it grew
  (capped at 200 characters, so an edit in the middle shows nothing useful), and parameter
  **names** added or removed. A changed property type or description, an output-schema
  change, and an annotation's before and after values are not shown; any non-description
  change collapses into one `structural-change` cue
  ([`drift_cues.go`](https://github.com/pipelab-org/pipelock/blob/7a3440a90e7f5e3c5778d5f906119507a2937f95/internal/mcp/tools/drift_cues.go)).
- It is a proxy: the baseline is held in the running `pipelock mcp proxy` or listener process
  and is established from the first `tools/list` it sees. There is no committed lock file a
  reviewer can read in a pull request.

## What this means for the wedge

Pipelock is the closer of the two and already catches annotation drift, so "we hash
annotations" is not a differentiator by itself. What neither offers is the review half: a
committed, human-readable lock file, and a per-field diff that names the description words
that changed, the schema properties added, removed or changed, and each annotation hint's
before and after value, without a proxy, an account or a network call. That is still the
build.

**Verdict: neither tool does both; falsifier 1 does not fire, so Slice 1 proceeds and no stop
question is needed.**

---

<p align="center"><a href="../README.md">← Docs home</a> · <a href="../ROADMAP.md">Roadmap →</a></p>
