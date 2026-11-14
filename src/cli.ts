#!/usr/bin/env node
// The bin entry: argument parsing, file reads and writes, exit codes. Everything else is the
// pure core, which the browser demo imports too.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { InputError, parseToolsList } from "./canonical.ts";
import { checkServer } from "./diff.ts";
import { emptyLockfile, lockServer, parseLockfile, serialiseLockfile } from "./lockfile.ts";
import { formatText } from "./report.ts";
import { VERSION } from "./version.ts";

export const DEFAULT_LOCK = "mcp-tools.lock.json";

const USAGE = `rugpull-gate ${VERSION}

Usage:
  rugpull-gate lock <tools-list.json> --server <id> [--lock <path>]
  rugpull-gate check <tools-list.json> [--server <id>] [--lock <path>]

lock   writes the hash and definition of every tool to the lock file (${DEFAULT_LOCK})
check  reports each tool as unchanged, cosmetic-only, changed, new or removed;
       exits 1 when any tool is changed, new or removed, 2 on bad input`;

export type RunResult = { code: number; stdout: string; stderr: string };

/** Read a file as text, or undefined when it doesn't exist. */
function readText(path: string, label: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new InputError(`cannot read ${label}: ${(e as Error).message}`);
  }
}

function readToolsList(path: string, cwd: string) {
  const text = readText(resolve(cwd, path), path);
  if (text === undefined) throw new InputError(`${path} not found`);
  return parseToolsList(text, path);
}

export async function run(argv: string[], cwd = process.cwd()): Promise<RunResult> {
  try {
    let parsed;
    try {
      parsed = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
          server: { type: "string" },
          lock: { type: "string", default: DEFAULT_LOCK },
          version: { type: "boolean" },
          help: { type: "boolean", short: "h" },
        },
      });
    } catch (e) {
      throw new InputError(`${(e as Error).message}\n\n${USAGE}`);
    }
    const { values, positionals } = parsed;
    if (values.version) return { code: 0, stdout: `rugpull-gate ${VERSION}\n`, stderr: "" };
    const [command, input, ...extra] = positionals;
    if (values.help || command === undefined) return { code: 0, stdout: `${USAGE}\n`, stderr: "" };
    if (command !== "lock" && command !== "check") throw new InputError(`unknown command "${command}"\n\n${USAGE}`);
    if (input === undefined) throw new InputError(`${command} needs a tools/list JSON file\n\n${USAGE}`);
    if (extra.length > 0) throw new InputError(`unexpected argument "${extra[0]}"`);

    const lockLabel = values.lock;
    const lockPath = resolve(cwd, lockLabel);
    const lockText = readText(lockPath, lockLabel);

    if (command === "lock") {
      if (!values.server) throw new InputError("lock needs --server <id>");
      // Parse the existing lock before anything else: a corrupt one is refused, never overwritten.
      let lock;
      try {
        lock = lockText === undefined ? emptyLockfile() : await parseLockfile(lockText, lockLabel);
      } catch (e) {
        throw new InputError(`${(e as Error).message}; refusing to overwrite it`);
      }
      const tools = readToolsList(input, cwd);
      lock.servers[values.server] = await lockServer(tools);
      writeFileSync(lockPath, serialiseLockfile(lock));
      return {
        code: 0,
        stdout: `Locked ${tools.length} tools for server ${values.server} in ${lockLabel}\n`,
        stderr: "",
      };
    }

    if (lockText === undefined) throw new InputError(`${lockLabel} not found; run "rugpull-gate lock" first`);
    const lock = await parseLockfile(lockText, lockLabel);
    const ids = Object.keys(lock.servers);
    let server = values.server;
    if (server === undefined) {
      if (ids.length !== 1) {
        throw new InputError(`${lockLabel} holds ${ids.length} servers; pick one with --server (${ids.join(", ")})`);
      }
      server = ids[0];
    } else if (!Object.hasOwn(lock.servers, server)) {
      throw new InputError(`${lockLabel} has no server "${server}" (it has: ${ids.join(", ") || "none"})`);
    }
    const results = await checkServer(lock.servers[server], readToolsList(input, cwd));
    const drift = results.some((r) => r.status === "changed" || r.status === "new" || r.status === "removed");
    return { code: drift ? 1 : 0, stdout: formatText(server, lockLabel, results), stderr: "" };
  } catch (e) {
    // Bad input gets one line (plus usage where it helps), never a stack trace.
    const message = e instanceof InputError ? e.message : `unexpected error: ${(e as Error).message}`;
    return { code: 2, stdout: "", stderr: `rugpull-gate: ${message}\n` };
  }
}

if (import.meta.main) {
  const { code, stdout, stderr } = await run(process.argv.slice(2));
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  process.exitCode = code;
}
