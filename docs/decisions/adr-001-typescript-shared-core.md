# ADR 001: TypeScript core shared by CLI and browser demo

Up: [docs home](../README.md) · Copied from the private business plan on 2026-11-08.

**Status:** accepted 2026-11-08 (scaffold) · **Door:** two-way for the code, one-way for the lock-file format once users commit one

## Decision

One TypeScript package: a pure `diff(approved, current)` core with no I/O, a Node CLI around it, and the same core bundled for the static Pages demo. No server, no database, no runtime dependency beyond a word-diff routine and a JSON Schema validator in tests.

## Why

- Same stack as mcp-frisk `[est]`, so the roadmap routine and CI patterns carry over and the estimate's reference class holds.
- One engine means the demo cannot disagree with the CLI.

## Alternatives

Python (fine for the CLI, but a second engine for the demo); Go binary (heavier to verify unattended; mcp-frisk's plan dropped it too).

## The one-way door

The `mcp-tools.lock.json` format: once a user commits one, changing it forces a migration. Mitigation: carry a `lockVersion` field from the first release and keep the hashed field set identical to leanproxy's list so a later import is possible.

## Exit cost

Low. The core is a few hundred lines of pure functions `[assum]`; a rewrite costs a few runs.

<p align="center"><a href="../README.md">← Docs home</a></p>
