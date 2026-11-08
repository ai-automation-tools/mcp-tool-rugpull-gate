# Spec: MCP Tool Rug-Pull Gate (working name `rugpull-gate`)

> Copied from the mcp-tool-rugpull-gate business plan (`Analysis/mcp-tool-rugpull-gate/build/spec.md` in the private pipeline workspace) on 2026-11-08. This copy is the one the roadmap works from.

Up: [product](README.md) · Build plan: [build-plan.md](build-plan.md)

The idea started as a private prototype console with its own dataset schema; the real input here is raw MCP `tools/list` JSON.

## Users

A platform or security engineer who approved MCP servers and wants a diff when one changes; a developer who keeps `.mcp.json` in a repo and wants drift visible in a pull request.

## MVP features

1. **Lock and diff (snapshot-only).** `lock <tools-list.json> --server <id>` canonicalises each tool (name, title, description, inputSchema, outputSchema, annotations; sorted keys, empties dropped, same rules as leanproxy PR 352), stores SHA-256 and the full approved definition in `mcp-tools.lock.json`. `check <tools-list.json>` reports each tool as unchanged, changed, cosmetic-only, new or removed.
2. **Review output and risk reasons.** Per changed tool: word-level description diff, added/removed/changed schema properties, annotation before/after with flipped hints named (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`). Rules: new tool = high; description gains an instruction with an address, URL or "always" directive = high; new schema property implying an external destination = high; `destructiveHint` false to true or `readOnlyHint` true to false = at least medium; title-only change = none. Exit code non-zero at or above `--fail-on`. `approve <tool>` rewrites the lock. Output text, JSON, and the suite agent-inventory format (MCP servers as identities, drift as findings).
3. **Browser demo.** Same engine client-side: paste two `tools/list` blobs or load the sample, planted `send_customer_email` drift shown as the banner on first load. Sample uses fictional servers only.

## Won't (first release)

Live fetching from stdio or HTTP servers (post-release); sitting in the call path or blocking live calls; any network access; signature schemes (ETDI); scanning descriptions for known injection phrases (mcp-frisk's and Snyk's job); implementation-behind-unchanged-definition detection (not visible to hashing); any account; real-vendor names in demo data.

## Acceptance criteria

- Key order and whitespace changes alone yield "unchanged".
- Title-only change yields cosmetic, risk none, and does not trip `--fail-on`.
- A description-identical tool that gains a `notify_webhook` property is flagged high (the card's `close_ticket` case).
- Missing, empty, malformed-JSON and paginated-merged inputs fail with a clear message, never a stack trace.
- A corrupt lock file is never overwritten.
- No network call at runtime, proven by a sockets-blocked test in CI.
- Output validates against the agent-inventory schema v0.1 in CI.
- The demo shows a finding with no click.

## Mike's approval notes

None. The `Plan approval: mcp-tool-rugpull-gate` issue (michaelschecht/claude-routines#20) was closed as Completed on 2026-11-06 with no comments, so the plan stands as written.

---

<p align="center"><a href="README.md">← Product</a> · <a href="build-plan.md">Build plan →</a></p>
