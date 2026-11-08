# Build plan: MCP Tool Rug-Pull Gate

> Copied from the mcp-tool-rugpull-gate business plan (`Analysis/mcp-tool-rugpull-gate/build/build-plan.md` in the private pipeline workspace) on 2026-11-08. The run estimates come from the plan's private estimate.

**Spec:** [spec.md](spec.md) · **Architecture:** [ADR-001](../decisions/adr-001-typescript-shared-core.md)

**MVP = Slices 0 to 3.** The repo goes public after Slice 3. Everything after is post-release.

## Slice 0 - Gate check and walking skeleton (MVP, ~2 runs)

- **Delivers:** falsifier 1 written up in `docs/` (do Snyk agent-scan or Pipelock already hash annotations and show a per-field diff); repo scaffold, CI, an npm package that prints a version, a Pages site with two empty paste boxes.
- **De-risks:** whether the project should exist; the deploy path.
- **Done when:** the check is recorded, CI is green, Pages loads. If the check says both already do it, stop and report PARK.

## Slice 1 - Canonicalise, lock, diff (MVP feature 1, ~9 runs)

- **Delivers:** canonical hash, `mcp-tools.lock.json` with `lockVersion`, `lock`/`check`, the diff engine for description, schema and annotations.
- **De-risks:** the false-positive risk; every canonicalisation rule gets a passing and a failing fixture.
- **Done when:** the key-order, title-only and `notify_webhook` acceptance criteria pass on Windows and Linux CI.

## Slice 2 - Risk reasons, approve, output formats (MVP feature 2, ~8 runs)

- **Delivers:** risk rules with plain-language reasons, `approve`, `--fail-on`, text/JSON/suite-inventory output, schema validation in CI, the sockets-blocked test.
- **De-risks:** the suite promise and the "no network" trust claim.
- **Done when:** the spec's rule, output and malformed-input criteria pass.

## Slice 3 - Browser demo and release prep (MVP feature 3, ~7 runs, incl. release prep)

- **Delivers:** client-side demo on the same core with the planted drift as the first-load banner, README with a GIF, rule catalog, Responsible use section, cross-link to mcp-frisk.
- **De-risks:** discoverability, the reach assumption.
- **Done when:** the demo criterion passes and Mike approves the release gate. **Public release = MVP.**

## Post-release

4. Opt-in live fetch (stdio and streamable HTTP) with a clear "this runs the server" warning. 5. `notifications/tools/list_changed` watch mode. 6. GitHub Action and SARIF. 7. Pin `initialize` `instructions`. 8. Import of leanproxy and Pipelock pin files.

## When we'd stop

If falsifier 1 fires in Slice 0, or if Slice 1 exceeds 13 runs, stop and write up. If 90 days after release stars are under 40 with no outside users, archive.

## Definition of done

Acceptance criteria pass including empty, malformed and corrupt-lock cases; tests concentrated on canonicalisation and risk rules; input treated as hostile (never evaluated); deployed, not merged.

---

<p align="center"><a href="README.md">← Product</a> · <a href="spec.md">Spec</a></p>
