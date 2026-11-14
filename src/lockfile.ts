// The mcp-tools.lock.json format. Pure: no Node built-ins (ADR-001).
//
// This format is a one-way door: once users commit a lock file, changing it forces a
// migration. Bump LOCK_VERSION for any change and say so in the PR.
//
// {
//   "lockVersion": 1,
//   "servers": {
//     "<server id>": {
//       "tools": {
//         "<tool name>": { "hash": "sha256:<hex>", "definition": { <canonical definition> } }
//       }
//     }
//   }
// }

import {
  canonicaliseTool,
  canonicalJson,
  hashDefinition,
  InputError,
  isObject,
  own,
  sortedKeys,
  type ToolDefinition,
} from "./canonical.ts";

export const LOCK_VERSION = 1;

export type LockedTool = { hash: string; definition: ToolDefinition };
export type ServerLock = { tools: Record<string, LockedTool> };
export type Lockfile = { lockVersion: number; servers: Record<string, ServerLock> };

export function emptyLockfile(): Lockfile {
  return { lockVersion: LOCK_VERSION, servers: Object.create(null) };
}

export async function lockServer(tools: ToolDefinition[]): Promise<ServerLock> {
  const locked: Record<string, LockedTool> = Object.create(null);
  for (const def of tools) locked[def.name] = { hash: await hashDefinition(def), definition: def };
  return { tools: locked };
}

/** Pretty-printed, sorted by server and tool name, so a lock diff in a PR is readable. */
export function serialiseLockfile(lock: Lockfile): string {
  const servers: Record<string, unknown> = Object.create(null);
  for (const id of Object.keys(lock.servers).sort()) {
    const tools: Record<string, LockedTool> = Object.create(null);
    const entry = lock.servers[id].tools;
    for (const name of Object.keys(entry).sort()) tools[name] = entry[name];
    servers[id] = { tools };
  }
  return `${JSON.stringify({ lockVersion: lock.lockVersion, servers }, null, 2)}\n`;
}

/** Parse and verify a lock file. Anything off is an InputError starting "corrupt lock file". */
export async function parseLockfile(text: string, label: string): Promise<Lockfile> {
  const corrupt = (why: string) => new InputError(`corrupt lock file ${label}: ${why}`);
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    throw corrupt("not valid JSON");
  }
  if (!isObject(doc)) throw corrupt("not a JSON object");
  const version = own(doc, "lockVersion");
  if (typeof version !== "number") throw corrupt('no "lockVersion"');
  if (version !== LOCK_VERSION) {
    throw corrupt(`lockVersion ${version} is not ${LOCK_VERSION}; it was written by another rugpull-gate version`);
  }
  const servers = own(doc, "servers");
  if (!isObject(servers)) throw corrupt('no "servers" object');
  const lock = emptyLockfile();
  for (const id of sortedKeys(servers)) {
    const server = servers[id];
    const tools = isObject(server) ? own(server, "tools") : undefined;
    if (!isObject(tools)) throw corrupt(`server ${JSON.stringify(id)} has no "tools" object`);
    const locked: Record<string, LockedTool> = Object.create(null);
    for (const name of sortedKeys(tools)) {
      const where = `server ${JSON.stringify(id)}, tool ${JSON.stringify(name)}`;
      const entry = tools[name];
      const hash = isObject(entry) ? own(entry, "hash") : undefined;
      const raw = isObject(entry) ? own(entry, "definition") : undefined;
      if (typeof hash !== "string" || !isObject(raw)) throw corrupt(`${where} needs "hash" and "definition"`);
      let def: ToolDefinition;
      try {
        def = canonicaliseTool(raw, where);
      } catch (e) {
        throw corrupt((e as Error).message);
      }
      if (def.name !== name) throw corrupt(`${where} has a definition named ${JSON.stringify(def.name)}`);
      if (canonicalJson(def) !== canonicalJson(raw)) throw corrupt(`${where} has a definition that is not canonical`);
      if ((await hashDefinition(def)) !== hash) {
        throw corrupt(`${where} has a hash that does not match its definition (edited by hand?)`);
      }
      locked[name] = { hash, definition: def };
    }
    lock.servers[id] = { tools: locked };
  }
  return lock;
}
