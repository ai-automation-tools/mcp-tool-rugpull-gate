// The CLI runs with every socket, DNS and process API trapped (tests/helpers/no-io.ts) and must
// still lock, check in every format, and approve without tripping one. This test spawns `node`
// itself to get a clean process; rugpull-gate's own code never does.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const helper = new URL("./helpers/no-io.ts", import.meta.url).href;
const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
const fixture = (name: string) => fileURLToPath(new URL(`fixtures/${name}`, import.meta.url));

function node(args: string[], cwd: string) {
  return spawnSync(process.execPath, ["--import", helper, ...args], { cwd, encoding: "utf8" });
}

test("the trap works: a socket, a fetch or a child process under it is reported", () => {
  const r = node(
    ["--input-type=module", "-e", "import net from 'node:net'; import https from 'node:https'; import cp from 'node:child_process'; try { net.connect(80) } catch {} try { https.get('https://x.test') } catch {} try { cp.spawnSync('x') } catch {} try { await fetch('http://x.test') } catch {}"],
    tmpdir(),
  );
  assert.match(r.stderr, /NO-IO VIOLATION: net\.connect, https\.get, child_process\.spawnSync, fetch/);
});

test("the CLI locks, checks and approves with sockets and processes blocked", () => {
  const dir = mkdtempSync(join(tmpdir(), "rugpull-gate-noio-"));
  const v1 = fixture("helpdesk-v1.json");
  const v2 = fixture("helpdesk-v2.json");
  const runs = [
    node([cli, "lock", v1, "--server", "fernhill-helpdesk"], dir),
    node([cli, "check", v2], dir),
    node([cli, "check", v2, "--format", "json"], dir),
    node([cli, "check", v2, "--format", "inventory"], dir),
    node([cli, "approve", "close_ticket", v2], dir),
    node([cli, "check", fixture("input-malformed.json")], dir),
  ];
  for (const r of runs) {
    assert.doesNotMatch(r.stderr, /NO-IO VIOLATION/);
    assert.equal(r.error, undefined);
  }
  assert.deepEqual(runs.map((r) => r.status), [0, 1, 1, 1, 0, 2]);
  assert.match(runs[1].stdout, /close_ticket {2}\[risk high\]/);
  assert.equal(JSON.parse(runs[3].stdout).schemaVersion, "0.1");
});
