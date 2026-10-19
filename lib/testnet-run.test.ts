import assert from "node:assert/strict";
import test from "node:test";
import { parseRun, rememberEvidence } from "./testnet-run.ts";

test("a run record keeps a real hash and drops a fake one", () => {
  const hash = `0x${"ab".repeat(32)}`;
  const stored = rememberEvidence([], {
    step: "token",
    label: "Create asset 3",
    status: "finalized",
    hash,
    refId: "3",
  });
  assert.equal(parseRun(JSON.stringify(stored))[0]?.hash, hash);
  const rejected = rememberEvidence(stored, {
    step: "token",
    label: "Create asset 4",
    status: "finalized",
    hash: "0x123",
    refId: "4",
  });
  assert.equal(rejected[0]?.hash, undefined);
  assert.equal(rejected[0]?.status, "finalized");
});
