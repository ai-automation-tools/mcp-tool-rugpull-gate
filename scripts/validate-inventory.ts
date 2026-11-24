// CI step: `node scripts/validate-inventory.ts <inventory.json>`. Validates a
// `rugpull-gate check --format inventory` document against the vendored agent inventory schema
// v0.1 and requires the planted drift finding (close_ticket gaining notify_webhook). Exits 1
// with one line per problem.

import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const path = process.argv[2];
if (!path) {
  console.error("usage: node scripts/validate-inventory.ts <inventory.json>");
  process.exit(2);
}
const schema = JSON.parse(readFileSync(new URL("../schemas/agent-inventory.schema.json", import.meta.url), "utf8"));
const doc = JSON.parse(readFileSync(path, "utf8"));

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats.default(ajv);
const validate = ajv.compile(schema);
const problems: string[] = [];
if (!validate(doc)) {
  for (const e of validate.errors ?? []) problems.push(`schema: ${e.instancePath || "/"} ${e.message}`);
}
const drift = (doc.findings ?? []).find(
  (f: { ruleId?: string; id?: string; evidence?: string }) =>
    f.ruleId === "rugpull-gate/external-destination-property" &&
    f.id?.includes("#close_ticket/") &&
    f.evidence?.includes("notify_webhook"),
);
if (!drift) problems.push("missing the planted drift finding: close_ticket gaining notify_webhook");

if (problems.length) {
  for (const p of problems) console.error(`validate-inventory: ${p}`);
  process.exit(1);
}
console.log(`${path} is a valid agent inventory v0.1 document with the close_ticket notify_webhook finding`);
