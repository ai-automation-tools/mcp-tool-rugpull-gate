// Canonical form and hash of one MCP tool definition. Pure: no Node built-ins (ADR-001).
//
// The rules match leanproxy PR 352 (pkg/toolpin/canonical.go):
// - the hashed fields are name, title, description, inputSchema, outputSchema and annotations;
//   everything else on the tool (icons, _meta, ...) is ignored;
// - a top-level field that is absent, null or "" is dropped, so "no title" and "title": null
//   hash the same; nested values are kept as written;
// - object keys are sorted by code point (= UTF-8 byte order) at every depth;
// - no insignificant whitespace; numbers in their shortest round-trip form (1.0 -> 1).

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };

/** The canonical, approved definition of one tool: the hashed fields only, keys sorted. */
export type ToolDefinition = JsonObject & { name: string };

/** A problem with an input file. The CLI prints the message as one line, never a stack. */
export class InputError extends Error {}

export const HASH_PREFIX = "sha256:";

const STRING_FIELDS = ["title", "description"] as const;
const JSON_FIELDS = ["inputSchema", "outputSchema", "annotations"] as const;

export function isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Own property only, so a hostile `constructor` or `__proto__` key never reads the prototype. */
export function own(o: JsonObject, key: string): Json | undefined {
  return Object.hasOwn(o, key) ? o[key] : undefined;
}

function byCodePoint(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const d = x[i].codePointAt(0)! - y[i].codePointAt(0)!;
    if (d !== 0) return d;
  }
  return x.length - y.length;
}

export function sortedKeys(o: JsonObject): string[] {
  return Object.keys(o).sort(byCodePoint);
}

/** A deep copy with sorted keys. Null-prototype objects, so a `__proto__` key stays data. */
function sortDeep(v: Json): Json {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (!isObject(v)) return v;
  const out: JsonObject = Object.create(null);
  for (const k of sortedKeys(v)) out[k] = sortDeep(v[k]);
  return out;
}

/** Canonical JSON text: sorted keys, no whitespace. Written by hand because JS objects put
 * integer-like keys ("9", "10") first whatever order they were inserted in. */
export function canonicalJson(v: Json): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (isObject(v)) {
    return `{${sortedKeys(v).map((k) => `${JSON.stringify(k)}:${canonicalJson(v[k])}`).join(",")}}`;
  }
  // ponytail: JSON.parse already rounded integers past 2^53, so two literals that differ only
  // there hash the same. Keep source text via JSON.parse's reviver context if that ever matters.
  return JSON.stringify(v);
}

/** Reduce one raw tool from a tools/list response to its canonical definition. */
export function canonicaliseTool(raw: unknown, where: string): ToolDefinition {
  if (!isObject(raw)) throw new InputError(`${where} is not a JSON object`);
  const name = own(raw, "name");
  if (typeof name !== "string" || name === "") {
    throw new InputError(`${where} has no "name" string`);
  }
  const out = Object.create(null) as ToolDefinition;
  out.name = name;
  for (const field of STRING_FIELDS) {
    const v = own(raw, field);
    if (v === undefined || v === null || v === "") continue;
    if (typeof v !== "string") {
      throw new InputError(`tool ${JSON.stringify(name)}: "${field}" is not a string`);
    }
    out[field] = v;
  }
  for (const field of JSON_FIELDS) {
    const v = own(raw, field);
    if (v === undefined || v === null) continue;
    out[field] = sortDeep(v);
  }
  return sortDeep(out) as ToolDefinition;
}

/** "sha256:<hex>" of the canonical JSON, through Web Crypto (Node and browsers both have it). */
export async function hashDefinition(def: ToolDefinition): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(def));
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes));
  return HASH_PREFIX + Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Parse a saved tools/list response: a JSON-RPC response, its `result`, or `{ tools: [...] }`. */
export function parseToolsList(text: string, label: string): ToolDefinition[] {
  if (text.trim() === "") throw new InputError(`${label} is empty`);
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new InputError(`${label} is not valid JSON`);
  }
  if (Array.isArray(doc)) {
    throw new InputError(
      `${label} is a JSON array; expected one tools/list response (merge paginated pages into one "tools" list)`,
    );
  }
  if (!isObject(doc)) throw new InputError(`${label} is not a tools/list response`);
  if (own(doc, "error") !== undefined) {
    throw new InputError(`${label} is a JSON-RPC error response, not a tools/list result`);
  }
  const result = own(doc, "result");
  const body = isObject(result) ? result : doc;
  const tools = own(body, "tools");
  if (!Array.isArray(tools)) throw new InputError(`${label} has no "tools" array`);
  const cursor = own(body, "nextCursor");
  if (cursor !== undefined && cursor !== null && cursor !== "") {
    throw new InputError(
      `${label} is one page of a paginated tools/list (nextCursor is set); fetch every page and merge their tools into one list`,
    );
  }
  const seen = new Set<string>();
  return tools.map((raw, i) => {
    const def = canonicaliseTool(raw, `${label}: tool #${i + 1}`);
    if (seen.has(def.name)) {
      throw new InputError(`${label} lists tool ${JSON.stringify(def.name)} twice`);
    }
    seen.add(def.name);
    return def;
  });
}
