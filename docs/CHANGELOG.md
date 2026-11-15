<h1 align="center">📋 mcp-tool-rugpull-gate Changelog</h1>

<p align="center">
  <em>What changed in mcp-tool-rugpull-gate, newest first.</em>
</p>

<p align="center">
  <a href="ROADMAP.md"><img src="https://img.shields.io/badge/plan-ROADMAP-8B5CF6?style=for-the-badge" alt="Roadmap"></a>
  <a href="README.md"><img src="https://img.shields.io/badge/↩-docs-6B7280?style=for-the-badge" alt="Docs home"></a>
</p>

---

Entries that close a roadmap item carry the roadmap phase in italics.

## Unreleased

**Added**
- `rugpull-gate lock <tools-list.json> --server <id>` writes `mcp-tools.lock.json` (`lockVersion` 1) with each tool's SHA-256 and canonical definition, and refuses to overwrite a lock file it can't verify; `rugpull-gate check` reports every tool as unchanged, cosmetic-only, changed, new or removed, with a word-level description diff, schema paths added, removed or changed, and annotation values before and after, exiting 1 on drift and 2 on bad input. The canonical form follows leanproxy PR 352's field set and rules, and every rule has a firing and a non-firing test. CI now runs on Ubuntu and Windows. *Slice 1: Canonicalise, lock, diff*

**Docs**
- Roadmap sweep: the Slice 1 heading had a lock emoji (the owner-tag marker) and now uses the build emoji; "Next slices" is a ### group under the post-release heading.
- Roadmap rechecked against the org's 2026-11 requirements: the intro names the roadmap routine instead of its days.
- Gate check (falsifier 1) in `docs/reports/2026-gate-check.md`: Pipelock hashes annotations but shows only a description-length and parameter-name summary; Snyk agent-scan keeps no local tool hash and never hashed more than the description. Neither does both, so the build goes on. *Slice 0: Gate check*

## 2026-11-08

**Added**
- Repo scaffold: a TypeScript CLI (`rugpull-gate`) that prints its version, with `npm run build`, `npm test` and `npm run lint` all passing, an MIT licence, and an `.env.example` that says there are no settings.
- CI on push to `main` and on every PR: lint, test and build. *Public release*
- `SECURITY.md` with private reporting through GitHub, and what counts as a vulnerability for a tool whose worst bug is a wrong "unchanged". *Public release*
- Demo shell in `site/`: the org source bar, a build-stamp meta tag, a "coming soon" body, and the app icon (a blue padlock on the shared dark tile) as its favicon. *Public release*

**Docs**
- Root README, the docs hub, this changelog, and a roadmap that puts Slices 0 to 3 of the build plan above the release line.
- The spec and build plan copied from the private business plan into `docs/product/`; Mike's approval issue had no notes to apply. ADR-001 copied into `docs/decisions/`.
- A full-history secret scan came back clean. *Public release*

---

<p align="center">
  <a href="README.md">← Docs home</a> ·
  <a href="ROADMAP.md">Roadmap →</a>
</p>
