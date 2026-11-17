// Compare a locked server against a fresh tools/list. Pure: no Node built-ins (ADR-001).

import { canonicalJson, hashDefinition, isObject, sortedKeys, type Json, type ToolDefinition } from "./canonical.ts";
import type { ServerLock } from "./lockfile.ts";
import { assessChange, assessNew, assessRemoved, highest, type Reason, type Risk } from "./risk.ts";

export type Status = "unchanged" | "cosmetic-only" | "changed" | "new" | "removed";

/** One value that differs. `before` absent = added, `after` absent = removed. */
export type Change = { path: string[]; before?: Json; after?: Json };

export type WordOp = { op: "equal" | "insert" | "delete"; text: string };

export type ToolChanges = {
  title?: { before?: string; after?: string };
  description?: WordOp[];
  inputSchema?: Change[];
  outputSchema?: Change[];
  annotations?: Change[];
};

export type ToolResult = { name: string; status: Status; risk: Risk; reasons: Reason[]; changes?: ToolChanges };

function result(name: string, status: Status, reasons: Reason[] = [], changes?: ToolChanges): ToolResult {
  const r: ToolResult = { name, status, risk: highest(reasons.map((x) => x.level)), reasons };
  if (changes) r.changes = changes;
  return r;
}

/** Every leaf that differs between two JSON values, with its path. Objects are walked key by
 * key; anything else (arrays included) that differs is one change. */
export function deepDiff(a: Json | undefined, b: Json | undefined, path: string[] = []): Change[] {
  if (a !== undefined && b !== undefined && canonicalJson(a) === canonicalJson(b)) return [];
  if (isObject(a) && isObject(b)) {
    const keys = sortedKeys({ ...a, ...b });
    return keys.flatMap((k) =>
      deepDiff(Object.hasOwn(a, k) ? a[k] : undefined, Object.hasOwn(b, k) ? b[k] : undefined, [...path, k]),
    );
  }
  if (a === undefined && b === undefined) return [];
  const change: Change = { path };
  if (a !== undefined) change.before = a;
  if (b !== undefined) change.after = b;
  return [change];
}

// ponytail: LCS is O(n*m); past this many cells the middle shows as one delete plus one insert.
const MAX_LCS_CELLS = 4_000_000;

/** Word-level diff. Whitespace runs are tokens too, so a whitespace-only edit still shows. */
export function wordDiff(before: string, after: string): WordOp[] {
  const a = before.split(/(\s+)/).filter(Boolean);
  const b = after.split(/(\s+)/).filter(Boolean);
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  const x = a.slice(pre, a.length - suf);
  const y = b.slice(pre, b.length - suf);

  const ops: WordOp[] = [];
  const push = (op: WordOp["op"], text: string) => {
    const last = ops.at(-1);
    if (last?.op === op) last.text += text;
    else ops.push({ op, text });
  };
  a.slice(0, pre).forEach((t) => push("equal", t));
  if (x.length * y.length > MAX_LCS_CELLS) {
    x.forEach((t) => push("delete", t));
    y.forEach((t) => push("insert", t));
  } else {
    // lcs[i][j] = LCS length of x[i..] and y[j..]
    const lcs = Array.from({ length: x.length + 1 }, () => new Uint32Array(y.length + 1));
    for (let i = x.length - 1; i >= 0; i--) {
      for (let j = y.length - 1; j >= 0; j--) {
        lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < x.length || j < y.length) {
      if (i < x.length && j < y.length && x[i] === y[j]) {
        push("equal", x[i++]);
        j++;
      } else if (i < x.length && (j === y.length || lcs[i + 1][j] >= lcs[i][j + 1])) {
        push("delete", x[i++]);
      } else {
        push("insert", y[j++]);
      }
    }
  }
  a.slice(a.length - suf).forEach((t) => push("equal", t));
  return ops;
}

function str(v: Json | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/** What differs between two definitions of the same tool, field by field. */
export function diffTool(before: ToolDefinition, after: ToolDefinition): ToolChanges {
  const changes: ToolChanges = {};
  const [t0, t1] = [str(before.title), str(after.title)];
  if (t0 !== t1) changes.title = { before: t0, after: t1 };
  const [d0, d1] = [str(before.description) ?? "", str(after.description) ?? ""];
  if (d0 !== d1) changes.description = wordDiff(d0, d1);
  for (const field of ["inputSchema", "outputSchema", "annotations"] as const) {
    const c = deepDiff(before[field], after[field]);
    if (c.length > 0) changes[field] = c;
  }
  return changes;
}

/** Status of every tool, locked or current, sorted by name. */
export async function checkServer(lock: ServerLock, current: ToolDefinition[]): Promise<ToolResult[]> {
  const results: ToolResult[] = [];
  const currentNames = new Set(current.map((t) => t.name));
  for (const def of current) {
    const locked = Object.hasOwn(lock.tools, def.name) ? lock.tools[def.name] : undefined;
    if (!locked) {
      results.push(result(def.name, "new", assessNew(def)));
    } else if ((await hashDefinition(def)) === locked.hash) {
      results.push(result(def.name, "unchanged"));
    } else {
      const changes = diffTool(locked.definition, def);
      // Cosmetic only when the title is provably the sole difference; anything else is "changed".
      const titleOnly = changes.title !== undefined && Object.keys(changes).length === 1;
      results.push(result(def.name, titleOnly ? "cosmetic-only" : "changed", assessChange(locked.definition, def, changes), changes));
    }
  }
  for (const name of Object.keys(lock.tools)) {
    if (!currentNames.has(name)) results.push(result(name, "removed", assessRemoved(name)));
  }
  return results.sort((p, q) => (p.name < q.name ? -1 : p.name > q.name ? 1 : 0));
}
