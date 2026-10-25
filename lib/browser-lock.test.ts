import assert from "node:assert/strict";
import test from "node:test";
import { acquireLease, type LockProvider } from "./browser-lock.ts";
function locks(): LockProvider {
  const held = new Set<string>();
  return { async request(name, _options, callback) {
    if (held.has(name)) return callback(null);
    held.add(name); try { return await callback({ name }); } finally { held.delete(name); }
  } };
}
test("two launch tabs cannot hold the same signing lease", async () => {
  const manager = locks(), first = await acquireLease("wallet:network", manager);
  await assert.rejects(acquireLease("wallet:network", manager), /Another tab/);
  const other = await acquireLease("different-wallet", manager); await other.release();
  await first.release();
  const resumed = await acquireLease("wallet:network", manager); await resumed.release();
});
test("unsupported coordination fails before any launch callback can sign", async () => {
  await assert.rejects(acquireLease("wallet:network", undefined), /cannot coordinate/);
});
