// Risk rules: a level and a plain-English reason for each change. Pure: no Node built-ins
// (ADR-001). Every rule has a test that fires it and one that doesn't (tests/risk.test.ts).

import { canonicalJson, isObject, own, sortedKeys, type Json, type JsonObject, type ToolDefinition } from "./canonical.ts";
import type { ToolChanges } from "./diff.ts";

export const RISK_LEVELS = ["none", "low", "medium", "high"] as const;
export type Risk = (typeof RISK_LEVELS)[number];

/** Rule ids and the one-line title each carries in the inventory output (`rugpull-gate/<id>`). */
export const RULES = {
  "new-tool": "New tool, not in the lock",
  "removed-tool": "Tool removed from the server",
  "title-changed": "Title changed",
  "description-instruction": "Description gained an instruction with an address, a URL or an \"always\"",
  "description-changed": "Description changed",
  "external-destination-property": "New input property points to an external destination",
  "input-schema-changed": "Input schema changed",
  "output-schema-changed": "Output schema changed",
  "destructive-hint-flipped": "destructiveHint flipped to true",
  "read-only-hint-flipped": "readOnlyHint flipped to false",
  "open-world-hint-flipped": "openWorldHint flipped to true",
  "annotation-changed": "Annotations changed",
  "definition-changed": "Definition changed",
} as const;
export type RuleId = keyof typeof RULES;

export type Reason = { rule: RuleId; level: Risk; reason: string };

export function rank(level: Risk): number {
  return RISK_LEVELS.indexOf(level);
}

export function highest(levels: Risk[]): Risk {
  return levels.reduce<Risk>((a, b) => (rank(b) > rank(a) ? b : a), "none");
}

const q = (s: string) => JSON.stringify(s);

// --- description ---------------------------------------------------------------------------

// Matched per whitespace-free token with anchored patterns: input is hostile, and an
// unanchored scan for an address over a long description backtracks quadratically.
const EMAIL = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;
const URL_START = /^(?:[a-z][a-z0-9+.-]*:\/\/|www\.)\S/i;
const ALWAYS = /^always$/i;

/** Strip the punctuation a sentence wraps around a word: `(see https://x.example).` */
function bare(token: string): string {
  let start = 0;
  let end = token.length;
  while (start < end && `("'<[{`.includes(token[start])) start++;
  while (end > start && `.,;:!?)]}>'"`.includes(token[end - 1])) end--;
  return token.slice(start, end);
}

function describeInserted(inserted: string): string[] {
  const tokens = inserted.split(/\s+/).map(bare);
  const found: string[] = [];
  const always = tokens.find((t) => ALWAYS.test(t));
  if (always) found.push(`the directive ${q(always)}`);
  const email = tokens.find((t) => EMAIL.test(t.replace(/^mailto:/i, "")));
  if (email) found.push(`the address ${email}`);
  const url = tokens.find((t) => URL_START.test(t) && !EMAIL.test(t));
  if (url) found.push(`the URL ${url}`);
  return found;
}

// --- input schema --------------------------------------------------------------------------

// Words in a property name that say "this is where data goes". Matched as whole words of the
// name (notify_webhook -> notify, webhook), so "access" never matches "cc".
const DESTINATION_WORDS = new Set([
  "webhook", "hook", "callback", "url", "uri", "endpoint", "email", "mail", "recipient", "recipients",
  "destination", "dest", "bcc", "cc", "host", "hostname", "redirect", "forward", "upload", "sink",
]);
const DESTINATION_FORMATS = new Set(["uri", "url", "iri", "uri-reference", "iri-reference", "email", "idn-email", "hostname", "idn-hostname"]);

function nameWords(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Why this property looks like an external destination, or undefined if it doesn't. */
export function destinationSignal(name: string, schema: Json | undefined): string | undefined {
  const signals: string[] = [];
  const word = nameWords(name).find((w) => DESTINATION_WORDS.has(w));
  if (word) signals.push(`its name says ${q(word)}`);
  const format = isObject(schema) ? own(schema, "format") : undefined;
  if (typeof format === "string" && DESTINATION_FORMATS.has(format)) signals.push(`its format is ${format}`);
  return signals.length > 0 ? signals.join(" and ") : undefined;
}

function properties(def: ToolDefinition): JsonObject {
  const schema = def.inputSchema;
  const props = isObject(schema) ? own(schema, "properties") : undefined;
  return isObject(props) ? props : {};
}

// --- annotations ---------------------------------------------------------------------------

// The MCP spec's defaults for an unset hint (ToolAnnotations, 2025-06-18).
const HINT_DEFAULTS: Record<string, boolean> = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

type Flip = { hint: string; to: boolean; rule: RuleId; level: Risk; meaning: string };
const FLIPS: Flip[] = [
  { hint: "destructiveHint", to: true, rule: "destructive-hint-flipped", level: "medium", meaning: "the tool now says it may delete or overwrite data" },
  { hint: "readOnlyHint", to: false, rule: "read-only-hint-flipped", level: "medium", meaning: "the tool no longer promises to only read" },
  { hint: "openWorldHint", to: true, rule: "open-world-hint-flipped", level: "medium", meaning: "the tool now says it reaches systems outside the server" },
];

function annotations(def: ToolDefinition): JsonObject {
  return isObject(def.annotations) ? def.annotations : {};
}

function hint(a: JsonObject, name: string): { value: boolean; shown: string } {
  const v = own(a, name);
  if (typeof v === "boolean") return { value: v, shown: String(v) };
  const shown = v === undefined ? "unset" : canonicalJson(v);
  return { value: HINT_DEFAULTS[name], shown: `${shown} (MCP reads that as ${HINT_DEFAULTS[name]})` };
}

// --- the rules -----------------------------------------------------------------------------

/** Reasons for a tool whose definition differs from the locked one. Never empty: anything the
 * named rules don't cover still gets a low "changed" reason. */
export function assessChange(before: ToolDefinition, after: ToolDefinition, changes: ToolChanges): Reason[] {
  const reasons: Reason[] = [];

  if (changes.title) reasons.push({ rule: "title-changed", level: "none", reason: "only the display title changed; the model does not act on it" });

  if (changes.description) {
    const inserted = changes.description.filter((o) => o.op === "insert").map((o) => o.text).join(" ");
    const found = describeInserted(inserted);
    reasons.push(
      found.length > 0
        ? {
            rule: "description-instruction",
            level: "high",
            reason: `the description gained ${new Intl.ListFormat("en").format(found)}; the model reads a description as instructions, so this can send data somewhere new`,
          }
        : { rule: "description-changed", level: "medium", reason: "the description changed; the model reads it as instructions, so read the new wording" },
    );
  }

  if (changes.inputSchema) {
    const p0 = properties(before);
    const p1 = properties(after);
    const flagged = new Set<string>();
    for (const name of sortedKeys(p1)) {
      if (Object.hasOwn(p0, name)) continue;
      const signal = destinationSignal(name, p1[name]);
      if (!signal) continue;
      flagged.add(name);
      reasons.push({
        rule: "external-destination-property",
        level: "high",
        reason: `new input property ${q(name)} looks like an external destination (${signal}); the tool could now send data somewhere it didn't before`,
      });
    }
    const rest = changes.inputSchema.filter((c) => !(c.path.length === 2 && c.path[0] === "properties" && flagged.has(c.path[1])));
    if (rest.length > 0) {
      const what = rest.map((c) => (c.path.length === 0 ? "the whole schema" : c.path.join("."))).join(", ");
      reasons.push({ rule: "input-schema-changed", level: "low", reason: `the input schema changed at ${what}` });
    }
  }

  if (changes.outputSchema) {
    reasons.push({ rule: "output-schema-changed", level: "low", reason: "the output schema changed; results may carry different fields" });
  }

  if (changes.annotations) {
    const a0 = annotations(before);
    const a1 = annotations(after);
    const named = new Set<string>();
    for (const f of FLIPS) {
      const [h0, h1] = [hint(a0, f.hint), hint(a1, f.hint)];
      if (h0.value === f.to || h1.value !== f.to) continue;
      named.add(f.hint);
      reasons.push({ rule: f.rule, level: f.level, reason: `${f.hint} went from ${h0.shown} to ${h1.shown}: ${f.meaning}` });
    }
    const other = sortedKeys({ ...a0, ...a1 }).filter((k) => {
      if (named.has(k)) return false;
      const [v0, v1] = [own(a0, k), own(a1, k)];
      return v0 === undefined || v1 === undefined || canonicalJson(v0) !== canonicalJson(v1);
    });
    if (other.length > 0) {
      reasons.push({
        rule: "annotation-changed",
        level: "low",
        reason: `annotation ${other.join(", ")} changed; hints are the server's own claims, so a safer-sounding one proves nothing`,
      });
    }
  }

  const changed = Object.keys(changes).filter((k) => k !== "title");
  if (changed.length > 0 && !reasons.some((r) => r.level !== "none")) {
    // Reached when a hostile definition makes a field a non-object (annotations: "x"), or a
    // future hashed field has no rule yet: a real change never comes out as risk none.
    reasons.push({ rule: "definition-changed", level: "low", reason: "the definition changed in a way no named rule covers; read the diff" });
  }
  return reasons;
}

export function assessNew(def: ToolDefinition): Reason[] {
  return [{ rule: "new-tool", level: "high", reason: `${q(def.name)} is not in the lock; read its whole definition before approving it` }];
}

export function assessRemoved(name: string): Reason[] {
  return [{ rule: "removed-tool", level: "low", reason: `${q(name)} is gone from the server; approve it to drop it from the lock` }];
}
