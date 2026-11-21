// `npm run build`, after tsc: writes the demo to _site/. The page and its assets come from
// site/; the engine is the compiled core from dist/, copied unchanged into _site/engine/
// (ADR-001: one engine, no second copy in the repo). The CLI entry stays out of the page.

import { cpSync, readdirSync, readFileSync, rmSync } from "node:fs";

const root = new URL("../", import.meta.url);
const out = new URL("_site/", root);
const dist = new URL("dist/", root);

rmSync(out, { recursive: true, force: true });
cpSync(new URL("site/", root), out, { recursive: true });

const engine = readdirSync(dist).filter((f) => f.endsWith(".js") && f !== "cli.js");
for (const file of engine) {
  const text = readFileSync(new URL(file, dist), "utf8");
  // The browser can't load a Node built-in; fail the build rather than ship a broken page.
  if (/from\s+["']node:/.test(text)) throw new Error(`dist/${file} imports a Node built-in; the core must not (ADR-001)`);
  cpSync(new URL(file, dist), new URL(`engine/${file}`, out));
}
console.log(`Wrote _site/ with ${engine.length} engine modules`);
