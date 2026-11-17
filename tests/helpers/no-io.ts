// Preloaded with `node --import` by tests/no-io.test.ts. Every way Node offers to open a socket,
// look up a host or start a process is replaced by a trap that records the call and throws; on
// exit the process reports any trap that fired on stderr, so a caught throw can't hide one.

import { createRequire, syncBuiltinESMExports } from "node:module";

const require = createRequire(import.meta.url);
const fired: string[] = [];
const trap = (name: string) => () => {
  fired.push(name);
  throw new Error(`no-io: ${name} is blocked`);
};

const BLOCKED: Record<string, string[]> = {
  net: ["connect", "createConnection", "createServer"],
  tls: ["connect", "createServer"],
  http: ["request", "get", "createServer"],
  https: ["request", "get", "createServer"],
  http2: ["connect", "createServer"],
  dgram: ["createSocket"],
  dns: ["lookup", "resolve", "resolve4", "resolve6"],
  child_process: ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"],
  worker_threads: ["Worker"],
};
for (const [mod, names] of Object.entries(BLOCKED)) {
  const m = require(mod);
  for (const name of names) m[name] = trap(`${mod}.${name}`);
}
require("net").Socket.prototype.connect = trap("net.Socket.connect");
globalThis.fetch = trap("fetch");
globalThis.WebSocket = trap("WebSocket") as unknown as typeof WebSocket;
syncBuiltinESMExports();

process.on("exit", () => {
  if (fired.length > 0) process.stderr.write(`NO-IO VIOLATION: ${fired.join(", ")}\n`);
});
