// Text and JSON reports for `check`. Pure: no Node built-ins (ADR-001).

import { canonicalJson, type Json } from "./canonical.ts";
import type { Change, Status, ToolResult } from "./diff.ts";
import { highest, type Risk } from "./risk.ts";

const STATUSES: Status[] = ["unchanged", "cosmetic-only", "changed", "new", "removed"];

/** Input is hostile: show control, bidi and zero-width characters as \uXXXX escapes so a
 * definition can't hide text from the reviewer's terminal. */
export function visible(s: string): string {
  let out = "";
  for (const c of s) {
    const n = c.codePointAt(0)!;
    const hidden =
      n < 0x20 || (n >= 0x7f && n <= 0x9f) || (n >= 0x200b && n <= 0x200f) ||
      (n >= 0x2028 && n <= 0x202e) || (n >= 0x2060 && n <= 0x2069) || n === 0xfeff;
    if (!hidden) out += c;
    else if (c === "\n") out += "\\n";
    else if (c === "\t") out += "\\t";
    else out += `\\u${n.toString(16).padStart(4, "0")}`;
  }
  return out;
}

function value(v: Json): string {
  return visible(canonicalJson(v));
}

function describe(field: string, c: Change): string {
  const [first, second] = c.path;
  const what =
    field !== "annotations" && first === "properties" && second !== undefined && c.path.length === 2
      ? `${field} property ${visible(second)}`
      : [field, ...c.path].map(visible).join(".");
  if (c.before === undefined) return `${what} added: ${value(c.after!)}`;
  if (c.after === undefined) return `${what} removed (was ${value(c.before)})`;
  return `${what}: ${value(c.before)} -> ${value(c.after)}`;
}

export function formatText(server: string, lockLabel: string, results: ToolResult[]): string {
  const lines = [`Server ${visible(server)}: ${results.length} tools checked against ${lockLabel}`];
  for (const r of results) {
    lines.push(`  ${r.status.padEnd(13)} ${visible(r.name)}${r.status === "unchanged" ? "" : `  [risk ${r.risk}]`}`);
    const c = r.changes ?? {};
    if (c.title) {
      const show = (t?: string) => (t === undefined ? "(none)" : JSON.stringify(visible(t)));
      lines.push(`      title: ${show(c.title.before)} -> ${show(c.title.after)}`);
    }
    if (c.description) {
      const text = c.description
        .map(({ op, text }) => (op === "equal" ? text : op === "insert" ? `{+${text}+}` : `[-${text}-]`))
        .join("");
      lines.push(`      description: ${visible(text)}`);
    }
    for (const field of ["inputSchema", "outputSchema", "annotations"] as const) {
      for (const change of c[field] ?? []) lines.push(`      ${describe(field, change)}`);
    }
    for (const x of r.reasons) lines.push(`      risk ${x.level}: ${visible(x.reason)}`);
  }
  const summary = Object.entries(counts(results)).map(([s, n]) => `${n} ${s}`).join(", ");
  lines.push(`Summary: ${summary}; highest risk ${highestRisk(results)}`);
  return `${lines.join("\n")}\n`;
}

export function counts(results: ToolResult[]): Record<Status, number> {
  return Object.fromEntries(STATUSES.map((s) => [s, results.filter((r) => r.status === s).length])) as Record<Status, number>;
}

export function highestRisk(results: ToolResult[]): Risk {
  return highest(results.map((r) => r.risk));
}

/** The same report as data. Strings stay as the server sent them; JSON escapes every control
 * character, and rendering the rest safely is the reader's job. */
export function formatJson(server: string, lockLabel: string, results: ToolResult[]): string {
  const doc = { server, lock: lockLabel, highestRisk: highestRisk(results), summary: counts(results), tools: results };
  return `${JSON.stringify(doc, null, 2)}\n`;
}
