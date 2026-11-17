// `check --format inventory`: an agent inventory document, schema v0.1
// (`schemas/agent-inventory.schema.json`, published at SCHEMA_ID). The checked server is one
// identity; every risk reason on a drifted tool is one finding. Pure: no Node built-ins (ADR-001).

import type { ToolResult } from "./diff.ts";
import { counts, highestRisk } from "./report.ts";
import { RULES, type Risk } from "./risk.ts";

export const SCHEMA_ID = "https://ai-automation-tools.dev/schemas/agent-inventory/v0.1.json";
const REPO = "https://github.com/ai-automation-tools/mcp-tool-rugpull-gate";

type Severity = "high" | "medium" | "low" | "info";
const SEVERITY: Record<Risk, Severity> = { high: "high", medium: "medium", low: "low", none: "info" };

export type InventoryOptions = {
  server: string;
  lock: string;
  /** The tools/list file as the user named it, for the approve command in each remediation. */
  input: string;
  version: string;
  now: Date;
};

export function buildInventory(results: ToolResult[], o: InventoryOptions) {
  const identityId = `mcp:${o.server}`;
  const findings = [];
  for (const r of results) {
    const seen = new Map<string, number>();
    for (const x of r.reasons) {
      const n = (seen.get(x.rule) ?? 0) + 1;
      seen.set(x.rule, n);
      findings.push({
        id: `${identityId}#${r.name}/${x.rule}/${n}`,
        identityId,
        ruleId: `rugpull-gate/${x.rule}`,
        severity: SEVERITY[x.level],
        title: `${r.name}: ${RULES[x.rule]}`,
        evidence: `${r.status} against ${o.lock}: ${x.reason}`,
        remediation: `Read the diff (rugpull-gate check ${o.input} --server ${o.server}); if the change is expected, run rugpull-gate approve ${r.name} ${o.input} --server ${o.server}`,
        status: "open" as const,
      });
    }
  }
  return {
    schemaVersion: "0.1" as const,
    generatedAt: o.now.toISOString(),
    producer: { name: "mcp-tool-rugpull-gate", version: o.version, url: REPO },
    identities: [
      {
        id: identityId,
        kind: "mcp-server" as const,
        platform: "mcp" as const,
        displayName: o.server,
        status: "unknown" as const,
        tools: results.filter((r) => r.status !== "removed").map((r) => ({ name: r.name, server: o.server })),
      },
    ],
    findings,
    x: { lock: o.lock, highestRisk: highestRisk(results), summary: counts(results) },
  };
}

export function formatInventory(results: ToolResult[], o: InventoryOptions): string {
  return `${JSON.stringify(buildInventory(results, o), null, 2)}\n`;
}
