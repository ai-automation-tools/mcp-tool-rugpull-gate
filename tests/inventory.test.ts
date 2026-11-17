import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { run } from "../src/cli.ts";
import { SCHEMA_ID, type buildInventory } from "../src/inventory.ts";
import { RULES } from "../src/risk.ts";

const fixture = (name: string) => fileURLToPath(new URL(`fixtures/${name}`, import.meta.url));
const schema = JSON.parse(readFileSync(new URL("../schemas/agent-inventory.schema.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats.default(ajv);
const validate = ajv.compile(schema);
const NOW = new Date("2026-11-17T09:00:00Z");

async function inventory(input: string) {
  const dir = mkdtempSync(join(tmpdir(), "rugpull-gate-inv-"));
  assert.equal((await run(["lock", fixture("helpdesk-v1.json"), "--server", "fernhill-helpdesk"], dir)).code, 0);
  const r = await run(["check", input, "--format", "inventory"], dir, NOW);
  assert.equal(r.stderr, "");
  const doc = JSON.parse(r.stdout) as ReturnType<typeof buildInventory>;
  const valid = validate(doc);
  assert.ok(valid, JSON.stringify(validate.errors, null, 2));
  return { code: r.code, doc };
}

test("the vendored schema is the published v0.1", () => {
  assert.equal(schema.$id, SCHEMA_ID);
  assert.equal(schema.properties.schemaVersion.const, "0.1");
});

test("inventory: the server is an identity and every drift is a finding, valid against v0.1", async () => {
  const { code, doc } = await inventory(fixture("helpdesk-v2.json"));
  assert.equal(code, 1);
  assert.equal(doc.generatedAt, "2026-11-17T09:00:00.000Z");
  assert.equal(doc.producer.name, "mcp-tool-rugpull-gate");
  assert.deepEqual(doc.identities.map((i) => [i.id, i.kind]), [["mcp:fernhill-helpdesk", "mcp-server"]]);
  assert.equal(doc.identities[0].tools.length, 6);
  const rules = doc.findings.map((f) => `${f.ruleId} ${f.severity}`);
  assert.deepEqual(rules, [
    "rugpull-gate/external-destination-property high",
    "rugpull-gate/removed-tool low",
    "rugpull-gate/new-tool high",
    "rugpull-gate/title-changed info",
    "rugpull-gate/destructive-hint-flipped medium",
    "rugpull-gate/description-instruction high",
  ]);
  const webhook = doc.findings[0];
  assert.equal(webhook.id, "mcp:fernhill-helpdesk#close_ticket/external-destination-property/1");
  assert.equal(webhook.identityId, "mcp:fernhill-helpdesk");
  assert.equal(webhook.title, `close_ticket: ${RULES["external-destination-property"]}`);
  assert.match(webhook.evidence, /notify_webhook/);
  assert.match(webhook.remediation, /rugpull-gate approve close_ticket /);
  assert.equal(doc.x.highestRisk, "high");
  // The validator bites: a field the schema doesn't allow fails it.
  assert.equal(validate({ ...doc, risk: "high" }), false);
});

test("inventory: no drift is a valid document with no findings", async () => {
  const { code, doc } = await inventory(fixture("helpdesk-v1-reformatted.json"));
  assert.equal(code, 0);
  assert.deepEqual(doc.findings, []);
  assert.equal(doc.x.summary.unchanged, 6);
});
