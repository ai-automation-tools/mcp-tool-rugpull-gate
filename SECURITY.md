# Security Policy

mcp-tool-rugpull-gate is a security tool: people will trust its "unchanged" to mean nothing
changed. A wrong "unchanged" is the worst bug it can have, so we take reports about it
seriously.

## Reporting a vulnerability

**Please don't open a public issue for a security vulnerability.**

Report it privately through GitHub:

1. Go to the repository's **Security** tab, then **Report a vulnerability** (GitHub Private
   Vulnerability Reporting).
2. Describe the issue, its impact, and the steps to reproduce it. A proof of concept helps.

We aim to acknowledge a report within a few days and keep you posted while we fix it.
Please give us reasonable time to ship a fix before you disclose it.

## Scope

mcp-tool-rugpull-gate runs entirely on your machine, or entirely in your browser tab for the
demo. There's no hosted service, no account and no telemetry. The surfaces that matter most:

- **A missed change.** Two tool definitions that differ in name, title, description,
  `inputSchema`, `outputSchema` or annotations must never be reported as unchanged. A
  canonicalisation rule that hides a real difference is in scope.
- **Hostile input.** A `tools/list` file or a lock file is untrusted. It is parsed as JSON and
  never evaluated. Input that makes the tool run code, hang, or crash with a stack trace that
  leaks file contents is in scope.
- **The lock file.** A corrupt lock file must never be overwritten. A path that loses the
  approved definitions is in scope.
- **Network and execution.** The CLI and the demo make no network calls, start no MCP server
  and spawn no process. A code path that does, including the demo sending pasted JSON
  anywhere, is in scope.

### Not vulnerabilities (by design)

- A tool that was already poisoned when you first locked it. The lock records what you
  approved; it can't judge whether that was safe.
- A server whose implementation changes behind an unchanged definition. Hashing can't see it.
- Missing risk rules for a pattern. That's a feature request; open an issue.

## Supported versions

mcp-tool-rugpull-gate is pre-1.0. Fixes land on the latest `main`.

## Test fixtures

Every server and tool in this repo's tests, examples and demo is fictional. Never commit a
real token, a `.env` file or a local path. A full-history secret scan
(`gitleaks git . --log-opts=--all`) came back clean on 2026-11-08.
