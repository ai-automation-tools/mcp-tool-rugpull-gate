#!/usr/bin/env node
// The bin entry: argument parsing, file reads and writes, exit codes. Everything else is the
// pure core, which the browser demo imports too.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { hashDefinition, InputError, parseToolsList } from "./canonical.ts";
import { checkServer } from "./diff.ts";
import { formatInventory } from "./inventory.ts";
import { emptyLockfile, lockServer, parseLockfile, serialiseLockfile, type Lockfile } from "./lockfile.ts";
import { formatJson, formatText, highestRisk } from "./report.ts";
import { rank, type Risk } from "./risk.ts";
import { VERSION } from "./version.ts";

export const DEFAULT_LOCK = "mcp-tools.lock.json";
const FORMATS = ["text", "json", "inventory"];
const FAIL_ON = ["low", "medium", "high"];

const USAGE = `rugpull-gate ${VERSION}

Usage:
  rugpull-gate lock <tools-list.json> --server <id> [--lock <path>]
  rugpull-gate check <tools-list.json> [--server <id>] [--lock <path>]
                     [--fail-on low|medium|high] [--format text|json|inventory]
  rugpull-gate approve <tool> <tools-list.json> [--server <id>] [--lock <path>]

lock     writes the hash and definition of every tool to the lock file (${DEFAULT_LOCK})
check    reports each tool as unchanged, cosmetic-only, changed, new or removed, with a risk
         level and the reason for it; exits 1 when any tool's risk is at or above --fail-on
         (default low; a title-only change is risk none and never counts), 2 on bad input
approve  accepts one tool's definition from <tools-list.json> into the lock, or drops it
         from the lock if the tools/list no longer has it; every other entry is left as is`;

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

/** The server to check or approve: --server, or the lock's only one. */
function pickServer(lock: Lockfile, lockLabel: string, server: string | undefined): string {
  const ids = Object.keys(lock.servers);
  if (server === undefined) {
    if (ids.length !== 1) {
      throw new InputError(`${lockLabel} holds ${ids.length} servers; pick one with --server (${ids.join(", ")})`);
    }
    return ids[0];
  }
  if (!Object.hasOwn(lock.servers, server)) {
    throw new InputError(`${lockLabel} has no server "${server}" (it has: ${ids.join(", ") || "none"})`);
  }
  return server;
}

export async function run(argv: string[], cwd = process.cwd(), now = new Date()): Promise<RunResult> {
  try {
    let parsed;
    try {
      parsed = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
          server: { type: "string" },
          lock: { type: "string", default: DEFAULT_LOCK },
          format: { type: "string", default: "text" },
          "fail-on": { type: "string", default: "low" },
          version: { type: "boolean" },
          help: { type: "boolean", short: "h" },
        },
      });
    } catch (e) {
      throw new InputError(`${(e as Error).message}\n\n${USAGE}`);
    }
    const { values, positionals } = parsed;
    if (values.version) return { code: 0, stdout: `rugpull-gate ${VERSION}\n`, stderr: "" };
    const [command, ...args] = positionals;
    if (values.help || command === undefined) return { code: 0, stdout: `${USAGE}\n`, stderr: "" };
    if (command !== "lock" && command !== "check" && command !== "approve") {
      throw new InputError(`unknown command "${command}"\n\n${USAGE}`);
    }
    const wanted = command === "approve" ? 2 : 1;
    if (args.length < wanted) {
      const what = command === "approve" ? "a tool name and a tools/list JSON file" : "a tools/list JSON file";
      throw new InputError(`${command} needs ${what}\n\n${USAGE}`);
    }
    if (args.length > wanted) throw new InputError(`unexpected argument "${args[wanted]}"`);
    if (!FORMATS.includes(values.format)) throw new InputError(`--format must be one of ${FORMATS.join(", ")}`);
    if (!FAIL_ON.includes(values["fail-on"])) throw new InputError(`--fail-on must be one of ${FAIL_ON.join(", ")}`);

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
      const tools = readToolsList(args[0], cwd);
      lock.servers[values.server] = await lockServer(tools);
      writeFileSync(lockPath, serialiseLockfile(lock));
      return {
        code: 0,
        stdout: `Locked ${tools.length} tools for server ${values.server} in ${lockLabel}\n`,
        stderr: "",
      };
    }

    if (lockText === undefined) throw new InputError(`${lockLabel} not found; run "rugpull-gate lock" first`);

    if (command === "approve") {
      const [tool, input] = args;
      let lock;
      try {
        lock = await parseLockfile(lockText, lockLabel);
      } catch (e) {
        throw new InputError(`${(e as Error).message}; refusing to overwrite it`);
      }
      const server = pickServer(lock, lockLabel, values.server);
      const entries = lock.servers[server].tools;
      const def = readToolsList(input, cwd).find((t) => t.name === tool);
      const locked = Object.hasOwn(entries, tool) ? entries[tool] : undefined;
      let message;
      if (def) {
        const hash = await hashDefinition(def);
        if (locked?.hash === hash) {
          return { code: 0, stdout: `${tool} already matches ${lockLabel}; nothing to approve\n`, stderr: "" };
        }
        entries[tool] = { hash, definition: def };
        message = `Approved ${locked ? "the new definition of" : "new tool"} ${tool} for server ${server} in ${lockLabel}`;
      } else if (locked) {
        delete entries[tool];
        message = `Dropped ${tool} from server ${server} in ${lockLabel}; ${input} no longer lists it`;
      } else {
        throw new InputError(`tool "${tool}" is in neither ${lockLabel} (server ${server}) nor ${input}`);
      }
      writeFileSync(lockPath, serialiseLockfile(lock));
      return { code: 0, stdout: `${message}\n`, stderr: "" };
    }

    const lock = await parseLockfile(lockText, lockLabel);
    const server = pickServer(lock, lockLabel, values.server);
    const input = args[0];
    const results = await checkServer(lock.servers[server], readToolsList(input, cwd));
    const failOn = values["fail-on"] as Risk;
    // A title-only change is risk none, so it never reaches any --fail-on level.
    const fail = rank(highestRisk(results)) >= rank(failOn);
    const stdout =
      values.format === "json"
        ? formatJson(server, lockLabel, results)
        : values.format === "inventory"
          ? formatInventory(results, { server, lock: lockLabel, input, version: VERSION, now })
          : formatText(server, lockLabel, results);
    return { code: fail ? 1 : 0, stdout, stderr: "" };
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
