<a id="readme-top"></a>

<h1 align="center">🔑 mcp-tool-rugpull-gate</h1>

<p align="center">
  <em>Locks the MCP tool definitions you approved and tells you, in plain words,<br>what changed since and which changes look risky.</em>
</p>

<p align="center">
  <a href="docs/README.md"><strong>Explore the docs »</strong></a>
</p>

<p align="center">
  <a href="docs/ROADMAP.md">Roadmap</a>
  ·
  <a href="https://github.com/ai-automation-tools/mcp-tool-rugpull-gate/issues">Report Bug</a>
  ·
  <a href="https://github.com/ai-automation-tools/mcp-tool-rugpull-gate/issues">Request Feature</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-incubating-F59E0B?style=for-the-badge" alt="Status: incubating">
  <a href="docs/ROADMAP.md"><img src="https://img.shields.io/badge/plan-ROADMAP-8B5CF6?style=for-the-badge" alt="Roadmap"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2ea44f?style=for-the-badge" alt="License: MIT"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Node.js-22.18+-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js 22.18+">
  <img src="https://img.shields.io/badge/network_calls-zero-6B7280?style=flat-square" alt="Network calls: zero">
</p>

---

> [!WARNING]
> **Nothing works yet.** This is the scaffold. `rugpull-gate` prints its version and that's
> all; `lock`, `check`, `approve` and the demo arrive one roadmap item at a time. The
> [roadmap](docs/ROADMAP.md) says what's next.

## 🎯 What it's for

You approve an MCP server after reading what its tools say they do. A week later the server
ships an update: `close_ticket` now takes a `notify_webhook` URL, or `send_customer_email`'s
description picked up a line telling the model to BCC an outside address. Your client loads the
new definitions without asking. That's a rug pull, and nothing in the default setup shows it to
you.

mcp-tool-rugpull-gate is a lock file for those definitions. It is planned to:

| Command | What it does |
|:---|:---|
| **`lock`** | Reads a saved `tools/list` response and writes `mcp-tools.lock.json`: a hash and the full approved definition of every tool. Commit it next to your `.mcp.json`. |
| **`check`** | Diffs a fresh `tools/list` against the lock. Each tool comes back unchanged, changed, cosmetic-only, new or removed, with a word-level description diff, schema properties added or removed, and annotation hints that flipped (`readOnlyHint` true to false, say). Exits non-zero at or above `--fail-on`. |
| **`approve`** | Accepts one tool's new definition into the lock once a human has read the diff. |

Output is text, JSON, or the Agent Security Suite's agent inventory format. The browser demo
runs the same engine on two pasted `tools/list` blobs.

### What it won't do

- Fetch from a live server. You give it a saved `tools/list`; live fetch comes after release.
- Block or hold a call. It reports drift; it doesn't sit between your client and the server.
- Catch a tool that was already poisoned when you first locked it.
- See a server whose code changed behind an unchanged definition.
- Touch the network, or ask for an account.

## 🚀 Quick start

From a clone, with Node 22.18 or newer:

```bash
npm install            # dev dependencies only; no runtime dependencies yet
npm run build          # compiles src/ to dist/
node dist/cli.js       # prints "rugpull-gate 0.0.0" for now
```

## 🗂️ What's in here

| Folder | What's inside |
|:---|:---|
| [**📚 docs/**](docs/README.md) | The roadmap, the changelog, the spec and build plan, and ADR-001. |
| [**🧩 src/**](src/) | The CLI. One TypeScript core that the browser demo will import too. |
| [**🧪 tests/**](tests/) | `node:test` suites, run with `npm test`. |
| [**🖥️ site/**](site/) | The demo page and its favicon. A "coming soon" shell for now. |

## 🛠️ Development

```bash
npm run lint    # ESLint plus tsc --noEmit
npm test        # node --test
npm run build   # tsc to dist/
```

Agents working this repo read [AGENTS.md](AGENTS.md) first. Security reports go through
[SECURITY.md](SECURITY.md), not public issues.

---

<p align="center">
  Built with <a href="https://www.typescriptlang.org/">TypeScript</a> · <a href="docs/README.md">Docs</a> · <a href="LICENSE">MIT License</a> · part of <a href="https://github.com/ai-automation-tools">ai-automation-tools</a>
</p>
