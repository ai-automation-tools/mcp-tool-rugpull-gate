// Text report for `check`. Pure: no Node built-ins (ADR-001).

import { canonicalJson, type Json } from "./canonical.ts";
import type { Change, Status, ToolResult } from "./diff.ts";

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
    lines.push(`  ${r.status.padEnd(13)} ${visible(r.name)}`);
    const c = r.changes;
    if (!c) continue;
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
  }
  const counts = STATUSES.map((s) => `${results.filter((r) => r.status === s).length} ${s}`);
  lines.push(`Summary: ${counts.join(", ")}`);
  return `${lines.join("\n")}\n`;
}
